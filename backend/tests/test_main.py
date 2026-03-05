"""Tests for the main.py module (application entry point / configuration wiring).

Tests use direct function imports instead of exec-based sandboxing.
"""
import json
import os
from pathlib import Path
from unittest.mock import MagicMock, patch, call

import pytest

from easylifeauth import ENVIRONEMNT_VARIABLE_PREFIX, OS_PROPERTY_SEPRATOR, LOCAL_FILE_STORAGE
from mock_data import (
    MOCK_DB_HOST, MOCK_DB_USERNAME, MOCK_DB_PASSWORD_MOCK, MOCK_DB_DATABASE,
    MOCK_EMAIL_BOT, MOCK_IP_BIND_ALL, MOCK_JIRA_PASSWORD, MOCK_PATH_UPLOADS,
    MOCK_URL_EXAMPLE, MOCK_URL_FRONTEND, MOCK_URL_FRONTEND_DEV,
    MOCK_URL_JIRA_EXAMPLE, MOCK_URL_JIRA_TEST,
)
from main import (
    resolve_environment, resolve_config_path, build_db_config,
    build_cors_origins, build_storage_config, build_jira_config, bootstrap,
    _safe_int,
)

ENV_PREFIX = f"{ENVIRONEMNT_VARIABLE_PREFIX}_"
CFG_ENVIRONMENT_CORS_ORIGINS = "environment.cors.origins"
CFG_ENVIRONMENT_JIRA = "environment.jira"
CFG_ENVIRONMENT_STORAGE = "environment.storage"
CFG_GLOBALS_DATABASES_DEFAULT = "globals.databases.default"
STR_DEFAULT_ASSIGNEE_NAME = "default_assignee_name"
STR_MAXPOOLSIZE = "maxPoolSize"
STR_MY_BUCKET = "my-bucket"
CFG_AUTH_SECRET_KEY = "environment.app_secrets.auth_secret_key"
CFG_SMTP = "environment.smtp"
PATCH_MAIN_CREATE_APP = "main.create_app"
PATCH_MAIN_CONFIG_LOADER = "main.ConfigurationLoader"
APP_TITLE = "EasyLife Admin Panel API"
APP_DESCRIPTION = "Authentication, Authorization, and Administration API"
UVICORN_APP_REF = "src.main:app"
PATCH_MAIN_SETUP_SSL = "main.setup_jira_ssl_bundle"
STR_USERNAME = "username"
STR_PASSWORD = "password"
UNRESOLVED_PLACEHOLDER = "{globals.databases.default.max_pool_size}"

# All env var keys that main.py reads — cleared before each test
_ENV_KEYS_TO_CLEAR = [
    "CONFIG_PATH",
    f"{ENVIRONEMNT_VARIABLE_PREFIX}_ENVIRONMENT",
    f"{ENVIRONEMNT_VARIABLE_PREFIX}{OS_PROPERTY_SEPRATOR}ENVIRONMENT",
    f"{ENVIRONEMNT_VARIABLE_PREFIX}_ENVIRONMENT.SPACE",
    f"{ENVIRONEMNT_VARIABLE_PREFIX}{OS_PROPERTY_SEPRATOR}ENVIRONMENT.SPACE",
]


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    """Remove all env vars that main.py reads so tests start from a clean slate."""
    for key in _ENV_KEYS_TO_CLEAR:
        monkeypatch.delenv(key, raising=False)


# ---------------------------------------------------------------------------
# Helper: build a mock ConfigurationLoader instance
# ---------------------------------------------------------------------------
def _make_config_loader(config_values=None):
    """Create a mock ConfigurationLoader instance.

    Parameters
    ----------
    config_values : dict | None
        Mapping of config paths to return values for get_config_by_path.
        Special key ``"db_config"`` controls get_DB_config("authentication").
    """
    config_values = config_values or {}
    loader = MagicMock()
    loader.get_DB_config.return_value = config_values.get("db_config")

    def _get_config(path, default=None):
        if path in config_values:
            return config_values[path]
        return default

    loader.get_config_by_path.side_effect = _get_config
    return loader


