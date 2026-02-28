"""Tests for Utility modules"""
import pytest
import os
import json
from unittest.mock import patch, MagicMock
from pathlib import Path

from easylifeauth import ENVIRONEMNT_VARIABLE_PREFIX
from easylifeauth.utils.dict_util import DictUtil
from easylifeauth.utils.config import ConfigurationLoader

ENV_PREFIX = f"{ENVIRONEMNT_VARIABLE_PREFIX}_"
from easylifeauth.utils.args_util import (
    convert_str, is_stringified_json, get_stringified_json_to_dict,
    is_valid_value_list, parse_key_path, assign_nested, parse_url_args,
    clean_parse_url_args
)


class TestDictUtilError:
    """Tests for DictUtilError"""

    def test_dict_util_error(self):
        """Test DictUtilError exception"""
        from easylifeauth.utils.dict_util import DictUtilError
        error = DictUtilError("Test error")
        assert str(error) == "Test error"


class TestDictUtil:
    """Tests for DictUtil"""

    @pytest.fixture
    def dict_util(self):
        return DictUtil()

    def test_deep_get_success(self, dict_util):
        """Test getting deep nested value"""
        d = {"a": {"b": {"c": "value"}}}
        result = dict_util.deep_get(d, "a.b.c")
        assert result == "value"

    def test_deep_get_default(self, dict_util):
        """Test getting with default"""
        d = {"a": {"b": {}}}
        result = dict_util.deep_get(d, "a.b.c", default="default")
        assert result == "default"

    def test_get_deep_nested_value_success(self, dict_util):
        """Test getting deep nested value"""
        d = {"level1": {"level2": {"level3": "value"}}}
        result = dict_util.get_deep_nested_value(d, "level1.level2.level3")
        assert result == "value"

    def test_get_deep_nested_value_with_list(self, dict_util):
        """Test getting value from list structure"""
        d = {"items": [{"name": "item1"}, {"name": "item2"}]}
        result = dict_util.get_deep_nested_value(d, "items.name")
        assert result == ["item1", "item2"]

    def test_get_deep_nested_value_not_found(self, dict_util):
        """Test getting non-existent value"""
        d = {"a": {"b": "c"}}
        result = dict_util.get_deep_nested_value(d, "a.x.y")
        assert result is None

    def test_get_deep_nested_value_attribute_error(self, dict_util):
        """Test handling AttributeError in nested value retrieval"""
        # This creates an empty list since 1,2,3 don't have .get, filtered out
        d = {"items": [1, 2, 3]}  # List of non-dicts that won't have .get
        result = dict_util.get_deep_nested_value(d, "items.value")
        # Non-dict items in list are filtered out, resulting in empty list
        assert result == []

    def test_get_deep_nested_value_triggers_attribute_error(self, dict_util):
        """Test that triggers AttributeError in nested value retrieval"""
        # Use a non-dict value that will cause AttributeError when .get is called
        d = {"count": 5}  # int value
        result = dict_util.get_deep_nested_value(d, "count.nested")
        # When trying to call .get() on an int, it returns None via AttributeError handler
        assert result is None

    def test_merge_dicts_simple(self, dict_util):
        """Test merging simple dicts"""
        config = {"a": 1}
        settings = {"b": 2}
        dict_util.merge_dicts(config, settings)
        assert config == {"a": 1, "b": 2}

    def test_merge_dicts_nested(self, dict_util):
        """Test merging nested dicts"""
        config = {"a": {"x": 1}}
        settings = {"a": {"y": 2}}
        dict_util.merge_dicts(config, settings)
        assert config == {"a": {"x": 1, "y": 2}}

    def test_merge_dicts_lists(self, dict_util):
        """Test merging lists"""
        config = {"items": [1, 2]}
        settings = {"items": [2, 3]}
        dict_util.merge_dicts(config, settings)
        assert config == {"items": [1, 2, 3]}

    def test_merge_dicts_overwrite(self, dict_util):
        """Test overwriting values"""
        config = {"a": 1}
        settings = {"a": 2}
        dict_util.merge_dicts(config, settings)
        assert config == {"a": 2}


