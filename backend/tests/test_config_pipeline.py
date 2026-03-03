"""Tests for config.py new methods: _load_json_file, _flatten_to_dot_paths,
_resolve_placeholders, load_environment, ConfigValueSimulator.load_simulator_file"""
import pytest
import os
import json
from pathlib import Path
from unittest.mock import patch, MagicMock

from easylifeauth import ENVIRONEMNT_VARIABLE_PREFIX, OS_PROPERTY_SEPRATOR
from easylifeauth.utils.config import ConfigurationLoader, ConfigValueSimulator
from mock_data import MOCK_PATH_CONFIG, MOCK_URL_HTTP_A, MOCK_URL_HTTP_B, MOCK_URL_MONGODB_MYDB, MOCK_URL_MONGODB_SIM

ENV_PREFIX = f"{ENVIRONEMNT_VARIABLE_PREFIX}_"
CFG_DB_HOST = "db.host"
CFG_DB_PORT = "db.port"
CFG_SERVER_ENV = "server.env."
EXT_JSON = ".json"
FILE_CONFIG_JSON = "config.json"
FILE_SIM_JSON = "sim.json"
JSON_DB = "{db"
JSON_DB_HOST = "{db.host}"
JSON_DB_PORT = "{db.port}"
JSON_VALUE = "{}"
STR_DB = "_DB"
STR_HOST = "HOST"
STR_HOST_BRACE = "host}"
STR_PORT = "PORT"
STR_SIM_HOST = "sim-host"
STR_TEST = "TEST"
STR_TEST_DB = "TEST_DB"
STR_TEST_FEATURE = "TEST_FEATURE"




class TestLoadJsonFile:
    """Tests for ConfigurationLoader._load_json_file"""

    def test_valid_json_file(self, tmp_path):
        """Test loading a valid JSON file returns parsed dict"""
        f = tmp_path / "test.json"
        f.write_text('{"key": "value", "num": 42}')
        result = ConfigurationLoader._load_json_file(str(f))
        assert result == {"key": "value", "num": 42}

    def test_missing_file_returns_empty_dict(self, tmp_path):
        """Test loading a non-existent file returns empty dict"""
        result = ConfigurationLoader._load_json_file(str(tmp_path / "nope.json"))
        assert result == {}

    def test_invalid_json_raises(self, tmp_path):
        """Test loading invalid JSON raises JSONDecodeError"""
        f = tmp_path / "bad.json"
        f.write_text("{not valid json")
        with pytest.raises(json.JSONDecodeError):
            ConfigurationLoader._load_json_file(str(f))

    def test_empty_json_object(self, tmp_path):
        """Test loading file with empty JSON object"""
        f = tmp_path / "empty.json"
        f.write_text(JSON_VALUE)
        result = ConfigurationLoader._load_json_file(str(f))
        assert result == {}

    def test_nested_json(self, tmp_path):
        """Test loading deeply nested JSON"""
        data = {"a": {"b": {"c": [1, 2, 3]}}}
        f = tmp_path / "nested.json"
        f.write_text(json.dumps(data))
        result = ConfigurationLoader._load_json_file(str(f))
        assert result == data


