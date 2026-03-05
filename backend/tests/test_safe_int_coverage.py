"""Dedicated coverage tests for _safe_int and build_db_config pool-setting lines.

Ensures Sonar sees every branch of _safe_int (lines 41-50) and every
_safe_int call-site inside build_db_config (lines 58-65) as covered.
"""
from unittest.mock import MagicMock

from main import _safe_int, build_db_config
from mock_data import MOCK_DB_HOST_SHORT, MOCK_DB_USERNAME_SHORT, MOCK_DB_PASSWORD_SHORT

CFG_GLOBALS_DATABASES_DEFAULT = "globals.databases.default"
UNRESOLVED_PLACEHOLDER = "{globals.databases.default.max_pool_size}"

# -- Pool config key constants ------------------------------------------------
KEY_MAX_POOL = "maxPoolSize"
KEY_MIN_POOL = "minPoolSize"
KEY_MAX_IDLE = "maxIdleTimeMS"
KEY_SERVER_SEL = "serverSelectionTimeoutMS"
KEY_CONNECT = "connectTimeoutMS"
KEY_SOCKET = "socketTimeoutMS"
KEY_HEARTBEAT = "heartbeatFrequencyMS"
KEY_WAIT_QUEUE = "waitQueueTimeoutMS"

# -- Default values from build_db_config --------------------------------------
DEFAULT_MAX_POOL = 50
DEFAULT_MIN_POOL = 5
DEFAULT_MAX_IDLE = 300000
DEFAULT_SERVER_SEL = 30000
DEFAULT_CONNECT = 20000
DEFAULT_SOCKET = 60000
DEFAULT_HEARTBEAT = 10000
DEFAULT_WAIT_QUEUE = 10000


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


# ============================================================================
# _safe_int — every branch
# ============================================================================
class TestSafeIntBranches:
    """Cover every branch of _safe_int."""

    def test_int_returns_value(self):
        assert _safe_int(100, 0) == 100

    def test_int_zero(self):
        assert _safe_int(0, 99) == 0

    def test_int_negative(self):
        assert _safe_int(-5, 99) == -5

    def test_float_truncates(self):
        assert _safe_int(3.9, 0) == 3

    def test_float_negative(self):
        assert _safe_int(-2.7, 0) == -2

    def test_string_int(self):
        assert _safe_int("42", 0) == 42

    def test_string_negative_int(self):
        assert _safe_int("-10", 0) == -10

    def test_placeholder_falls_back(self):
        assert _safe_int(UNRESOLVED_PLACEHOLDER, 50) == 50

    def test_non_numeric_string_falls_back(self):
        assert _safe_int("abc", 77) == 77

    def test_empty_string_falls_back(self):
        assert _safe_int("", 99) == 99

    def test_none_falls_back(self):
        assert _safe_int(None, 33) == 33

    def test_bool_true_treated_as_int(self):
        # bool is subclass of int in Python
        assert _safe_int(True, 0) == 1

    def test_bool_false_treated_as_int(self):
        assert _safe_int(False, 99) == 0


