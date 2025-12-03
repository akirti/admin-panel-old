"""
Main entry point for EasyLife Auth API
"""
import os
from pathlib import Path
from easylifeauth.app import create_app
from easylifeauth.utils.config import ConfigurationLoader

# Try to load from config file first
config_path = os.environ.get("CONFIG_PATH", str(Path(__file__).parent / "config"))

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
            "scenario_requests", "feedbacks", "easylife_domain",
            "easylife_scenerios", "easylife_sceneario_playboard"
        ]
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

# Create app
app = create_app(
    db_config=db_config,
    token_secret=token_secret,
    smtp_config=smtp_config,
    cors_origins=cors_origins,
    title="EasyLife Admin Panel API",
    description="Authentication, Authorization, and Administration API"
)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
