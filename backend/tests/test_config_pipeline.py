"""Tests for config.py new methods: _load_json_file, _flatten_to_dot_paths,
_resolve_placeholders, load_environment, ConfigValueSimulator.load_simulator_file"""
import pytest
import os
import json
from pathlib import Path
from unittest.mock import patch, MagicMock

from easylifeauth.utils.config import ConfigurationLoader, ConfigValueSimulator


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
        f.write_text("{}")
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
        config = "{db.host}"
        lookup = {"db.host": "localhost"}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result == "localhost"

    def test_exact_match_int(self):
        """Test exact placeholder replaced with integer (typed replacement)"""
        config = "{db.port}"
        lookup = {"db.port": 5432}
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
        lookup = {"allowed.origins": ["http://a", "http://b"]}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result == ["http://a", "http://b"]

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
        lookup = {"db.host": "localhost", "db.port": 27017}
        result = ConfigurationLoader._resolve_placeholders(config, lookup)
        assert result == "mongodb://localhost:27017/mydb"

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
                "host": "{db.host}",
                "port": "{db.port}",
            },
            "name": "myapp",
        }
        lookup = {"db.host": "localhost", "db.port": 5432}
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
            str(tmp_path / "nope.json"), "TEST"
        )
        assert result == {}

    def test_loads_flat_json_and_returns_data(self, tmp_path):
        """Test loading flat JSON returns raw data dict"""
        data = {"db.host": "localhost", "db.port": 5432}
        f = tmp_path / "sim.json"
        f.write_text(json.dumps(data))
        env_keys = ["TEST_DB_HOST", "TEST_DB_PORT"]
        self._cleanup_env(env_keys)
        try:
            result = ConfigValueSimulator.load_simulator_file(str(f), "TEST")
            assert result == data
        finally:
            self._cleanup_env(env_keys)

    def test_sets_string_env_var(self, tmp_path):
        """Test that string values are set correctly as env vars"""
        f = tmp_path / "sim.json"
        f.write_text(json.dumps({"app.name": "myapp"}))
        env_key = "TEST_APP_NAME"
        self._cleanup_env([env_key])
        try:
            ConfigValueSimulator.load_simulator_file(str(f), "TEST")
            assert os.environ[env_key] == "myapp"
        finally:
            self._cleanup_env([env_key])

    def test_sets_int_env_var(self, tmp_path):
        """Test that integer values are converted to string env vars"""
        f = tmp_path / "sim.json"
        f.write_text(json.dumps({"server.port": 8080}))
        env_key = "TEST_SERVER_PORT"
        self._cleanup_env([env_key])
        try:
            ConfigValueSimulator.load_simulator_file(str(f), "TEST")
            assert os.environ[env_key] == "8080"
        finally:
            self._cleanup_env([env_key])

    def test_sets_bool_env_var(self, tmp_path):
        """Test that bool values are set as lowercase strings"""
        f = tmp_path / "sim.json"
        f.write_text(json.dumps({"feature.on": True, "feature.off": False}))
        env_keys = ["TEST_FEATURE_ON", "TEST_FEATURE_OFF"]
        self._cleanup_env(env_keys)
        try:
            ConfigValueSimulator.load_simulator_file(str(f), "TEST")
            assert os.environ["TEST_FEATURE_ON"] == "true"
            assert os.environ["TEST_FEATURE_OFF"] == "false"
        finally:
            self._cleanup_env(env_keys)

    def test_sets_list_env_var_as_json(self, tmp_path):
        """Test that list values are JSON-serialized in env vars"""
        f = tmp_path / "sim.json"
        f.write_text(json.dumps({"allowed.hosts": ["a", "b"]}))
        env_key = "TEST_ALLOWED_HOSTS"
        self._cleanup_env([env_key])
        try:
            ConfigValueSimulator.load_simulator_file(str(f), "TEST")
            assert os.environ[env_key] == '["a", "b"]'
        finally:
            self._cleanup_env([env_key])

    def test_sets_dict_env_var_as_json(self, tmp_path):
        """Test that dict values are JSON-serialized in env vars"""
        f = tmp_path / "sim.json"
        f.write_text(json.dumps({"db.options": {"ssl": True}}))
        env_key = "TEST_DB_OPTIONS"
        self._cleanup_env([env_key])
        try:
            ConfigValueSimulator.load_simulator_file(str(f), "TEST")
            assert json.loads(os.environ[env_key]) == {"ssl": True}
        finally:
            self._cleanup_env([env_key])


class TestConfigurationLoaderInit:
    """Tests for ConfigurationLoader.__init__ branching on environment param"""

    def test_environment_param_triggers_load_environment(self, tmp_path):
        """Test that passing environment= calls load_environment, not legacy"""
        # Create minimal config.json so it doesn't fail
        (tmp_path / "config.json").write_text("{}")
        (tmp_path / "production.json").write_text("{}")

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith("EASYLIFE_")}
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
            loader = ConfigurationLoader(config_path="/tmp/fake")
            mock_load.assert_called_once_with("config.json")
            mock_apply.assert_called_once()

    def test_environment_does_not_call_legacy(self):
        """Test that environment= skips _load_config and _apply_env_vars"""
        with patch.object(ConfigurationLoader, 'load_environment') as mock_env, \
             patch.object(ConfigurationLoader, '_load_config') as mock_load, \
             patch.object(ConfigurationLoader, '_apply_env_vars') as mock_apply:
            loader = ConfigurationLoader(
                config_path="/tmp/fake",
                environment="staging",
            )
            mock_env.assert_called_once()
            mock_load.assert_not_called()
            mock_apply.assert_not_called()