class TestArgsUtil:
    """Tests for args_util functions"""

    def test_convert_str_bool_true(self):
        """Test converting string to bool true"""
        assert convert_str("true") is True
        assert convert_str("True") is True

    def test_convert_str_bool_false(self):
        """Test converting string to bool false"""
        assert convert_str("false") is False
        assert convert_str("False") is False

    def test_convert_str_int(self):
        """Test converting string to int"""
        assert convert_str("42") == 42
        assert convert_str("-10") == -10

    def test_convert_str_float(self):
        """Test converting string to float"""
        assert convert_str("3.14") == 3.14
        assert convert_str("-2.5") == -2.5

    def test_convert_str_passthrough(self):
        """Test string passthrough"""
        assert convert_str("hello") == "hello"

    def test_convert_str_query_key(self):
        """Test string with query_ key prefix"""
        assert convert_str("123", key="query_param") == "123"

    def test_convert_str_value_error(self):
        """Test string that causes ValueError"""
        # "1.2.3" contains dots but isn't a valid float
        result = convert_str("1.2.3")
        assert result == "1.2.3"  # Returns original string

    def test_is_stringified_json_dict(self):
        """Test detecting stringified JSON dict"""
        assert is_stringified_json('{"key": "value"}') is True

    def test_is_stringified_json_list(self):
        """Test detecting stringified JSON list"""
        assert is_stringified_json('[1, 2, 3]') is True

    def test_is_stringified_json_not_json(self):
        """Test non-JSON string"""
        assert is_stringified_json("not json") is False

    def test_is_stringified_json_not_string(self):
        """Test non-string input"""
        assert is_stringified_json(123) is False

    def test_is_stringified_json_primitive(self):
        """Test JSON primitive (number)"""
        assert is_stringified_json("42") is False

    def test_get_stringified_json_to_dict_json(self):
        """Test converting stringified JSON"""
        result = get_stringified_json_to_dict('{"key": "value"}')
        assert result == {"key": "value"}

    def test_get_stringified_json_to_dict_non_json(self):
        """Test converting non-JSON string"""
        result = get_stringified_json_to_dict("42")
        assert result == 42

    def test_get_stringified_json_to_dict_non_string(self):
        """Test with non-string value"""
        result = get_stringified_json_to_dict(42)
        assert result == 42

    def test_is_valid_value_list_valid(self):
        """Test valid value list"""
        assert is_valid_value_list(["a", 1, 2.5, True]) is True

    def test_is_valid_value_list_invalid(self):
        """Test invalid value list"""
        assert is_valid_value_list([{"nested": "dict"}]) is False

    def test_is_valid_value_list_empty(self):
        """Test empty list"""
        assert is_valid_value_list([]) is True

    def test_parse_key_path_simple(self):
        """Test parsing simple key path"""
        result = parse_key_path("key")
        assert result == ["key"]

    def test_parse_key_path_bracket(self):
        """Test parsing bracket notation"""
        result = parse_key_path("request[0][param]")
        # Returns list with string for index, not int
        assert result == ["request", 0, "param"]

    def test_parse_key_path_nested_brackets(self):
        """Test parsing nested brackets"""
        result = parse_key_path("items[0][1]")
        assert result == ["items", 0, 1]

    def test_assign_nested_dict(self):
        """Test assigning nested dict value"""
        container = {}
        assign_nested(container, ["a", "b", "c"], "value")
        assert container == {"a": {"b": {"c": "value"}}}

    def test_assign_nested_list(self):
        """Test assigning to list"""
        container = {"items": []}
        assign_nested(container, ["items", 0], "value")
        assert container == {"items": ["value"]}

    def test_assign_nested_list_extend(self):
        """Test assigning to list index beyond current size"""
        container = {"items": []}
        assign_nested(container, ["items", 2], "value")
        assert container == {"items": [None, None, "value"]}

    def test_assign_nested_list_to_dict(self):
        """Test assigning list index followed by dict key"""
        container = {"items": []}
        assign_nested(container, ["items", 0, "name"], "value")
        assert container == {"items": [{"name": "value"}]}

    def test_assign_nested_list_to_list(self):
        """Test assigning list index followed by list index"""
        container = {"items": []}
        assign_nested(container, ["items", 0, 0], "value")
        assert container == {"items": [["value"]]}

    def test_parse_url_args(self):
        """Test parsing URL args"""
        flat = {"pagination[page]": "0", "pagination[limit]": "25"}
        result = parse_url_args(flat)
        # parse_url_args doesn't convert strings to ints for non-JSON values
        assert result == {"pagination": {"page": "0", "limit": "25"}}

    def test_parse_url_args_with_json(self):
        """Test parsing URL args with JSON values"""
        flat = {"filters": '{"status": "active"}'}
        result = parse_url_args(flat)
        assert result == {"filters": {"status": "active"}}

    def test_clean_parse_url_args_single_value(self):
        """Test clean_parse_url_args with single values"""
        params = {"page": ["1"], "limit": ["25"]}
        result = clean_parse_url_args(params)
        assert result == {"page": 1, "limit": 25}

    def test_clean_parse_url_args_multiple_values(self):
        """Test clean_parse_url_args with multiple values"""
        params = {"ids": ["1", "2", "3"]}
        result = clean_parse_url_args(params)
        assert result == {"ids": ["1", "2", "3"]}

    def test_clean_parse_url_args_json_list(self):
        """Test clean_parse_url_args with JSON list values - valid values treated as strings"""
        params = {"filters": ['a', 'b', 'c']}
        result = clean_parse_url_args(params)
        # Valid value list returns as-is
        assert result == {"filters": ['a', 'b', 'c']}

    def test_clean_parse_url_args_non_list(self):
        """Test clean_parse_url_args with non-list value"""
        params = {"page": "1"}
        result = clean_parse_url_args(params)
        assert result == {"page": 1}