class TestFlattenToDotPaths:
    """Tests for ConfigurationLoader._flatten_to_dot_paths"""

    def test_empty_dict(self):
        """Test flattening empty dict returns empty dict"""
        assert ConfigurationLoader._flatten_to_dot_paths({}) == {}

    def test_single_level(self):
        """Test flattening single-level dict"""
        result = ConfigurationLoader._flatten_to_dot_paths({"a": 1, "b": "two"})
        assert result == {"a": 1, "b": "two"}

    def test_multi_level(self):
        """Test flattening multi-level nested dict"""
        d = {"a": {"b": {"c": "deep"}}}
        result = ConfigurationLoader._flatten_to_dot_paths(d)
        assert result == {"a.b.c": "deep"}

    def test_mixed_nesting(self):
        """Test flattening dict with mixed depth levels"""
        d = {
            "top": "value",
            "nested": {"child": "val"},
            "deep": {"level1": {"level2": 42}},
        }
        result = ConfigurationLoader._flatten_to_dot_paths(d)
        assert result == {
            "top": "value",
            "nested.child": "val",
            "deep.level1.level2": 42,
        }

    def test_list_values_preserved(self):
        """Test that list values are preserved as leaf values, not flattened"""
        d = {"items": [1, 2, 3]}
        result = ConfigurationLoader._flatten_to_dot_paths(d)
        assert result == {"items": [1, 2, 3]}

    def test_bool_and_none_values(self):
        """Test that bool and None values are preserved"""
        d = {"flag": True, "empty": None, "off": False}
        result = ConfigurationLoader._flatten_to_dot_paths(d)
        assert result == {"flag": True, "empty": None, "off": False}

    def test_non_dict_input_returns_empty(self):
        """Test that non-dict input returns empty dict"""
        assert ConfigurationLoader._flatten_to_dot_paths("string") == {}
        assert ConfigurationLoader._flatten_to_dot_paths([1, 2]) == {}
        assert ConfigurationLoader._flatten_to_dot_paths(None) == {}

    def test_parent_prefix(self):
        """Test flattening with a parent prefix"""
        d = {"host": "localhost", "port": 3000}
        result = ConfigurationLoader._flatten_to_dot_paths(d, parent="server")
        assert result == {"server.host": "localhost", "server.port": 3000}


class TestResolvePlaceholders:
    """Tests for ConfigurationLoader._resolve_placeholders"""

    def test_exact_match_string(self):
        """Test exact placeholder replaced with string value"""
        config = JSON_DB_HOST
        lookup = {CFG_DB_HOST: "localhost"}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result == "localhost"

    def test_exact_match_int(self):
        """Test exact placeholder replaced with integer (typed replacement)"""
        config = JSON_DB_PORT
        lookup = {CFG_DB_PORT: 5432}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result == 5432

    def test_exact_match_bool(self):
        """Test exact placeholder replaced with bool"""
        config = "{feature.enabled}"
        lookup = {"feature.enabled": True}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result is True

    def test_exact_match_list(self):
        """Test exact placeholder replaced with list (typed)"""
        config = "{allowed.origins}"
        lookup = {"allowed.origins": [MOCK_URL_HTTP_A, MOCK_URL_HTTP_B]}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result == [MOCK_URL_HTTP_A, MOCK_URL_HTTP_B]

    def test_exact_match_dict(self):
        """Test exact placeholder replaced with dict (typed)"""
        config = "{db.options}"
        lookup = {"db.options": {"ssl": True, "timeout": 30}}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result == {"ssl": True, "timeout": 30}

    def test_exact_match_returns_deepcopy(self):
        """Test that exact match returns a deep copy, not a reference"""
        original = {"nested": [1, 2, 3]}
        lookup = {"data": original}
        result = ConfigurationLoader._resolve_placeholders("{data}", lookup)
        result["nested"].append(4)
        assert original == {"nested": [1, 2, 3]}  # original unchanged

    def test_embedded_placeholder_string_interpolation(self):
        """Test embedded placeholder does string interpolation"""
        config = "mongodb://{db.host}:{db.port}/mydb"
        lookup = {CFG_DB_HOST: "localhost", CFG_DB_PORT: 27017}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result == MOCK_URL_MONGODB_MYDB

    def test_embedded_placeholder_with_dict_value(self):
        """Test embedded placeholder with dict value serializes to JSON"""
        config = "config={opts}"
        lookup = {"opts": {"a": 1}}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result == 'config={"a": 1}'

    def test_embedded_placeholder_with_list_value(self):
        """Test embedded placeholder with list value serializes to JSON"""
        config = "items={items}"
        lookup = {"items": [1, 2, 3]}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result == "items=[1, 2, 3]"

    def test_unresolved_placeholder_left_as_is(self):
        """Test placeholder with no match stays as original string"""
        config = "{missing.key}"
        lookup = {"other.key": "value"}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result == "{missing.key}"

    def test_unresolved_embedded_placeholder_left_as_is(self):
        """Test unresolved embedded placeholder preserved in string"""
        config = "prefix-{missing}-suffix"
        lookup = {}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result == "prefix-{missing}-suffix"

    def test_mixed_resolved_and_unresolved(self):
        """Test string with both resolved and unresolved placeholders"""
        config = "{host}:{missing.port}"
        lookup = {"host": "localhost"}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result == "localhost:{missing.port}"

    def test_nested_dict_resolved_recursively(self):
        """Test that dicts are resolved recursively"""
        config = {
            "db": {
                "host": JSON_DB_HOST,
                "port": JSON_DB_PORT,
            },
            "name": "myapp",
        }
        lookup = {CFG_DB_HOST: "localhost", CFG_DB_PORT: 5432}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result == {
            "db": {"host": "localhost", "port": 5432},
            "name": "myapp",
        }

    def test_list_resolved_recursively(self):
        """Test that lists are resolved recursively"""
        config = ["{a}", "{b}", "literal"]
        lookup = {"a": 1, "b": 2}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result == [1, 2, "literal"]

    def test_non_string_int_passthrough(self):
        """Test that integer values pass through unchanged"""
        assert ConfigurationLoader._resolve_placeholders(42, {}) == 42

    def test_non_string_bool_passthrough(self):
        """Test that bool values pass through unchanged"""
        assert ConfigurationLoader._resolve_placeholders(True, {}) is True

    def test_non_string_none_passthrough(self):
        """Test that None passes through unchanged"""
        assert ConfigurationLoader._resolve_placeholders(None, {}) is None

    def test_no_placeholder_string_unchanged(self):
        """Test that a string without placeholders is returned unchanged"""
        result = ConfigurationLoader._resolve_placeholders("plain text", {})
        assert result == "plain text"

    def test_nested_list_in_dict(self):
        """Test resolving placeholders in a list nested inside a dict"""
        config = {"servers": ["{s1}", "{s2}"]}
        lookup = {"s1": "host1", "s2": "host2"}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result == {"servers": ["host1", "host2"]}


