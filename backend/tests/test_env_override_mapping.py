"""Tests for _collect_env_overrides reverse map.

Verifies that env vars set by PCF/Docker using dots as path separators
(EASYLIFE_DATABASES.AUTHENTICATION.DB_INFO.HOST or
EASYLIFE.DATABASES.AUTHENTICATION.DB_INFO.HOST) are correctly mapped back
to dot-path config keys like databases.authentication.db_info.host.
Underscores within property names (db_info, connection_scheme) are preserved.
"""
import json
import os
from unittest.mock import patch

import pytest

from easylifeauth import ENVIRONEMNT_VARIABLE_PREFIX, OS_PROPERTY_SEPRATOR
from easylifeauth.utils.config import ConfigurationLoader
from mock_data import (
    MOCK_DB_HOST, MOCK_DB_HOST_CLUSTER, MOCK_DB_HOST_EXAMPLE,
    MOCK_DB_USERNAME, MOCK_DB_USERNAME_ALT,
    MOCK_DB_PASSWORD_SECRET, MOCK_DB_PASSWORD_ALT,
    MOCK_DB_DATABASE_EASYLIFE, MOCK_DB_DATABASE_PROD, MOCK_DB_SCHEME_SRV,
    MOCK_URL_HOST_1, MOCK_URL_HOST_2,
)

ENV_PREFIX = ENVIRONEMNT_VARIABLE_PREFIX
SEP = OS_PROPERTY_SEPRATOR

# Dot-path keys as they appear in config.json placeholders
DOT_PATH_SCHEME = f"databases{SEP}authentication{SEP}db_info{SEP}connection_scheme"
DOT_PATH_USERNAME = f"databases{SEP}authentication{SEP}db_info{SEP}username"
DOT_PATH_PASSWORD = f"databases{SEP}authentication{SEP}db_info{SEP}password"
DOT_PATH_HOST = f"databases{SEP}authentication{SEP}db_info{SEP}host"
DOT_PATH_DATABASE = f"databases{SEP}authentication{SEP}db_info{SEP}database"
DOT_PATH_MAX_POOL = f"globals{SEP}databases{SEP}default{SEP}max_pool_size"
DOT_PATH_CREDS_JSON = f"environment{SEP}storage{SEP}gcs{SEP}credentials_json"

# Env var names — underscore prefix format (EASYLIFE_DATABASES.AUTH...)
ENV_SCHEME = f"{ENV_PREFIX}_DATABASES{SEP}AUTHENTICATION{SEP}DB_INFO{SEP}CONNECTION_SCHEME"
ENV_USERNAME = f"{ENV_PREFIX}_DATABASES{SEP}AUTHENTICATION{SEP}DB_INFO{SEP}USERNAME"
ENV_PASSWORD = f"{ENV_PREFIX}_DATABASES{SEP}AUTHENTICATION{SEP}DB_INFO{SEP}PASSWORD"
ENV_HOST = f"{ENV_PREFIX}_DATABASES{SEP}AUTHENTICATION{SEP}DB_INFO{SEP}HOST"
ENV_DATABASE = f"{ENV_PREFIX}_DATABASES{SEP}AUTHENTICATION{SEP}DB_INFO{SEP}DATABASE"
ENV_MAX_POOL = f"{ENV_PREFIX}_GLOBALS{SEP}DATABASES{SEP}DEFAULT{SEP}MAX_POOL_SIZE"

# Env var names — dot prefix format (EASYLIFE.DATABASES.AUTH...)
DOT_ENV_HOST = f"{ENV_PREFIX}{SEP}DATABASES{SEP}AUTHENTICATION{SEP}DB_INFO{SEP}HOST"
DOT_ENV_USERNAME = f"{ENV_PREFIX}{SEP}DATABASES{SEP}AUTHENTICATION{SEP}DB_INFO{SEP}USERNAME"
DOT_ENV_PASSWORD = f"{ENV_PREFIX}{SEP}DATABASES{SEP}AUTHENTICATION{SEP}DB_INFO{SEP}PASSWORD"
DOT_ENV_CREDS = f"{ENV_PREFIX}{SEP}ENVIRONMENT{SEP}STORAGE{SEP}GCS{SEP}CREDENTIALS_JSON"
DOT_ENV_MAX_POOL = f"{ENV_PREFIX}{SEP}GLOBALS{SEP}DATABASES{SEP}DEFAULT{SEP}MAX_POOL_SIZE"

