"""Tests for Utility modules"""
import pytest
import os
import json
from unittest.mock import patch, MagicMock
from pathlib import Path

from easylifeauth.utils.dict_util import DictUtil
from easylifeauth.utils.config import ConfigurationLoader
from easylifeauth.utils.args_util import (
    convert_str, is_stringified_json, get_stringified_json_to_dict,
    is_valid_value_list, parse_key_path, assign_nested, parse_url_args
)


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

    def test_get_stringified_json_to_dict_json(self):
        """Test converting stringified JSON"""
        result = get_stringified_json_to_dict('{"key": "value"}')
        assert result == {"key": "value"}

    def test_get_stringified_json_to_dict_non_json(self):
        """Test converting non-JSON string"""
        result = get_stringified_json_to_dict("42")
        assert result == 42

    def test_is_valid_value_list_valid(self):
        """Test valid value list"""
        assert is_valid_value_list(["a", 1, 2.5, True]) is True

    def test_is_valid_value_list_invalid(self):
        """Test invalid value list"""
        assert is_valid_value_list([{"nested": "dict"}]) is False

    def test_parse_key_path_simple(self):
        """Test parsing simple key path"""
        result = parse_key_path("key")
        assert result == ["key"]

    def test_parse_key_path_bracket(self):
        """Test parsing bracket notation"""
        result = parse_key_path("request[0][param]")
        assert result == ["request", "0", "param"]

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

    def test_parse_url_args(self):
        """Test parsing URL args"""
        flat = {"pagination[page]": "0", "pagination[limit]": "25"}
        result = parse_url_args(flat)
        assert result == {"pagination": {"page": 0, "limit": 25}}


class TestConfigurationLoader:
    """Tests for ConfigurationLoader"""

    def test_init_default_path(self):
        """Test initialization with default path"""
        with patch.object(Path, 'exists', return_value=False):
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