# ============================================================================
# TestResolveEnvironment
# ============================================================================
class TestResolveEnvironment:
    """4-level environment variable fallback for environment resolution."""

    def test_none_when_no_env_vars_set(self):
        assert resolve_environment() is None

    def test_primary_underscore_env(self, monkeypatch):
        monkeypatch.setenv(f"{ENVIRONEMNT_VARIABLE_PREFIX}_ENVIRONMENT", "production")
        assert resolve_environment() == "production"

    def test_fallback_dot_separator(self, monkeypatch):
        monkeypatch.setenv(f"{ENVIRONEMNT_VARIABLE_PREFIX}{OS_PROPERTY_SEPRATOR}ENVIRONMENT", "dot-env")
        assert resolve_environment() == "dot-env"

    def test_fallback_underscore_space(self, monkeypatch):
        monkeypatch.setenv(f"{ENVIRONEMNT_VARIABLE_PREFIX}_ENVIRONMENT.SPACE", "space-env")
        assert resolve_environment() == "space-env"

    def test_fallback_dot_separator_space(self, monkeypatch):
        monkeypatch.setenv(f"{ENVIRONEMNT_VARIABLE_PREFIX}{OS_PROPERTY_SEPRATOR}ENVIRONMENT.SPACE", "dot-space-env")
        assert resolve_environment() == "dot-space-env"

    def test_underscore_takes_priority_over_all(self, monkeypatch):
        monkeypatch.setenv(f"{ENVIRONEMNT_VARIABLE_PREFIX}_ENVIRONMENT", "primary")
        monkeypatch.setenv(f"{ENVIRONEMNT_VARIABLE_PREFIX}{OS_PROPERTY_SEPRATOR}ENVIRONMENT", "secondary")
        monkeypatch.setenv(f"{ENVIRONEMNT_VARIABLE_PREFIX}_ENVIRONMENT.SPACE", "tertiary")
        monkeypatch.setenv(f"{ENVIRONEMNT_VARIABLE_PREFIX}{OS_PROPERTY_SEPRATOR}ENVIRONMENT.SPACE", "quaternary")
        assert resolve_environment() == "primary"

    def test_dot_separator_takes_priority_over_space_variants(self, monkeypatch):
        monkeypatch.setenv(f"{ENVIRONEMNT_VARIABLE_PREFIX}{OS_PROPERTY_SEPRATOR}ENVIRONMENT", "dot-env")
        monkeypatch.setenv(f"{ENVIRONEMNT_VARIABLE_PREFIX}_ENVIRONMENT.SPACE", "space-env")
        monkeypatch.setenv(f"{ENVIRONEMNT_VARIABLE_PREFIX}{OS_PROPERTY_SEPRATOR}ENVIRONMENT.SPACE", "dot-space-env")
        assert resolve_environment() == "dot-env"

    def test_underscore_space_takes_priority_over_dot_space(self, monkeypatch):
        monkeypatch.setenv(f"{ENVIRONEMNT_VARIABLE_PREFIX}_ENVIRONMENT.SPACE", "space-env")
        monkeypatch.setenv(f"{ENVIRONEMNT_VARIABLE_PREFIX}{OS_PROPERTY_SEPRATOR}ENVIRONMENT.SPACE", "dot-space-env")
        assert resolve_environment() == "space-env"


# ============================================================================
# TestResolveConfigPath
# ============================================================================
class TestResolveConfigPath:
    """CONFIG_PATH env var resolution."""

    def test_default_path(self):
        result = resolve_config_path()
        assert Path(result).name == "config"

    def test_custom_config_path(self, monkeypatch):
        monkeypatch.setenv("CONFIG_PATH", "/custom/config")
        assert resolve_config_path() == "/custom/config"


