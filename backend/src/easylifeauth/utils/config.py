"""Configuration Loader"""
import os
import json
import re
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
        env_prefix: str = "EASYLIFE",
        environment: Optional[str] = None
    ):
        self.config_path = config_path or os.getcwd()
        self.env_prefix = env_prefix
        self.configuration: Dict[str, Any] = {}
        self._dict_util = DictUtil()

        if environment:
            self.load_environment(self.config_path, environment)
        else:
            # Legacy mode: load single config file + env vars
            self._load_config(config_file)
            self._apply_env_vars()

    @staticmethod
    def _load_json_file(file_path: str) -> Dict[str, Any]:
        """Load JSON file, return empty dict if missing or invalid"""
        p = Path(file_path)
        if not p.exists():
            return {}
        with open(p, 'r') as f:
            return json.load(f)

    @staticmethod
    def _flatten_to_dot_paths(d: Any, parent: str = "") -> Dict[str, Any]:
        """Flatten nested dict to {\"a.b.c\": value} dot-path lookup"""
        items: Dict[str, Any] = {}
        if not isinstance(d, dict):
            return items
        for key, value in d.items():
            new_key = f"{parent}.{key}" if parent else key
            if isinstance(value, dict):
                items.update(ConfigurationLoader._flatten_to_dot_paths(value, new_key))
            else:
                items[new_key] = value
        return items

    @staticmethod
    def _resolve_placeholders(config: Any, values_lookup: Dict[str, Any]) -> Any:
        """Recursively resolve {dot.path} placeholders in config.

        - If a string is exactly \"{dot.path}\", replace with typed value.
        - If a string contains {dot.path} embedded, do string substitution.
        - If no match found, keep original string (unresolved).
        """
        if isinstance(config, dict):
            return {
                k: ConfigurationLoader._resolve_placeholders(v, values_lookup)
                for k, v in config.items()
            }
        elif isinstance(config, list):
            return [
                ConfigurationLoader._resolve_placeholders(item, values_lookup)
                for item in config
            ]
        elif isinstance(config, str):
            # Exact match: entire string is a single placeholder
            exact_match = re.fullmatch(r'\{([^{}]+)\}', config)
            if exact_match:
                dot_path = exact_match.group(1)
                if dot_path in values_lookup:
                    return deepcopy(values_lookup[dot_path])
                return config

            # Embedded placeholders: string contains one or more {dot.path}
            def replace_match(m):
                dot_path = m.group(1)
                if dot_path in values_lookup:
                    val = values_lookup[dot_path]
                    if isinstance(val, (dict, list)):
                        return json.dumps(val)
                    return str(val)
                return m.group(0)

            resolved = re.sub(r'\{([^{}]+)\}', replace_match, config)
            return resolved
        else:
            return config

    def load_environment(self, config_path: str, environment: str) -> None:
        """Main config pipeline:
        simulator → env vars → localenv resolution → env resolution → config.json resolution
        """
        base = Path(config_path)

        # a) Load simulator → set env vars, get flat lookup
        simulator_path = base / "server.env.simulator.json"
        simulator_data = ConfigValueSimulator.load_simulator_file(
            str(simulator_path), self.env_prefix
        )

        # b) Build values_lookup from simulator
        values_lookup = dict(simulator_data)

        # c) Load localenv-{environment}.json → resolve with simulator values
        localenv_path = base / f"localenv-{environment}.json"
        localenv_raw = self._load_json_file(str(localenv_path))
        localenv_config = self._resolve_placeholders(localenv_raw, values_lookup)

        # d) Flatten localenv → merge into values_lookup (localenv wins)
        localenv_flat = self._flatten_to_dot_paths(localenv_config)
        values_lookup.update(localenv_flat)

        # e) Load {environment}.json → resolve with updated lookup
        env_path = base / f"{environment}.json"
        env_raw = self._load_json_file(str(env_path))
        env_config = self._resolve_placeholders(env_raw, values_lookup)

        # f) Flatten env_config → merge into values_lookup (env wins)
        env_flat = self._flatten_to_dot_paths(env_config)
        values_lookup.update(env_flat)

        # g) Load config.json → resolve with final lookup
        config_json_path = base / "config.json"
        config_raw = self._load_json_file(str(config_json_path))
        resolved_config = self._resolve_placeholders(config_raw, values_lookup)

        # h) Merge extra properties from env_config into resolved_config
        self._dict_util.merge_dicts(resolved_config, env_config)

        # i) Set final configuration
        self.configuration = resolved_config

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
    def load_simulator_file(
        file_path: str,
        prefix: str = "EASYLIFE"
    ) -> Dict[str, Any]:
        """Load simulator JSON file and set env vars.
        File format: flat dict {\"dot.path.key\": value, ...}
        Each entry becomes env var PREFIX_DOT_PATH_KEY=value
        Returns raw flat dict for use as values lookup.
        """
        p = Path(file_path)
        if not p.exists():
            return {}
        with open(p, 'r') as f:
            simulator_data = json.load(f)

        for dot_path, value in simulator_data.items():
            env_key = f"{prefix}_{dot_path.replace('.', '_')}".upper()
            if isinstance(value, (dict, list)):
                os.environ[env_key] = json.dumps(value)
            elif isinstance(value, bool):
                os.environ[env_key] = str(value).lower()
            else:
                os.environ[env_key] = str(value)

        return simulator_data

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
