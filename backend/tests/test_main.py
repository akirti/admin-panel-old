"""Tests for the main.py module (application entry point / configuration wiring).

Since main.py is a top-level script whose logic runs at import time, we
test it by ``exec``-ing the source with mocked imports injected into the
execution namespace.  This avoids fragile module-reload gymnastics and
gives full control over every dependency that main.py touches.
"""
import json
import os
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from easylifeauth import ENVIRONEMNT_VARIABLE_PREFIX

ENV_PREFIX = f"{ENVIRONEMNT_VARIABLE_PREFIX}_"


# ---------------------------------------------------------------------------
# Path to the real main.py source file
# ---------------------------------------------------------------------------
_MAIN_PY = Path(__file__).resolve().parent.parent / "src" / "main.py"


# ---------------------------------------------------------------------------
# Helper: build a mock ConfigurationLoader instance
# ---------------------------------------------------------------------------
def _make_config_instance(config_values=None):
    """Create a mock ConfigurationLoader instance.

    Parameters
    ----------
    config_values : dict | None
        Mapping of config paths to return values for get_config_by_path.
        Special key ``"db_config"`` controls get_DB_config("authentication").
    """
    config_values = config_values or {}
    instance = MagicMock()

    # get_DB_config
    instance.get_DB_config.return_value = config_values.get("db_config")

    # get_config_by_path — returns values from config_values by dot-path key
    def _get_config(path, default=None):
        if path in config_values:
            return config_values[path]
        return default

    instance.get_config_by_path.side_effect = _get_config
    return instance


# ---------------------------------------------------------------------------
# Helper: execute main.py in a controlled sandbox
# ---------------------------------------------------------------------------
def _run_main(env_overrides=None, config_values=None, name_override=None):
    """Execute ``src/main.py`` source code in an isolated namespace.

    Parameters
    ----------
    env_overrides : dict | None
        Extra environment variables to inject.
    config_values : dict | None
        Config values for the mock ConfigurationLoader.
    name_override : str | None
        Override ``__name__`` in the exec namespace.

    Returns
    -------
    tuple (namespace_dict, mock_create_app, mock_config_loader_cls)
    """
    env_overrides = env_overrides or {}

    # Build a clean copy of os.environ without variables main.py reads
    prefixes_to_strip = ("CONFIG_PATH", ENV_PREFIX)
    clean_env = {
        k: v for k, v in os.environ.items()
        if not any(k.startswith(p) for p in prefixes_to_strip)
    }
    clean_env.update(env_overrides)

    # -- Mock create_app -------------------------------------------------------
    mock_create_app = MagicMock(name="create_app")

    # -- Mock ConfigurationLoader ----------------------------------------------
    mock_config_loader_cls = MagicMock(name="ConfigurationLoader")
    instance = _make_config_instance(config_values)
    mock_config_loader_cls.return_value = instance

    # -- Read the source -------------------------------------------------------
    source = _MAIN_PY.read_text()

    # -- Patch imports ---------------------------------------------------------
    patched_source = source.replace(
        "from easylifeauth import ENVIRONEMNT_VARIABLE_PREFIX",
        "pass  # ENVIRONEMNT_VARIABLE_PREFIX injected",
    ).replace(
        "from easylifeauth.app import create_app",
        "pass  # create_app injected",
    ).replace(
        "from easylifeauth.utils.config import ConfigurationLoader",
        "pass  # ConfigurationLoader injected",
    )

    ns = {
        "__name__": name_override or "src.main",
        "__file__": str(_MAIN_PY),
        "__builtins__": __builtins__,
        "ENVIRONEMNT_VARIABLE_PREFIX": ENVIRONEMNT_VARIABLE_PREFIX,
        "create_app": mock_create_app,
        "ConfigurationLoader": mock_config_loader_cls,
    }

    with patch.dict(os.environ, clean_env, clear=True):
        exec(compile(patched_source, str(_MAIN_PY), "exec"), ns)

    return ns, mock_create_app, mock_config_loader_cls


# ============================================================================
# Tests
# ============================================================================


