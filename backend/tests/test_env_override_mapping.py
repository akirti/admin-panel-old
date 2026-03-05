"""Tests for _collect_env_overrides reverse map — dot-to-underscore normalisation.

Verifies that env vars set by PCF/Docker (using underscores) are correctly
mapped back to dot-path config keys like databases.authentication.db_info.host.
"""
import json
import os
from unittest.mock import patch

import pytest

from easylifeauth import ENVIRONEMNT_VARIABLE_PREFIX, OS_PROPERTY_SEPRATOR
from easylifeauth.utils.config import ConfigurationLoader

ENV_PREFIX = ENVIRONEMNT_VARIABLE_PREFIX
SEP = OS_PROPERTY_SEPRATOR

# Dot-path keys as they appear in config.json placeholders
DOT_PATH_SCHEME = f"databases{SEP}authentication{SEP}db_info{SEP}connection_scheme"
DOT_PATH_USERNAME = f"databases{SEP}authentication{SEP}db_info{SEP}username"
DOT_PATH_PASSWORD = f"databases{SEP}authentication{SEP}db_info{SEP}password"
DOT_PATH_HOST = f"databases{SEP}authentication{SEP}db_info{SEP}host"
DOT_PATH_DATABASE = f"databases{SEP}authentication{SEP}db_info{SEP}database"
DOT_PATH_MAX_POOL = f"globals{SEP}databases{SEP}default{SEP}max_pool_size"

# Corresponding env var names (uppercase, underscores)
ENV_SCHEME = f"{ENV_PREFIX}_DATABASES_AUTHENTICATION_DB_INFO_CONNECTION_SCHEME"
ENV_USERNAME = f"{ENV_PREFIX}_DATABASES_AUTHENTICATION_DB_INFO_USERNAME"
ENV_PASSWORD = f"{ENV_PREFIX}_DATABASES_AUTHENTICATION_DB_INFO_PASSWORD"
ENV_HOST = f"{ENV_PREFIX}_DATABASES_AUTHENTICATION_DB_INFO_HOST"
ENV_DATABASE = f"{ENV_PREFIX}_DATABASES_AUTHENTICATION_DB_INFO_DATABASE"
ENV_MAX_POOL = f"{ENV_PREFIX}_GLOBALS_DATABASES_DEFAULT_MAX_POOL_SIZE"

FILE_CONFIG_JSON = "config.json"


def _make_loader_with_env(env_vars, known_paths=None):
    """Create ConfigurationLoader._collect_env_overrides with given env vars."""
    clean_env = {
        k: v for k, v in os.environ.items()
        if not k.startswith(f"{ENV_PREFIX}_")
    }
    clean_env.update(env_vars)

    with patch.object(ConfigurationLoader, "_load_config"):
        with patch.object(ConfigurationLoader, "_apply_env_vars"):
            loader = ConfigurationLoader()

    known = known_paths or {
        DOT_PATH_SCHEME,
        DOT_PATH_USERNAME,
        DOT_PATH_PASSWORD,
        DOT_PATH_HOST,
        DOT_PATH_DATABASE,
        DOT_PATH_MAX_POOL,
    }

    with patch.dict(os.environ, clean_env, clear=True):
        return loader._collect_env_overrides(known, ENV_PREFIX)


