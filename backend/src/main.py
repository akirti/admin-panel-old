"""Main entry point for EasyLife Auth API"""
import os
import sys
import json
import logging
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)
def set_path():
    """set root path for all"""
    MODULE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "."))
    if MODULE_ROOT not in sys.path:
        sys.path.append(MODULE_ROOT)
    SRC_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    if SRC_PATH not in sys.path:
        sys.path.append(SRC_PATH)
 
    return MODULE_ROOT
module_path = set_path()
from easylifeauth import ENVIRONEMNT_VARIABLE_PREFIX, OS_PROPERTY_SEPRATOR, LOCAL_FILE_STORAGE
from easylifeauth.app import create_app
from easylifeauth.utils.config import ConfigurationLoader
from easylifeauth.utils.certificate_util import setup_jira_ssl_bundle


def resolve_environment() -> Optional[str]:
    """Resolve the application environment via 4-level env var fallback."""
    environment = os.environ.get(f"{ENVIRONEMNT_VARIABLE_PREFIX}_ENVIRONMENT", None)
    if environment is None:
        environment = os.environ.get(f"{ENVIRONEMNT_VARIABLE_PREFIX}{OS_PROPERTY_SEPRATOR}ENVIRONMENT", None)
        if environment is None:
            environment = os.environ.get(f"{ENVIRONEMNT_VARIABLE_PREFIX}_ENVIRONMENT.SPACE", None)
        if environment is None:
            environment = os.environ.get(f"{ENVIRONEMNT_VARIABLE_PREFIX}{OS_PROPERTY_SEPRATOR}ENVIRONMENT.SPACE", None)
    return environment


def resolve_config_path() -> str:
    """Resolve configuration path from CONFIG_PATH env var or default."""
    return os.environ.get("CONFIG_PATH", str(Path(__file__).parent.parent / "config"))


def _is_placeholder(value) -> bool:
    """Return True if *value* is an unresolved ``{dot.path}`` placeholder."""
    if not isinstance(value, str):
        return False
    return bool(re.fullmatch(r'\{[^{}]+\}', value.strip()))


def _safe_int(value, default: int) -> int:
    """Convert a config value to int, returning *default* for unresolved placeholders."""
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    try:
        return int(str(value))
    except (ValueError, TypeError):
        return default


def build_db_config(loader: ConfigurationLoader, db_token: str = "authentication") -> Optional[dict]:
    """Extract DB config and inject connection pool settings from globals.

    Returns None when required fields (host, username, password) are missing
    or still contain unresolved ``{placeholder}`` strings.
    """
    db_config = loader.get_DB_config(db_token)
    if not db_config:
        return None

    # Validate required connection fields are resolved
    required_keys = ("host", "username", "password")
    for key in required_keys:
        val = db_config.get(key)
        if not val or _is_placeholder(val):
            logger.warning(
                "DB config key '%s' is missing or unresolved (%s) — skipping database setup",
                key, val,
            )
            return None

    globals_pool = loader.get_config_by_path("globals.databases.default")
    if globals_pool:
        db_config["maxPoolSize"] = _safe_int(globals_pool.get("max_pool_size"), 50)
        db_config["minPoolSize"] = _safe_int(globals_pool.get("min_pool_size"), 5)
        db_config["maxIdleTimeMS"] = _safe_int(globals_pool.get("max_idle_time_ms"), 300000)
        db_config["serverSelectionTimeoutMS"] = _safe_int(globals_pool.get("server_selection_timeout_ms"), 30000)
        db_config["connectTimeoutMS"] = _safe_int(globals_pool.get("connect_timeout_ms"), 20000)
        db_config["socketTimeoutMS"] = _safe_int(globals_pool.get("socket_timeout_ms"), 60000)
        db_config["heartbeatFrequencyMS"] = _safe_int(globals_pool.get("heartbeat_frequency_ms"), 10000)
        db_config["waitQueueTimeoutMS"] = _safe_int(globals_pool.get("wait_queue_timeout_ms"), 10000)
    return db_config


def build_cors_origins(loader: ConfigurationLoader) -> list:
    """Extract CORS origins from config with localhost fallback."""
    return loader.get_config_by_path("environment.cors.origins") or [
        "http://localhost:3000", "http://localhost:5173"
    ]


def build_storage_config(loader: ConfigurationLoader) -> tuple:
    """Extract file storage and GCS configuration.

    Returns (file_storage_config, gcs_config).
    """
    storage_config = loader.get_config_by_path("environment.storage")
    gcs_config = None
    file_storage_config = {"type": "local", "base_path": LOCAL_FILE_STORAGE}
    if storage_config:
        storage_type = storage_config.get("type", "local")
        gcp = storage_config.get("gcs", {})
        if storage_type == "gcs" and gcp.get("credentials_json"):
            creds = gcp["credentials_json"]
            gcs_config = {
                "credentials_json": json.dumps(creds) if isinstance(creds, dict) else creds,
                "bucket_name": gcp.get("bucket_name"),
                "upload_folder": gcp.get("upload_folder", "uploads"),
                "config_folder": gcp.get("config_folder", "config"),
                "project_id": gcp.get("project_id"),
                "project_name": gcp.get("project_name"),
                "credentials_path": gcp.get("credentials_path"),
            }
            file_storage_config = {
                "type": "gcs",
                "bucket_name": gcp.get("bucket_name"),
                "credentials_json": gcs_config["credentials_json"],
                "base_path": LOCAL_FILE_STORAGE,
            }
    return file_storage_config, gcs_config