class TestConfigurationLoaderConstruction:
    """ConfigurationLoader should be instantiated with the correct arguments."""

    def test_default_config_path_and_environment(self):
        """Without env vars, uses default config path and 'production' environment."""
        _, _, mock_cl = _run_main()
        mock_cl.assert_called_once()
        kwargs = mock_cl.call_args[1]
        assert Path(kwargs["config_path"]).name == "config"
        assert kwargs["environment"] == "production"

    def test_custom_config_path(self):
        """CONFIG_PATH env var should override the config path."""
        _, _, mock_cl = _run_main(env_overrides={"CONFIG_PATH": "/custom/config"})
        kwargs = mock_cl.call_args[1]
        assert kwargs["config_path"] == "/custom/config"

    def test_custom_environment(self):
        """{prefix}_ENVIRONMENT env var should override the environment."""
        _, _, mock_cl = _run_main(
            env_overrides={f"{ENVIRONEMNT_VARIABLE_PREFIX}_ENVIRONMENT": "staging"},
        )
        kwargs = mock_cl.call_args[1]
        assert kwargs["environment"] == "staging"

    def test_both_custom_env_vars(self):
        """Both CONFIG_PATH and {prefix}_ENVIRONMENT should be forwarded."""
        _, _, mock_cl = _run_main(env_overrides={
            "CONFIG_PATH": "/etc/myapp",
            f"{ENVIRONEMNT_VARIABLE_PREFIX}_ENVIRONMENT": "test",
        })
        kwargs = mock_cl.call_args[1]
        assert kwargs["config_path"] == "/etc/myapp"
        assert kwargs["environment"] == "test"


class TestDBConfig:
    """Database configuration extraction and pool settings injection."""

    def test_db_config_from_loader(self):
        """DB config from get_DB_config should be passed to create_app."""
        fake_db = {"host": "dbhost", "database": "mydb"}
        _, mock_app, _ = _run_main(config_values={
            "db_config": fake_db,
            "globals.databases.default": {"max_pool_size": 100},
        })
        db = mock_app.call_args[1]["db_config"]
        assert db["host"] == "dbhost"
        assert db["database"] == "mydb"

    def test_pool_settings_injected(self):
        """Pool settings from globals.databases.default should be injected."""
        fake_db = {"host": "dbhost"}
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
        _, mock_app, _ = _run_main(config_values={
            "db_config": fake_db,
            "globals.databases.default": fake_pool,
        })
        db = mock_app.call_args[1]["db_config"]
        assert db["maxPoolSize"] == 100
        assert db["minPoolSize"] == 10
        assert db["maxIdleTimeMS"] == 600000
        assert db["serverSelectionTimeoutMS"] == 5000
        assert db["connectTimeoutMS"] == 3000
        assert db["socketTimeoutMS"] == 30000
        assert db["heartbeatFrequencyMS"] == 5000
        assert db["waitQueueTimeoutMS"] == 20000

    def test_pool_defaults_for_missing_keys(self):
        """Pool settings should use defaults when specific keys are missing."""
        fake_db = {"host": "dbhost"}
        _, mock_app, _ = _run_main(config_values={
            "db_config": fake_db,
            "globals.databases.default": {"max_pool_size": 100},
        })
        db = mock_app.call_args[1]["db_config"]
        assert db["maxPoolSize"] == 100
        assert db["minPoolSize"] == 5  # default
        assert db["maxIdleTimeMS"] == 300000  # default
        assert db["serverSelectionTimeoutMS"] == 30000  # default

    def test_db_config_none_when_loader_returns_none(self):
        """If get_DB_config returns None, db_config should be None."""
        _, mock_app, _ = _run_main(config_values={"db_config": None})
        assert mock_app.call_args[1]["db_config"] is None

    def test_pool_not_injected_when_db_config_none(self):
        """Pool settings should not be injected when db_config is None."""
        _, mock_app, _ = _run_main(config_values={
            "db_config": None,
            "globals.databases.default": {"max_pool_size": 100},
        })
        assert mock_app.call_args[1]["db_config"] is None

    def test_pool_not_injected_when_globals_none(self):
        """Pool settings should not be injected when globals returns None."""
        fake_db = {"host": "dbhost"}
        _, mock_app, _ = _run_main(config_values={
            "db_config": fake_db,
            "globals.databases.default": None,
        })
        db = mock_app.call_args[1]["db_config"]
        assert "maxPoolSize" not in db

    def test_pool_not_injected_when_globals_empty_dict(self):
        """Empty dict is falsy — pool settings should not be injected."""
        fake_db = {"host": "dbhost"}
        _, mock_app, _ = _run_main(config_values={
            "db_config": fake_db,
            "globals.databases.default": {},
        })
        db = mock_app.call_args[1]["db_config"]
        assert "maxPoolSize" not in db


