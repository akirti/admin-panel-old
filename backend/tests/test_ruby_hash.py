"""Tests for parse_ruby_hash utility and its integration with _convert_value."""
import os
import json
import pytest
from unittest.mock import patch

from easylifeauth import ENVIRONEMNT_VARIABLE_PREFIX, OS_PROPERTY_SEPRATOR
from easylifeauth.utils.dict_util import parse_ruby_hash
from easylifeauth.utils.config import ConfigurationLoader
from mock_data import MOCK_URL_GCS, MOCK_EMAIL

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
RUBY_ARROW = "=>"
KEY_AUTH_URI = "auth_uri"
KEY_TOKEN_URI = "token_uri"
KEY_CLIENT_EMAIL = "client_email"
KEY_PROJECT_ID = "project_id"
KEY_TYPE = "type"
KEY_PRIVATE_KEY = "private_key"
KEY_AUTH_PROVIDER = "auth_provider_x509_cert_url"

VAL_SERVICE_ACCOUNT = "service_account"
VAL_MY_PROJECT = "my-project"

URL_OAUTH2_AUTH = "https://accounts.google.com/o/oauth2/auth"
URL_OAUTH2_TOKEN = "https://oauth2.googleapis.com/token"
URL_OAUTH2_CERTS = "https://www.googleapis.com/oauth2/v1/certs"

ENV_PREFIX = f"{ENVIRONEMNT_VARIABLE_PREFIX}_"
FILE_CONFIG_JSON = "config.json"


