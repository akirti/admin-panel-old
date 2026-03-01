"""Integration tests for the configuration loading pipeline.

Tests the full flow: simulator -> localenv -> env -> config.json resolution,
verifying that ConfigurationLoader produces the correct final configuration
when processing real JSON files.
"""
import json
import os
from pathlib import Path

import pytest

from easylifeauth import OS_PROPERTY_SEPRATOR
from easylifeauth.utils.config import ConfigurationLoader, ConfigValueSimulator
from tests.test_config_values import (
    SIMULATOR_DATA, CONFIG_JSON,
    EXPECTED_DB_HOST, EXPECTED_DB_DATABASE, EXPECTED_DB_USERNAME,
    EXPECTED_DB_PASSWORD, EXPECTED_DB_CONNECTION_SCHEME, EXPECTED_COLLECTIONS,
    EXPECTED_MAX_POOL_SIZE, EXPECTED_MIN_POOL_SIZE,
    EXPECTED_SECRET_KEY, EXPECTED_SMTP_SERVER, EXPECTED_SMTP_PORT,
    EXPECTED_CORS_ORIGINS, EXPECTED_JIRA_BASE_URL,
)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------
def _create_config_dir(tmp_path, files):
    """Create config files in a temporary directory.

    Parameters
    ----------
    tmp_path : Path
        pytest tmp_path fixture.
    files : dict
        Mapping of filename -> content (will be JSON-encoded).
    """
    config_dir = tmp_path / "config"
    config_dir.mkdir(exist_ok=True)
    for name, content in files.items():
        (config_dir / name).write_text(json.dumps(content))
    return str(config_dir)


# ---------------------------------------------------------------------------
# Fixture: clean up environment variables set by ConfigValueSimulator
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def clean_test_env_vars():
    """Ensure env vars set by the simulator don't leak between tests."""
    original = os.environ.copy()
    yield
    os.environ.clear()
    os.environ.update(original)


# ============================================================================
# Pipeline tests with temporary config files
# ============================================================================


class TestPlaceholderResolution:
    """Simulator values should resolve placeholders in config.json."""

    def test_simulator_values_resolve_in_config(self, tmp_path, environment="production"):
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {
                "app.name": "test-app",
                "db.host": "localhost",
                "db.port": 27017,
            },
            "config.json": {
                "application": {"name": "{app.name}"},
                "database": {"host": "{db.host}", "port": "{db.port}"},
            },
            "production.json": {},
            f"localenv-{environment}.json": {},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        assert loader.get_config_by_path("application.name") == "test-app"
        assert loader.get_config_by_path("database.host") == "localhost"
        assert loader.get_config_by_path("database.port") == 27017

    def test_nested_placeholder_resolution(self, tmp_path, environment="production"):
        """Placeholders should resolve to complex types (lists, dicts)."""
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {
                "db.collections": ["users", "tokens", "sessions"],
            },
            "config.json": {
                "database": {"collections": "{db.collections}"},
            },
            f"{environment}.json": {},
            f"localenv-{environment}.json": {},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        result = loader.get_config_by_path("database.collections")
        assert result == ["users", "tokens", "sessions"]

    def test_embedded_placeholders_in_string(self, tmp_path, environment="production"):
        """Embedded placeholders within a string should be resolved."""
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {
                "db.host": "myhost",
                "db.port": 27017,
            },
            "config.json": {
                "connection_string": "mongodb://{db.host}:{db.port}/mydb",
            },
            f"{environment}.json": {},
            f"localenv-{environment}.json": {},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        assert loader.get_config_by_path("connection_string") == "mongodb://myhost:27017/mydb"

    def test_unresolved_placeholders_kept(self, tmp_path, environment="production"):
        """Placeholders with no matching value should be kept as-is."""
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {},
            "config.json": {"item": "{nonexistent.path}"},
            f"{environment}.json": {},
            f"localenv-{environment}.json": {},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        assert loader.get_config_by_path("item") == "{nonexistent.path}"

    def test_boolean_values_preserved(self, tmp_path, environment="production"):
        """Boolean values from simulator should be preserved through resolution."""
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {
                "feature.enabled": True,
                "feature.debug": False,
            },
            "config.json": {
                "feature": {
                    "enabled": "{feature.enabled}",
                    "debug": "{feature.debug}",
                },
            },
            f"{environment}.json": {},
            f"localenv-{environment}.json": {},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        assert loader.get_config_by_path("feature.enabled") is True
        assert loader.get_config_by_path("feature.debug") is False

    def test_integer_values_preserved(self, tmp_path, environment="production"):
        """Integer values should be preserved as integers through resolution."""
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {
                "server.port": 8080,
                "pool.size": 50,
            },
            "config.json": {
                "server": {"port": "{server.port}"},
                "pool": {"size": "{pool.size}"},
            },
            f"{environment}.json": {},
            f"localenv-{environment}.json": {},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        assert loader.get_config_by_path("server.port") == 8080
        assert loader.get_config_by_path("pool.size") == 50