class TestTokenSecret:
    """Token secret extraction."""

    def test_token_secret_passed_through(self):
        """Auth secret from config should be passed to create_app."""
        _, mock_app, _ = _run_main(config_values={
            "environment.app_secrets.auth_secret_key": "my-secret-key",
        })
        assert mock_app.call_args[1]["token_secret"] == "my-secret-key"

    def test_token_secret_none_when_not_configured(self):
        """Token secret should be None when not in config."""
        _, mock_app, _ = _run_main()
        assert mock_app.call_args[1]["token_secret"] is None


class TestSMTPConfig:
    """SMTP configuration extraction."""

    def test_smtp_config_passed_through(self):
        """SMTP config should be passed to create_app."""
        fake_smtp = {"smtp_server": "mail.test.com", "smtp_port": 587}
        _, mock_app, _ = _run_main(config_values={
            "environment.smtp": fake_smtp,
        })
        assert mock_app.call_args[1]["smtp_config"] == fake_smtp

    def test_smtp_config_none_when_not_configured(self):
        """SMTP config should be None when not in config."""
        _, mock_app, _ = _run_main()
        assert mock_app.call_args[1]["smtp_config"] is None


class TestCORSOrigins:
    """CORS origins extraction and fallback."""

    def test_cors_origins_from_config(self):
        """CORS origins from config should be used."""
        _, mock_app, _ = _run_main(config_values={
            "environment.cors.origins": ["http://example.com"],
        })
        assert mock_app.call_args[1]["cors_origins"] == ["http://example.com"]

    def test_cors_origins_fallback_when_none(self):
        """When cors.origins is None, should fallback to default localhost list."""
        _, mock_app, _ = _run_main(config_values={
            "environment.cors.origins": None,
        })
        assert mock_app.call_args[1]["cors_origins"] == [
            "http://localhost:3000", "http://localhost:5173"
        ]

    def test_cors_origins_fallback_when_not_set(self):
        """When cors.origins is not in config at all, should fallback."""
        _, mock_app, _ = _run_main()
        assert mock_app.call_args[1]["cors_origins"] == [
            "http://localhost:3000", "http://localhost:5173"
        ]

    def test_cors_empty_list_triggers_fallback(self):
        """Empty list is falsy — should trigger fallback to defaults."""
        _, mock_app, _ = _run_main(config_values={
            "environment.cors.origins": [],
        })
        assert mock_app.call_args[1]["cors_origins"] == [
            "http://localhost:3000", "http://localhost:5173"
        ]


class TestStorageConfig:
    """File storage and GCS configuration."""

    def test_default_local_storage(self):
        """When no storage config, should default to local."""
        _, mock_app, _ = _run_main()
        fsc = mock_app.call_args[1]["file_storage_config"]
        assert fsc["type"] == "local"
        assert fsc["base_path"] == "/tmp/easylife_uploads"
        assert mock_app.call_args[1]["gcs_config"] is None

    def test_gcs_storage_with_credentials_dict(self):
        """GCS storage with credentials as a dict should build gcs_config."""
        storage = {
            "type": "gcs",
            "gcp": {
                "credentials_json": {"type": "service_account", "project_id": "test"},
                "bucket_name": "my-bucket",
                "upload_folder": "uploads",
                "config_folder": "config",
                "project_id": "test-proj",
                "project_name": "Test Project",
                "credentials_path": "path/to/creds",
            },
        }
        _, mock_app, _ = _run_main(config_values={"environment.storage": storage})

        fsc = mock_app.call_args[1]["file_storage_config"]
        assert fsc["type"] == "gcs"
        assert fsc["bucket_name"] == "my-bucket"
        assert fsc["base_path"] == "/tmp/easylife_uploads"

        gcs = mock_app.call_args[1]["gcs_config"]
        assert gcs is not None
        assert json.loads(gcs["credentials_json"]) == {
            "type": "service_account", "project_id": "test"
        }
        assert gcs["bucket_name"] == "my-bucket"
        assert gcs["upload_folder"] == "uploads"
        assert gcs["config_folder"] == "config"
        assert gcs["project_id"] == "test-proj"
        assert gcs["project_name"] == "Test Project"
        assert gcs["credentials_path"] == "path/to/creds"

    def test_gcs_storage_with_credentials_string(self):
        """GCS storage with credentials as a JSON string."""
        storage = {
            "type": "gcs",
            "gcp": {
                "credentials_json": '{"type":"service_account"}',
                "bucket_name": "bucket",
            },
        }
        _, mock_app, _ = _run_main(config_values={"environment.storage": storage})

        gcs = mock_app.call_args[1]["gcs_config"]
        assert gcs["credentials_json"] == '{"type":"service_account"}'

    def test_gcs_without_credentials_stays_local(self):
        """GCS type but no credentials -> stays local."""
        storage = {"type": "gcs", "gcp": {}}
        _, mock_app, _ = _run_main(config_values={"environment.storage": storage})
        fsc = mock_app.call_args[1]["file_storage_config"]
        assert fsc["type"] == "local"
        assert mock_app.call_args[1]["gcs_config"] is None

    def test_storage_type_defaults_to_local(self):
        """Storage without explicit type defaults to 'local'."""
        storage = {"gcp": {}}
        _, mock_app, _ = _run_main(config_values={"environment.storage": storage})
        fsc = mock_app.call_args[1]["file_storage_config"]
        assert fsc["type"] == "local"

    def test_storage_with_no_gcp_key(self):
        """Storage config without 'gcp' key should use empty dict default."""
        storage = {"type": "gcs"}
        _, mock_app, _ = _run_main(config_values={"environment.storage": storage})
        fsc = mock_app.call_args[1]["file_storage_config"]
        assert fsc["type"] == "local"
        assert mock_app.call_args[1]["gcs_config"] is None