# ============================================================================
# TestBuildDBConfig
# ============================================================================
class TestBuildDBConfig:
    """Database configuration extraction and pool settings injection."""

    def test_db_config_from_loader(self):
        fake_db = {"host": MOCK_DB_HOST, "username": MOCK_DB_USERNAME, "password": MOCK_DB_PASSWORD_MOCK, "database": MOCK_DB_DATABASE}
        loader = _make_config_loader({
            "db_config": fake_db,
            CFG_GLOBALS_DATABASES_DEFAULT: {"max_pool_size": 100},
        })
        result = build_db_config(loader)
        assert result["host"] == "dbhost"
        assert result["database"] == "mydb"

    def test_pool_settings_injected(self):
        fake_db = {"host": MOCK_DB_HOST, "username": MOCK_DB_USERNAME, "password": MOCK_DB_PASSWORD_MOCK}
        fake_pool = {
            "max_pool_size": 100,
            "min_pool_size": 10,
            "max_idle_time_ms": 600000,
            "server_selection_timeout_ms": 5000,
            "connect_timeout_ms": 3000,
            "socket_timeout_ms": 30000,
            "heartbeat_frequency_ms": 5000,
            "wait_queue_timeout_ms": 20000,
        }
        loader = _make_config_loader({
            "db_config": fake_db,
            CFG_GLOBALS_DATABASES_DEFAULT: fake_pool,
        })
        db = build_db_config(loader)
        assert db[STR_MAXPOOLSIZE] == 100
        assert db["minPoolSize"] == 10
        assert db["maxIdleTimeMS"] == 600000
        assert db["serverSelectionTimeoutMS"] == 5000
        assert db["connectTimeoutMS"] == 3000
        assert db["socketTimeoutMS"] == 30000
        assert db["heartbeatFrequencyMS"] == 5000
        assert db["waitQueueTimeoutMS"] == 20000

    def test_pool_defaults_for_missing_keys(self):
        fake_db = {"host": MOCK_DB_HOST, "username": MOCK_DB_USERNAME, "password": MOCK_DB_PASSWORD_MOCK}
        loader = _make_config_loader({
            "db_config": fake_db,
            CFG_GLOBALS_DATABASES_DEFAULT: {"max_pool_size": 100},
        })
        db = build_db_config(loader)
        assert db[STR_MAXPOOLSIZE] == 100
        assert db["minPoolSize"] == 5
        assert db["maxIdleTimeMS"] == 300000
        assert db["serverSelectionTimeoutMS"] == 30000

    def test_none_when_loader_returns_none(self):
        loader = _make_config_loader({"db_config": None})
        assert build_db_config(loader) is None

    def test_pool_not_injected_when_db_config_none(self):
        loader = _make_config_loader({
            "db_config": None,
            CFG_GLOBALS_DATABASES_DEFAULT: {"max_pool_size": 100},
        })
        assert build_db_config(loader) is None

    def test_pool_not_injected_when_globals_none(self):
        fake_db = {"host": MOCK_DB_HOST, "username": MOCK_DB_USERNAME, "password": MOCK_DB_PASSWORD_MOCK}
        loader = _make_config_loader({
            "db_config": fake_db,
            CFG_GLOBALS_DATABASES_DEFAULT: None,
        })
        db = build_db_config(loader)
        assert STR_MAXPOOLSIZE not in db

    def test_pool_not_injected_when_globals_empty_dict(self):
        fake_db = {"host": MOCK_DB_HOST, "username": MOCK_DB_USERNAME, "password": MOCK_DB_PASSWORD_MOCK}
        loader = _make_config_loader({
            "db_config": fake_db,
            CFG_GLOBALS_DATABASES_DEFAULT: {},
        })
        db = build_db_config(loader)
        assert STR_MAXPOOLSIZE not in db

    def test_pool_settings_fallback_for_unresolved_placeholders(self):
        """Unresolved placeholder strings fall back to defaults (not ValueError)."""
        fake_db = {"host": MOCK_DB_HOST, "username": MOCK_DB_USERNAME, "password": MOCK_DB_PASSWORD_MOCK}
        fake_pool = {
            "max_pool_size": UNRESOLVED_PLACEHOLDER,
            "min_pool_size": "{globals.databases.default.min_pool_size}",
            "max_idle_time_ms": "{globals.databases.default.max_idle_time_ms}",
            "server_selection_timeout_ms": "{unresolved}",
            "connect_timeout_ms": "{unresolved}",
            "socket_timeout_ms": "{unresolved}",
            "heartbeat_frequency_ms": "{unresolved}",
            "wait_queue_timeout_ms": "{unresolved}",
        }
        loader = _make_config_loader({
            "db_config": fake_db,
            CFG_GLOBALS_DATABASES_DEFAULT: fake_pool,
        })
        db = build_db_config(loader)
        assert db[STR_MAXPOOLSIZE] == 50
        assert db["minPoolSize"] == 5
        assert db["maxIdleTimeMS"] == 300000
        assert db["serverSelectionTimeoutMS"] == 30000
        assert db["connectTimeoutMS"] == 20000
        assert db["socketTimeoutMS"] == 60000
        assert db["heartbeatFrequencyMS"] == 10000
        assert db["waitQueueTimeoutMS"] == 10000

    def test_pool_settings_accept_string_integers(self):
        """String integers (e.g. from env vars) are converted properly."""
        fake_db = {"host": MOCK_DB_HOST, "username": MOCK_DB_USERNAME, "password": MOCK_DB_PASSWORD_MOCK}
        fake_pool = {"max_pool_size": "200", "min_pool_size": "10"}
        loader = _make_config_loader({
            "db_config": fake_db,
            CFG_GLOBALS_DATABASES_DEFAULT: fake_pool,
        })
        db = build_db_config(loader)
        assert db[STR_MAXPOOLSIZE] == 200
        assert db["minPoolSize"] == 10


