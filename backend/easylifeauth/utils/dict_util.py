"""Dictionary Utility"""
from functools import reduce
from typing import Any, Dict, Optional


class DictUtil:
    """Dictionary utility class for deep nested operations"""
    
    def deep_get(self, dictionary: Dict, keys: str, default: Any = None) -> Any:
        """Get value from nested dictionary using dot notation"""
        return reduce(
            lambda d, key: d.get(key, default) if isinstance(d, dict) else default,
            keys.split("."),
            dictionary
        )
    
    def get_deep_nested_value(
        self,
        dictionary: Dict,
        key_path: str,
        default: Any = None
    ) -> Any:
        """Get deeply nested value with list support"""
        keys = key_path.split(".")
        try:
            return reduce(
                lambda d, key: (
                    [item.get(key) for sublist in d for item in (sublist if isinstance(sublist, list) else [sublist]) if isinstance(item, dict)]
                    if isinstance(d, list) else d.get(key)
                    if isinstance(d, dict) else default
                ),
                keys,
                dictionary
            )
        except AttributeError:
            return None

    def merge_dicts(self, config_dict: Dict, setting_dict: Dict) -> None:
        """Merge two dictionaries recursively"""
        for key, value in setting_dict.items():
            if key not in config_dict:
                config_dict[key] = value
            else:
                if isinstance(value, dict) and isinstance(config_dict[key], dict):
                    self.merge_dicts(config_dict[key], value)
                elif isinstance(value, list) and isinstance(config_dict[key], list):
                    config_dict[key].extend(x for x in value if x not in config_dict[key])
                else:
                    config_dict[key] = value


class DictUtilError(Exception):
    """Dictionary utility error"""
    pass
