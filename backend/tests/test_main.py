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


# ---------------------------------------------------------------------------
# Path to the real main.py source file
# ---------------------------------------------------------------------------
_MAIN_PY = Path(__file__).resolve().parent.parent / "src" / "main.py"


# ---------------------------------------------------------------------------
# Helper: execute main.py in a controlled sandbox
# ---------------------------------------------------------------------------
def _run_main(env_overrides=None, config_loader_side_effect=None,
              config_loader_returns=None, name_override=None):
    """Execute ``src/main.py`` source code in an isolated namespace.

    Parameters
    ----------
    env_overrides : dict | None
        Extra environment variables to inject.  All host variables that
        main.py would read are stripped first so the real host config
        does not leak into the test.
    config_loader_side_effect : Exception | None
        If set, instantiating ``ConfigurationLoader`` will raise this
        exception, simulating a config-file loading failure.
    config_loader_returns : dict | None
        Controls what the mock ``ConfigurationLoader`` instance returns.
        Recognised keys: ``db_config``, ``token_secret``, ``smtp_config``,
        ``cors_origins``.
    name_override : str | None
        Override ``__name__`` in the exec namespace.  Defaults to
        ``"src.main"`` (normal import).

    Returns
    -------
    tuple (namespace_dict, mock_create_app, mock_config_loader_cls,
           mock_load_dotenv)
    """
    env_overrides = env_overrides or {}
    config_loader_returns = config_loader_returns or {}

    # Build a clean copy of os.environ without variables main.py reads
    prefixes_to_strip = (
        "MONGODB_", "JWT_", "SMTP_", "CORS_", "GCS_", "FILE_STORAGE_",
        "JIRA_", "LOCAL_UPLOAD_", "CONFIG_PATH", "EASYLIFE_",
    )
    clean_env = {
        k: v for k, v in os.environ.items()
        if not any(k.startswith(p) for p in prefixes_to_strip)
    }
    clean_env.update(env_overrides)

    # -- Mock create_app -------------------------------------------------------
    mock_create_app = MagicMock(name="create_app")

    # -- Mock load_dotenv ------------------------------------------------------
    mock_load_dotenv = MagicMock(name="load_dotenv")

    # -- Mock ConfigurationLoader ----------------------------------------------
    mock_config_loader_cls = MagicMock(name="ConfigurationLoader")
    if config_loader_side_effect:
        mock_config_loader_cls.side_effect = config_loader_side_effect
    else:
        instance = MagicMock()
        instance.get_DB_config.return_value = config_loader_returns.get("db_config")
        instance.get_config_by_path.side_effect = lambda path, *a, **kw: {
            "specs.app_secrets.auth_secret_key": config_loader_returns.get("token_secret"),
            "specs.smtp": config_loader_returns.get("smtp_config"),
            "cors.origins": config_loader_returns.get("cors_origins"),
        }.get(path)
        mock_config_loader_cls.return_value = instance

    # -- Read the source -------------------------------------------------------
    source = _MAIN_PY.read_text()

    # -- Build the execution namespace -----------------------------------------
    # We inject mocks so that ``from X import Y`` at the top of main.py
    # is replaced by simple namespace lookups.
    #
    # The trick: we *rewrite* the three ``from ... import ...`` lines so
    # that they become simple assignments from our mocks.
    patched_source = source.replace(
        "from dotenv import load_dotenv",
        "pass  # load_dotenv injected",
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
        # Inject mocks
        "load_dotenv": mock_load_dotenv,
        "create_app": mock_create_app,
        "ConfigurationLoader": mock_config_loader_cls,
    }

    with patch.dict(os.environ, clean_env, clear=True):
        exec(compile(patched_source, str(_MAIN_PY), "exec"), ns)

    return ns, mock_create_app, mock_config_loader_cls, mock_load_dotenv


# ============================================================================
# Tests
# ============================================================================