# ============================================================================
# build_db_config — pool-setting call-sites (lines 58-65)
# ============================================================================
class TestBuildDbConfigPoolLines:
    """Cover every _safe_int call-site inside build_db_config."""

    def test_all_pool_settings_from_int_values(self):
        loader = _make_loader(
            db_config={"host": MOCK_DB_HOST_SHORT, "username": MOCK_DB_USERNAME_SHORT, "password": MOCK_DB_PASSWORD_SHORT},
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
        assert db[KEY_MIN_POOL] == 20
        assert db[KEY_MAX_IDLE] == 500000
        assert db[KEY_SERVER_SEL] == 15000
        assert db[KEY_CONNECT] == 10000
        assert db[KEY_SOCKET] == 45000
        assert db[KEY_HEARTBEAT] == 8000
        assert db[KEY_WAIT_QUEUE] == 12000

    def test_all_pool_settings_from_string_values(self):
        loader = _make_loader(
            db_config={"host": MOCK_DB_HOST_SHORT, "username": MOCK_DB_USERNAME_SHORT, "password": MOCK_DB_PASSWORD_SHORT},
            globals_pool={
                "max_pool_size": "150",
                "min_pool_size": "15",
                "max_idle_time_ms": "400000",
                "server_selection_timeout_ms": "12000",
                "connect_timeout_ms": "8000",
                "socket_timeout_ms": "35000",
                "heartbeat_frequency_ms": "6000",
                "wait_queue_timeout_ms": "9000",
            },
        )
        db = build_db_config(loader)
        assert db[KEY_MAX_POOL] == 150
        assert db[KEY_MIN_POOL] == 15
        assert db[KEY_MAX_IDLE] == 400000
        assert db[KEY_SERVER_SEL] == 12000
        assert db[KEY_CONNECT] == 8000
        assert db[KEY_SOCKET] == 35000
        assert db[KEY_HEARTBEAT] == 6000
        assert db[KEY_WAIT_QUEUE] == 9000

    def test_all_pool_settings_fallback_on_unresolved_placeholders(self):
        loader = _make_loader(
            db_config={"host": MOCK_DB_HOST_SHORT, "username": MOCK_DB_USERNAME_SHORT, "password": MOCK_DB_PASSWORD_SHORT},
            globals_pool={
                "max_pool_size": UNRESOLVED_PLACEHOLDER,
                "min_pool_size": "{unresolved}",
                "max_idle_time_ms": "{unresolved}",
                "server_selection_timeout_ms": "{unresolved}",
                "connect_timeout_ms": "{unresolved}",
                "socket_timeout_ms": "{unresolved}",
                "heartbeat_frequency_ms": "{unresolved}",
                "wait_queue_timeout_ms": "{unresolved}",
            },
        )
        db = build_db_config(loader)
        assert db[KEY_MAX_POOL] == DEFAULT_MAX_POOL
        assert db[KEY_MIN_POOL] == DEFAULT_MIN_POOL
        assert db[KEY_MAX_IDLE] == DEFAULT_MAX_IDLE
        assert db[KEY_SERVER_SEL] == DEFAULT_SERVER_SEL
        assert db[KEY_CONNECT] == DEFAULT_CONNECT
        assert db[KEY_SOCKET] == DEFAULT_SOCKET
        assert db[KEY_HEARTBEAT] == DEFAULT_HEARTBEAT
        assert db[KEY_WAIT_QUEUE] == DEFAULT_WAIT_QUEUE

    def test_pool_defaults_when_keys_missing(self):
        loader = _make_loader(
            db_config={"host": MOCK_DB_HOST_SHORT, "username": MOCK_DB_USERNAME_SHORT, "password": MOCK_DB_PASSWORD_SHORT},
            globals_pool={"max_pool_size": 100},
        )
        db = build_db_config(loader)
        assert db[KEY_MAX_POOL] == 100
        assert db[KEY_MIN_POOL] == DEFAULT_MIN_POOL
        assert db[KEY_MAX_IDLE] == DEFAULT_MAX_IDLE
        assert db[KEY_SERVER_SEL] == DEFAULT_SERVER_SEL
        assert db[KEY_CONNECT] == DEFAULT_CONNECT
        assert db[KEY_SOCKET] == DEFAULT_SOCKET
        assert db[KEY_HEARTBEAT] == DEFAULT_HEARTBEAT
        assert db[KEY_WAIT_QUEUE] == DEFAULT_WAIT_QUEUE

    def test_no_pool_injection_when_db_config_none(self):
        loader = _make_loader(db_config=None, globals_pool={"max_pool_size": 100})
        assert build_db_config(loader) is None

    def test_no_pool_injection_when_globals_none(self):
        loader = _make_loader(db_config={"host": MOCK_DB_HOST_SHORT, "username": MOCK_DB_USERNAME_SHORT, "password": MOCK_DB_PASSWORD_SHORT}, globals_pool=None)
        db = build_db_config(loader)
        assert KEY_MAX_POOL not in db

    def test_no_pool_injection_when_globals_empty(self):
        loader = _make_loader(db_config={"host": MOCK_DB_HOST_SHORT, "username": MOCK_DB_USERNAME_SHORT, "password": MOCK_DB_PASSWORD_SHORT}, globals_pool={})
        db = build_db_config(loader)
        assert KEY_MAX_POOL not in db

    def test_float_pool_values(self):
        loader = _make_loader(
            db_config={"host": MOCK_DB_HOST_SHORT, "username": MOCK_DB_USERNAME_SHORT, "password": MOCK_DB_PASSWORD_SHORT},
            globals_pool={"max_pool_size": 50.9, "min_pool_size": 5.1},
        )
        db = build_db_config(loader)
        assert db[KEY_MAX_POOL] == 50
        assert db[KEY_MIN_POOL] == 5