# ============================================================================
# TestSafeInt
# ============================================================================
class TestSafeInt:
    """Tests for _safe_int helper."""

    def test_int_passthrough(self):
        assert _safe_int(100, 50) == 100

    def test_string_int(self):
        assert _safe_int("42", 50) == 42

    def test_float_truncated(self):
        assert _safe_int(3.9, 50) == 3

    def test_placeholder_returns_default(self):
        assert _safe_int(UNRESOLVED_PLACEHOLDER, 50) == 50

    def test_none_returns_default(self):
        assert _safe_int(None, 50) == 50

    def test_empty_string_returns_default(self):
        assert _safe_int("", 50) == 50

    def test_non_numeric_string_returns_default(self):
        assert _safe_int("abc", 50) == 50

    def test_zero(self):
        assert _safe_int(0, 50) == 0

    def test_negative_int(self):
        assert _safe_int(-1, 50) == -1


# ============================================================================
# TestBuildCorsOrigins
# ============================================================================
class TestBuildCorsOrigins:
    """CORS origins extraction and fallback."""

    def test_cors_origins_from_config(self):
        loader = _make_config_loader({CFG_ENVIRONMENT_CORS_ORIGINS: [MOCK_URL_EXAMPLE]})
        assert build_cors_origins(loader) == [MOCK_URL_EXAMPLE]

    def test_cors_origins_fallback_when_none(self):
        loader = _make_config_loader({CFG_ENVIRONMENT_CORS_ORIGINS: None})
        assert build_cors_origins(loader) == [MOCK_URL_FRONTEND, MOCK_URL_FRONTEND_DEV]

    def test_cors_origins_fallback_when_not_set(self):
        loader = _make_config_loader()
        assert build_cors_origins(loader) == [MOCK_URL_FRONTEND, MOCK_URL_FRONTEND_DEV]

    def test_cors_empty_list_triggers_fallback(self):
        loader = _make_config_loader({CFG_ENVIRONMENT_CORS_ORIGINS: []})
        assert build_cors_origins(loader) == [MOCK_URL_FRONTEND, MOCK_URL_FRONTEND_DEV]


# ============================================================================
# TestBuildStorageConfig
# ============================================================================
class TestBuildStorageConfig:
    """File storage and GCS configuration."""

    def test_default_local_storage(self):
        loader = _make_config_loader()
        fsc, gcs = build_storage_config(loader)
        assert fsc["type"] == "local"
        assert fsc["base_path"] == MOCK_PATH_UPLOADS
        assert gcs is None

    def test_gcs_storage_with_credentials_dict(self):
        storage = {
            "type": "gcs",
            "gcs": {
                "credentials_json": {"type": "service_account", "project_id": "test"},
                "bucket_name": STR_MY_BUCKET,
                "upload_folder": "uploads",
                "config_folder": "config",
                "project_id": "test-proj",
                "project_name": "Test Project",
                "credentials_path": "path/to/creds",
            },
        }
        loader = _make_config_loader({CFG_ENVIRONMENT_STORAGE: storage})
        fsc, gcs = build_storage_config(loader)

        assert fsc["type"] == "gcs"
        assert fsc["bucket_name"] == STR_MY_BUCKET
        assert fsc["base_path"] == MOCK_PATH_UPLOADS

        assert gcs is not None
        assert json.loads(gcs["credentials_json"]) == {
            "type": "service_account", "project_id": "test"
        }
        assert gcs["bucket_name"] == STR_MY_BUCKET
        assert gcs["upload_folder"] == "uploads"
        assert gcs["config_folder"] == "config"
        assert gcs["project_id"] == "test-proj"
        assert gcs["project_name"] == "Test Project"
        assert gcs["credentials_path"] == "path/to/creds"

    def test_gcs_storage_with_credentials_string(self):
        storage = {
            "type": "gcs",
            "gcs": {
                "credentials_json": '{"type":"service_account"}',
                "bucket_name": "bucket",
            },
        }
        loader = _make_config_loader({CFG_ENVIRONMENT_STORAGE: storage})
        _, gcs = build_storage_config(loader)
        assert gcs["credentials_json"] == '{"type":"service_account"}'

    def test_gcs_without_credentials_stays_local(self):
        storage = {"type": "gcs", "gcs": {}}
        loader = _make_config_loader({CFG_ENVIRONMENT_STORAGE: storage})
        fsc, gcs = build_storage_config(loader)
        assert fsc["type"] == "local"
        assert gcs is None

    def test_storage_type_defaults_to_local(self):
        storage = {"gcs": {}}
        loader = _make_config_loader({CFG_ENVIRONMENT_STORAGE: storage})
        fsc, _ = build_storage_config(loader)
        assert fsc["type"] == "local"

    def test_storage_with_no_gcs_key(self):
        storage = {"type": "gcs"}
        loader = _make_config_loader({CFG_ENVIRONMENT_STORAGE: storage})
        fsc, gcs = build_storage_config(loader)
        assert fsc["type"] == "local"
        assert gcs is None