class TestEnvOverrideMapping:
    """Env vars with underscores map to dot-path config keys."""

    def test_underscore_env_maps_to_dot_path(self):
        overrides = _make_loader_with_env({ENV_HOST: "myhost.example.com"})
        assert overrides[DOT_PATH_HOST] == "myhost.example.com"

    def test_all_db_fields_resolve(self):
        overrides = _make_loader_with_env({
            ENV_SCHEME: "mongodb+srv",
            ENV_USERNAME: "dbadmin",
            ENV_PASSWORD: "s3cret",
            ENV_HOST: "cluster.mongodb.net",
            ENV_DATABASE: "easylife_prod",
        })
        assert overrides[DOT_PATH_SCHEME] == "mongodb+srv"
        assert overrides[DOT_PATH_USERNAME] == "dbadmin"
        assert overrides[DOT_PATH_PASSWORD] == "s3cret"
        assert overrides[DOT_PATH_HOST] == "cluster.mongodb.net"
        assert overrides[DOT_PATH_DATABASE] == "easylife_prod"

    def test_integer_value_converted(self):
        overrides = _make_loader_with_env({ENV_MAX_POOL: "200"})
        assert overrides[DOT_PATH_MAX_POOL] == 200

    def test_json_value_converted(self):
        overrides = _make_loader_with_env({
            ENV_HOST: '["host1.example.com", "host2.example.com"]',
        })
        assert overrides[DOT_PATH_HOST] == ["host1.example.com", "host2.example.com"]

    def test_environment_key_skipped(self):
        overrides = _make_loader_with_env({
            f"{ENV_PREFIX}_ENVIRONMENT": "production",
            ENV_HOST: "myhost",
        })
        assert DOT_PATH_HOST in overrides
        # ENVIRONMENT is a meta key, not a config value
        assert "environment" not in overrides

    def test_unknown_env_var_falls_back_to_lowercase(self):
        overrides = _make_loader_with_env(
            {f"{ENV_PREFIX}_CUSTOM_SETTING": "val"},
            known_paths={DOT_PATH_HOST},
        )
        assert overrides.get("custom_setting") == "val"

    def test_empty_known_paths_uses_fallback(self):
        overrides = _make_loader_with_env(
            {ENV_HOST: "myhost"},
            known_paths=set(),
        )
        # Falls back to lowercased underscore key since no known paths match
        fallback_key = ENV_HOST[len(f"{ENV_PREFIX}_"):].lower()
        # Value exists under fallback key (underscored, not dotted)
        assert fallback_key in overrides or any(
            v == "myhost" for v in overrides.values()
        )


class TestEndToEndEnvResolution:
    """Full config pipeline resolves PCF-style env vars into config.json."""

    def test_db_config_resolved_from_underscore_env_vars(self, tmp_path):
        config = {
            "databases": {
                "authentication": {
                    "type": "db",
                    "db_info": {
                        "connection_scheme": f"{{{DOT_PATH_SCHEME}}}",
                        "username": f"{{{DOT_PATH_USERNAME}}}",
                        "password": f"{{{DOT_PATH_PASSWORD}}}",
                        "host": f"{{{DOT_PATH_HOST}}}",
                        "database": f"{{{DOT_PATH_DATABASE}}}",
                    }
                }
            }
        }
        (tmp_path / FILE_CONFIG_JSON).write_text(json.dumps(config))

        clean_env = {
            k: v for k, v in os.environ.items()
            if not k.startswith(f"{ENV_PREFIX}_")
        }
        clean_env.update({
            ENV_SCHEME: "mongodb+srv",
            ENV_USERNAME: "admin",
            ENV_PASSWORD: "secret",
            ENV_HOST: "cluster.mongodb.net",
            ENV_DATABASE: "easylife",
        })

        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path), environment="dev"
            )

        db_info = loader.configuration["databases"]["authentication"]["db_info"]
        assert db_info["connection_scheme"] == "mongodb+srv"
        assert db_info["username"] == "admin"
        assert db_info["password"] == "secret"
        assert db_info["host"] == "cluster.mongodb.net"
        assert db_info["database"] == "easylife"

    def test_pool_settings_resolved_from_underscore_env_vars(self, tmp_path):
        config = {
            "globals": {
                "databases": {
                    "default": {
                        "max_pool_size": f"{{{DOT_PATH_MAX_POOL}}}",
                    }
                }
            }
        }
        (tmp_path / FILE_CONFIG_JSON).write_text(json.dumps(config))

        clean_env = {
            k: v for k, v in os.environ.items()
            if not k.startswith(f"{ENV_PREFIX}_")
        }
        clean_env[ENV_MAX_POOL] = "150"

        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path), environment="dev"
            )

        pool = loader.configuration["globals"]["databases"]["default"]
        assert pool["max_pool_size"] == 150