class TestLoadSimulatorFile:
    """Tests for ConfigValueSimulator.load_simulator_file"""

    def _cleanup_env(self, keys):
        """Remove env vars by keys"""
        for k in keys:
            os.environ.pop(k, None)

    def test_missing_file_returns_empty_dict(self, tmp_path):
        """Test that a missing simulator file returns empty dict"""
        result = ConfigValueSimulator.load_simulator_file(
            str(tmp_path / "nope.json"), STR_TEST
        )
        assert result == {}

    def test_loads_flat_json_and_returns_data(self, tmp_path):
        """Test loading flat JSON returns raw data dict"""
        sep = OS_PROPERTY_SEPRATOR
        data = {f"db{sep}host": "localhost", f"db{sep}port": 5432}
        f = tmp_path / FILE_SIM_JSON
        f.write_text(json.dumps(data))
        env_keys = [f"TEST_DB{sep}HOST", f"TEST_DB{sep}PORT"]
        self._cleanup_env(env_keys)
        try:
            result = ConfigValueSimulator.load_simulator_file(str(f), STR_TEST)
            assert result == data
        finally:
            self._cleanup_env(env_keys)

    def test_sets_string_env_var(self, tmp_path):
        """Test that string values are set correctly as env vars"""
        sep = OS_PROPERTY_SEPRATOR
        f = tmp_path / FILE_SIM_JSON
        f.write_text(json.dumps({f"app{sep}name": "myapp"}))
        env_key = f"TEST_APP{sep}NAME"
        self._cleanup_env([env_key])
        try:
            ConfigValueSimulator.load_simulator_file(str(f), STR_TEST)
            assert os.environ[env_key] == "myapp"
        finally:
            self._cleanup_env([env_key])

    def test_sets_int_env_var(self, tmp_path):
        """Test that integer values are converted to string env vars"""
        sep = OS_PROPERTY_SEPRATOR
        f = tmp_path / FILE_SIM_JSON
        f.write_text(json.dumps({f"server{sep}port": 8080}))
        env_key = f"TEST_SERVER{sep}PORT"
        self._cleanup_env([env_key])
        try:
            ConfigValueSimulator.load_simulator_file(str(f), STR_TEST)
            assert os.environ[env_key] == "8080"
        finally:
            self._cleanup_env([env_key])

    def test_sets_bool_env_var(self, tmp_path):
        """Test that bool values are set as lowercase strings"""
        sep = OS_PROPERTY_SEPRATOR
        f = tmp_path / FILE_SIM_JSON
        f.write_text(json.dumps({f"feature{sep}on": True, f"feature{sep}off": False}))
        env_keys = [f"TEST_FEATURE{sep}ON", f"TEST_FEATURE{sep}OFF"]
        self._cleanup_env(env_keys)
        try:
            ConfigValueSimulator.load_simulator_file(str(f), STR_TEST)
            assert os.environ[f"TEST_FEATURE{sep}ON"] == "true"
            assert os.environ[f"TEST_FEATURE{sep}OFF"] == "false"
        finally:
            self._cleanup_env(env_keys)

    def test_sets_list_env_var_as_json(self, tmp_path):
        """Test that list values are JSON-serialized in env vars"""
        sep = OS_PROPERTY_SEPRATOR
        f = tmp_path / FILE_SIM_JSON
        f.write_text(json.dumps({f"allowed{sep}hosts": ["a", "b"]}))
        env_key = f"TEST_ALLOWED{sep}HOSTS"
        self._cleanup_env([env_key])
        try:
            ConfigValueSimulator.load_simulator_file(str(f), STR_TEST)
            assert os.environ[env_key] == '["a", "b"]'
        finally:
            self._cleanup_env([env_key])

    def test_sets_dict_env_var_as_json(self, tmp_path):
        """Test that dict values are JSON-serialized in env vars"""
        sep = OS_PROPERTY_SEPRATOR
        f = tmp_path / FILE_SIM_JSON
        f.write_text(json.dumps({f"db{sep}options": {"ssl": True}}))
        env_key = f"TEST_DB{sep}OPTIONS"
        self._cleanup_env([env_key])
        try:
            ConfigValueSimulator.load_simulator_file(str(f), STR_TEST)
            assert json.loads(os.environ[env_key]) == {"ssl": True}
        finally:
            self._cleanup_env([env_key])