FILE_CONFIG_JSON = "config.json"


def _make_loader_with_env(env_vars, known_paths=None):
    """Create ConfigurationLoader._collect_env_overrides with given env vars."""
    dot_prefix = f"{ENV_PREFIX}{SEP}"
    clean_env = {
        k: v for k, v in os.environ.items()
        if not k.startswith(f"{ENV_PREFIX}_") and not k.startswith(dot_prefix)
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
        DOT_PATH_CREDS_JSON,
    }

    with patch.dict(os.environ, clean_env, clear=True):
        return loader._collect_env_overrides(known, ENV_PREFIX)


class TestEnvOverrideMapping:
    """Env vars with dot separators map to dot-path config keys."""

    def test_env_maps_to_dot_path(self):
        overrides = _make_loader_with_env({ENV_HOST: MOCK_DB_HOST_EXAMPLE})
        assert overrides[DOT_PATH_HOST] == MOCK_DB_HOST_EXAMPLE

    def test_all_db_fields_resolve(self):
        overrides = _make_loader_with_env({
            ENV_SCHEME: MOCK_DB_SCHEME_SRV,
            ENV_USERNAME: MOCK_DB_USERNAME_ALT,
            ENV_PASSWORD: MOCK_DB_PASSWORD_ALT,
            ENV_HOST: MOCK_DB_HOST_CLUSTER,
            ENV_DATABASE: MOCK_DB_DATABASE_PROD,
        })
        assert overrides[DOT_PATH_SCHEME] == MOCK_DB_SCHEME_SRV
        assert overrides[DOT_PATH_USERNAME] == MOCK_DB_USERNAME_ALT
        assert overrides[DOT_PATH_PASSWORD] == MOCK_DB_PASSWORD_ALT
        assert overrides[DOT_PATH_HOST] == MOCK_DB_HOST_CLUSTER
        assert overrides[DOT_PATH_DATABASE] == MOCK_DB_DATABASE_PROD

    def test_integer_value_converted(self):
        overrides = _make_loader_with_env({ENV_MAX_POOL: "200"})
        assert overrides[DOT_PATH_MAX_POOL] == 200

    def test_json_value_converted(self):
        host_list_json = json.dumps([MOCK_URL_HOST_1, MOCK_URL_HOST_2])
        overrides = _make_loader_with_env({ENV_HOST: host_list_json})
        assert overrides[DOT_PATH_HOST] == [MOCK_URL_HOST_1, MOCK_URL_HOST_2]

    def test_environment_key_skipped(self):
        overrides = _make_loader_with_env({
            f"{ENV_PREFIX}_ENVIRONMENT": MOCK_DB_DATABASE_PROD,
            ENV_HOST: MOCK_DB_HOST,
        })
        assert DOT_PATH_HOST in overrides
        # ENVIRONMENT is a meta key, not a config value
        assert "environment" not in overrides

    def test_environment_key_skipped_dot_format(self):
        overrides = _make_loader_with_env({
            f"{ENV_PREFIX}{SEP}ENVIRONMENT": MOCK_DB_DATABASE_PROD,
            DOT_ENV_HOST: MOCK_DB_HOST,
        })
        assert DOT_PATH_HOST in overrides
        assert "environment" not in overrides

    def test_unknown_env_var_falls_back_to_lowercase(self):
        overrides = _make_loader_with_env(
            {f"{ENV_PREFIX}_CUSTOM_SETTING": MOCK_DB_HOST},
            known_paths={DOT_PATH_HOST},
        )
        assert overrides.get("custom_setting") == MOCK_DB_HOST

    def test_empty_known_paths_uses_fallback(self):
        overrides = _make_loader_with_env(
            {ENV_HOST: MOCK_DB_HOST},
            known_paths=set(),
        )
        # Falls back to lowercased underscore key since no known paths match
        fallback_key = ENV_HOST[len(f"{ENV_PREFIX}_"):].lower()
        # Value exists under fallback key (underscored, not dotted)
        assert fallback_key in overrides or any(
            v == MOCK_DB_HOST for v in overrides.values()
        )