class TestDefaultConfigLoading:
    """When no relevant env vars are set and config file loading fails,
    main.py should fall back to safe defaults."""

    def test_create_app_called_with_defaults_on_config_failure(self):
        """Config loader raises -> all configs fall back to None / defaults."""
        _, mock_create_app, _, _ = _run_main(
            config_loader_side_effect=FileNotFoundError("no config"),
        )

        mock_create_app.assert_called_once()
        kwargs = mock_create_app.call_args[1]

        assert kwargs["db_config"] is None
        assert kwargs["token_secret"] is None
        assert kwargs["smtp_config"] is None
        assert kwargs["cors_origins"] == ["*"]
        assert kwargs["title"] == "EasyLife Admin Panel API"
        assert kwargs["description"] == "Authentication, Authorization, and Administration API"

    def test_file_storage_defaults_to_local(self):
        """Without FILE_STORAGE_TYPE, storage should default to local."""
        _, mock_create_app, _, _ = _run_main(
            config_loader_side_effect=Exception("nope"),
        )

        kwargs = mock_create_app.call_args[1]
        assert kwargs["file_storage_config"]["type"] == "local"
        assert kwargs["file_storage_config"]["base_path"] == "/tmp/easylife_uploads"

    def test_gcs_config_is_none_by_default(self):
        """Without GCS env vars, gcs_config should be None."""
        _, mock_create_app, _, _ = _run_main(
            config_loader_side_effect=Exception("nope"),
        )

        kwargs = mock_create_app.call_args[1]
        assert kwargs["gcs_config"] is None

    def test_jira_config_is_none_by_default(self):
        """Without JIRA env vars, jira_config should be None."""
        _, mock_create_app, _, _ = _run_main(
            config_loader_side_effect=Exception("nope"),
        )

        kwargs = mock_create_app.call_args[1]
        assert kwargs["jira_config"] is None

    def test_load_dotenv_called(self):
        """load_dotenv should always be called."""
        _, _, _, mock_load_dotenv = _run_main(
            config_loader_side_effect=Exception("nope"),
        )

        mock_load_dotenv.assert_called_once()


class TestConfigFileLoading:
    """When the config file loads successfully, the values should be passed
    through to create_app."""

    def test_config_values_passed_through(self):
        """Values from ConfigurationLoader should reach create_app."""
        fake_db = {"host": "confighost", "database": "configdb"}
        fake_smtp = {"smtp_server": "smtp.config.local", "smtp_port": 587}
        fake_cors = ["http://localhost:3000", "http://localhost:5173"]

        _, mock_create_app, _, _ = _run_main(
            config_loader_returns={
                "db_config": fake_db,
                "token_secret": "config_secret_123",
                "smtp_config": fake_smtp,
                "cors_origins": fake_cors,
            },
        )

        kwargs = mock_create_app.call_args[1]
        assert kwargs["db_config"] == fake_db
        assert kwargs["token_secret"] == "config_secret_123"
        assert kwargs["smtp_config"] == fake_smtp
        assert kwargs["cors_origins"] == fake_cors

    def test_cors_defaults_to_star_when_config_returns_none(self):
        """If config loader returns None for cors.origins, default to ['*']."""
        _, mock_create_app, _, _ = _run_main(
            config_loader_returns={
                "db_config": None,
                "token_secret": None,
                "smtp_config": None,
                "cors_origins": None,
            },
        )

        kwargs = mock_create_app.call_args[1]
        assert kwargs["cors_origins"] == ["*"]