class TestLayeredOverrides:
    """Test the override chain: simulator < localenv < env file."""

    def test_localenv_overrides_simulator(self, tmp_path, environment="production"):
        """localenv values should override simulator values."""
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {
                "db.host": "sim-host",
                "db.port": 27017,
            },
            f"localenv-{environment}.json": {
                "db": {"host": "localenv-host"},
            },
            f"{environment}.json": {},
            "config.json": {
                "database": {"host": "{db.host}", "port": "{db.port}"},
            },
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        assert loader.get_config_by_path("database.host") == "localenv-host"
        assert loader.get_config_by_path("database.port") == 27017

    def test_env_overrides_localenv(self, tmp_path, environment="staging"):
        """Environment file values should override localenv values."""
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {"db.host": "sim-host"},
            f"localenv-{environment}.json": {"db": {"host": "localenv-host"}},
            f"{environment}.json": {"db": {"host": "env-host"}},
            "config.json": {"database": {"host": "{db.host}"}},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        assert loader.get_config_by_path("database.host") == "env-host"

    def test_env_file_adds_extra_properties(self, tmp_path, environment="production"):
        """Environment file should merge extra properties into final config."""
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {},
            "config.json": {"app": {"name": "base-app"}},
            f"{environment}.json": {"app": {"version": "2.0"}},
            f"localenv-{environment}.json": {},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        assert loader.get_config_by_path("app.name") == "base-app"
        assert loader.get_config_by_path("app.version") == "2.0"