class TestDotPrefixEnvVars:
    """Env vars with dot separators (EASYLIFE.DB.HOST) map to dot-path config keys."""

    def test_dot_env_maps_to_dot_path(self):
        overrides = _make_loader_with_env({DOT_ENV_HOST: MOCK_DB_HOST_EXAMPLE})
        assert overrides[DOT_PATH_HOST] == MOCK_DB_HOST_EXAMPLE

    def test_dot_env_all_db_fields_resolve(self):
        dot_scheme = f"{ENV_PREFIX}{SEP}DATABASES{SEP}AUTHENTICATION{SEP}DB_INFO{SEP}CONNECTION_SCHEME"
        dot_database = f"{ENV_PREFIX}{SEP}DATABASES{SEP}AUTHENTICATION{SEP}DB_INFO{SEP}DATABASE"
        overrides = _make_loader_with_env({
            dot_scheme: MOCK_DB_SCHEME_SRV,
            DOT_ENV_USERNAME: MOCK_DB_USERNAME_ALT,
            DOT_ENV_PASSWORD: MOCK_DB_PASSWORD_ALT,
            DOT_ENV_HOST: MOCK_DB_HOST_CLUSTER,
            dot_database: MOCK_DB_DATABASE_PROD,
        })
        assert overrides[DOT_PATH_SCHEME] == MOCK_DB_SCHEME_SRV
        assert overrides[DOT_PATH_USERNAME] == MOCK_DB_USERNAME_ALT
        assert overrides[DOT_PATH_PASSWORD] == MOCK_DB_PASSWORD_ALT
        assert overrides[DOT_PATH_HOST] == MOCK_DB_HOST_CLUSTER
        assert overrides[DOT_PATH_DATABASE] == MOCK_DB_DATABASE_PROD

    def test_dot_env_credentials_json_with_underscore(self):
        """credentials_json has underscore in property name — must resolve via dot env."""
        creds_json = '{"type":"service_account"}'
        overrides = _make_loader_with_env({
            DOT_ENV_CREDS: creds_json,
        })
        assert DOT_PATH_CREDS_JSON in overrides
        assert overrides[DOT_PATH_CREDS_JSON] == {"type": "service_account"}

    def test_dot_env_max_pool_size_with_underscore(self):
        """max_pool_size has underscores in property name — must resolve via dot env."""
        overrides = _make_loader_with_env({DOT_ENV_MAX_POOL: "250"})
        assert overrides[DOT_PATH_MAX_POOL] == 250

    def test_mixed_prefix_formats(self):
        """Both prefix formats (EASYLIFE_ and EASYLIFE.) resolve to correct dot paths."""
        overrides = _make_loader_with_env({
            ENV_HOST: MOCK_DB_HOST_EXAMPLE,           # EASYLIFE_DATABASES.AUTH...
            DOT_ENV_USERNAME: MOCK_DB_USERNAME_ALT,    # EASYLIFE.DATABASES.AUTH...
        })
        assert overrides[DOT_PATH_HOST] == MOCK_DB_HOST_EXAMPLE
        assert overrides[DOT_PATH_USERNAME] == MOCK_DB_USERNAME_ALT


def _clean_env_for_e2e(overrides):
    """Build a clean env dict with only the given overrides (no EASYLIFE_ or EASYLIFE. vars)."""
    dot_prefix = f"{ENV_PREFIX}{SEP}"
    clean = {
        k: v for k, v in os.environ.items()
        if not k.startswith(f"{ENV_PREFIX}_") and not k.startswith(dot_prefix)
    }
    clean.update(overrides)
    return clean