class TestEnvVarOverrides:
    """Environment variables should override values from the config file."""

    def test_mongodb_host_env_overrides_config(self):
        """Setting MONGODB_HOST should build a full db_config dict."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={"MONGODB_HOST": "envhost"},
            config_loader_returns={"db_config": {"host": "confighost"}},
        )

        kwargs = mock_create_app.call_args[1]
        db = kwargs["db_config"]
        assert db["host"] == "envhost"
        assert db["connectionScheme"] == "mongodb"
        assert db["username"] == "admin"
        assert db["password"] == "password"
        assert db["database"] == "easylife_auth"
        assert isinstance(db["collections"], list)
        assert "users" in db["collections"]

    def test_mongodb_env_custom_values(self):
        """All MONGODB_* env vars should populate the db_config."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "MONGODB_HOST": "mongo.custom.io",
                "MONGODB_SCHEME": "mongodb+srv",
                "MONGODB_USERNAME": "myuser",
                "MONGODB_PASSWORD": "mypass",
                "MONGODB_DATABASE": "mydb",
                "MONGODB_MAX_POOL_SIZE": "100",
                "MONGODB_MIN_POOL_SIZE": "10",
                "MONGODB_MAX_IDLE_TIME_MS": "600000",
                "MONGODB_SERVER_SELECTION_TIMEOUT_MS": "5000",
                "MONGODB_CONNECT_TIMEOUT_MS": "3000",
                "MONGODB_SOCKET_TIMEOUT_MS": "30000",
                "MONGODB_HEARTBEAT_FREQUENCY_MS": "5000",
                "MONGODB_WAIT_QUEUE_TIMEOUT_MS": "20000",
            },
            config_loader_side_effect=Exception("nope"),
        )

        db = mock_create_app.call_args[1]["db_config"]
        assert db["host"] == "mongo.custom.io"
        assert db["connectionScheme"] == "mongodb+srv"
        assert db["username"] == "myuser"
        assert db["password"] == "mypass"
        assert db["database"] == "mydb"
        assert db["maxPoolSize"] == "100"
        assert db["minPoolSize"] == "10"
        assert db["maxIdleTimeMS"] == "600000"
        assert db["serverSelectionTimeoutMS"] == "5000"
        assert db["connectTimeoutMS"] == "3000"
        assert db["socketTimeoutMS"] == "30000"
        assert db["heartbeatFrequencyMS"] == "5000"
        assert db["waitQueueTimeoutMS"] == "20000"

    def test_easylife_prefixed_mongodb_host(self):
        """EASYLIFE_DATABASES_AUTHENTICATION_DB_INFO_HOST as fallback."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "EASYLIFE_DATABASES_AUTHENTICATION_DB_INFO_HOST": "legacyhost",
            },
            config_loader_side_effect=Exception("nope"),
        )

        db = mock_create_app.call_args[1]["db_config"]
        assert db["host"] == "legacyhost"

    def test_easylife_prefixed_mongodb_fields(self):
        """EASYLIFE_DATABASES_AUTHENTICATION_DB_INFO_* as fallback for all fields."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "EASYLIFE_DATABASES_AUTHENTICATION_DB_INFO_HOST": "legacyhost",
                "EASYLIFE_DATABASES_AUTHENTICATION_DB_INFO_CONNECTIONSCHEME": "mongodb+srv",
                "EASYLIFE_DATABASES_AUTHENTICATION_DB_INFO_USERNAME": "legacyuser",
                "EASYLIFE_DATABASES_AUTHENTICATION_DB_INFO_PASSWORD": "legacypass",
                "EASYLIFE_DATABASES_AUTHENTICATION_DB_INFO_DATABASE": "legacydb",
            },
            config_loader_side_effect=Exception("nope"),
        )

        db = mock_create_app.call_args[1]["db_config"]
        assert db["connectionScheme"] == "mongodb+srv"
        assert db["username"] == "legacyuser"
        assert db["password"] == "legacypass"
        assert db["database"] == "legacydb"

    def test_jwt_secret_key_env(self):
        """JWT_SECRET_KEY env should override config file secret."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={"JWT_SECRET_KEY": "env_jwt_secret"},
            config_loader_returns={"token_secret": "config_secret"},
        )

        assert mock_create_app.call_args[1]["token_secret"] == "env_jwt_secret"

    def test_easylife_prefixed_jwt_secret(self):
        """EASYLIFE_SPECS_APP_SECRETS_AUTH_SECRET_KEY as fallback."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "EASYLIFE_SPECS_APP_SECRETS_AUTH_SECRET_KEY": "legacy_jwt",
            },
            config_loader_side_effect=Exception("nope"),
        )

        assert mock_create_app.call_args[1]["token_secret"] == "legacy_jwt"

    def test_smtp_server_env(self):
        """SMTP_SERVER env should build a complete smtp_config."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "SMTP_SERVER": "smtp.env.local",
                "SMTP_PORT": "587",
                "SMTP_EMAIL": "me@env.local",
                "SMTP_PASSWORD": "s3cret",
            },
            config_loader_side_effect=Exception("nope"),
        )

        smtp = mock_create_app.call_args[1]["smtp_config"]
        assert smtp["smtp_server"] == "smtp.env.local"
        assert smtp["smtp_port"] == 587
        assert smtp["email"] == "me@env.local"
        assert smtp["password"] == "s3cret"

    def test_smtp_server_defaults(self):
        """SMTP config should use defaults when only SMTP_SERVER is set."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={"SMTP_SERVER": "mail.local"},
            config_loader_side_effect=Exception("nope"),
        )

        smtp = mock_create_app.call_args[1]["smtp_config"]
        assert smtp["smtp_port"] == 25
        assert smtp["email"] == "noreply@easylife.local"
        assert smtp["password"] == ""

    def test_easylife_prefixed_smtp(self):
        """EASYLIFE_SPECS_SMTP_SMTP_SERVER as fallback for SMTP_SERVER."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "EASYLIFE_SPECS_SMTP_SMTP_SERVER": "legacy.smtp.local",
            },
            config_loader_side_effect=Exception("nope"),
        )

        smtp = mock_create_app.call_args[1]["smtp_config"]
        assert smtp["smtp_server"] == "legacy.smtp.local"

    def test_easylife_prefixed_smtp_fields(self):
        """EASYLIFE_SPECS_SMTP_* fallbacks for port, email, password."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "EASYLIFE_SPECS_SMTP_SMTP_SERVER": "legacy.smtp",
                "EASYLIFE_SPECS_SMTP_SMTP_PORT": "465",
                "EASYLIFE_SPECS_SMTP_EMAIL": "legacy@smtp.local",
                "EASYLIFE_SPECS_SMTP_PASSWORD": "legacypass",
            },
            config_loader_side_effect=Exception("nope"),
        )

        smtp = mock_create_app.call_args[1]["smtp_config"]
        assert smtp["smtp_port"] == 465
        assert smtp["email"] == "legacy@smtp.local"
        assert smtp["password"] == "legacypass"

    def test_cors_origins_env(self):
        """CORS_ORIGINS env should split on commas."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "CORS_ORIGINS": "http://a.com, http://b.com , http://c.com",
            },
            config_loader_side_effect=Exception("nope"),
        )

        cors = mock_create_app.call_args[1]["cors_origins"]
        assert cors == ["http://a.com", "http://b.com", "http://c.com"]

    def test_cors_origins_single_value(self):
        """CORS_ORIGINS with a single origin (no comma)."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={"CORS_ORIGINS": "http://only.com"},
            config_loader_side_effect=Exception("nope"),
        )

        cors = mock_create_app.call_args[1]["cors_origins"]
        assert cors == ["http://only.com"]


