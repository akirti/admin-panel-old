"""
Centralized System Logging Service — file-based logging for PCF pods.

Configures Python's logging module with RotatingFileHandler for structured
JSON logs. Runs alongside (not replacing) the existing ErrorLogService/MongoDB flow.
"""
import os
import re
import gzip
import json
import uuid
import logging
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

_file_executor = ThreadPoolExecutor(max_workers=2)

DEFAULT_LOG_CONFIG = {
    "log_level": "INFO",
    "log_dir": "./logs/system",
    "log_filename": "system.log",
    "max_file_size_mb": 10,
    "backup_count": 5,
    "gcs_prefix": "system_logs",
    "json_format": True,
}


class JsonFormatter(logging.Formatter):
    """Structured JSON log formatter."""

    def format(self, record):
        log_entry = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)
        # Attach extra fields from log_route decorator
        for key in ("request_method", "request_path", "request_ip",
                     "response_status", "duration_ms", "user_email"):
            if hasattr(record, key):
                log_entry[key] = getattr(record, key)
        return json.dumps(log_entry, default=str)


class SystemLogService:
    """Configures centralized Python logging and provides log file access."""

    def __init__(self, config: Optional[Dict[str, Any]] = None, gcs_service=None):
        self.config = {**DEFAULT_LOG_CONFIG, **(config or {})}
        self.gcs_service = gcs_service
        self._file_lock = asyncio.Lock()

        self.log_dir = Path(self.config["log_dir"])
        self.log_file = self.log_dir / self.config["log_filename"]
        self.log_level = getattr(logging, self.config["log_level"].upper(), logging.INFO)
        self.max_file_size = int(self.config["max_file_size_mb"] * 1024 * 1024)
        self.backup_count = int(self.config["backup_count"])

        self._ensure_dir()
        self._configure_logging()

    def _ensure_dir(self):
        try:
            self.log_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print(f"Failed to create system log dir: {e}")

    def _configure_logging(self):
        """Set up root logger with RotatingFileHandler + JSON formatter."""
        root = logging.getLogger()
        # Set root level to our config level (if not already lower)
        if root.level == logging.WARNING or root.level > self.log_level:
            root.setLevel(self.log_level)

        # Remove any existing RotatingFileHandler we may have added before
        for h in root.handlers[:]:
            if isinstance(h, RotatingFileHandler) and "system.log" in str(getattr(h, "baseFilename", "")):
                root.removeHandler(h)

        # Add our handler
        handler = RotatingFileHandler(
            filename=str(self.log_file),
            maxBytes=self.max_file_size,
            backupCount=self.backup_count,
            encoding="utf-8",
        )
        handler.setLevel(self.log_level)

        if self.config.get("json_format", True):
            handler.setFormatter(JsonFormatter())
        else:
            handler.setFormatter(logging.Formatter(
                "%(asctime)s [%(levelname)s] %(name)s:%(funcName)s:%(lineno)d - %(message)s"
            ))

        root.addHandler(handler)
        logger.info("System logging configured: level=%s dir=%s max=%sMB backups=%d",
                     self.config["log_level"], self.log_dir, self.config["max_file_size_mb"],
                     self.backup_count)

    def get_config_info(self) -> Dict[str, Any]:
        """Return current logging config for admin UI."""
        return {
            "log_level": self.config["log_level"],
            "log_dir": str(self.log_dir.absolute()),
            "log_filename": self.config["log_filename"],
            "max_file_size_mb": self.config["max_file_size_mb"],
            "backup_count": self.backup_count,
            "json_format": self.config.get("json_format", True),
            "gcs_prefix": self.config["gcs_prefix"],
        }

    # --- File reading ---

    def _sync_list_log_files(self) -> List[Dict[str, Any]]:
        """List all log files (current + rotated backups)."""
        files = []
        try:
            for f in sorted(self.log_dir.iterdir()):
                if f.name.startswith(self.config["log_filename"].split(".")[0]):
                    stat = f.stat()
                    files.append({
                        "name": f.name,
                        "size_bytes": stat.st_size,
                        "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                    })
        except Exception as e:
            logger.error("Failed to list log files: %s", e)
        return files

    async def list_log_files(self) -> List[Dict[str, Any]]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(_file_executor, self._sync_list_log_files)

    def _sync_read_log(self, filename: str, tail_lines: int = 200,
                       level_filter: Optional[str] = None,
                       search: Optional[str] = None) -> List[Dict[str, Any]]:
        """Read and optionally filter a log file. Returns parsed JSON entries (newest first)."""
        filepath = self.log_dir / filename
        if not filepath.exists() or not filepath.is_relative_to(self.log_dir):
            return []
        entries = []
        try:
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
            for line in lines[-(tail_lines * 3):]:  # read extra to account for filtering
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    entry = {"timestamp": "", "level": "INFO", "message": line, "raw": True}
                if level_filter and entry.get("level", "").upper() != level_filter.upper():
                    continue
                if search and search.lower() not in json.dumps(entry).lower():
                    continue
                entries.append(entry)
            return list(reversed(entries[-tail_lines:]))
        except Exception as e:
            logger.error("Failed to read log file %s: %s", filename, e)
            return []

    async def read_log(self, filename: str, tail_lines: int = 200,
                       level_filter: Optional[str] = None,
                       search: Optional[str] = None) -> Dict[str, Any]:
        loop = asyncio.get_event_loop()
        entries = await loop.run_in_executor(
            _file_executor, self._sync_read_log, filename, tail_lines, level_filter, search
        )
        return {"entries": entries, "count": len(entries), "filename": filename}

    def _sync_read_raw(self, filename: str) -> Optional[bytes]:
        """Read raw file content for download."""
        filepath = self.log_dir / filename
        if not filepath.exists() or not filepath.is_relative_to(self.log_dir):
            return None
        try:
            return filepath.read_bytes()
        except Exception as e:
            logger.error("Failed to read raw log %s: %s", filename, e)
            return None

    async def download_log(self, filename: str) -> Optional[bytes]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(_file_executor, self._sync_read_raw, filename)

    # --- GCS push ---

    async def push_to_gcs(self, filename: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Compress and push a log file (or current) to GCS errors/ folder."""
        if not self.gcs_service or not self.gcs_service.is_configured():
            return None

        target = filename or self.config["log_filename"]
        filepath = self.log_dir / target
        if not filepath.exists():
            return None

        loop = asyncio.get_event_loop()
        raw = await loop.run_in_executor(_file_executor, self._sync_read_raw, target)
        if not raw:
            return None

        compressed = gzip.compress(raw)
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
        archive_id = uuid.uuid4().hex[:8]
        gcs_path = f"errors/{self.config['gcs_prefix']}_{ts}_{archive_id}.log.gz"

        gcs_uri = await self.gcs_service.upload_file(
            file_content=compressed,
            destination_path=gcs_path,
            content_type="application/gzip",
        )
        if not gcs_uri:
            return None

        return {
            "gcs_uri": gcs_uri,
            "gcs_path": gcs_path,
            "original_size": len(raw),
            "compressed_size": len(compressed),
            "source_file": target,
            "pushed_at": datetime.now(timezone.utc).isoformat(),
        }


# --- Singleton ---

_system_log_service: Optional[SystemLogService] = None


def init_system_log_service(config: Optional[Dict[str, Any]] = None,
                            gcs_service=None) -> SystemLogService:
    global _system_log_service
    _system_log_service = SystemLogService(config=config, gcs_service=gcs_service)
    return _system_log_service


def get_system_log_service() -> Optional[SystemLogService]:
    return _system_log_service