class TestEndToEndEnvResolution:
    """Full config pipeline resolves PCF-style env vars into config.json."""

    def _db_config_template(self):
        return {
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

    def test_db_config_resolved_from_env_vars(self, tmp_path):
        (tmp_path / FILE_CONFIG_JSON).write_text(json.dumps(self._db_config_template()))

        clean_env = _clean_env_for_e2e({
            ENV_SCHEME: MOCK_DB_SCHEME_SRV,
            ENV_USERNAME: MOCK_DB_USERNAME,
            ENV_PASSWORD: MOCK_DB_PASSWORD_SECRET,
            ENV_HOST: MOCK_DB_HOST_CLUSTER,
            ENV_DATABASE: MOCK_DB_DATABASE_EASYLIFE,
        })

        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path), environment="dev"
            )

        db_info = loader.configuration["databases"]["authentication"]["db_info"]
        assert db_info["connection_scheme"] == MOCK_DB_SCHEME_SRV
        assert db_info["username"] == MOCK_DB_USERNAME
        assert db_info["password"] == MOCK_DB_PASSWORD_SECRET
        assert db_info["host"] == MOCK_DB_HOST_CLUSTER
        assert db_info["database"] == MOCK_DB_DATABASE_EASYLIFE

    def test_db_config_resolved_from_dot_env_vars(self, tmp_path):
        """PCF dot-format env vars (EASYLIFE.DATABASES.AUTHENTICATION.DB_INFO.HOST)."""
        (tmp_path / FILE_CONFIG_JSON).write_text(json.dumps(self._db_config_template()))

        dot_scheme = f"{ENV_PREFIX}{SEP}DATABASES{SEP}AUTHENTICATION{SEP}DB_INFO{SEP}CONNECTION_SCHEME"
        dot_database = f"{ENV_PREFIX}{SEP}DATABASES{SEP}AUTHENTICATION{SEP}DB_INFO{SEP}DATABASE"
        clean_env = _clean_env_for_e2e({
            dot_scheme: MOCK_DB_SCHEME_SRV,
            DOT_ENV_USERNAME: MOCK_DB_USERNAME,
            DOT_ENV_PASSWORD: MOCK_DB_PASSWORD_SECRET,
            DOT_ENV_HOST: MOCK_DB_HOST_CLUSTER,
            dot_database: MOCK_DB_DATABASE_EASYLIFE,
        })

        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path), environment="dev"
            )

        db_info = loader.configuration["databases"]["authentication"]["db_info"]
        assert db_info["connection_scheme"] == MOCK_DB_SCHEME_SRV
        assert db_info["username"] == MOCK_DB_USERNAME
        assert db_info["password"] == MOCK_DB_PASSWORD_SECRET
        assert db_info["host"] == MOCK_DB_HOST_CLUSTER
        assert db_info["database"] == MOCK_DB_DATABASE_EASYLIFE

    def test_credentials_json_resolved_from_dot_env(self, tmp_path):
        """credentials_json (underscore in name) resolves via dot-format env var."""
        config = {
            "environment": {
                "storage": {
                    "gcs": {
                        "credentials_json": f"{{{DOT_PATH_CREDS_JSON}}}",
                    }
                }
            }
        }
        (tmp_path / FILE_CONFIG_JSON).write_text(json.dumps(config))

        creds_json_str = json.dumps({"type": "service_account", "project_id": MOCK_DB_DATABASE_EASYLIFE})
        clean_env = _clean_env_for_e2e({
            DOT_ENV_CREDS: creds_json_str,
        })

        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path), environment="dev"
            )

        creds = loader.configuration["environment"]["storage"]["gcs"]["credentials_json"]
        assert isinstance(creds, dict)
        assert creds["type"] == "service_account"
        assert creds["project_id"] == MOCK_DB_DATABASE_EASYLIFE

    def test_pool_settings_resolved_from_env_vars(self, tmp_path):
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

        clean_env = _clean_env_for_e2e({ENV_MAX_POOL: "150"})

        with patch.dict(os.environ, clean_env, clear=True):
            loader = ConfigurationLoader(
                config_path=str(tmp_path), environment="dev"
            )

        pool = loader.configuration["globals"]["databases"]["default"]
        assert pool["max_pool_size"] == 150