class TestFileStorageConfig:
    """Tests for FILE_STORAGE_TYPE and related env vars."""

    def test_local_storage_explicit(self):
        """FILE_STORAGE_TYPE=local should produce local config."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={"FILE_STORAGE_TYPE": "local"},
            config_loader_side_effect=Exception("nope"),
        )

        fsc = mock_create_app.call_args[1]["file_storage_config"]
        assert fsc["type"] == "local"
        assert fsc["base_path"] == "/tmp/easylife_uploads"

    def test_local_storage_custom_path(self):
        """LOCAL_UPLOAD_PATH should override the default base_path."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "FILE_STORAGE_TYPE": "local",
                "LOCAL_UPLOAD_PATH": "/data/uploads",
            },
            config_loader_side_effect=Exception("nope"),
        )

        fsc = mock_create_app.call_args[1]["file_storage_config"]
        assert fsc["base_path"] == "/data/uploads"

    def test_gcs_storage_with_credentials(self):
        """FILE_STORAGE_TYPE=gcs with valid GCS vars should produce gcs config."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "FILE_STORAGE_TYPE": "gcs",
                "GCS_CREDENTIALS_JSON": '{"type":"service_account"}',
                "GCS_BUCKET_NAME": "my-bucket",
            },
            config_loader_side_effect=Exception("nope"),
        )

        fsc = mock_create_app.call_args[1]["file_storage_config"]
        assert fsc["type"] == "gcs"
        assert fsc["bucket_name"] == "my-bucket"
        assert fsc["credentials_json"] == '{"type":"service_account"}'

    def test_gcs_storage_without_credentials_falls_back_to_local(self):
        """FILE_STORAGE_TYPE=gcs but no GCS creds -> local fallback."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={"FILE_STORAGE_TYPE": "gcs"},
            config_loader_side_effect=Exception("nope"),
        )

        fsc = mock_create_app.call_args[1]["file_storage_config"]
        assert fsc["type"] == "local"

    def test_gcs_storage_with_empty_credentials_falls_back_to_local(self):
        """GCS_CREDENTIALS_JSON='{}' should be treated as not set."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "FILE_STORAGE_TYPE": "gcs",
                "GCS_CREDENTIALS_JSON": "{}",
                "GCS_BUCKET_NAME": "bucket",
            },
            config_loader_side_effect=Exception("nope"),
        )

        fsc = mock_create_app.call_args[1]["file_storage_config"]
        assert fsc["type"] == "local"

    def test_gcs_config_populated_when_credentials_valid(self):
        """gcs_config kwarg should be populated with valid GCS env vars."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "GCS_CREDENTIALS_JSON": '{"type":"service_account"}',
                "GCS_BUCKET_NAME": "test-bucket",
            },
            config_loader_side_effect=Exception("nope"),
        )

        gcs = mock_create_app.call_args[1]["gcs_config"]
        assert gcs is not None
        assert gcs["credentials_json"] == '{"type":"service_account"}'
        assert gcs["bucket_name"] == "test-bucket"

    def test_gcs_config_none_when_credentials_empty_braces(self):
        """GCS_CREDENTIALS_JSON='{}' -> gcs_config is None."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "GCS_CREDENTIALS_JSON": "{}",
                "GCS_BUCKET_NAME": "test-bucket",
            },
            config_loader_side_effect=Exception("nope"),
        )

        gcs = mock_create_app.call_args[1]["gcs_config"]
        assert gcs is None

    def test_gcs_storage_base_path_uses_local_upload_path(self):
        """GCS file_storage_config should include base_path from LOCAL_UPLOAD_PATH."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "FILE_STORAGE_TYPE": "gcs",
                "GCS_CREDENTIALS_JSON": '{"type":"service_account"}',
                "GCS_BUCKET_NAME": "my-bucket",
                "LOCAL_UPLOAD_PATH": "/custom/path",
            },
            config_loader_side_effect=Exception("nope"),
        )

        fsc = mock_create_app.call_args[1]["file_storage_config"]
        assert fsc["base_path"] == "/custom/path"