class TestMissingFiles:
    """Pipeline should handle missing optional files gracefully."""

    def test_missing_simulator_file(self, tmp_path, environment="production"):
        config_path = _create_config_dir(tmp_path, {
            "config.json": {"app": {"name": "fallback"}},
            f"{environment}.json": {},
            f"localenv-{environment}.json": {},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        assert loader.get_config_by_path("app.name") == "fallback"

    def test_missing_localenv_file(self, tmp_path, environment="production"):
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {"val": "sim-val"},
            "config.json": {"item": "{val}"},
            f"{environment}.json": {},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        assert loader.get_config_by_path("item") == "sim-val"

    def test_missing_env_file(self, tmp_path, environment="production"):
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {"val": "sim-val"},
            "config.json": {"item": "{val}"},
            f"localenv-{environment}.json": {},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        assert loader.get_config_by_path("item") == "sim-val"

    def test_all_optional_files_missing(self, tmp_path):
        """Only config.json exists — unresolved placeholders kept."""
        config_path = _create_config_dir(tmp_path, {
            "config.json": {"item": "{missing.val}", "static": "hello"},
        })
        loader = ConfigurationLoader(config_path=config_path, environment="production")
        assert loader.get_config_by_path("static") == "hello"
        assert loader.get_config_by_path("item") == "{missing.val}"


class TestDifferentEnvironments:
    """Test loading different environment names."""

    def test_staging_environment(self, tmp_path, environment="staging"):
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {"db.host": "sim-host"},
            f"localenv-{environment}.json": {},
            f"{environment}.json": {"db": {"host": "staging-db.example.com"}},
            "config.json": {"database": {"host": "{db.host}"}},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        assert loader.get_config_by_path("database.host") == "staging-db.example.com"

    def test_dev_environment(self, tmp_path, environment="dev"):
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {},
            f"localenv-{environment}.json": {"app": {"debug": True}},
            f"{environment}.json": {},
            "config.json": {"app": {"debug": "{app.debug}"}},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        assert loader.get_config_by_path("app.debug") is True


# ============================================================================
# get_DB_config tests
# ============================================================================


class TestGetDBConfig:
    """Tests for get_DB_config method with different data structures."""

    def test_db_info_key_with_underscore(self, tmp_path, environment="production"):
        """get_DB_config should handle 'db_info' key."""
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {},
            "config.json": {
                "databases": {
                    "mydb": {
                        "db_info": {"host": "testhost", "port": 3306}
                    }
                }
            },
            f"{environment}.json": {},
            f"localenv-{environment}.json": {},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        result = loader.get_DB_config("mydb")
        assert result is not None
        assert result["host"] == "testhost"
        assert result["port"] == 3306

    def test_flat_database_config(self, tmp_path,environment="production"):
        """get_DB_config should handle flat database config (no db_info wrapper)."""
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {},
            "config.json": {
                "databases": {
                    "mydb": {"host": "flathost", "port": 5432}
                }
            },
            f"{environment}.json": {},
            f"localenv-{environment}.json": {},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        result = loader.get_DB_config("mydb")
        assert result is not None
        assert result["host"] == "flathost"

    def test_nonexistent_token_returns_none(self, tmp_path, environment="production"):
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {},
            "config.json": {"databases": {}},
            f"{environment}.json": {},
            f"localenv-{environment}.json": {},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        assert loader.get_DB_config("nonexistent") is None

    def test_get_DB_config_returns_deepcopy(self, tmp_path, environment="production"):
        """Returned config should be a deep copy — mutations don't affect loader."""
        config_path = _create_config_dir(tmp_path, {
            f"server.env.{environment}.json": {},
            "config.json": {
                "databases": {
                    "mydb": {"db_info": {"host": "original"}}
                }
            },
            f"{environment}.json": {},
            f"localenv-{environment}.json": {},
        })
        loader = ConfigurationLoader(config_path=config_path, environment=environment)
        result = loader.get_DB_config("mydb")
        result["host"] = "mutated"
        # Original should be unchanged
        assert loader.get_DB_config("mydb")["host"] == "original"


# ============================================================================
# ConfigValueSimulator tests
# ============================================================================


class TestConfigValueSimulator:
    """Tests for ConfigValueSimulator."""

    def test_load_simulator_sets_env_vars(self, tmp_path):
        sep = OS_PROPERTY_SEPRATOR
        sim_file = tmp_path / "sim.json"
        sim_file.write_text(json.dumps({
            f"app{sep}name": "test",
            f"db{sep}port": 5432,
        }))
        result = ConfigValueSimulator.load_simulator_file(str(sim_file), "TESTSIM")
        assert os.environ.get(f"TESTSIM_APP{sep}NAME") == "test"
        assert os.environ.get(f"TESTSIM_DB{sep}PORT") == "5432"
        assert result == {f"app{sep}name": "test", f"db{sep}port": 5432}

    def test_load_simulator_handles_missing_file(self):
        result = ConfigValueSimulator.load_simulator_file("/nonexistent/file.json")
        assert result == {}

    def test_load_simulator_handles_complex_values(self, tmp_path):
        sep = OS_PROPERTY_SEPRATOR
        sim_file = tmp_path / "sim.json"
        sim_file.write_text(json.dumps({
            f"db{sep}collections": ["users", "tokens"],
            f"feature{sep}flags": {"debug": True},
        }))
        ConfigValueSimulator.load_simulator_file(str(sim_file), "TESTCPLX")
        assert os.environ.get(f"TESTCPLX_DB{sep}COLLECTIONS") == '["users", "tokens"]'
        assert os.environ.get(f"TESTCPLX_FEATURE{sep}FLAGS") == '{"debug": true}'

    def test_load_simulator_handles_booleans(self, tmp_path):
        sep = OS_PROPERTY_SEPRATOR
        sim_file = tmp_path / "sim.json"
        sim_file.write_text(json.dumps({
            f"feature{sep}enabled": True,
            f"feature{sep}debug": False,
        }))
        ConfigValueSimulator.load_simulator_file(str(sim_file), "TESTBOOL")
        assert os.environ.get(f"TESTBOOL_FEATURE{sep}ENABLED") == "true"
        assert os.environ.get(f"TESTBOOL_FEATURE{sep}DEBUG") == "false"

    def test_set_os_environment(self):
        sep = OS_PROPERTY_SEPRATOR
        values = {"db": {"host": "localhost", "port": "5432"}, "name": "app"}
        ConfigValueSimulator.set_os_environment(values, "TESTSET")
        assert os.environ.get(f"TESTSET_DB{sep}HOST") == "localhost"
        assert os.environ.get(f"TESTSET_DB{sep}PORT") == "5432"
        assert os.environ.get("TESTSET_NAME") == "app"


# ============================================================================
# Full pipeline tests with self-contained fixture data (CI/CD safe)
# ============================================================================


class TestRealConfigFiles:
    """Test ConfigurationLoader with the full config pipeline.

    Uses temporary config files created from test_config_values fixtures,
    so tests work on any machine without real project config files.
    """

    @pytest.fixture
    def config_path(self, tmp_path):
        return _create_config_dir(tmp_path, {
            "server.env.production.json": SIMULATOR_DATA,
            "config.json": CONFIG_JSON,
            "production.json": {},
            "localenv-production.json": {},
        })

    def test_loads_production_environment(self, config_path):
        """Loading 'production' environment should produce valid resolved config."""
        loader = ConfigurationLoader(config_path=config_path, environment="production")
        db = loader.get_config_by_path("databases.authentication.db_info")
        assert db is not None
        assert db["host"] == EXPECTED_DB_HOST
        assert db["database"] == EXPECTED_DB_DATABASE
        assert isinstance(db["collections"], list)
        assert "users" in db["collections"]

    def test_get_DB_config_returns_db_info(self, config_path):
        """get_DB_config('authentication') should return the db_info dict."""
        loader = ConfigurationLoader(config_path=config_path, environment="production")
        db_config = loader.get_DB_config("authentication")
        assert db_config is not None
        assert db_config["host"] == EXPECTED_DB_HOST
        assert db_config["database"] == EXPECTED_DB_DATABASE
        assert db_config["username"] == EXPECTED_DB_USERNAME
        assert db_config["connection_scheme"] == EXPECTED_DB_CONNECTION_SCHEME

    def test_token_secret_resolved(self, config_path):
        loader = ConfigurationLoader(config_path=config_path, environment="production")
        secret = loader.get_config_by_path("environment.app_secrets.auth_secret_key")
        assert secret is not None
        assert isinstance(secret, str)
        assert secret == EXPECTED_SECRET_KEY

    def test_smtp_config_resolved(self, config_path):
        loader = ConfigurationLoader(config_path=config_path, environment="production")
        smtp = loader.get_config_by_path("environment.smtp")
        assert smtp is not None
        assert smtp["smtp_server"] == EXPECTED_SMTP_SERVER
        assert smtp["smtp_port"] == EXPECTED_SMTP_PORT

    def test_cors_origins_resolved(self, config_path):
        loader = ConfigurationLoader(config_path=config_path, environment="production")
        origins = loader.get_config_by_path("environment.cors.origins")
        assert isinstance(origins, list)
        assert origins == EXPECTED_CORS_ORIGINS

    def test_globals_pool_settings_resolved(self, config_path):
        loader = ConfigurationLoader(config_path=config_path, environment="production")
        pool = loader.get_config_by_path("globals.databases.default")
        assert pool is not None
        assert pool["max_pool_size"] == EXPECTED_MAX_POOL_SIZE
        assert pool["min_pool_size"] == EXPECTED_MIN_POOL_SIZE

    def test_storage_config_resolved(self, config_path):
        loader = ConfigurationLoader(config_path=config_path, environment="production")
        storage = loader.get_config_by_path("environment.storage")
        assert storage is not None
        assert "type" in storage

    def test_jira_config_resolved(self, config_path):
        loader = ConfigurationLoader(config_path=config_path, environment="production")
        jira = loader.get_config_by_path("environment.jira")
        assert jira is not None
        assert jira["base_url"] == EXPECTED_JIRA_BASE_URL

    def test_full_main_py_wiring_simulation(self, config_path):
        """Simulate the full main.py extraction logic with test config."""
        loader = ConfigurationLoader(config_path=config_path, environment="production")

        # DB
        db_config = loader.get_DB_config("authentication")
        globals_pool = loader.get_config_by_path("globals.databases.default")
        if db_config and globals_pool:
            db_config["maxPoolSize"] = globals_pool.get("max_pool_size", 50)
            db_config["minPoolSize"] = globals_pool.get("min_pool_size", 5)

        # Auth
        token_secret = loader.get_config_by_path("environment.app_secrets.auth_secret_key")

        # SMTP
        smtp_config = loader.get_config_by_path("environment.smtp")

        # CORS
        cors_origins = loader.get_config_by_path("environment.cors.origins") or [
            "http://localhost:3000", "http://localhost:5173"
        ]

        # Verify all resolved correctly
        assert db_config is not None
        assert db_config["maxPoolSize"] == EXPECTED_MAX_POOL_SIZE
        assert db_config["minPoolSize"] == EXPECTED_MIN_POOL_SIZE
        assert db_config["host"] == EXPECTED_DB_HOST
        assert token_secret == EXPECTED_SECRET_KEY
        assert smtp_config is not None
        assert isinstance(cors_origins, list)
        assert len(cors_origins) > 0

    def test_collections_list_from_real_config(self, config_path):
        """The collections list should be fully resolved from simulator data."""
        loader = ConfigurationLoader(config_path=config_path, environment="production")
        db_config = loader.get_DB_config("authentication")
        assert db_config is not None
        collections = db_config["collections"]
        assert collections == EXPECTED_COLLECTIONS
