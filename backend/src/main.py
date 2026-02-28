"""Main entry point for EasyLife Auth API"""
import os
import json
from pathlib import Path

from easylifeauth import ENVIRONEMNT_VARIABLE_PREFIX
from easylifeauth.app import create_app
from easylifeauth.utils.config import ConfigurationLoader

# Determine paths
config_path = os.environ.get("CONFIG_PATH", str(Path(__file__).parent.parent / "config"))
environment = os.environ.get(f"{ENVIRONEMNT_VARIABLE_PREFIX}_ENVIRONMENT", "production")

# Load configuration through pipeline
config_loader = ConfigurationLoader(config_path=config_path, environment=environment)

# --- Extract configs via dot-path access ---

# Database
db_config = config_loader.get_DB_config("authentication")
# Inject pool settings from globals
globals_pool = config_loader.get_config_by_path("globals.databases.default")
if db_config and globals_pool:
    db_config["maxPoolSize"] = globals_pool.get("max_pool_size", 50)
    db_config["minPoolSize"] = globals_pool.get("min_pool_size", 5)
    db_config["maxIdleTimeMS"] = globals_pool.get("max_idle_time_ms", 300000)
    db_config["serverSelectionTimeoutMS"] = globals_pool.get("server_selection_timeout_ms", 30000)
    db_config["connectTimeoutMS"] = globals_pool.get("connect_timeout_ms", 20000)
    db_config["socketTimeoutMS"] = globals_pool.get("socket_timeout_ms", 60000)
    db_config["heartbeatFrequencyMS"] = globals_pool.get("heartbeat_frequency_ms", 10000)
    db_config["waitQueueTimeoutMS"] = globals_pool.get("wait_queue_timeout_ms", 10000)

# Auth
token_secret = config_loader.get_config_by_path("environment.app_secrets.auth_secret_key")

# SMTP
smtp_config = config_loader.get_config_by_path("environment.smtp")

# CORS
cors_origins = config_loader.get_config_by_path("environment.cors.origins") or [
    "http://localhost:3000", "http://localhost:5173"
]

# GCS / file storage
storage_config = config_loader.get_config_by_path("environment.storage")
gcs_config = None
file_storage_config = {"type": "local", "base_path": "/tmp/easylife_uploads"}
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
            "base_path": "/tmp/easylife_uploads",
        }

# Jira
jira_config = None
jira_raw = config_loader.get_config_by_path("environment.jira")
if jira_raw and jira_raw.get("base_url"):
    jira_config = {
        "base_url": jira_raw.get("base_url"),
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

# Create app
app = create_app(
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