class TestJiraConfig:
    """Tests for Jira configuration via environment variables."""

    def test_jira_config_with_all_required_vars(self):
        """All three required JIRA vars should produce a jira_config."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "JIRA_BASE_URL": "https://jira.example.com",
                "JIRA_EMAIL": "bot@example.com",
                "JIRA_API_TOKEN": "tok123",
            },
            config_loader_side_effect=Exception("nope"),
        )

        jira = mock_create_app.call_args[1]["jira_config"]
        assert jira is not None
        assert jira["base_url"] == "https://jira.example.com"
        assert jira["email"] == "bot@example.com"
        assert jira["api_token"] == "tok123"
        # defaults
        assert jira["project_key"] == "SCEN"
        assert jira["issue_type"] == "Task"
        assert jira["target_days"] == 7

    def test_jira_config_custom_optional_fields(self):
        """Optional JIRA vars should be picked up."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "JIRA_BASE_URL": "https://jira.example.com",
                "JIRA_EMAIL": "bot@example.com",
                "JIRA_API_TOKEN": "tok123",
                "JIRA_PROJECT_KEY": "PROJ",
                "JIRA_ISSUE_TYPE": "Bug",
                "JIRA_DEFAULT_TEAM": "Alpha",
                "JIRA_DEFAULT_ASSIGNEE": "user123",
                "JIRA_DEFAULT_ASSIGNEE_NAME": "Jane Doe",
                "JIRA_TARGET_DAYS": "14",
            },
            config_loader_side_effect=Exception("nope"),
        )

        jira = mock_create_app.call_args[1]["jira_config"]
        assert jira["project_key"] == "PROJ"
        assert jira["issue_type"] == "Bug"
        assert jira["default_team"] == "Alpha"
        assert jira["default_assignee"] == "user123"
        assert jira["default_assignee_name"] == "Jane Doe"
        assert jira["target_days"] == 14

    def test_jira_default_team_and_assignee_are_none_when_unset(self):
        """Without optional JIRA vars, default_team/assignee should be None."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "JIRA_BASE_URL": "https://jira.example.com",
                "JIRA_EMAIL": "bot@example.com",
                "JIRA_API_TOKEN": "tok123",
            },
            config_loader_side_effect=Exception("nope"),
        )

        jira = mock_create_app.call_args[1]["jira_config"]
        assert jira["default_team"] is None
        assert jira["default_assignee"] is None
        assert jira["default_assignee_name"] is None

    def test_jira_config_none_when_base_url_missing(self):
        """Missing JIRA_BASE_URL -> jira_config is None."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "JIRA_EMAIL": "bot@example.com",
                "JIRA_API_TOKEN": "tok123",
            },
            config_loader_side_effect=Exception("nope"),
        )

        assert mock_create_app.call_args[1]["jira_config"] is None

    def test_jira_config_none_when_email_missing(self):
        """Missing JIRA_EMAIL -> jira_config is None."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "JIRA_BASE_URL": "https://jira.example.com",
                "JIRA_API_TOKEN": "tok123",
            },
            config_loader_side_effect=Exception("nope"),
        )

        assert mock_create_app.call_args[1]["jira_config"] is None

    def test_jira_config_none_when_token_missing(self):
        """Missing JIRA_API_TOKEN -> jira_config is None."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "JIRA_BASE_URL": "https://jira.example.com",
                "JIRA_EMAIL": "bot@example.com",
            },
            config_loader_side_effect=Exception("nope"),
        )

        assert mock_create_app.call_args[1]["jira_config"] is None