class TestLoadEnvironmentPipeline:
    """Tests for ConfigurationLoader.load_environment end-to-end"""

    def test_full_pipeline(self, tmp_path):
        """Test full config pipeline: simulator → localenv → env → config.json"""
        # Simulator: flat key-values
        sim = {"db.host": "simhost", "db.port": 5432}
        (tmp_path / "server.env.simulator.json").write_text(json.dumps(sim))

        # localenv-dev.json: references simulator values
        localenv = {"database": {"host": "{db.host}", "port": "{db.port}"}}
        (tmp_path / "localenv-dev.json").write_text(json.dumps(localenv))

        # dev.json: references localenv-flattened values
        env_json = {"connection_string": "mongodb://{database.host}:{database.port}/app"}
        (tmp_path / "dev.json").write_text(json.dumps(env_json))

        # config.json: uses env-resolved values
        config = {"db_url": "{connection_string}", "db_host": "{database.host}"}
        (tmp_path / "config.json").write_text(json.dumps(config))

        env_keys = ["EASYLIFE_DB_HOST", "EASYLIFE_DB_PORT"]
        for k in env_keys:
            os.environ.pop(k, None)

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith("EASYLIFE_")}

        try:
            with patch.dict(os.environ, clean_env, clear=True):
                loader = ConfigurationLoader(
                    config_path=str(tmp_path),
                    environment="dev",
                )
            assert loader.configuration["db_url"] == "mongodb://simhost:5432/app"
            assert loader.configuration["db_host"] == "simhost"
        finally:
            for k in env_keys:
                os.environ.pop(k, None)

    def test_missing_files_graceful(self, tmp_path):
        """Test that missing localenv/env/simulator files don't crash"""
        (tmp_path / "config.json").write_text('{"static": "value"}')

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith("EASYLIFE_")}
        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path),
                environment="prod",
            )
        assert loader.configuration["static"] == "value"

    def test_env_json_merges_into_config(self, tmp_path):
        """Test that env.json extra keys merge into resolved config"""
        (tmp_path / "config.json").write_text('{"base": "val"}')
        (tmp_path / "staging.json").write_text('{"extra_from_env": "added"}')

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith("EASYLIFE_")}
        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path),
                environment="staging",
            )
        assert loader.configuration["base"] == "val"
        assert loader.configuration["extra_from_env"] == "added"

    def test_localenv_wins_over_simulator(self, tmp_path):
        """Test that localenv values override simulator values in lookup"""
        sim = {"db.host": "sim-host"}
        (tmp_path / "server.env.simulator.json").write_text(json.dumps(sim))

        localenv = {"db": {"host": "local-host"}}
        (tmp_path / "localenv-dev.json").write_text(json.dumps(localenv))

        config = {"host": "{db.host}"}
        (tmp_path / "config.json").write_text(json.dumps(config))

        env_keys = ["EASYLIFE_DB_HOST"]
        for k in env_keys:
            os.environ.pop(k, None)

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith("EASYLIFE_")}
        try:
            with patch.dict(os.environ, clean_env, clear=True):
                loader = ConfigurationLoader(
                    config_path=str(tmp_path),
                    environment="dev",
                )
            assert loader.configuration["host"] == "local-host"
        finally:
            for k in env_keys:
                os.environ.pop(k, None)

    def test_env_json_wins_over_localenv(self, tmp_path):
        """Test that env.json values override localenv values in lookup"""
        localenv = {"server": {"port": 3000}}
        (tmp_path / "localenv-dev.json").write_text(json.dumps(localenv))

        env_json = {"server": {"port": 8080}}
        (tmp_path / "dev.json").write_text(json.dumps(env_json))

        config = {"port": "{server.port}"}
        (tmp_path / "config.json").write_text(json.dumps(config))

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith("EASYLIFE_")}
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
        sim = {"environment.authentication.secret": "s3cret"}
        (tmp_path / "server.env.simulator.json").write_text(json.dumps(sim))

        config = {"auth_secret": "{environment.authentication.secret}"}
        (tmp_path / "config.json").write_text(json.dumps(config))

        env_keys = ["EASYLIFE_ENVIRONMENT_AUTHENTICATION_SECRET"]
        for k in env_keys:
            os.environ.pop(k, None)

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith("EASYLIFE_")}
        try:
            with patch.dict(os.environ, clean_env, clear=True):
                loader = ConfigurationLoader(
                    config_path=str(tmp_path),
                    environment="dev",
                )
            assert loader.configuration["auth_secret"] == "s3cret"
        finally:
            for k in env_keys:
                os.environ.pop(k, None)

    def test_typo_path_does_not_resolve(self, tmp_path):
        """Test that the old typo 'authenitcation' would NOT resolve"""
        sim = {"environment.authentication.secret": "correct"}
        (tmp_path / "server.env.simulator.json").write_text(json.dumps(sim))

        config = {"auth_secret": "{environment.authenitcation.secret}"}
        (tmp_path / "config.json").write_text(json.dumps(config))

        env_keys = ["EASYLIFE_ENVIRONMENT_AUTHENTICATION_SECRET"]
        for k in env_keys:
            os.environ.pop(k, None)

        clean_env = {k: v for k, v in os.environ.items()
                     if not k.startswith("EASYLIFE_")}
        try:
            with patch.dict(os.environ, clean_env, clear=True):
                loader = ConfigurationLoader(
                    config_path=str(tmp_path),
                    environment="dev",
                )
            # Typo placeholder should stay unresolved
            assert loader.configuration["auth_secret"] == "{environment.authenitcation.secret}"
        finally:
            for k in env_keys:
                os.environ.pop(k, None)
