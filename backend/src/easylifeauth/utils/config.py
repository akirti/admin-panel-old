"""Configuration Loader"""
import os
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from copy import deepcopy

from .dict_util import DictUtil


class ConfigurationLoader:
    """Configuration loader from JSON files and environment variables"""
    
    def __init__(
        self,
        config_path: Optional[str] = None,
        config_file: str = "config.json",
        env_prefix: str = "EASYLIFE"
    ):
        self.config_path = config_path or os.getcwd()
        self.env_prefix = env_prefix
        self.configuration: Dict[str, Any] = {}
        self._dict_util = DictUtil()
        
        # Load configuration
        self._load_config(config_file)
        self._apply_env_vars()
    
    def _load_config(self, config_file: str) -> None:
        """Load configuration from JSON file"""
        file_path = Path(self.config_path) / config_file
        if file_path.exists():
            with open(file_path, 'r') as f:
                self.configuration = json.load(f)
    
    def _apply_env_vars(self) -> None:
        """Apply environment variables to configuration"""
        prefix = f"{self.env_prefix}_"
        
        for key, value in os.environ.items():
            if key.startswith(prefix):
                # Convert EASYLIFE_SPECS_DB_HOST to specs.db.host
                # Use underscore as separator (Docker style)
                config_key = key[len(prefix):].lower().replace("_", ".")
                self._set_nested_value(config_key, self._convert_value(value))
    
    def _set_nested_value(self, key_path: str, value: Any) -> None:
        """Set a nested value in configuration"""
        keys = key_path.split(".")
        d = self.configuration
        for key in keys[:-1]:
            if key not in d:
                d[key] = {}
            elif not isinstance(d[key], dict):
                d[key] = {}
            d = d[key]
        d[keys[-1]] = value
    
    def _convert_value(self, value: str) -> Any:
        """Convert string value to appropriate type"""
        # Try JSON
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            pass
        
        # Try int
        try:
            return int(value)
        except ValueError:
            pass
        
        # Try float
        try:
            return float(value)
        except ValueError:
            pass
        
        # Try bool
        if value.lower() in ['true', 'false']:
            return value.lower() == 'true'
        
        return value
    
    def get_config_by_path(
        self,
        key_path: str,
        default: Any = None
    ) -> Any:
        """Get configuration value by dot-notation path"""
        result = self._dict_util.get_deep_nested_value(
            self.configuration,
            key_path,
            default
        )
        return result if result is not None else default
    
    def get_DB_config(self, token: str) -> Optional[Dict[str, Any]]:
        """Get database configuration by token"""
        config = self.get_config_by_path(f"databases.{token}")
        if config and 'db.info' in config:
            # Handle both db_info and db.info formats
            return deepcopy(config['db.info'])
        if config and 'db_info' in config:
            return deepcopy(config['db_info'])
        # Check for flat structure from env vars
        if config:
            return deepcopy(config)
        return None
    
    def get_config_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Get configuration by token"""
        return self.get_config_by_path(f"databases.{token}")


class ConfigValueSimulator:
    """Simulate configuration from environment variables for testing"""
    
    @staticmethod
    def set_os_environment(
        values: Dict[str, Any],
        prefix: str = "EASYLIFE"
    ) -> None:
        """Set environment variables from dictionary"""
        def flatten(d: Dict, parent_key: str = '') -> Dict[str, str]:
            items = []
            for k, v in d.items():
                new_key = f"{parent_key}_{k}" if parent_key else k
                if isinstance(v, dict):
                    items.extend(flatten(v, new_key).items())
                else:
                    items.append((new_key, str(v) if not isinstance(v, (dict, list)) else json.dumps(v)))
            return dict(items)
        
        flat_values = flatten(values)
        for key, value in flat_values.items():
            env_key = f"{prefix}_{key}".upper()
            os.environ[env_key] = value