# ===========================================================================
# parse_ruby_hash — standalone tests
# ===========================================================================
class TestParseRubyHash:
    """Tests for the parse_ruby_hash function."""

    def test_simple_symbol_keys(self):
        """Parse Ruby hash with :symbol keys."""
        raw = '{:name=>"alice",:age=>"30"}'
        result = parse_ruby_hash(raw)
        assert result == {"name": "alice", "age": "30"}

    def test_bare_keys_without_colon(self):
        """Parse Ruby hash with bare keys (no : prefix)."""
        raw = '{name=>"alice",age=>"30"}'
        result = parse_ruby_hash(raw)
        assert result == {"name": "alice", "age": "30"}

    def test_mixed_keys(self):
        """Parse Ruby hash with mixed :symbol and bare keys."""
        raw = '{:name=>"alice",age=>"30"}'
        result = parse_ruby_hash(raw)
        assert result == {"name": "alice", "age": "30"}

    def test_url_values(self):
        """Parse Ruby hash with URL values containing special chars."""
        raw = (
            '{:auth_uri=>"' + URL_OAUTH2_AUTH + '"'
            ',:token_uri=>"' + URL_OAUTH2_TOKEN + '"}'
        )
        result = parse_ruby_hash(raw)
        assert result == {
            KEY_AUTH_URI: URL_OAUTH2_AUTH,
            KEY_TOKEN_URI: URL_OAUTH2_TOKEN,
        }

    def test_gcs_credentials_format(self):
        """Parse a realistic GCS credentials Ruby hash."""
        raw = (
            '{'
            ':type=>"service_account"'
            ',:project_id=>"my-project"'
            ',:client_email=>"' + MOCK_EMAIL + '"'
            ',:auth_uri=>"' + URL_OAUTH2_AUTH + '"'
            ',:token_uri=>"' + URL_OAUTH2_TOKEN + '"'
            ',:auth_provider_x509_cert_url=>"' + URL_OAUTH2_CERTS + '"'
            '}'
        )
        result = parse_ruby_hash(raw)
        assert result is not None
        assert result[KEY_TYPE] == VAL_SERVICE_ACCOUNT
        assert result[KEY_PROJECT_ID] == VAL_MY_PROJECT
        assert result[KEY_CLIENT_EMAIL] == MOCK_EMAIL
        assert result[KEY_AUTH_URI] == URL_OAUTH2_AUTH
        assert result[KEY_TOKEN_URI] == URL_OAUTH2_TOKEN
        assert result[KEY_AUTH_PROVIDER] == URL_OAUTH2_CERTS

    def test_whitespace_around_arrow(self):
        """Parse Ruby hash with spaces around =>."""
        raw = '{:name => "alice" , :city => "paris"}'
        result = parse_ruby_hash(raw)
        assert result == {"name": "alice", "city": "paris"}

    def test_escaped_quote_in_value(self):
        """Parse Ruby hash with escaped double quote in value."""
        raw = r'{:msg=>"say \"hello\""}'
        result = parse_ruby_hash(raw)
        assert result == {"msg": 'say "hello"'}

    def test_escaped_newline_in_value(self):
        """Parse Ruby hash with escaped \\n in value (e.g. private key)."""
        raw = '{:private_key=>"line1\\nline2"}'
        result = parse_ruby_hash(raw)
        assert result == {KEY_PRIVATE_KEY: "line1\nline2"}

    def test_escaped_backslash_in_value(self):
        """Parse Ruby hash with escaped backslash."""
        raw = '{:path=>"C:\\\\Users"}'
        result = parse_ruby_hash(raw)
        assert result == {"path": "C:\\Users"}

    def test_key_with_underscore(self):
        """Parse Ruby hash where keys contain underscores."""
        raw = '{:private_key_id=>"abc123"}'
        result = parse_ruby_hash(raw)
        assert result == {"private_key_id": "abc123"}

    def test_empty_value(self):
        """Parse Ruby hash with empty string value."""
        raw = '{:name=>""}'
        result = parse_ruby_hash(raw)
        assert result == {"name": ""}

    def test_leading_trailing_whitespace(self):
        """Parse Ruby hash with leading/trailing whitespace."""
        raw = '  {:name=>"alice"}  '
        result = parse_ruby_hash(raw)
        assert result == {"name": "alice"}

    # --- None / fallthrough cases ---

    def test_returns_none_for_empty_string(self):
        """Return None for empty string."""
        assert parse_ruby_hash("") is None

    def test_returns_none_for_plain_string(self):
        """Return None for plain string without braces or =>."""
        assert parse_ruby_hash("hello world") is None

    def test_returns_none_for_json_object(self):
        """Return None for valid JSON object (no => present)."""
        assert parse_ruby_hash('{"key": "value"}') is None

    def test_returns_none_for_json_array(self):
        """Return None for JSON array."""
        assert parse_ruby_hash('[1, 2, 3]') is None

    def test_returns_none_for_braces_no_arrow(self):
        """Return None when braces present but no => separator."""
        assert parse_ruby_hash("{key: value}") is None

    def test_returns_none_for_no_valid_pairs(self):
        """Return None when => exists but no valid key=>\"value\" pairs."""
        assert parse_ruby_hash("{=> =>}") is None

    def test_returns_none_for_numeric_string(self):
        """Return None for numeric string."""
        assert parse_ruby_hash("42") is None

    def test_returns_none_for_bool_string(self):
        """Return None for boolean string."""
        assert parse_ruby_hash("true") is None