class TestConfigFileFallback:
    """Tests for graceful fallback when the config file cannot be loaded."""

    def test_file_not_found_error(self):
        """FileNotFoundError from ConfigurationLoader -> fallback."""
        _, mock_create_app, _, _ = _run_main(
            config_loader_side_effect=FileNotFoundError("no such file"),
        )

        kwargs = mock_create_app.call_args[1]
        assert kwargs["db_config"] is None
        assert kwargs["token_secret"] is None
        assert kwargs["smtp_config"] is None
        assert kwargs["cors_origins"] == ["*"]

    def test_json_decode_error(self):
        """JSONDecodeError from config -> fallback."""
        _, mock_create_app, _, _ = _run_main(
            config_loader_side_effect=json.JSONDecodeError("bad json", "", 0),
        )

        kwargs = mock_create_app.call_args[1]
        assert kwargs["db_config"] is None
        assert kwargs["cors_origins"] == ["*"]

    def test_permission_error(self):
        """PermissionError from config -> fallback."""
        _, mock_create_app, _, _ = _run_main(
            config_loader_side_effect=PermissionError("access denied"),
        )

        kwargs = mock_create_app.call_args[1]
        assert kwargs["db_config"] is None

    def test_generic_exception(self):
        """Any unexpected exception -> fallback."""
        _, mock_create_app, _, _ = _run_main(
            config_loader_side_effect=RuntimeError("something broke"),
        )

        kwargs = mock_create_app.call_args[1]
        assert kwargs["db_config"] is None
        assert kwargs["cors_origins"] == ["*"]


class TestConfigPathEnvVar:
    """The CONFIG_PATH env var should control where ConfigurationLoader looks."""

    def test_custom_config_path(self):
        """CONFIG_PATH env var should be forwarded to ConfigurationLoader."""
        _, _, mock_cl, _ = _run_main(
            env_overrides={"CONFIG_PATH": "/custom/config/dir"},
        )

        mock_cl.assert_called_once_with(
            config_path="/custom/config/dir",
            config_file="config.json",
        )

    def test_default_config_path(self):
        """Without CONFIG_PATH, the default path (backend/config) should be used."""
        _, _, mock_cl, _ = _run_main()

        call_kwargs = mock_cl.call_args
        # The first positional/keyword arg should end with /config
        config_path_arg = call_kwargs[1].get("config_path") or call_kwargs[0][0]
        assert config_path_arg.endswith("config")


class TestCreateAppInvocation:
    """Ensure create_app is called exactly once with the right keyword arguments."""

    def test_all_kwargs_present(self):
        """create_app must receive all expected keyword arguments."""
        _, mock_create_app, _, _ = _run_main(
            config_loader_side_effect=Exception("nope"),
        )

        mock_create_app.assert_called_once()
        kwargs = mock_create_app.call_args[1]

        expected_keys = {
            "db_config", "token_secret", "smtp_config", "jira_config",
            "file_storage_config", "gcs_config", "cors_origins",
            "title", "description",
        }
        assert set(kwargs.keys()) == expected_keys

    def test_title_and_description(self):
        """create_app should receive the correct title and description."""
        _, mock_create_app, _, _ = _run_main(
            config_loader_side_effect=Exception("nope"),
        )

        kwargs = mock_create_app.call_args[1]
        assert kwargs["title"] == "EasyLife Admin Panel API"
        assert kwargs["description"] == "Authentication, Authorization, and Administration API"


class TestMainBlock:
    """Test the ``if __name__ == '__main__'`` block."""

    def test_uvicorn_run_called_when_name_is_main(self):
        """Simulating __name__ == '__main__' should call uvicorn.run."""
        mock_uvicorn = MagicMock()

        # Read the source and prepare a patched version
        source = _MAIN_PY.read_text()
        patched_source = source.replace(
            "from dotenv import load_dotenv",
            "pass  # load_dotenv injected",
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
            "load_dotenv": MagicMock(),
            "create_app": MagicMock(),
            "ConfigurationLoader": MagicMock(side_effect=Exception("nope")),
            "uvicorn": mock_uvicorn,
        }

        # Strip env vars that main.py reads
        prefixes_to_strip = (
            "MONGODB_", "JWT_", "SMTP_", "CORS_", "GCS_", "FILE_STORAGE_",
            "JIRA_", "LOCAL_UPLOAD_", "CONFIG_PATH", "EASYLIFE_",
        )
        clean_env = {
            k: v for k, v in os.environ.items()
            if not any(k.startswith(p) for p in prefixes_to_strip)
        }

        with patch.dict(os.environ, clean_env, clear=True):
            exec(compile(patched_source, str(_MAIN_PY), "exec"), ns)

        mock_uvicorn.run.assert_called_once_with(
            "src.main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
        )

    def test_uvicorn_not_called_when_imported(self):
        """When imported normally (__name__ != '__main__'), uvicorn.run
        should NOT be called."""
        mock_uvicorn = MagicMock()

        source = _MAIN_PY.read_text()
        patched_source = source.replace(
            "from dotenv import load_dotenv",
            "pass  # load_dotenv injected",
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
            "__name__": "src.main",
            "__file__": str(_MAIN_PY),
            "__builtins__": __builtins__,
            "load_dotenv": MagicMock(),
            "create_app": MagicMock(),
            "ConfigurationLoader": MagicMock(side_effect=Exception("nope")),
            "uvicorn": mock_uvicorn,
        }

        prefixes_to_strip = (
            "MONGODB_", "JWT_", "SMTP_", "CORS_", "GCS_", "FILE_STORAGE_",
            "JIRA_", "LOCAL_UPLOAD_", "CONFIG_PATH", "EASYLIFE_",
        )
        clean_env = {
            k: v for k, v in os.environ.items()
            if not any(k.startswith(p) for p in prefixes_to_strip)
        }

        with patch.dict(os.environ, clean_env, clear=True):
            exec(compile(patched_source, str(_MAIN_PY), "exec"), ns)

        mock_uvicorn.run.assert_not_called()


