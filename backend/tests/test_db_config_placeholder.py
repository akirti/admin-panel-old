"""Tests for unresolved placeholder detection in build_db_config and _is_placeholder."""
from unittest.mock import MagicMock

from main import _is_placeholder, build_db_config
from mock_data import (
    MOCK_DB_HOST_LOCAL, MOCK_DB_USERNAME, MOCK_DB_PASSWORD_SECRET123,
    MOCK_DB_DATABASE_EASYLIFE, MOCK_DB_SCHEME_DEFAULT, MOCK_DB_SCHEME_SRV,
)

CFG_GLOBALS_DATABASES_DEFAULT = "globals.databases.default"

# Typical unresolved placeholder strings from config.json
PH_SCHEME = "{databases.authentication.db_info.connection_scheme}"
PH_USERNAME = "{databases.authentication.db_info.username}"
PH_PASSWORD = "{databases.authentication.db_info.password}"
PH_HOST = "{databases.authentication.db_info.host}"
PH_DATABASE = "{databases.authentication.db_info.database}"
PH_COLLECTIONS = "{databases.authentication.db_info.collections}"

KEY_MAX_POOL = "maxPoolSize"


def _make_loader(db_config=None, globals_pool=None):
    """Build a mock ConfigurationLoader for build_db_config."""
    loader = MagicMock()
    loader.get_DB_config.return_value = db_config

    def _get_config(path, default=None):
        if path == CFG_GLOBALS_DATABASES_DEFAULT:
            return globals_pool
        return default

    loader.get_config_by_path.side_effect = _get_config
    return loader


def _resolved_db_config(**overrides):
    """Return a valid db_config dict with all required fields resolved."""
    base = {
        "connection_scheme": MOCK_DB_SCHEME_DEFAULT,
        "username": MOCK_DB_USERNAME,
        "password": MOCK_DB_PASSWORD_SECRET123,
        "host": MOCK_DB_HOST_LOCAL,
        "database": MOCK_DB_DATABASE_EASYLIFE,
        "collections": ["users", "tokens"],
    }
    base.update(overrides)
    return base


def _unresolved_db_config(**overrides):
    """Return a db_config dict with all fields as unresolved placeholders."""
    base = {
        "connection_scheme": PH_SCHEME,
        "username": PH_USERNAME,
        "password": PH_PASSWORD,
        "host": PH_HOST,
        "database": PH_DATABASE,
        "collections": PH_COLLECTIONS,
    }
    base.update(overrides)
    return base


# ============================================================================
# _is_placeholder
# ============================================================================
class TestIsPlaceholder:
    """Tests for _is_placeholder helper."""

    def test_standard_placeholder(self):
        assert _is_placeholder("{databases.authentication.db_info.host}") is True

    def test_short_placeholder(self):
        assert _is_placeholder("{host}") is True

    def test_placeholder_with_whitespace(self):
        assert _is_placeholder("  {some.path}  ") is True

    def test_plain_string(self):
        assert _is_placeholder("localhost") is False

    def test_empty_string(self):
        assert _is_placeholder("") is False

    def test_none(self):
        assert _is_placeholder(None) is False

    def test_integer(self):
        assert _is_placeholder(42) is False

    def test_dict(self):
        assert _is_placeholder({"key": "val"}) is False

    def test_braces_no_content(self):
        assert _is_placeholder("{}") is False

    def test_partial_placeholder_in_string(self):
        assert _is_placeholder("prefix{some.path}suffix") is False

    def test_resolved_url(self):
        assert _is_placeholder(f"{MOCK_DB_SCHEME_SRV}://cluster.example.net") is False

    def test_nested_braces(self):
        assert _is_placeholder("{{nested}}") is False


# ============================================================================
# build_db_config — unresolved placeholders
# ============================================================================
class TestBuildDbConfigPlaceholders:
    """build_db_config returns None when required fields are unresolved."""

    def test_returns_none_when_all_fields_unresolved(self):
        loader = _make_loader(db_config=_unresolved_db_config())
        assert build_db_config(loader) is None

    def test_returns_none_when_host_unresolved(self):
        cfg = _resolved_db_config(host=PH_HOST)
        loader = _make_loader(db_config=cfg)
        assert build_db_config(loader) is None

    def test_returns_none_when_username_unresolved(self):
        cfg = _resolved_db_config(username=PH_USERNAME)
        loader = _make_loader(db_config=cfg)
        assert build_db_config(loader) is None

    def test_returns_none_when_password_unresolved(self):
        cfg = _resolved_db_config(password=PH_PASSWORD)
        loader = _make_loader(db_config=cfg)
        assert build_db_config(loader) is None

    def test_returns_none_when_host_missing(self):
        cfg = _resolved_db_config()
        del cfg["host"]
        loader = _make_loader(db_config=cfg)
        assert build_db_config(loader) is None

    def test_returns_none_when_username_empty_string(self):
        cfg = _resolved_db_config(username="")
        loader = _make_loader(db_config=cfg)
        assert build_db_config(loader) is None

    def test_returns_none_when_password_none(self):
        cfg = _resolved_db_config(password=None)
        loader = _make_loader(db_config=cfg)
        assert build_db_config(loader) is None

    def test_returns_config_when_all_resolved(self):
        cfg = _resolved_db_config()
        loader = _make_loader(
            db_config=cfg,
            globals_pool={"max_pool_size": 100},
        )
        result = build_db_config(loader)
        assert result is not None
        assert result["host"] == MOCK_DB_HOST_LOCAL
        assert result["username"] == MOCK_DB_USERNAME
        assert result[KEY_MAX_POOL] == 100

    def test_returns_config_without_pool_when_globals_none(self):
        cfg = _resolved_db_config()
        loader = _make_loader(db_config=cfg, globals_pool=None)
        result = build_db_config(loader)
        assert result is not None
        assert KEY_MAX_POOL not in result

    def test_returns_none_when_db_config_none(self):
        loader = _make_loader(db_config=None)
        assert build_db_config(loader) is None

    def test_scheme_unresolved_still_returns_if_required_ok(self):
        """connection_scheme is not a required field — app can default to mongodb."""
        cfg = _resolved_db_config(connection_scheme=PH_SCHEME)
        loader = _make_loader(db_config=cfg, globals_pool={"max_pool_size": 50})
        result = build_db_config(loader)
        assert result is not None
        assert result["host"] == MOCK_DB_HOST_LOCAL

    def test_pool_settings_still_injected_when_resolved(self):
        cfg = _resolved_db_config()
        loader = _make_loader(
            db_config=cfg,
            globals_pool={
                "max_pool_size": 200,
                "min_pool_size": 20,
                "max_idle_time_ms": 500000,
                "server_selection_timeout_ms": 15000,
                "connect_timeout_ms": 10000,
                "socket_timeout_ms": 45000,
                "heartbeat_frequency_ms": 8000,
                "wait_queue_timeout_ms": 12000,
            },
        )
        db = build_db_config(loader)
        assert db[KEY_MAX_POOL] == 200
        assert db["minPoolSize"] == 20
        assert db["maxIdleTimeMS"] == 500000
        assert db["serverSelectionTimeoutMS"] == 15000
        assert db["connectTimeoutMS"] == 10000
        assert db["socketTimeoutMS"] == 45000
        assert db["heartbeatFrequencyMS"] == 8000
        assert db["waitQueueTimeoutMS"] == 12000