# ===========================================================================
# _convert_value integration — Ruby hash path
# ===========================================================================
class TestConvertValueRubyHash:
    """Tests for ConfigurationLoader._convert_value with Ruby hash input."""

    def _make_loader(self):
        """Create a bare ConfigurationLoader (legacy mode, no files)."""
        with patch.object(ConfigurationLoader, "_load_config"):
            with patch.object(ConfigurationLoader, "_apply_env_vars"):
                return ConfigurationLoader()

    def test_ruby_hash_converted_to_dict(self):
        """_convert_value returns dict for Ruby hash string."""
        loader = self._make_loader()
        raw = '{:type=>"service_account",:project_id=>"my-project"}'
        result = loader._convert_value(raw)
        assert isinstance(result, dict)
        assert result[KEY_TYPE] == VAL_SERVICE_ACCOUNT
        assert result[KEY_PROJECT_ID] == VAL_MY_PROJECT

    def test_json_still_preferred_over_ruby(self):
        """_convert_value prefers JSON when input is valid JSON."""
        loader = self._make_loader()
        raw = '{"type": "service_account"}'
        result = loader._convert_value(raw)
        assert isinstance(result, dict)
        assert result[KEY_TYPE] == VAL_SERVICE_ACCOUNT

    def test_int_still_works(self):
        """_convert_value still converts plain integers."""
        loader = self._make_loader()
        assert loader._convert_value("42") == 42

    def test_float_still_works(self):
        """_convert_value still converts plain floats."""
        loader = self._make_loader()
        assert loader._convert_value("3.14") == 3.14

    def test_bool_still_works(self):
        """_convert_value still converts booleans."""
        loader = self._make_loader()
        assert loader._convert_value("true") is True
        assert loader._convert_value("false") is False

    def test_plain_string_unchanged(self):
        """_convert_value returns plain string unchanged."""
        loader = self._make_loader()
        assert loader._convert_value("hello") == "hello"

    def test_ruby_hash_takes_precedence_over_int(self):
        """Ruby hash detected before int conversion is attempted."""
        loader = self._make_loader()
        raw = '{:count=>"42"}'
        result = loader._convert_value(raw)
        assert isinstance(result, dict)
        assert result["count"] == "42"


# ===========================================================================
# End-to-end: env var → config pipeline with Ruby hash
# ===========================================================================
class TestRubyHashInConfigPipeline:
    """Test that Ruby hash env vars flow through the config pipeline correctly."""

    def test_env_var_ruby_hash_resolved_as_dict(self, tmp_path):
        """Ruby hash env var becomes a dict in final configuration."""
        sep = OS_PROPERTY_SEPRATOR
        env = "dev"
        ruby_creds = '{:type=>"service_account",:project_id=>"my-project"}'

        config = {
            "storage": {
                "credentials_json": f"{{environment{sep}storage{sep}gcs{sep}credentials_json}}"
            }
        }
        (tmp_path / FILE_CONFIG_JSON).write_text(json.dumps(config))

        clean_env = {
            k: v for k, v in os.environ.items() if not k.startswith(ENV_PREFIX)
        }
        env_key = f"{ENVIRONEMNT_VARIABLE_PREFIX}_ENVIRONMENT{sep}STORAGE{sep}GCS{sep}CREDENTIALS_JSON"
        clean_env[env_key] = ruby_creds

        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path), environment=env
            )

        creds = loader.configuration["storage"]["credentials_json"]
        assert isinstance(creds, dict)
        assert creds[KEY_TYPE] == VAL_SERVICE_ACCOUNT
        assert creds[KEY_PROJECT_ID] == VAL_MY_PROJECT

    def test_json_env_var_still_works_in_pipeline(self, tmp_path):
        """Valid JSON env var is still parsed as JSON (not Ruby hash)."""
        sep = OS_PROPERTY_SEPRATOR
        env = "dev"
        json_creds = json.dumps({"type": "service_account", "project_id": "my-project"})

        config = {
            "storage": {
                "credentials_json": f"{{environment{sep}storage{sep}gcs{sep}credentials_json}}"
            }
        }
        (tmp_path / FILE_CONFIG_JSON).write_text(json.dumps(config))

        clean_env = {
            k: v for k, v in os.environ.items() if not k.startswith(ENV_PREFIX)
        }
        env_key = f"{ENVIRONEMNT_VARIABLE_PREFIX}_ENVIRONMENT{sep}STORAGE{sep}GCS{sep}CREDENTIALS_JSON"
        clean_env[env_key] = json_creds

        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path), environment=env
            )

        creds = loader.configuration["storage"]["credentials_json"]
        assert isinstance(creds, dict)
        assert creds[KEY_TYPE] == VAL_SERVICE_ACCOUNT