class TestJiraConfig:
    """Jira configuration extraction."""

    def test_jira_config_with_all_fields(self):
        """Jira config should be built when base_url is present."""
        jira_raw = {
            "base_url": "https://jira.example.com",
            "email": "bot@test.com",
            "api_token": "tok123",
            "project_key": "PROJ",
            "issue_type": "Bug",
            "components": ["web"],
            "default_team": "Alpha",
            "default_assignee": "user1",
            "default_assignee_name": "Jane",
            "default_priority": "High",
            "default_epic": "EPIC-1",
            "default_watchers": ["watcher1"],
            "default_task_environment": "PROD",
            "default_task_labels": "urgent",
            "default_target_days": 14,
            "ssl": {"enabled": True},
        }
        _, mock_app, _ = _run_main(config_values={"environment.jira": jira_raw})

        jira = mock_app.call_args[1]["jira_config"]
        assert jira is not None
        assert jira["base_url"] == "https://jira.example.com"
        assert jira["email"] == "bot@test.com"
        assert jira["api_token"] == "tok123"
        assert jira["project_key"] == "PROJ"
        assert jira["issue_type"] == "Bug"
        assert jira["components"] == ["web"]
        assert jira["default_team"] == "Alpha"
        assert jira["default_assignee"] == "user1"
        assert jira["default_assignee_name"] == "Jane"
        assert jira["default_priority"] == "High"
        assert jira["default_epic"] == "EPIC-1"
        assert jira["default_watchers"] == ["watcher1"]
        assert jira["default_task_environment"] == "PROD"
        assert jira["default_task_labels"] == "urgent"
        assert jira["target_days"] == 14
        assert jira["ssl"] == {"enabled": True}

    def test_jira_config_defaults(self):
        """Jira config should use defaults for optional fields."""
        jira_raw = {
            "base_url": "https://jira.test.com",
            "email": "bot@test.com",
            "api_token": "tok",
        }
        _, mock_app, _ = _run_main(config_values={"environment.jira": jira_raw})

        jira = mock_app.call_args[1]["jira_config"]
        assert jira["project_key"] == "SCEN"
        assert jira["issue_type"] == "Task"
        assert jira["default_priority"] == "Medium"
        assert jira["target_days"] == 7
        assert jira["components"] == []
        assert jira["default_watchers"] == []
        assert jira["default_team"] is None
        assert jira["default_assignee"] is None
        assert jira["default_assignee_name"] is None

    def test_jira_config_none_when_no_base_url(self):
        """Jira config should be None when base_url is missing."""
        jira_raw = {"email": "bot@test.com", "api_token": "tok"}
        _, mock_app, _ = _run_main(config_values={"environment.jira": jira_raw})
        assert mock_app.call_args[1]["jira_config"] is None

    def test_jira_config_none_when_base_url_empty(self):
        """Empty base_url should result in None jira_config."""
        jira_raw = {"base_url": "", "email": "e", "api_token": "t"}
        _, mock_app, _ = _run_main(config_values={"environment.jira": jira_raw})
        assert mock_app.call_args[1]["jira_config"] is None

    def test_jira_config_none_when_not_configured(self):
        """Jira config should be None when no jira config exists."""
        _, mock_app, _ = _run_main()
        assert mock_app.call_args[1]["jira_config"] is None

    def test_jira_config_none_when_jira_raw_is_none(self):
        """Jira config should be None when jira returns None."""
        _, mock_app, _ = _run_main(config_values={"environment.jira": None})
        assert mock_app.call_args[1]["jira_config"] is None

    def test_jira_target_days_string_conversion(self):
        """target_days should be converted to int even if string."""
        jira_raw = {"base_url": "https://jira.test.com", "default_target_days": "21"}
        _, mock_app, _ = _run_main(config_values={"environment.jira": jira_raw})
        jira = mock_app.call_args[1]["jira_config"]
        assert jira["target_days"] == 21