class TestConfigurationLoaderInit:
    """Tests for ConfigurationLoader.__init__ branching on environment param"""

    def test_environment_param_triggers_load_environment(self, tmp_path):
        """Test that passing environment= calls load_environment, not legacy"""
        # Create minimal config.json so it doesn't fail
        (tmp_path / FILE_CONFIG_JSON).write_text(JSON_VALUE)
        (tmp_path / "production.json").write_text(JSON_VALUE)

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith(ENV_PREFIX)}
        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path),
                environment="production",
            )
        assert loader.configuration == {}  # empty since all files are {}

    def test_no_environment_triggers_legacy(self):
        """Test that omitting environment= calls _load_config + _apply_env_vars"""
        with patch.object(ConfigurationLoader, '_load_config') as mock_load, \
             patch.object(ConfigurationLoader, '_apply_env_vars') as mock_apply:
            loader = ConfigurationLoader(config_path=MOCK_PATH_CONFIG)
            mock_load.assert_called_once_with(FILE_CONFIG_JSON)
            mock_apply.assert_called_once()

    def test_environment_does_not_call_legacy(self):
        """Test that environment= skips _load_config and _apply_env_vars"""
        with patch.object(ConfigurationLoader, 'load_environment') as mock_env, \
             patch.object(ConfigurationLoader, '_load_config') as mock_load, \
             patch.object(ConfigurationLoader, '_apply_env_vars') as mock_apply:
            loader = ConfigurationLoader(
                config_path=MOCK_PATH_CONFIG,
                environment="staging",
            )
            mock_env.assert_called_once()
            mock_load.assert_not_called()
            mock_apply.assert_not_called()