def build_jira_config(loader: ConfigurationLoader) -> Optional[dict]:
    """Extract Jira configuration with defaults."""
    jira_raw = loader.get_config_by_path("environment.jira")
    if not jira_raw or not jira_raw.get("base_url"):
        return None
    return {
        "base_url": jira_raw.get("base_url"),
        "username": jira_raw.get("username"),
        "password": jira_raw.get("password"),
        "email": jira_raw.get("email"),
        "api_token": jira_raw.get("api_token"),
        "project_key": jira_raw.get("project_key", "SCEN"),
        "project_name": jira_raw.get("project_name"),
        "issue_type": jira_raw.get("issue_type", "Task"),
        "components": jira_raw.get("components", []),
        "default_team": jira_raw.get("default_team"),
        "default_team_name": jira_raw.get("default_team_name"),
        "default_assignee": jira_raw.get("default_assignee"),
        "default_assignee_name": jira_raw.get("default_assignee_name"),
        "default_priority": jira_raw.get("default_priority", "Medium"),
        "default_epic": jira_raw.get("default_epic"),
        "default_watchers": jira_raw.get("default_watchers", []),
        "default_task_environment": jira_raw.get("default_task_environment"),
        "default_task_labels": jira_raw.get("default_task_labels"),
        "target_days": _safe_int(jira_raw.get("default_target_days", 7), 7),
        "ssl": jira_raw.get("ssl", {}),
        "jira_type": jira_raw.get("jira_type", "cloud"),
    }


def build_atlassian_lookup_config(jira_config: Optional[dict]) -> Optional[dict]:
    """Build Atlassian lookup config from the same Jira config block.

    Reuses Jira credentials but adds jira_type for cloud/server branching.
    Returns None if jira_config is None.
    """
    if not jira_config or not jira_config.get("base_url"):
        return None
    return {
        "base_url": jira_config.get("base_url"),
        "username": jira_config.get("username"),
        "password": jira_config.get("password"),
        "email": jira_config.get("email"),
        "api_token": jira_config.get("api_token"),
        "jira_type": jira_config.get("jira_type", "cloud"),
    }


def bootstrap():
    """Orchestrate configuration loading and create the FastAPI application."""
    config_path = resolve_config_path()
    environment = resolve_environment()
    config_loader = ConfigurationLoader(config_path=config_path, environment=environment)

    db_config = build_db_config(config_loader)
    token_secret = config_loader.get_config_by_path("environment.app_secrets.auth_secret_key")
    jwt_issuer = (
        config_loader.get_config_by_path("environment.app_secrets.jwt_issuer")
        or os.environ.get("JWT_ISSUER", "easylife-auth")
    )
    jwt_audience = (
        config_loader.get_config_by_path("environment.app_secrets.jwt_audience")
        or os.environ.get("JWT_AUDIENCE", "easylife-api")
    )
    smtp_config = config_loader.get_config_by_path("environment.smtp")
    cors_origins = build_cors_origins(config_loader)
    file_storage_config, gcs_config = build_storage_config(config_loader)
    jira_config = build_jira_config(config_loader)
    atlassian_lookup_config = build_atlassian_lookup_config(jira_config)
    app_name = config_loader.get_config_by_path("environment.app_name") or "easylife-admin-panel"

    pem_path = setup_jira_ssl_bundle(jira_config, config_path)
    if pem_path and jira_config:
        jira_config["ssl"]["bundle_pem_path"] = pem_path

    handshake_secret = config_loader.get_config_by_path(
        "environment.app_secrets.private_handshake_secret_key"
    )

    root_path = (
        os.environ.get("ROOT_PATH")
        or config_loader.get_config_by_path("environment.root_path")
        or ""
    )

    # Build separate DB config for ui_templates
    ui_templates_db_config = build_db_config(config_loader, db_token="ui_templates")

    kw = {}
    kw["db_config"] = db_config
    kw["ui_templates_db_config"] = ui_templates_db_config
    kw["token_secret"] = token_secret
    kw["jwt_issuer"] = jwt_issuer
    kw["jwt_audience"] = jwt_audience
    kw["smtp_config"] = smtp_config
    kw["jira_config"] = jira_config
    kw["atlassian_lookup_config"] = atlassian_lookup_config
    kw["file_storage_config"] = file_storage_config
    kw["gcs_config"] = gcs_config
    kw["cors_origins"] = cors_origins
    kw["app_name"] = app_name
    kw["title"] = "EasyLife Admin Panel API"
    kw["description"] = "Authentication, Authorization, and Administration API"
    kw["root_path"] = root_path
    kw["handshake_secret"] = handshake_secret
    return create_app(**kw)


app = bootstrap()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="127.0.0.1", port=8000, reload=True)