class TestConfigurationLoader:
    """Tests for ConfigurationLoader"""

    def test_init_default_path(self):
        """Test initialization with default path"""
        clean_env = {k: v for k, v in os.environ.items() if not k.startswith(ENV_PREFIX)}
        with patch.object(Path, 'exists', return_value=False):
            with patch.dict(os.environ, clean_env, clear=True):
                loader = ConfigurationLoader()
                assert loader.configuration == {}

    def test_convert_value_json(self):
        """Test converting JSON value"""
        loader = ConfigurationLoader()
        result = loader._convert_value('{"key": "value"}')
        assert result == {"key": "value"}

    def test_convert_value_int(self):
        """Test converting int value"""
        loader = ConfigurationLoader()
        result = loader._convert_value("42")
        assert result == 42

    def test_convert_value_float(self):
        """Test converting float value"""
        loader = ConfigurationLoader()
        result = loader._convert_value("3.14")
        assert result == 3.14

    def test_convert_value_bool(self):
        """Test converting bool value"""
        loader = ConfigurationLoader()
        assert loader._convert_value("true") is True
        assert loader._convert_value("false") is False

    def test_convert_value_string(self):
        """Test passthrough string value"""
        loader = ConfigurationLoader()
        result = loader._convert_value("hello")
        assert result == "hello"

    def test_set_nested_value(self):
        """Test setting nested value"""
        loader = ConfigurationLoader()
        loader.configuration = {}
        loader._set_nested_value("a.b.c", "value")
        assert loader.configuration == {"a": {"b": {"c": "value"}}}

    def test_set_nested_value_overwrite(self):
        """Test setting nested value with overwrite"""
        loader = ConfigurationLoader()
        loader.configuration = {"a": "string"}  # Not a dict
        loader._set_nested_value("a.b.c", "value")
        assert loader.configuration == {"a": {"b": {"c": "value"}}}

    def test_get_config_by_path(self):
        """Test getting config by path"""
        loader = ConfigurationLoader()
        loader.configuration = {"specs": {"db": {"host": "localhost"}}}
        result = loader.get_config_by_path("specs.db.host")
        assert result == "localhost"

    def test_get_config_by_path_default(self):
        """Test getting config with default"""
        loader = ConfigurationLoader()
        loader.configuration = {}
        result = loader.get_config_by_path("missing.path", default="default")
        assert result == "default"

    def test_get_db_config_db_info(self):
        """Test getting DB config with db_info"""
        loader = ConfigurationLoader()
        loader.configuration = {
            "databases": {
                "auth": {
                    "db_info": {"host": "localhost"}
                }
            }
        }
        result = loader.get_DB_config("auth")
        assert result == {"host": "localhost"}

    def test_get_db_config_dot_info(self):
        """Test getting DB config with db.info"""
        loader = ConfigurationLoader()
        loader.configuration = {
            "databases": {
                "auth": {
                    "db.info": {"host": "localhost"}
                }
            }
        }
        result = loader.get_DB_config("auth")
        assert result == {"host": "localhost"}

    def test_get_db_config_flat(self):
        """Test getting flat DB config"""
        loader = ConfigurationLoader()
        loader.configuration = {
            "databases": {
                "auth": {"host": "localhost"}
            }
        }
        result = loader.get_DB_config("auth")
        assert result == {"host": "localhost"}

    def test_get_db_config_not_found(self):
        """Test getting non-existent DB config"""
        loader = ConfigurationLoader()
        loader.configuration = {}
        result = loader.get_DB_config("missing")
        assert result is None

    def test_get_config_by_token(self):
        """Test getting config by token"""
        loader = ConfigurationLoader()
        loader.configuration = {
            "databases": {
                "auth": {"host": "localhost"}
            }
        }
        result = loader.get_config_by_token("auth")
        assert result == {"host": "localhost"}

    def test_load_from_file(self):
        """Test loading config from file"""
        mock_config = {"test": "value"}
        with patch.object(Path, 'exists', return_value=True):
            with patch('builtins.open', MagicMock()):
                with patch('json.load', return_value=mock_config):
                    loader = ConfigurationLoader()
                    # Config should be loaded from file
                    assert loader.configuration == mock_config

    def test_load_from_environment(self):
        """Test loading config from environment"""
        with patch.object(Path, 'exists', return_value=False):
            with patch.dict(os.environ, {f"{ENVIRONEMNT_VARIABLE_PREFIX}_TEST_KEY": "env_value"}, clear=False):
                loader = ConfigurationLoader()
                # _apply_env_vars is called in __init__ and converts {prefix}_TEST_KEY to test.key
                assert loader.configuration.get("test", {}).get("key") == "env_value"

    def test_convert_value_bool_uppercase(self):
        """Test converting bool value with mixed case"""
        loader = ConfigurationLoader()
        assert loader._convert_value("TRUE") is True
        assert loader._convert_value("FALSE") is False

    def test_convert_value_bool_with_other_cases(self):
        """Test value that is NOT a bool - just lowercase string"""
        loader = ConfigurationLoader()
        # Value that doesn't match 'true' or 'false'
        result = loader._convert_value("yes")
        assert result == "yes"