# ============================================================================
# TestBuildJiraConfig
# ============================================================================
class TestBuildJiraConfig:
    """Jira configuration extraction."""

    def test_jira_config_with_all_fields(self):
        jira_raw = {
            "base_url": MOCK_URL_JIRA_EXAMPLE,
            STR_USERNAME: "jirauser",
            STR_PASSWORD: MOCK_JIRA_PASSWORD,
            "email": MOCK_EMAIL_BOT,
            "api_token": "tok123",
            "project_key": "PROJ",
            "issue_type": "Bug",
            "components": ["web"],
            "default_team": "Alpha",
            "default_assignee": "user1",
            STR_DEFAULT_ASSIGNEE_NAME: "Jane",
            "default_priority": "High",
            "default_epic": "EPIC-1",
            "default_watchers": ["watcher1"],
            "default_task_environment": "PROD",
            "default_task_labels": "urgent",
            "default_target_days": 14,
            "ssl": {"enabled": True},
        }
        loader = _make_config_loader({CFG_ENVIRONMENT_JIRA: jira_raw})
        jira = build_jira_config(loader)

        assert jira is not None
        assert jira["base_url"] == MOCK_URL_JIRA_EXAMPLE
        assert jira[STR_USERNAME] == "jirauser"
        assert jira[STR_PASSWORD] == MOCK_JIRA_PASSWORD
        assert jira["email"] == MOCK_EMAIL_BOT
        assert jira["api_token"] == "tok123"
        assert jira["project_key"] == "PROJ"
        assert jira["issue_type"] == "Bug"
        assert jira["components"] == ["web"]
        assert jira["default_team"] == "Alpha"
        assert jira["default_assignee"] == "user1"
        assert jira[STR_DEFAULT_ASSIGNEE_NAME] == "Jane"
        assert jira["default_priority"] == "High"
        assert jira["default_epic"] == "EPIC-1"
        assert jira["default_watchers"] == ["watcher1"]
        assert jira["default_task_environment"] == "PROD"
        assert jira["default_task_labels"] == "urgent"
        assert jira["target_days"] == 14
        assert jira["ssl"] == {"enabled": True}

    def test_jira_config_defaults(self):
        jira_raw = {
            "base_url": MOCK_URL_JIRA_TEST,
            "email": MOCK_EMAIL_BOT,
            "api_token": "tok",
        }
        loader = _make_config_loader({CFG_ENVIRONMENT_JIRA: jira_raw})
        jira = build_jira_config(loader)

        assert jira["project_key"] == "SCEN"
        assert jira["issue_type"] == "Task"
        assert jira["default_priority"] == "Medium"
        assert jira["target_days"] == 7
        assert jira["components"] == []
        assert jira["default_watchers"] == []
        assert jira[STR_USERNAME] is None
        assert jira[STR_PASSWORD] is None
        assert jira["default_team"] is None
        assert jira["default_assignee"] is None
        assert jira[STR_DEFAULT_ASSIGNEE_NAME] is None

    def test_jira_config_none_when_no_base_url(self):
        jira_raw = {"email": MOCK_EMAIL_BOT, "api_token": "tok"}
        loader = _make_config_loader({CFG_ENVIRONMENT_JIRA: jira_raw})
        assert build_jira_config(loader) is None

    def test_jira_config_none_when_base_url_empty(self):
        jira_raw = {"base_url": "", "email": "e", "api_token": "t"}
        loader = _make_config_loader({CFG_ENVIRONMENT_JIRA: jira_raw})
        assert build_jira_config(loader) is None

    def test_jira_config_none_when_not_configured(self):
        loader = _make_config_loader()
        assert build_jira_config(loader) is None

    def test_jira_config_none_when_jira_raw_is_none(self):
        loader = _make_config_loader({CFG_ENVIRONMENT_JIRA: None})
        assert build_jira_config(loader) is None

    def test_jira_target_days_string_conversion(self):
        jira_raw = {"base_url": MOCK_URL_JIRA_TEST, "default_target_days": "21"}
        loader = _make_config_loader({CFG_ENVIRONMENT_JIRA: jira_raw})
        jira = build_jira_config(loader)
        assert jira["target_days"] == 21