class TestCreateAppInvocation:
    """Ensure create_app is called exactly once with the right keyword arguments."""

    def test_all_kwargs_present(self):
        """create_app must receive all expected keyword arguments."""
        _, mock_app, _ = _run_main()
        mock_app.assert_called_once()
        kwargs = mock_app.call_args[1]
        expected_keys = {
            "db_config", "token_secret", "smtp_config", "jira_config",
            "file_storage_config", "gcs_config", "cors_origins",
            "title", "description",
        }
        assert set(kwargs.keys()) == expected_keys

    def test_title_and_description(self):
        """create_app should receive the correct title and description."""
        _, mock_app, _ = _run_main()
        kwargs = mock_app.call_args[1]
        assert kwargs["title"] == "EasyLife Admin Panel API"
        assert kwargs["description"] == "Authentication, Authorization, and Administration API"

    def test_app_is_return_value_of_create_app(self):
        """The module-level ``app`` should be the return value of create_app."""
        ns, mock_app, _ = _run_main()
        assert ns["app"] is mock_app.return_value


class TestMainBlock:
    """Test the ``if __name__ == '__main__'`` block."""

    def test_uvicorn_run_called_when_name_is_main(self):
        """Simulating __name__ == '__main__' should call uvicorn.run."""
        mock_uvicorn = MagicMock()

        source = _MAIN_PY.read_text()
        patched_source = source.replace(
            "from easylifeauth import ENVIRONEMNT_VARIABLE_PREFIX",
            "pass  # ENVIRONEMNT_VARIABLE_PREFIX injected",
        ).replace(
            "from easylifeauth.app import create_app",
            "pass  # create_app injected",
        ).replace(
            "from easylifeauth.utils.config import ConfigurationLoader",
            "pass  # ConfigurationLoader injected",
        ).replace(
            "import uvicorn",
            "pass  # uvicorn injected",
        )

        ns = {
            "__name__": "__main__",
            "__file__": str(_MAIN_PY),
            "__builtins__": __builtins__,
            "ENVIRONEMNT_VARIABLE_PREFIX": ENVIRONEMNT_VARIABLE_PREFIX,
            "create_app": MagicMock(),
            "ConfigurationLoader": MagicMock(),
            "uvicorn": mock_uvicorn,
        }

        clean_env = {
            k: v for k, v in os.environ.items()
            if not any(k.startswith(p) for p in ("CONFIG_PATH", ENV_PREFIX))
        }

        with patch.dict(os.environ, clean_env, clear=True):
            exec(compile(patched_source, str(_MAIN_PY), "exec"), ns)

        mock_uvicorn.run.assert_called_once_with(
            "src.main:app", host="0.0.0.0", port=8000, reload=True,
        )

    def test_uvicorn_not_called_when_imported(self):
        """When imported normally, uvicorn.run should NOT be called."""
        ns, mock_app, _ = _run_main(name_override="src.main")
        # uvicorn is only imported inside the __main__ block,
        # so it should not appear in the namespace at all
        mock_app.assert_called_once()


class TestEdgeCases:
    """Edge cases and boundary conditions."""

    def test_no_config_produces_minimal_app(self):
        """With empty config, only defaults remain."""
        _, mock_app, _ = _run_main()
        kwargs = mock_app.call_args[1]
        assert kwargs["db_config"] is None
        assert kwargs["token_secret"] is None
        assert kwargs["smtp_config"] is None
        assert kwargs["jira_config"] is None
        assert kwargs["gcs_config"] is None
        assert kwargs["cors_origins"] == [
            "http://localhost:3000", "http://localhost:5173"
        ]
        assert kwargs["file_storage_config"]["type"] == "local"
        assert kwargs["file_storage_config"]["base_path"] == "/tmp/easylife_uploads"
