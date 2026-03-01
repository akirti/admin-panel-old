"""Expected config values loaded from the simulator file.

Provides EXPECTED_DB_*, EXPECTED_SMTP_*, EXPECTED_POOL_*, EXPECTED_COLLECTIONS, etc.
so that TestRealConfigFiles can assert against them without hardcoding.
"""
import json
from pathlib import Path

_CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
_SIMULATOR_FILE = _CONFIG_DIR / "server.env.production.json"


def _load_simulator() -> dict:
    with open(_SIMULATOR_FILE, "r") as f:
        return json.load(f)


def _get(data: dict, dot_path: str):
    """Get value by dot.path key from flat simulator data."""
    if dot_path in data:
        return data[dot_path]
    return None


SIMULATOR_DATA = _load_simulator()

# Database values
EXPECTED_DB_HOST = _get(SIMULATOR_DATA, "databases.authentication.db_info.host")
EXPECTED_DB_DATABASE = _get(SIMULATOR_DATA, "databases.authentication.db_info.database")
EXPECTED_DB_USERNAME = _get(SIMULATOR_DATA, "databases.authentication.db_info.username")
EXPECTED_DB_PASSWORD = _get(SIMULATOR_DATA, "databases.authentication.db_info.password")
EXPECTED_DB_PORT = _get(SIMULATOR_DATA, "databases.authentication.db_info.port")
EXPECTED_DB_CONNECTION_SCHEME = _get(SIMULATOR_DATA, "databases.authentication.db_info.connection_scheme")
EXPECTED_COLLECTIONS = _get(SIMULATOR_DATA, "databases.authentication.db_info.collections")

# Pool settings
EXPECTED_MAX_POOL_SIZE = _get(SIMULATOR_DATA, "globals.databases.default.max_pool_size")
EXPECTED_MIN_POOL_SIZE = _get(SIMULATOR_DATA, "globals.databases.default.min_pool_size")

# Auth
EXPECTED_SECRET_KEY = _get(SIMULATOR_DATA, "environment.app_secrets.auth_secret_key")

# SMTP
EXPECTED_SMTP_SERVER = _get(SIMULATOR_DATA, "environment.smtp.smtp_server")
EXPECTED_SMTP_PORT = _get(SIMULATOR_DATA, "environment.smtp.smtp_port")

# CORS
EXPECTED_CORS_ORIGINS = _get(SIMULATOR_DATA, "environment.cors.origins")

# Jira
EXPECTED_JIRA_BASE_URL = _get(SIMULATOR_DATA, "environment.jira.base_url")