# ============================================================================
# TestBootstrap
# ============================================================================
class TestBootstrap:
    """End-to-end bootstrap orchestration."""

    @patch(PATCH_MAIN_CREATE_APP)
    @patch(PATCH_MAIN_CONFIG_LOADER)
    def test_all_kwargs_present(self, mock_cl_cls, mock_create_app):
        mock_cl_cls.return_value = _make_config_loader()
        bootstrap()
        mock_create_app.assert_called_once()
        kwargs = mock_create_app.call_args[1]
        expected_keys = {
            "db_config", "token_secret", "smtp_config", "jira_config",
            "file_storage_config", "gcs_config", "cors_origins",
            "title", "description",
        }
        assert set(kwargs.keys()) == expected_keys

    @patch(PATCH_MAIN_CREATE_APP)
    @patch(PATCH_MAIN_CONFIG_LOADER)
    def test_title_and_description(self, mock_cl_cls, mock_create_app):
        mock_cl_cls.return_value = _make_config_loader()
        bootstrap()
        kwargs = mock_create_app.call_args[1]
        assert kwargs["title"] == APP_TITLE
        assert kwargs["description"] == APP_DESCRIPTION

    @patch(PATCH_MAIN_CREATE_APP)
    @patch(PATCH_MAIN_CONFIG_LOADER)
    def test_returns_create_app_result(self, mock_cl_cls, mock_create_app):
        mock_cl_cls.return_value = _make_config_loader()
        result = bootstrap()
        assert result is mock_create_app.return_value

    @patch(PATCH_MAIN_CREATE_APP)
    @patch(PATCH_MAIN_CONFIG_LOADER)
    def test_token_secret_passed_through(self, mock_cl_cls, mock_create_app):
        mock_cl_cls.return_value = _make_config_loader({
            CFG_AUTH_SECRET_KEY: "my-secret-key",
        })
        bootstrap()
        assert mock_create_app.call_args[1]["token_secret"] == "my-secret-key"

    @patch(PATCH_MAIN_CREATE_APP)
    @patch(PATCH_MAIN_CONFIG_LOADER)
    def test_smtp_config_passed_through(self, mock_cl_cls, mock_create_app):
        fake_smtp = {"smtp_server": "mail.test.com", "smtp_port": 587}
        mock_cl_cls.return_value = _make_config_loader({
            CFG_SMTP: fake_smtp,
        })
        bootstrap()
        assert mock_create_app.call_args[1]["smtp_config"] == fake_smtp

    @patch(PATCH_MAIN_CREATE_APP)
    @patch(PATCH_MAIN_CONFIG_LOADER)
    def test_minimal_config_produces_defaults(self, mock_cl_cls, mock_create_app):
        mock_cl_cls.return_value = _make_config_loader()
        bootstrap()
        kwargs = mock_create_app.call_args[1]
        assert kwargs["db_config"] is None
        assert kwargs["token_secret"] is None
        assert kwargs["smtp_config"] is None
        assert kwargs["jira_config"] is None
        assert kwargs["gcs_config"] is None
        assert kwargs["cors_origins"] == [MOCK_URL_FRONTEND, MOCK_URL_FRONTEND_DEV]
        assert kwargs["file_storage_config"]["type"] == "local"
        assert kwargs["file_storage_config"]["base_path"] == MOCK_PATH_UPLOADS

    @patch(PATCH_MAIN_SETUP_SSL, return_value="/app/config/certificate/jira/combined.pem")
    @patch(PATCH_MAIN_CREATE_APP)
    @patch(PATCH_MAIN_CONFIG_LOADER)
    def test_bootstrap_sets_bundle_pem_path_when_ssl_configured(
        self, mock_cl_cls, mock_create_app, mock_setup_ssl,
    ):
        jira_raw = {
            "base_url": MOCK_URL_JIRA_EXAMPLE,
            "ssl": {"bundle_data": "cert-data", "bundle_path": "certificate/jira", "bundle_file_name": "combined.pem"},
        }
        mock_cl_cls.return_value = _make_config_loader({CFG_ENVIRONMENT_JIRA: jira_raw})
        bootstrap()

        mock_setup_ssl.assert_called_once()
        kwargs = mock_create_app.call_args[1]
        assert kwargs["jira_config"]["ssl"]["bundle_pem_path"] == "/app/config/certificate/jira/combined.pem"

    @patch(PATCH_MAIN_SETUP_SSL, return_value=None)
    @patch(PATCH_MAIN_CREATE_APP)
    @patch(PATCH_MAIN_CONFIG_LOADER)
    def test_bootstrap_no_pem_path_when_ssl_returns_none(
        self, mock_cl_cls, mock_create_app, mock_setup_ssl,
    ):
        jira_raw = {"base_url": MOCK_URL_JIRA_EXAMPLE, "ssl": {}}
        mock_cl_cls.return_value = _make_config_loader({CFG_ENVIRONMENT_JIRA: jira_raw})
        bootstrap()

        mock_setup_ssl.assert_called_once()
        kwargs = mock_create_app.call_args[1]
        assert "bundle_pem_path" not in kwargs["jira_config"]["ssl"]

    @patch(PATCH_MAIN_SETUP_SSL, return_value=None)
    @patch(PATCH_MAIN_CREATE_APP)
    @patch(PATCH_MAIN_CONFIG_LOADER)
    def test_bootstrap_skips_ssl_when_jira_none(
        self, mock_cl_cls, mock_create_app, mock_setup_ssl,
    ):
        mock_cl_cls.return_value = _make_config_loader()
        bootstrap()

        mock_setup_ssl.assert_called_once()
        kwargs = mock_create_app.call_args[1]
        assert kwargs["jira_config"] is None


