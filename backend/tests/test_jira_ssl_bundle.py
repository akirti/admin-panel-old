"""Tests for setup_jira_ssl_bundle() in main.py"""
import os
from unittest.mock import patch, MagicMock

import pytest

from src.main import setup_jira_ssl_bundle, bootstrap


SAMPLE_PEM = "-----BEGIN CERTIFICATE-----\nMIIBxTCCAW...\n-----END CERTIFICATE-----\n"


# --- None / no-op cases ---

def test_returns_none_when_jira_config_none():
    assert setup_jira_ssl_bundle(None, "/tmp") is None


def test_returns_none_when_ssl_missing():
    assert setup_jira_ssl_bundle({"base_url": "https://jira"}, "/tmp") is None


def test_returns_none_when_ssl_empty():
    assert setup_jira_ssl_bundle({"ssl": {}}, "/tmp") is None


def test_returns_none_when_bundle_data_missing():
    cfg = {"ssl": {"bundle_path": "cert/jira", "bundle_file_name": "combined.pem"}}
    assert setup_jira_ssl_bundle(cfg, "/tmp") is None


def test_returns_none_when_bundle_path_missing():
    cfg = {"ssl": {"bundle_data": SAMPLE_PEM, "bundle_file_name": "combined.pem"}}
    assert setup_jira_ssl_bundle(cfg, "/tmp") is None


def test_returns_none_when_bundle_file_name_missing():
    cfg = {"ssl": {"bundle_data": SAMPLE_PEM, "bundle_path": "cert/jira"}}
    assert setup_jira_ssl_bundle(cfg, "/tmp") is None


# --- Happy-path cases ---

def _make_jira_config(bundle_path="certificate/jira", file_name="combined.pem", data=SAMPLE_PEM):
    return {
        "ssl": {
            "bundle_data": data,
            "bundle_path": bundle_path,
            "bundle_file_name": file_name,
        }
    }


def test_creates_directory_and_pem_file(tmp_path):
    cfg = _make_jira_config()
    result = setup_jira_ssl_bundle(cfg, str(tmp_path))

    expected = tmp_path / "certificate" / "jira" / "combined.pem"
    assert expected.exists()
    assert result is not None


def test_pem_file_content_matches_bundle_data(tmp_path):
    cfg = _make_jira_config(data=SAMPLE_PEM)
    setup_jira_ssl_bundle(cfg, str(tmp_path))

    pem_file = tmp_path / "certificate" / "jira" / "combined.pem"
    assert pem_file.read_text() == SAMPLE_PEM


def test_returns_full_pem_path(tmp_path):
    cfg = _make_jira_config()
    result = setup_jira_ssl_bundle(cfg, str(tmp_path))

    expected = os.path.join(str(tmp_path), "certificate", "jira", "combined.pem")
    assert result == expected


def test_deletes_and_recreates_existing_directory(tmp_path):
    # Pre-create directory with a stale file
    stale_dir = tmp_path / "certificate" / "jira"
    stale_dir.mkdir(parents=True)
    stale_file = stale_dir / "old_cert.pem"
    stale_file.write_text("stale data")

    cfg = _make_jira_config()
    setup_jira_ssl_bundle(cfg, str(tmp_path))

    # Stale file should be gone
    assert not stale_file.exists()
    # New PEM file should exist
    assert (stale_dir / "combined.pem").exists()


def test_creates_nested_bundle_path(tmp_path):
    cfg = _make_jira_config(bundle_path="a/b/c/d")
    result = setup_jira_ssl_bundle(cfg, str(tmp_path))

    expected = tmp_path / "a" / "b" / "c" / "d" / "combined.pem"
    assert expected.exists()
    assert result == str(expected)


# --- Bootstrap integration ---

@patch("src.main.create_app")
@patch("src.main.ConfigurationLoader")
def test_bootstrap_stores_pem_path_in_jira_config(mock_loader_cls, mock_create_app, tmp_path):
    """bootstrap() sets jira_config['ssl']['bundle_pem_path'] when SSL is configured."""
    mock_loader = MagicMock()
    mock_loader_cls.return_value = mock_loader

    jira_raw = {
        "base_url": "https://jira.example.com",
        "email": "a@b.com",
        "api_token": "tok",
        "ssl": {
            "bundle_data": SAMPLE_PEM,
            "bundle_path": "certificate/jira",
            "bundle_file_name": "combined.pem",
        },
    }

    def side_effect(path):
        mapping = {
            "environment.app_secrets.auth_secret_key": "secret",
            "environment.smtp": None,
            "environment.cors.origins": None,
            "environment.storage": None,
            "environment.jira": jira_raw,
        }
        return mapping.get(path)

    mock_loader.get_config_by_path.side_effect = side_effect
    mock_loader.get_DB_config.return_value = {"host": "localhost"}
    mock_create_app.return_value = "fake_app"

    with patch("src.main.resolve_config_path", return_value=str(tmp_path)), \
         patch("src.main.resolve_environment", return_value="test"):
        bootstrap()

    # Verify create_app received jira_config with bundle_pem_path
    call_kwargs = mock_create_app.call_args[1]
    jira_cfg = call_kwargs["jira_config"]
    expected_pem = os.path.join(str(tmp_path), "certificate", "jira", "combined.pem")
    assert jira_cfg["ssl"]["bundle_pem_path"] == expected_pem
    assert os.path.exists(expected_pem)


@patch("src.main.create_app")
@patch("src.main.ConfigurationLoader")
def test_bootstrap_no_pem_path_when_ssl_not_configured(mock_loader_cls, mock_create_app, tmp_path):
    """bootstrap() works fine when jira has no SSL config."""
    mock_loader = MagicMock()
    mock_loader_cls.return_value = mock_loader

    def side_effect(path):
        mapping = {
            "environment.app_secrets.auth_secret_key": "secret",
            "environment.smtp": None,
            "environment.cors.origins": None,
            "environment.storage": None,
            "environment.jira": None,
        }
        return mapping.get(path)

    mock_loader.get_config_by_path.side_effect = side_effect
    mock_loader.get_DB_config.return_value = {"host": "localhost"}
    mock_create_app.return_value = "fake_app"

    with patch("src.main.resolve_config_path", return_value=str(tmp_path)), \
         patch("src.main.resolve_environment", return_value="test"):
        result = bootstrap()

    # Should not crash; jira_config should be None
    call_kwargs = mock_create_app.call_args[1]
    assert call_kwargs["jira_config"] is None