class TestConfigValueSimulator:
    """Tests for ConfigValueSimulator"""

    def test_set_os_environment_simple(self):
        """Test setting simple environment variables"""
        from easylifeauth.utils.config import ConfigValueSimulator

        # Clear any existing test env vars
        test_vars = [f"{ENVIRONEMNT_VARIABLE_PREFIX}_SIMPLE_KEY", f"{ENVIRONEMNT_VARIABLE_PREFIX}_NESTED_LEVEL1_LEVEL2"]
        for var in test_vars:
            os.environ.pop(var, None)

        ConfigValueSimulator.set_os_environment(
            {"simple_key": "value1"},
            prefix=ENVIRONEMNT_VARIABLE_PREFIX
        )

        assert f"{ENVIRONEMNT_VARIABLE_PREFIX}_SIMPLE_KEY" in os.environ
        assert os.environ[f"{ENVIRONEMNT_VARIABLE_PREFIX}_SIMPLE_KEY"] == "value1"

        # Clean up
        os.environ.pop(f"{ENVIRONEMNT_VARIABLE_PREFIX}_SIMPLE_KEY", None)

    def test_set_os_environment_nested(self):
        """Test setting nested environment variables"""
        from easylifeauth.utils.config import ConfigValueSimulator

        # Clear any existing test env vars
        os.environ.pop(f"{ENVIRONEMNT_VARIABLE_PREFIX}_NESTED_LEVEL1_LEVEL2", None)

        ConfigValueSimulator.set_os_environment(
            {"nested": {"level1": {"level2": "deep_value"}}},
            prefix=ENVIRONEMNT_VARIABLE_PREFIX
        )

        assert f"{ENVIRONEMNT_VARIABLE_PREFIX}_NESTED_LEVEL1_LEVEL2" in os.environ
        assert os.environ[f"{ENVIRONEMNT_VARIABLE_PREFIX}_NESTED_LEVEL1_LEVEL2"] == "deep_value"

        # Clean up
        os.environ.pop(f"{ENVIRONEMNT_VARIABLE_PREFIX}_NESTED_LEVEL1_LEVEL2", None)

    def test_set_os_environment_with_list(self):
        """Test setting environment variable with list value"""
        from easylifeauth.utils.config import ConfigValueSimulator

        os.environ.pop(f"{ENVIRONEMNT_VARIABLE_PREFIX}_ITEMS", None)

        ConfigValueSimulator.set_os_environment(
            {"items": [1, 2, 3]},
            prefix=ENVIRONEMNT_VARIABLE_PREFIX
        )

        assert f"{ENVIRONEMNT_VARIABLE_PREFIX}_ITEMS" in os.environ
        assert os.environ[f"{ENVIRONEMNT_VARIABLE_PREFIX}_ITEMS"] == "[1, 2, 3]"

        # Clean up
        os.environ.pop(f"{ENVIRONEMNT_VARIABLE_PREFIX}_ITEMS", None)

    def test_set_os_environment_with_dict_value(self):
        """Test setting environment variable with dict value"""
        from easylifeauth.utils.config import ConfigValueSimulator

        os.environ.pop(f"{ENVIRONEMNT_VARIABLE_PREFIX}_CONFIG", None)

        ConfigValueSimulator.set_os_environment(
            {"config": {"key": "value"}},
            prefix=ENVIRONEMNT_VARIABLE_PREFIX
        )

        # Dict values should be JSON stringified
        assert f"{ENVIRONEMNT_VARIABLE_PREFIX}_CONFIG_KEY" in os.environ
        assert os.environ[f"{ENVIRONEMNT_VARIABLE_PREFIX}_CONFIG_KEY"] == "value"

        # Clean up
        os.environ.pop(f"{ENVIRONEMNT_VARIABLE_PREFIX}_CONFIG_KEY", None)

    def test_set_os_environment_custom_prefix(self):
        """Test setting environment variables with custom prefix"""
        from easylifeauth.utils.config import ConfigValueSimulator

        os.environ.pop("CUSTOM_TEST_KEY", None)

        ConfigValueSimulator.set_os_environment(
            {"test_key": "custom_value"},
            prefix="CUSTOM"
        )

        assert "CUSTOM_TEST_KEY" in os.environ
        assert os.environ["CUSTOM_TEST_KEY"] == "custom_value"

        # Clean up
        os.environ.pop("CUSTOM_TEST_KEY", None)
