"""
Main entry point for EasyLife Auth API
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from easylifeauth.app import create_app
from easylifeauth.utils.config import ConfigurationLoader

# Load environment variables from .env file
# Explicitly specify the path to ensure it works regardless of working directory
# .env is in backend/ (parent of src/)
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Try to load from config file first
# config is in backend/ (parent of src/)
config_path = os.environ.get("CONFIG_PATH", str(Path(__file__).parent.parent / "config"))

try:
    config_loader = ConfigurationLoader(config_path=config_path, config_file="config.json")
    
    # Get configurations from file
    db_config = config_loader.get_DB_config("authentication")
    token_secret = config_loader.get_config_by_path("specs.app_secrets.auth_secret_key")
    smtp_config = config_loader.get_config_by_path("specs.smtp")
    cors_origins = config_loader.get_config_by_path("cors.origins") or ["*"]
except Exception as e:
    print(f"Config file loading failed: {e}, using environment variables")
    db_config = None
    token_secret = None
    smtp_config = None
    cors_origins = ["*"]

# Override with environment variables if set
env_db_host = os.environ.get("MONGODB_HOST") or os.environ.get("EASYLIFE_DATABASES_AUTHENTICATION_DB_INFO_HOST")
if env_db_host:
    db_config = {
        "connectionScheme": os.environ.get("MONGODB_SCHEME", os.environ.get("EASYLIFE_DATABASES_AUTHENTICATION_DB_INFO_CONNECTIONSCHEME", "mongodb")),
        "username": os.environ.get("MONGODB_USERNAME", os.environ.get("EASYLIFE_DATABASES_AUTHENTICATION_DB_INFO_USERNAME", "admin")),
        "password": os.environ.get("MONGODB_PASSWORD", os.environ.get("EASYLIFE_DATABASES_AUTHENTICATION_DB_INFO_PASSWORD", "password")),
        "host": env_db_host,
        "database": os.environ.get("MONGODB_DATABASE", os.environ.get("EASYLIFE_DATABASES_AUTHENTICATION_DB_INFO_DATABASE", "easylife_auth")),
        "collections": [
            "users", "tokens", "reset_tokens", "sessions", "roles", "groups",
            "permissions", "customers", "scenario_requests", "feedbacks", "domains",
            "domain_scenarios", "playboards", "configurations", "activity_logs", "api_configs",
            "distribution_lists"
        ],
        # MongoDB Connection Pool Settings (for handling idle connections and auto-reconnect)
        "maxPoolSize": os.environ.get("MONGODB_MAX_POOL_SIZE", "50"),
        "minPoolSize": os.environ.get("MONGODB_MIN_POOL_SIZE", "5"),
        "maxIdleTimeMS": os.environ.get("MONGODB_MAX_IDLE_TIME_MS", "300000"),
        "serverSelectionTimeoutMS": os.environ.get("MONGODB_SERVER_SELECTION_TIMEOUT_MS", "30000"),
        "connectTimeoutMS": os.environ.get("MONGODB_CONNECT_TIMEOUT_MS", "20000"),
        "socketTimeoutMS": os.environ.get("MONGODB_SOCKET_TIMEOUT_MS", "60000"),
        "heartbeatFrequencyMS": os.environ.get("MONGODB_HEARTBEAT_FREQUENCY_MS", "10000"),
        "waitQueueTimeoutMS": os.environ.get("MONGODB_WAIT_QUEUE_TIMEOUT_MS", "10000"),
    }

env_jwt_secret = os.environ.get("JWT_SECRET_KEY") or os.environ.get("EASYLIFE_SPECS_APP_SECRETS_AUTH_SECRET_KEY")
if env_jwt_secret:
    token_secret = env_jwt_secret

env_smtp_server = os.environ.get("SMTP_SERVER") or os.environ.get("EASYLIFE_SPECS_SMTP_SMTP_SERVER")
if env_smtp_server:
    smtp_config = {
        "smtp_server": env_smtp_server,
        "smtp_port": int(os.environ.get("SMTP_PORT", os.environ.get("EASYLIFE_SPECS_SMTP_SMTP_PORT", "25"))),
        "email": os.environ.get("SMTP_EMAIL", os.environ.get("EASYLIFE_SPECS_SMTP_EMAIL", "noreply@easylife.local")),
        "password": os.environ.get("SMTP_PASSWORD", os.environ.get("EASYLIFE_SPECS_SMTP_PASSWORD", ""))
    }

env_cors = os.environ.get("CORS_ORIGINS")
if env_cors:
    cors_origins = [o.strip() for o in env_cors.split(",")]

# GCS configuration from environment variables
gcs_config = None
env_gcs_credentials = os.environ.get("GCS_CREDENTIALS_JSON")
env_gcs_bucket = os.environ.get("GCS_BUCKET_NAME")
if env_gcs_credentials and env_gcs_credentials != "{}":
    gcs_config = {
        "credentials_json": env_gcs_credentials,
        "bucket_name": env_gcs_bucket
    }

# File storage configuration from environment variables
# FILE_STORAGE_TYPE: "gcs" or "local" (default: "local")
# When "gcs", uses GCS_CREDENTIALS_JSON and GCS_BUCKET_NAME
# Falls back to local storage if GCS initialization fails
file_storage_config = None
env_file_storage_type = os.environ.get("FILE_STORAGE_TYPE", "local").lower()
if env_file_storage_type == "gcs" and gcs_config:
    file_storage_config = {
        "type": "gcs",
        "bucket_name": env_gcs_bucket,
        "credentials_json": env_gcs_credentials,
        "base_path": os.environ.get("LOCAL_UPLOAD_PATH", "/tmp/easylife_uploads")
    }
elif env_file_storage_type == "local" or not gcs_config:
    file_storage_config = {
        "type": "local",
        "base_path": os.environ.get("LOCAL_UPLOAD_PATH", "/tmp/easylife_uploads")
    }

# Jira configuration from environment variables
jira_config = None
env_jira_base_url = os.environ.get("JIRA_BASE_URL")
env_jira_email = os.environ.get("JIRA_EMAIL")
env_jira_api_token = os.environ.get("JIRA_API_TOKEN")
if env_jira_base_url and env_jira_email and env_jira_api_token:
    jira_config = {
        "base_url": env_jira_base_url,
        "email": env_jira_email,
        "api_token": env_jira_api_token,
        "project_key": os.environ.get("JIRA_PROJECT_KEY", "SCEN"),
        "issue_type": os.environ.get("JIRA_ISSUE_TYPE", "Task"),
        "default_team": os.environ.get("JIRA_DEFAULT_TEAM"),
        "target_days": int(os.environ.get("JIRA_TARGET_DAYS", "7"))
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
    description="Authentication, Authorization, and Administration API"
)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