# ============================================================================
# TestMainBlock
# ============================================================================
_MAIN_PY = Path(__file__).resolve().parent.parent / "src" / "main.py"


class TestMainBlock:
    """Test the ``if __name__ == '__main__'`` block."""

    def test_uvicorn_run_called_when_name_is_main(self):
        mock_uvicorn = MagicMock()
        # Only exec the __main__ guard — bootstrap() is already tested above
        code = (
            "if __name__ == '__main__':\n"
            "    import uvicorn\n"
            f'    uvicorn.run("{UVICORN_APP_REF}", host="0.0.0.0", port=8000, reload=True)\n'
        )
        ns = {
            "__name__": "__main__",
            "__builtins__": __builtins__,
            "uvicorn": mock_uvicorn,
        }
        # Patch the import so it uses our mock
        import builtins
        _real_import = builtins.__import__

        def _mock_import(name, *args, **kwargs):
            if name == "uvicorn":
                return mock_uvicorn
            return _real_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=_mock_import):
            exec(compile(code, "main.py", "exec"), ns)

        mock_uvicorn.run.assert_called_once_with(
            UVICORN_APP_REF, host=MOCK_IP_BIND_ALL, port=8000, reload=True,
        )

    def test_uvicorn_not_called_when_imported(self):
        code = (
            "if __name__ == '__main__':\n"
            "    import uvicorn\n"
            f'    uvicorn.run("{UVICORN_APP_REF}", host="0.0.0.0", port=8000, reload=True)\n'
        )
        mock_uvicorn = MagicMock()
        ns = {
            "__name__": "src.main",
            "__builtins__": __builtins__,
            "uvicorn": mock_uvicorn,
        }
        exec(compile(code, "main.py", "exec"), ns)
        mock_uvicorn.run.assert_not_called()