class TestMongoDBCollections:
    """Verify the collections list in the env-driven db_config."""

    def test_expected_collections_present(self):
        """The db_config built from MONGODB_HOST should contain all expected collections."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={"MONGODB_HOST": "localhost"},
            config_loader_side_effect=Exception("nope"),
        )

        collections = mock_create_app.call_args[1]["db_config"]["collections"]
        expected = [
            "users", "tokens", "reset_tokens", "sessions", "roles", "groups",
            "permissions", "customers", "scenario_requests", "feedbacks", "domains",
            "domain_scenarios", "playboards", "configurations", "activity_logs",
            "api_configs", "distribution_lists", "error_logs", "error_log_archives",
        ]
        assert collections == expected

    def test_collections_count(self):
        """There should be exactly 19 collections."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={"MONGODB_HOST": "localhost"},
            config_loader_side_effect=Exception("nope"),
        )

        collections = mock_create_app.call_args[1]["db_config"]["collections"]
        assert len(collections) == 19


class TestEnvVarPrecedence:
    """Env vars should take precedence over config-file values."""

    def test_env_db_overrides_config_db(self):
        """MONGODB_HOST should replace the entire db_config from the config file."""
        config_db = {"host": "config-host", "database": "config-db", "extra": "value"}

        _, mock_create_app, _, _ = _run_main(
            env_overrides={"MONGODB_HOST": "env-host"},
            config_loader_returns={"db_config": config_db},
        )

        db = mock_create_app.call_args[1]["db_config"]
        # The env-driven config completely replaces the file-based one
        assert db["host"] == "env-host"
        assert "extra" not in db

    def test_env_jwt_overrides_config_jwt(self):
        """JWT_SECRET_KEY env should override the config-file token secret."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={"JWT_SECRET_KEY": "env-secret"},
            config_loader_returns={"token_secret": "config-secret"},
        )

        assert mock_create_app.call_args[1]["token_secret"] == "env-secret"

    def test_env_smtp_overrides_config_smtp(self):
        """SMTP_SERVER env should replace the smtp_config from config file."""
        config_smtp = {"smtp_server": "config.smtp", "smtp_port": 465}

        _, mock_create_app, _, _ = _run_main(
            env_overrides={"SMTP_SERVER": "env.smtp"},
            config_loader_returns={"smtp_config": config_smtp},
        )

        smtp = mock_create_app.call_args[1]["smtp_config"]
        assert smtp["smtp_server"] == "env.smtp"

    def test_env_cors_overrides_config_cors(self):
        """CORS_ORIGINS env should replace the cors list from config file."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={"CORS_ORIGINS": "http://env.com"},
            config_loader_returns={"cors_origins": ["http://config.com"]},
        )

        assert mock_create_app.call_args[1]["cors_origins"] == ["http://env.com"]

    def test_config_values_used_when_no_env_override(self):
        """Without env overrides, config file values should pass through."""
        _, mock_create_app, _, _ = _run_main(
            config_loader_returns={
                "db_config": {"host": "cfghost"},
                "token_secret": "cfgsecret",
                "smtp_config": {"smtp_server": "cfgsmtp"},
                "cors_origins": ["http://cfg.com"],
            },
        )

        kwargs = mock_create_app.call_args[1]
        assert kwargs["db_config"] == {"host": "cfghost"}
        assert kwargs["token_secret"] == "cfgsecret"
        assert kwargs["smtp_config"] == {"smtp_server": "cfgsmtp"}
        assert kwargs["cors_origins"] == ["http://cfg.com"]


