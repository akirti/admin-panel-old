"""
Error Logging Service - Captures application errors with file storage and GCS archival.

Features:
- Logs errors to local JSONL file and MongoDB
- Auto-archives to GCS when file reaches 5MB threshold
- Provides admin API for viewing, downloading, and managing logs
"""
import os
import gzip
import json
import uuid
import asyncio
import logging
import traceback
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

from ..db.db_manager import DatabaseManager
from .gcs_service import GCSService

logger = logging.getLogger(__name__)

# Thread pool for file operations
_file_executor = ThreadPoolExecutor(max_workers=2)

# Default configuration
DEFAULT_CONFIG = {
    "log_dir": "./logs",
    "max_file_size_mb": 5,
    "archive_prefix": "error_logs",
    "mongodb_ttl_days": 30,
    "compress_archives": True,
    "current_log_filename": "errors_current.jsonl"
}


class ErrorLogEntry:
    """Represents a single error log entry."""

    def __init__(
        self,
        level: str,
        error_type: str,
        message: str,
        stack_trace: Optional[str] = None,
        request_context: Optional[Dict[str, Any]] = None,
        additional_data: Optional[Dict[str, Any]] = None,
        timestamp: Optional[datetime] = None
    ):
        self.timestamp = timestamp or datetime.now(timezone.utc)
        self.level = level.upper()
        self.error_type = error_type
        self.message = message
        self.stack_trace = stack_trace
        self.request_context = request_context or {}
        self.additional_data = additional_data or {}

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        return {
            "timestamp": self.timestamp.isoformat(),
            "level": self.level,
            "error_type": self.error_type,
            "message": self.message,
            "stack_trace": self.stack_trace,
            "request_context": self.request_context,
            "additional_data": self.additional_data
        }

    def to_mongodb_doc(self) -> Dict[str, Any]:
        """Convert to MongoDB document format."""
        return {
            "timestamp": self.timestamp,
            "level": self.level,
            "error_type": self.error_type,
            "message": self.message,
            "stack_trace": self.stack_trace,
            "request_context": self.request_context,
            "additional_data": self.additional_data,
            "created_at": datetime.now(timezone.utc)
        }

    @classmethod
    def from_exception(
        cls,
        exc: Exception,
        level: str = "ERROR",
        request_context: Optional[Dict[str, Any]] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> "ErrorLogEntry":
        """Create entry from an exception."""
        return cls(
            level=level,
            error_type=type(exc).__name__,
            message=str(exc),
            stack_trace=traceback.format_exc(),
            request_context=request_context,
            additional_data=additional_data
        )


class ErrorLogService:
    """Service for logging errors with file storage and GCS archival."""

    def __init__(
        self,
        db: DatabaseManager,
        gcs_service: Optional[GCSService] = None,
        config: Optional[Dict[str, Any]] = None
    ):
        self.db = db
        self.gcs_service = gcs_service
        self.config = {**DEFAULT_CONFIG, **(config or {})}

        # File paths
        self.log_dir = Path(self.config["log_dir"])
        self.current_log_path = self.log_dir / self.config["current_log_filename"]

        # Async lock for file operations
        self._file_lock = asyncio.Lock()

        # Ensure log directory exists
        self._ensure_log_dir()

    def _ensure_log_dir(self):
        """Create log directory if it doesn't exist."""
        try:
            self.log_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"Error log directory: {self.log_dir.absolute()}")
        except Exception as e:
            logger.error(f"Failed to create log directory: {e}")

    def _get_file_size_mb(self) -> float:
        """Get current log file size in MB."""
        try:
            if self.current_log_path.exists():
                return self.current_log_path.stat().st_size / (1024 * 1024)
            return 0.0
        except Exception:
            return 0.0

    def _sync_write_to_file(self, json_line: str) -> bool:
        """Synchronous file write operation."""
        try:
            with open(self.current_log_path, "a", encoding="utf-8") as f:
                f.write(json_line + "\n")
            return True
        except Exception as e:
            logger.error(f"Failed to write to error log file: {e}")
            return False

    async def _write_to_file(self, entry: ErrorLogEntry) -> bool:
        """Write error entry to local file."""
        json_line = json.dumps(entry.to_dict(), default=str)
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _file_executor,
            self._sync_write_to_file,
            json_line
        )

    async def _write_to_mongodb(self, entry: ErrorLogEntry) -> Optional[str]:
        """Write error entry to MongoDB."""
        if not hasattr(self.db, 'error_logs') or self.db.error_logs is None:
            return None

        try:
            doc = entry.to_mongodb_doc()
            result = await self.db.error_logs.insert_one(doc)
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to write error to MongoDB: {e}")
            return None

    def _sync_read_current_log(self, limit: int) -> List[Dict[str, Any]]:
        """Synchronous read of current log file (tail)."""
        try:
            if not self.current_log_path.exists():
                return []

            lines = []
            with open(self.current_log_path, "r", encoding="utf-8") as f:
                # Read all lines and get last N
                all_lines = f.readlines()
                for line in all_lines[-limit:]:
                    try:
                        lines.append(json.loads(line.strip()))
                    except json.JSONDecodeError:
                        continue
            return list(reversed(lines))  # Most recent first
        except Exception as e:
            logger.error(f"Failed to read current log file: {e}")
            return []

    def _sync_archive_to_gcs(self, local_path: Path) -> Optional[Dict[str, Any]]:
        """Synchronous archive operation - compress and upload to GCS."""
        try:
            if not local_path.exists():
                return None

            # Read file content
            with open(local_path, "rb") as f:
                original_content = f.read()

            original_size = len(original_content)

            # Count errors and get date range
            error_count = 0
            first_timestamp = None
            last_timestamp = None

            for line in original_content.decode("utf-8").strip().split("\n"):
                if line:
                    try:
                        entry = json.loads(line)
                        error_count += 1
                        ts = entry.get("timestamp")
                        if ts:
                            if first_timestamp is None:
                                first_timestamp = ts
                            last_timestamp = ts
                    except json.JSONDecodeError:
                        continue

            # Compress content
            if self.config["compress_archives"]:
                compressed_content = gzip.compress(original_content)
                compressed_size = len(compressed_content)
                extension = ".jsonl.gz"
            else:
                compressed_content = original_content
                compressed_size = original_size
                extension = ".jsonl"

            # Generate archive filename
            archive_id = uuid.uuid4().hex[:8]
            timestamp_str = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
            filename = f"errors_{timestamp_str}_{archive_id}{extension}"
            gcs_path = f"{self.config['archive_prefix']}/{filename}"

            return {
                "archive_id": archive_id,
                "gcs_path": gcs_path,
                "filename": filename,
                "compressed_content": compressed_content,
                "original_size": original_size,
                "compressed_size": compressed_size,
                "error_count": error_count,
                "date_range": {
                    "start": first_timestamp,
                    "end": last_timestamp
                }
            }
        except Exception as e:
            logger.error(f"Failed to prepare archive: {e}")
            return None

    async def _check_and_archive(self) -> Optional[Dict[str, Any]]:
        """Check file size and archive if threshold reached."""
        current_size_mb = self._get_file_size_mb()

        if current_size_mb < self.config["max_file_size_mb"]:
            return None

        if not self.gcs_service or not self.gcs_service.is_configured():
            logger.warning("GCS not configured, cannot archive error logs")
            return None

        async with self._file_lock:
            # Double-check size after acquiring lock
            current_size_mb = self._get_file_size_mb()
            if current_size_mb < self.config["max_file_size_mb"]:
                return None

            logger.info(f"Error log file reached {current_size_mb:.2f}MB, archiving to GCS...")

            # Prepare archive in thread pool
            loop = asyncio.get_event_loop()
            archive_data = await loop.run_in_executor(
                _file_executor,
                self._sync_archive_to_gcs,
                self.current_log_path
            )

            if not archive_data:
                return None

            # Upload to GCS
            content_type = "application/gzip" if self.config["compress_archives"] else "application/x-ndjson"
            gcs_uri = await self.gcs_service.upload_file(
                file_content=archive_data["compressed_content"],
                destination_path=archive_data["gcs_path"],
                content_type=content_type
            )

            if not gcs_uri:
                logger.error("Failed to upload archive to GCS")
                return None

            # Save archive metadata to MongoDB
            archive_metadata = {
                "archive_id": archive_data["archive_id"],
                "gcs_path": archive_data["gcs_path"],
                "bucket_name": self.gcs_service.bucket_name,
                "file_name": archive_data["filename"],
                "original_size": archive_data["original_size"],
                "compressed_size": archive_data["compressed_size"],
                "error_count": archive_data["error_count"],
                "date_range": archive_data["date_range"],
                "created_at": datetime.now(timezone.utc)
            }

            if hasattr(self.db, 'error_log_archives') and self.db.error_log_archives is not None:
                try:
                    await self.db.error_log_archives.insert_one(archive_metadata)
                except Exception as e:
                    logger.error(f"Failed to save archive metadata: {e}")

            # Clear the current log file
            try:
                self.current_log_path.unlink()
                logger.info(f"Archived error log to GCS: {gcs_uri}")
            except Exception as e:
                logger.error(f"Failed to clear current log file: {e}")

            return archive_metadata

    async def log_error(
        self,
        error: Exception,
        request: Any = None,
        level: str = "ERROR",
        additional_data: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Log an error from an exception.

        Args:
            error: The exception to log
            request: FastAPI Request object (optional)
            level: Log level (ERROR, WARNING, CRITICAL)
            additional_data: Extra data to include

        Returns:
            MongoDB document ID if stored, None otherwise
        """
        # Extract request context if available
        request_context = {}
        if request:
            try:
                request_context = {
                    "method": request.method,
                    "path": str(request.url.path),
                    "query": str(request.url.query) if request.url.query else None,
                    "ip_address": request.client.host if request.client else None,
                    "user_agent": request.headers.get("user-agent"),
                }

                # Try to get user info from state (if set by auth middleware)
                if hasattr(request, "state"):
                    if hasattr(request.state, "user_email"):
                        request_context["user_email"] = request.state.user_email
                    if hasattr(request.state, "user_id"):
                        request_context["user_id"] = request.state.user_id
            except Exception:
                pass

        entry = ErrorLogEntry.from_exception(
            exc=error,
            level=level,
            request_context=request_context,
            additional_data=additional_data
        )

        # Write to both file and MongoDB
        async with self._file_lock:
            await self._write_to_file(entry)

        mongo_id = await self._write_to_mongodb(entry)

        # Check if archival is needed (non-blocking)
        asyncio.create_task(self._check_and_archive())

        return mongo_id

    async def log_message(
        self,
        level: str,
        error_type: str,
        message: str,
        stack_trace: Optional[str] = None,
        request_context: Optional[Dict[str, Any]] = None,
        additional_data: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """Log an error message directly (not from exception)."""
        entry = ErrorLogEntry(
            level=level,
            error_type=error_type,
            message=message,
            stack_trace=stack_trace,
            request_context=request_context,
            additional_data=additional_data
        )

        async with self._file_lock:
            await self._write_to_file(entry)

        mongo_id = await self._write_to_mongodb(entry)

        # Check if archival is needed
        asyncio.create_task(self._check_and_archive())

        return mongo_id

    async def get_current_logs(
        self,
        limit: int = 100,
        offset: int = 0,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Get error logs from MongoDB with pagination and filtering."""
        if not hasattr(self.db, 'error_logs') or self.db.error_logs is None:
            return {"logs": [], "total": 0, "page": 0, "limit": limit}

        # Build query
        query = {}
        if filters:
            if filters.get("level"):
                query["level"] = filters["level"].upper()
            if filters.get("error_type"):
                query["error_type"] = {"$regex": filters["error_type"], "$options": "i"}
            if filters.get("search"):
                query["$or"] = [
                    {"message": {"$regex": filters["search"], "$options": "i"}},
                    {"error_type": {"$regex": filters["search"], "$options": "i"}},
                    {"stack_trace": {"$regex": filters["search"], "$options": "i"}}
                ]
            if filters.get("start_date"):
                query["timestamp"] = {"$gte": filters["start_date"]}
            if filters.get("end_date"):
                if "timestamp" in query:
                    query["timestamp"]["$lte"] = filters["end_date"]
                else:
                    query["timestamp"] = {"$lte": filters["end_date"]}
            if filters.get("days"):
                cutoff = datetime.now(timezone.utc) - timedelta(days=int(filters["days"]))
                query["timestamp"] = {"$gte": cutoff}

        try:
            # Get total count
            total = await self.db.error_logs.count_documents(query)

            # Get paginated results
            cursor = self.db.error_logs.find(query).sort("timestamp", -1).skip(offset).limit(limit)
            logs = []
            async for doc in cursor:
                doc["_id"] = str(doc["_id"])
                if "timestamp" in doc and isinstance(doc["timestamp"], datetime):
                    doc["timestamp"] = doc["timestamp"].isoformat()
                if "created_at" in doc and isinstance(doc["created_at"], datetime):
                    doc["created_at"] = doc["created_at"].isoformat()
                logs.append(doc)

            return {
                "logs": logs,
                "total": total,
                "page": offset // limit if limit > 0 else 0,
                "limit": limit
            }
        except Exception as e:
            logger.error(f"Failed to get error logs: {e}")
            return {"logs": [], "total": 0, "page": 0, "limit": limit, "error": str(e)}

    async def get_stats(self, days: int = 7) -> Dict[str, Any]:
        """Get error statistics."""
        if not hasattr(self.db, 'error_logs') or self.db.error_logs is None:
            return {}

        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)

            # Total count
            total = await self.db.error_logs.count_documents({"timestamp": {"$gte": cutoff}})

            # By level
            level_pipeline = [
                {"$match": {"timestamp": {"$gte": cutoff}}},
                {"$group": {"_id": "$level", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}
            ]
            levels = {}
            async for doc in self.db.error_logs.aggregate(level_pipeline):
                levels[doc["_id"]] = doc["count"]

            # By error type (top 10)
            type_pipeline = [
                {"$match": {"timestamp": {"$gte": cutoff}}},
                {"$group": {"_id": "$error_type", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": 10}
            ]
            types = []
            async for doc in self.db.error_logs.aggregate(type_pipeline):
                types.append({"type": doc["_id"], "count": doc["count"]})

            # Timeline (daily)
            timeline_pipeline = [
                {"$match": {"timestamp": {"$gte": cutoff}}},
                {"$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                    "count": {"$sum": 1}
                }},
                {"$sort": {"_id": 1}}
            ]
            timeline = []
            async for doc in self.db.error_logs.aggregate(timeline_pipeline):
                timeline.append({"date": doc["_id"], "count": doc["count"]})

            return {
                "total": total,
                "days": days,
                "by_level": levels,
                "by_type": types,
                "timeline": timeline
            }
        except Exception as e:
            logger.error(f"Failed to get error stats: {e}")
            return {"error": str(e)}

    async def get_levels(self) -> List[str]:
        """Get distinct log levels."""
        if not hasattr(self.db, 'error_logs') or self.db.error_logs is None:
            return ["ERROR", "WARNING", "CRITICAL"]

        try:
            levels = await self.db.error_logs.distinct("level")
            return sorted(levels) if levels else ["ERROR", "WARNING", "CRITICAL"]
        except Exception:
            return ["ERROR", "WARNING", "CRITICAL"]

    async def get_error_types(self) -> List[str]:
        """Get distinct error types."""
        if not hasattr(self.db, 'error_logs') or self.db.error_logs is None:
            return []

        try:
            types = await self.db.error_logs.distinct("error_type")
            return sorted(types) if types else []
        except Exception:
            return []

    async def get_current_file_content(self, lines: int = 100) -> Dict[str, Any]:
        """Get content from current log file (for live view)."""
        loop = asyncio.get_event_loop()
        entries = await loop.run_in_executor(
            _file_executor,
            self._sync_read_current_log,
            lines
        )

        return {
            "entries": entries,
            "file_size_mb": self._get_file_size_mb(),
            "file_path": str(self.current_log_path),
            "max_size_mb": self.config["max_file_size_mb"]
        }

    async def get_archived_files(self) -> List[Dict[str, Any]]:
        """Get list of archived files from MongoDB."""
        if not hasattr(self.db, 'error_log_archives') or self.db.error_log_archives is None:
            return []

        try:
            cursor = self.db.error_log_archives.find().sort("created_at", -1)
            archives = []
            async for doc in cursor:
                doc["_id"] = str(doc["_id"])
                if "created_at" in doc and isinstance(doc["created_at"], datetime):
                    doc["created_at"] = doc["created_at"].isoformat()
                if "date_range" in doc:
                    # Keep as-is, already strings
                    pass
                archives.append(doc)
            return archives
        except Exception as e:
            logger.error(f"Failed to get archived files: {e}")
            return []

    async def get_archive_download_url(
        self,
        archive_id: str,
        expiration_minutes: int = 60
    ) -> Optional[str]:
        """Get signed download URL for an archive."""
        if not self.gcs_service or not self.gcs_service.is_configured():
            return None

        # Find archive metadata
        if not hasattr(self.db, 'error_log_archives') or self.db.error_log_archives is None:
            return None

        try:
            archive = await self.db.error_log_archives.find_one({"archive_id": archive_id})
            if not archive:
                return None

            return await self.gcs_service.get_signed_url(
                file_path=archive["gcs_path"],
                expiration_minutes=expiration_minutes
            )
        except Exception as e:
            logger.error(f"Failed to get archive download URL: {e}")
            return None

    async def delete_archive(self, archive_id: str) -> bool:
        """Delete an archive from GCS and MongoDB."""
        if not self.gcs_service or not self.gcs_service.is_configured():
            return False

        if not hasattr(self.db, 'error_log_archives') or self.db.error_log_archives is None:
            return False

        try:
            # Find archive
            archive = await self.db.error_log_archives.find_one({"archive_id": archive_id})
            if not archive:
                return False

            # Delete from GCS
            deleted = await self.gcs_service.delete_file(archive["gcs_path"])
            if not deleted:
                logger.warning(f"Failed to delete archive from GCS: {archive['gcs_path']}")

            # Delete metadata from MongoDB (even if GCS delete failed)
            await self.db.error_log_archives.delete_one({"archive_id": archive_id})

            return True
        except Exception as e:
            logger.error(f"Failed to delete archive: {e}")
            return False

    async def force_archive(self) -> Optional[Dict[str, Any]]:
        """Force archive current log file regardless of size."""
        if not self.gcs_service or not self.gcs_service.is_configured():
            return None

        if not self.current_log_path.exists() or self._get_file_size_mb() == 0:
            return None

        # Temporarily set threshold to 0 to force archive
        original_threshold = self.config["max_file_size_mb"]
        self.config["max_file_size_mb"] = 0

        result = await self._check_and_archive()

        self.config["max_file_size_mb"] = original_threshold
        return result

    async def cleanup_old_archives(self, days: int = 90) -> Dict[str, Any]:
        """Delete archives older than specified days."""
        if not hasattr(self.db, 'error_log_archives') or self.db.error_log_archives is None:
            return {"deleted": 0, "errors": ["Archives collection not configured"]}

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        deleted_count = 0
        errors = []

        try:
            cursor = self.db.error_log_archives.find({"created_at": {"$lt": cutoff}})
            async for archive in cursor:
                try:
                    success = await self.delete_archive(archive["archive_id"])
                    if success:
                        deleted_count += 1
                    else:
                        errors.append(f"Failed to delete {archive['archive_id']}")
                except Exception as e:
                    errors.append(f"Error deleting {archive['archive_id']}: {str(e)}")

            return {"deleted": deleted_count, "errors": errors if errors else None}
        except Exception as e:
            logger.error(f"Failed to cleanup old archives: {e}")
            return {"deleted": deleted_count, "errors": [str(e)]}


# Singleton instance holder
_error_log_service: Optional[ErrorLogService] = None


def init_error_log_service(
    db: DatabaseManager,
    gcs_service: Optional[GCSService] = None,
    config: Optional[Dict[str, Any]] = None
) -> ErrorLogService:
    """Initialize the error log service."""
    global _error_log_service
    _error_log_service = ErrorLogService(db, gcs_service, config)
    return _error_log_service


def get_error_log_service() -> Optional[ErrorLogService]:
    """Get the error log service instance."""
    return _error_log_service


async def log_error(
    error: Exception,
    request: Any = None,
    level: str = "ERROR",
    additional_data: Optional[Dict[str, Any]] = None
) -> Optional[str]:
    """Convenience function to log an error."""
    service = get_error_log_service()
    if service:
        return await service.log_error(
            error=error,
            request=request,
            level=level,
            additional_data=additional_data
        )
    return None