class TestLoadEnvironmentPipeline:
    """Tests for ConfigurationLoader.load_environment end-to-end"""

    def test_full_pipeline(self, tmp_path):
        """Test full config pipeline: simulator → localenv → env → config.json"""
        env = "dev"
        # Simulator: flat key-values
        sim = {CFG_DB_HOST: "simhost", CFG_DB_PORT: 5432}
        (tmp_path / f"server.env.{env}.json").write_text(json.dumps(sim))

        # localenv-dev.json: references simulator values
        localenv = {"database": {"host": JSON_DB_HOST, "port": JSON_DB_PORT}}
        (tmp_path / f"localenv-{env}.json").write_text(json.dumps(localenv))

        # dev.json: references localenv-flattened values
        env_json = {"connection_string": "mongodb://{database.host}:{database.port}/app"}
        (tmp_path / f"{env}.json").write_text(json.dumps(env_json))

        # config.json: uses env-resolved values
        config = {"db_url": "{connection_string}", "db_host": "{database.host}"}
        (tmp_path / FILE_CONFIG_JSON).write_text(json.dumps(config))

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith(ENV_PREFIX)}
        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path),
                environment=env,
            )
        assert loader.configuration["db_url"] == MOCK_URL_MONGODB_SIM
        assert loader.configuration["db_host"] == "simhost"

    def test_missing_files_graceful(self, tmp_path):
        """Test that missing localenv/env/simulator files don't crash"""
        (tmp_path / FILE_CONFIG_JSON).write_text('{"static": "value"}')

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith(ENV_PREFIX)}
        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path),
                environment="prod",
            )
        assert loader.configuration["static"] == "value"

    def test_env_json_merges_into_config(self, tmp_path):
        """Test that env.json extra keys merge into resolved config"""
        (tmp_path / FILE_CONFIG_JSON).write_text('{"base": "val"}')
        (tmp_path / "staging.json").write_text('{"extra_from_env": "added"}')

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith(ENV_PREFIX)}
        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path),
                environment="staging",
            )
        assert loader.configuration["base"] == "val"
        assert loader.configuration["extra_from_env"] == "added"

    def test_localenv_wins_over_simulator(self, tmp_path):
        """Test that localenv values override simulator values in lookup"""
        env = "dev"
        sim = {CFG_DB_HOST: STR_SIM_HOST}
        (tmp_path / f"server.env.{env}.json").write_text(json.dumps(sim))

        localenv = {"db": {"host": "local-host"}}
        (tmp_path / f"localenv-{env}.json").write_text(json.dumps(localenv))

        config = {"host": JSON_DB_HOST}
        (tmp_path / FILE_CONFIG_JSON).write_text(json.dumps(config))

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith(ENV_PREFIX)}
        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path),
                environment=env,
            )
        assert loader.configuration["host"] == "local-host"

    def test_env_json_wins_over_localenv(self, tmp_path):
        """Test that env.json values override localenv values in lookup"""
        localenv = {"server": {"port": 3000}}
        (tmp_path / "localenv-dev.json").write_text(json.dumps(localenv))

        env_json = {"server": {"port": 8080}}
        (tmp_path / "dev.json").write_text(json.dumps(env_json))

        config = {"port": "{server.port}"}
        (tmp_path / FILE_CONFIG_JSON).write_text(json.dumps(config))

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith(ENV_PREFIX)}
        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path),
                environment="dev",
            )
        assert loader.configuration["port"] == 8080


class TestAuthenticationTypoFix:
    """Verify config uses 'authentication' (not 'authenitcation')"""

    def test_resolved_config_uses_correct_spelling(self, tmp_path):
        """Test that placeholder paths use authentication, not authenitcation"""
        env = "dev"
        sim = {"environment.authentication.secret": "s3cret"}
        (tmp_path / f"server.env.{env}.json").write_text(json.dumps(sim))

        config = {"auth_secret": "{environment.authentication.secret}"}
        (tmp_path / FILE_CONFIG_JSON).write_text(json.dumps(config))

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith(ENV_PREFIX)}
        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path),
                environment=env,
            )
        assert loader.configuration["auth_secret"] == "s3cret"

    def test_typo_path_does_not_resolve(self, tmp_path):
        """Test that the old typo 'authenitcation' would NOT resolve"""
        env = "dev"
        sim = {"environment.authentication.secret": "correct"}
        (tmp_path / f"server.env.{env}.json").write_text(json.dumps(sim))

        config = {"auth_secret": "{environment.authenitcation.secret}"}
        (tmp_path / FILE_CONFIG_JSON).write_text(json.dumps(config))

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith(ENV_PREFIX)}
        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path),
                environment=env,
            )
        # Typo placeholder should stay unresolved
        assert loader.configuration["auth_secret"] == "{environment.authenitcation.secret}"