class TestEdgeCases:
    """Edge cases and boundary conditions."""

    def test_mongodb_host_empty_string_not_treated_as_set(self):
        """An empty MONGODB_HOST should not trigger env-based db_config.

        Note: os.environ.get returns '' for empty strings, and
        ``'' or None`` evaluates to None, so empty string means 'not set'.
        """
        _, mock_create_app, _, _ = _run_main(
            env_overrides={"MONGODB_HOST": ""},
            config_loader_side_effect=Exception("nope"),
        )

        assert mock_create_app.call_args[1]["db_config"] is None

    def test_jwt_secret_empty_string_not_treated_as_set(self):
        """An empty JWT_SECRET_KEY should not override config value."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={"JWT_SECRET_KEY": ""},
            config_loader_returns={"token_secret": "from-config"},
        )

        assert mock_create_app.call_args[1]["token_secret"] == "from-config"

    def test_smtp_server_empty_string_not_treated_as_set(self):
        """An empty SMTP_SERVER should not trigger env-based smtp_config."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={"SMTP_SERVER": ""},
            config_loader_side_effect=Exception("nope"),
        )

        assert mock_create_app.call_args[1]["smtp_config"] is None

    def test_file_storage_type_case_insensitive(self):
        """FILE_STORAGE_TYPE should be case-insensitive."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "FILE_STORAGE_TYPE": "GCS",
                "GCS_CREDENTIALS_JSON": '{"type":"sa"}',
                "GCS_BUCKET_NAME": "bucket",
            },
            config_loader_side_effect=Exception("nope"),
        )

        fsc = mock_create_app.call_args[1]["file_storage_config"]
        assert fsc["type"] == "gcs"

    def test_gcs_credentials_without_bucket_name(self):
        """GCS creds set but no bucket name -> gcs_config still built (bucket is None)."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "GCS_CREDENTIALS_JSON": '{"type":"sa"}',
            },
            config_loader_side_effect=Exception("nope"),
        )

        gcs = mock_create_app.call_args[1]["gcs_config"]
        assert gcs is not None
        assert gcs["bucket_name"] is None

    def test_app_attribute_is_return_value_of_create_app(self):
        """The module-level ``app`` should be the return value of create_app."""
        ns, mock_create_app, _, _ = _run_main(
            config_loader_side_effect=Exception("nope"),
        )

        assert ns["app"] is mock_create_app.return_value

    def test_mongodb_primary_env_takes_precedence_over_easylife_prefix(self):
        """MONGODB_HOST should win over EASYLIFE_DATABASES_AUTHENTICATION_DB_INFO_HOST."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "MONGODB_HOST": "primary-host",
                "EASYLIFE_DATABASES_AUTHENTICATION_DB_INFO_HOST": "legacy-host",
            },
            config_loader_side_effect=Exception("nope"),
        )

        db = mock_create_app.call_args[1]["db_config"]
        assert db["host"] == "primary-host"

    def test_jwt_primary_env_takes_precedence_over_easylife_prefix(self):
        """JWT_SECRET_KEY should win over EASYLIFE_SPECS_APP_SECRETS_AUTH_SECRET_KEY."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "JWT_SECRET_KEY": "primary-jwt",
                "EASYLIFE_SPECS_APP_SECRETS_AUTH_SECRET_KEY": "legacy-jwt",
            },
            config_loader_side_effect=Exception("nope"),
        )

        assert mock_create_app.call_args[1]["token_secret"] == "primary-jwt"

    def test_smtp_primary_env_takes_precedence_over_easylife_prefix(self):
        """SMTP_SERVER should win over EASYLIFE_SPECS_SMTP_SMTP_SERVER."""
        _, mock_create_app, _, _ = _run_main(
            env_overrides={
                "SMTP_SERVER": "primary-smtp",
                "EASYLIFE_SPECS_SMTP_SMTP_SERVER": "legacy-smtp",
            },
            config_loader_side_effect=Exception("nope"),
        )

        smtp = mock_create_app.call_args[1]["smtp_config"]
        assert smtp["smtp_server"] == "primary-smtp"

    def test_no_env_no_config_produces_minimal_app(self):
        """With no env vars and failed config, only defaults remain."""
        _, mock_create_app, _, _ = _run_main(
            config_loader_side_effect=Exception("nope"),
        )

        kwargs = mock_create_app.call_args[1]
        assert kwargs["db_config"] is None
        assert kwargs["token_secret"] is None
        assert kwargs["smtp_config"] is None
        assert kwargs["jira_config"] is None
        assert kwargs["gcs_config"] is None
        assert kwargs["cors_origins"] == ["*"]
        assert kwargs["file_storage_config"]["type"] == "local"
