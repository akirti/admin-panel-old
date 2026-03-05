"""Main entry point for EasyLife Auth API"""
import os
import sys
import json
from pathlib import Path
from typing import Optional
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


def build_db_config(loader: ConfigurationLoader) -> Optional[dict]:
    """Extract DB config and inject connection pool settings from globals."""
    db_config = loader.get_DB_config("authentication")
    globals_pool = loader.get_config_by_path("globals.databases.default")
    if db_config and globals_pool:
        db_config["maxPoolSize"] = globals_pool.get("max_pool_size", 50)
        db_config["minPoolSize"] = globals_pool.get("min_pool_size", 5)
        db_config["maxIdleTimeMS"] = globals_pool.get("max_idle_time_ms", 300000)
        db_config["serverSelectionTimeoutMS"] = globals_pool.get("server_selection_timeout_ms", 30000)
        db_config["connectTimeoutMS"] = globals_pool.get("connect_timeout_ms", 20000)
        db_config["socketTimeoutMS"] = globals_pool.get("socket_timeout_ms", 60000)
        db_config["heartbeatFrequencyMS"] = globals_pool.get("heartbeat_frequency_ms", 10000)
        db_config["waitQueueTimeoutMS"] = globals_pool.get("wait_queue_timeout_ms", 10000)
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
        "issue_type": jira_raw.get("issue_type", "Task"),
        "components": jira_raw.get("components", []),
        "default_team": jira_raw.get("default_team"),
        "default_assignee": jira_raw.get("default_assignee"),
        "default_assignee_name": jira_raw.get("default_assignee_name"),
        "default_priority": jira_raw.get("default_priority", "Medium"),
        "default_epic": jira_raw.get("default_epic"),
        "default_watchers": jira_raw.get("default_watchers", []),
        "default_task_environment": jira_raw.get("default_task_environment"),
        "default_task_labels": jira_raw.get("default_task_labels"),
        "target_days": int(jira_raw.get("default_target_days", 7)),
        "ssl": jira_raw.get("ssl", {}),
    }


def bootstrap():
    """Orchestrate configuration loading and create the FastAPI application."""
    config_path = resolve_config_path()
    environment = resolve_environment()
    config_loader = ConfigurationLoader(config_path=config_path, environment=environment)

    db_config = build_db_config(config_loader)
    token_secret = config_loader.get_config_by_path("environment.app_secrets.auth_secret_key")
    smtp_config = config_loader.get_config_by_path("environment.smtp")
    cors_origins = build_cors_origins(config_loader)
    file_storage_config, gcs_config = build_storage_config(config_loader)
    jira_config = build_jira_config(config_loader)

    # Create SSL PEM file if configured
    pem_path = setup_jira_ssl_bundle(jira_config, config_path)
    if pem_path and jira_config:
        jira_config["ssl"]["bundle_pem_path"] = pem_path

    return create_app(
        db_config=db_config,
        token_secret=token_secret,
        smtp_config=smtp_config,
        jira_config=jira_config,
        file_storage_config=file_storage_config,
        gcs_config=gcs_config,
        cors_origins=cors_origins,
        title="EasyLife Admin Panel API",
        description="Authentication, Authorization, and Administration API",
    )


app = bootstrap()

if __name__ == "__main__":  # pragma: no cover
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