class TestEnvVarOverrides:
    """Tests for OS environment variable overrides in the config pipeline"""

    def test_env_var_overrides_simulator_value(self, tmp_path):
        """Test that env prefix env vars override simulator values"""
        sep = OS_PROPERTY_SEPRATOR
        env = "dev"
        sim = {f"db{sep}host": STR_SIM_HOST, f"db{sep}port": 5432}
        (tmp_path / f"server.env.{env}.json").write_text(json.dumps(sim))

        config = {"host": f"{{db{sep}host}}", "port": f"{{db{sep}port}}"}
        (tmp_path / FILE_CONFIG_JSON).write_text(json.dumps(config))

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith(ENV_PREFIX)}
        clean_env[f"{ENVIRONEMNT_VARIABLE_PREFIX}_DB{sep}HOST"] = "docker-host"
        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path),
                environment=env,
            )
        assert loader.configuration["host"] == "docker-host"
        assert loader.configuration["port"] == 5432

    def test_env_vars_work_without_simulator_file(self, tmp_path):
        """Test that config resolves from env vars alone when simulator is missing"""
        sep = OS_PROPERTY_SEPRATOR
        env = "dev"
        # No simulator file — only config.json template
        config = {"db": {"host": f"{{db{sep}host}}", "port": f"{{db{sep}port}}"}}
        (tmp_path / FILE_CONFIG_JSON).write_text(json.dumps(config))

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith(ENV_PREFIX)}
        # Set env vars that match the placeholder keys
        clean_env[f"{ENVIRONEMNT_VARIABLE_PREFIX}_DB{sep}HOST"] = "env-only-host"
        clean_env[f"{ENVIRONEMNT_VARIABLE_PREFIX}_DB{sep}PORT"] = "3307"
        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path),
                environment=env,
            )
        assert loader.configuration["db"]["host"] == "env-only-host"
        assert loader.configuration["db"]["port"] == 3307

    def test_env_var_with_underscore_key_uses_reverse_map(self, tmp_path):
        """Test that db_info underscore is preserved via reverse map"""
        sep = OS_PROPERTY_SEPRATOR
        env = "dev"
        sim = {f"databases{sep}auth{sep}db_info{sep}host": STR_SIM_HOST}
        (tmp_path / f"server.env.{env}.json").write_text(json.dumps(sim))

        config = {"host": f"{{databases{sep}auth{sep}db_info{sep}host}}"}
        (tmp_path / FILE_CONFIG_JSON).write_text(json.dumps(config))

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith(ENV_PREFIX)}
        # Env var key uses separator: EASYLIFE_DATABASES.AUTH.DB_INFO.HOST
        clean_env[f"{ENVIRONEMNT_VARIABLE_PREFIX}_DATABASES{sep}AUTH{sep}DB_INFO{sep}HOST"] = "docker-db"
        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path),
                environment=env,
            )
        assert loader.configuration["host"] == "docker-db"

    def test_env_var_skips_meta_keys(self, tmp_path):
        """Test that {prefix}_ENVIRONMENT is not treated as a config value"""
        env = "dev"
        config = {"name": "app"}
        (tmp_path / FILE_CONFIG_JSON).write_text(json.dumps(config))

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith(ENV_PREFIX)}
        clean_env[f"{ENVIRONEMNT_VARIABLE_PREFIX}_ENVIRONMENT"] = "production"
        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path),
                environment=env,
            )
        # {prefix}_ENVIRONMENT should not inject "environment" key into config
        assert "environment" not in loader.configuration or loader.configuration.get("environment") != "production"
