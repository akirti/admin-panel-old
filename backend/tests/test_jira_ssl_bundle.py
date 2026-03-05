"""Tests for certificate_util: format_pem_bundle() and setup_jira_ssl_bundle()"""
import os
from unittest.mock import patch, MagicMock

import pytest

from src.easylifeauth.utils.certificate_util import format_pem_bundle, setup_jira_ssl_bundle
from src.main import bootstrap


# -- Sample data ---------------------------------------------------------------

# A realistic multi-block bundle as it would appear in an env var (single line,
# literal \n).  Contains: client cert + private key + CA cert.
CLIENT_CERT_B64 = "MIICpDCCAYwCCQDU+pQ4pHgSpDANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDDAls"
KEY_B64 = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7o4qne60TB3pM"
CA_CERT_B64 = "MIIDXTCCAkWgAwIBAgIJAJC1HiIAZAiUMA0GCSqGSIb3Qq9BQBCwUAMEUxCzAJBg"

SINGLE_LINE_BUNDLE = (
    "-----BEGIN CERTIFICATE-----\\n"
    f"{CLIENT_CERT_B64}\\n"
    "-----END CERTIFICATE-----\\n"
    "-----BEGIN RSA PRIVATE KEY-----\\n"
    f"{KEY_B64}\\n"
    "-----END RSA PRIVATE KEY-----\\n"
    "-----BEGIN CERTIFICATE-----\\n"
    f"{CA_CERT_B64}\\n"
    "-----END CERTIFICATE-----"
)

# Same bundle but with spaces instead of \n (another common env-var encoding)
SPACE_SEPARATED_BUNDLE = (
    "-----BEGIN CERTIFICATE----- "
    f"{CLIENT_CERT_B64} "
    "-----END CERTIFICATE----- "
    "-----BEGIN RSA PRIVATE KEY----- "
    f"{KEY_B64} "
    "-----END RSA PRIVATE KEY----- "
    "-----BEGIN CERTIFICATE----- "
    f"{CA_CERT_B64} "
    "-----END CERTIFICATE-----"
)

# Already properly formatted PEM (should pass through unchanged)
PROPER_PEM = (
    "-----BEGIN CERTIFICATE-----\n"
    f"{CLIENT_CERT_B64}\n"
    "-----END CERTIFICATE-----\n"
    "-----BEGIN RSA PRIVATE KEY-----\n"
    f"{KEY_B64}\n"
    "-----END RSA PRIVATE KEY-----\n"
    "-----BEGIN CERTIFICATE-----\n"
    f"{CA_CERT_B64}\n"
    "-----END CERTIFICATE-----\n"
)

SIMPLE_PEM = "-----BEGIN CERTIFICATE-----\nMIIBxTCCAW\n-----END CERTIFICATE-----\n"


# ==============================================================================
# format_pem_bundle tests
# ==============================================================================

class TestFormatPemBundle:

    def test_converts_literal_backslash_n_to_newlines(self):
        raw = "-----BEGIN CERTIFICATE-----\\nMIIBxTCCAW\\n-----END CERTIFICATE-----"
        result = format_pem_bundle(raw)
        assert "\\n" not in result
        assert result.startswith("-----BEGIN CERTIFICATE-----\n")

    def test_formats_single_line_bundle_with_three_blocks(self):
        result = format_pem_bundle(SINGLE_LINE_BUNDLE)
        blocks = result.strip().split("-----END")
        # 3 END markers means 3 blocks
        assert len(blocks) == 4  # 3 blocks + trailing empty after last END

    def test_each_block_has_begin_and_end_on_own_lines(self):
        result = format_pem_bundle(SINGLE_LINE_BUNDLE)
        lines = result.strip().split("\n")
        begin_lines = [l for l in lines if l.startswith("-----BEGIN")]
        end_lines = [l for l in lines if l.startswith("-----END")]
        assert len(begin_lines) == 3
        assert len(end_lines) == 3

    def test_base64_body_on_separate_lines_from_markers(self):
        result = format_pem_bundle(SINGLE_LINE_BUNDLE)
        lines = result.strip().split("\n")
        # Line after each BEGIN should be base64, not another marker
        for i, line in enumerate(lines):
            if line.startswith("-----BEGIN"):
                assert not lines[i + 1].startswith("-----")

    def test_handles_space_separated_bundle(self):
        result = format_pem_bundle(SPACE_SEPARATED_BUNDLE)
        lines = result.strip().split("\n")
        begin_lines = [l for l in lines if l.startswith("-----BEGIN")]
        end_lines = [l for l in lines if l.startswith("-----END")]
        assert len(begin_lines) == 3
        assert len(end_lines) == 3

    def test_preserves_already_formatted_pem(self):
        result = format_pem_bundle(PROPER_PEM)
        # Should produce identical content (both have same base64 blocks)
        assert result == PROPER_PEM

    def test_wraps_base64_at_64_chars(self):
        # Long base64 body that exceeds 64 chars
        long_b64 = "A" * 128
        raw = f"-----BEGIN CERTIFICATE-----\\n{long_b64}\\n-----END CERTIFICATE-----"
        result = format_pem_bundle(raw)
        lines = result.strip().split("\n")
        body_lines = [l for l in lines if not l.startswith("-----")]
        for line in body_lines:
            assert len(line) <= 64

    def test_handles_private_key_block_type(self):
        raw = "-----BEGIN RSA PRIVATE KEY-----\\nMIIEvQ\\n-----END RSA PRIVATE KEY-----"
        result = format_pem_bundle(raw)
        assert "-----BEGIN RSA PRIVATE KEY-----\n" in result
        assert "-----END RSA PRIVATE KEY-----" in result

    def test_handles_ec_private_key_block_type(self):
        raw = "-----BEGIN EC PRIVATE KEY-----\\nMHQC\\n-----END EC PRIVATE KEY-----"
        result = format_pem_bundle(raw)
        assert "-----BEGIN EC PRIVATE KEY-----\n" in result
        assert "-----END EC PRIVATE KEY-----" in result

    def test_handles_generic_private_key_type(self):
        raw = "-----BEGIN PRIVATE KEY-----\\nMIIE\\n-----END PRIVATE KEY-----"
        result = format_pem_bundle(raw)
        assert "-----BEGIN PRIVATE KEY-----\n" in result

    def test_returns_raw_data_when_no_pem_blocks_found(self):
        raw = "not a certificate at all"
        result = format_pem_bundle(raw)
        assert result == raw

    def test_ends_with_trailing_newline(self):
        raw = "-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----"
        result = format_pem_bundle(raw)
        assert result.endswith("\n")

    def test_mixed_literal_newlines_and_spaces(self):
        raw = (
            "-----BEGIN CERTIFICATE-----\\n"
            f"{CLIENT_CERT_B64}\\n"
            "-----END CERTIFICATE----- "
            "-----BEGIN CERTIFICATE-----\\n"
            f"{CA_CERT_B64}\\n"
            "-----END CERTIFICATE-----"
        )
        result = format_pem_bundle(raw)
        begin_count = result.count("-----BEGIN CERTIFICATE-----")
        assert begin_count == 2


# ==============================================================================
# setup_jira_ssl_bundle tests
# ==============================================================================

def _make_jira_config(bundle_path="certificate/jira", file_name="combined.pem", data=SINGLE_LINE_BUNDLE):
    return {
        "ssl": {
            "bundle_data": data,
            "bundle_path": bundle_path,
            "bundle_file_name": file_name,
        }
    }


class TestSetupJiraSslBundleNoop:

    def test_returns_none_when_jira_config_none(self):
        assert setup_jira_ssl_bundle(None, "/tmp") is None

    def test_returns_none_when_ssl_missing(self):
        assert setup_jira_ssl_bundle({"base_url": "https://jira"}, "/tmp") is None

    def test_returns_none_when_ssl_empty(self):
        assert setup_jira_ssl_bundle({"ssl": {}}, "/tmp") is None

    def test_returns_none_when_bundle_data_missing(self):
        cfg = {"ssl": {"bundle_path": "cert/jira", "bundle_file_name": "combined.pem"}}
        assert setup_jira_ssl_bundle(cfg, "/tmp") is None

    def test_returns_none_when_bundle_path_missing(self):
        cfg = {"ssl": {"bundle_data": SINGLE_LINE_BUNDLE, "bundle_file_name": "combined.pem"}}
        assert setup_jira_ssl_bundle(cfg, "/tmp") is None

    def test_returns_none_when_bundle_file_name_missing(self):
        cfg = {"ssl": {"bundle_data": SINGLE_LINE_BUNDLE, "bundle_path": "cert/jira"}}
        assert setup_jira_ssl_bundle(cfg, "/tmp") is None


class TestSetupJiraSslBundleHappyPath:

    def test_creates_directory_and_pem_file(self, tmp_path):
        cfg = _make_jira_config()
        result = setup_jira_ssl_bundle(cfg, str(tmp_path))
        expected = tmp_path / "certificate" / "jira" / "combined.pem"
        assert expected.exists()
        assert result is not None

    def test_pem_file_has_proper_format(self, tmp_path):
        cfg = _make_jira_config(data=SINGLE_LINE_BUNDLE)
        setup_jira_ssl_bundle(cfg, str(tmp_path))

        pem_file = tmp_path / "certificate" / "jira" / "combined.pem"
        content = pem_file.read_text()

        # Should NOT contain literal \n
        assert "\\n" not in content
        # Should have proper BEGIN/END on their own lines
        lines = content.strip().split("\n")
        begin_lines = [l for l in lines if l.startswith("-----BEGIN")]
        end_lines = [l for l in lines if l.startswith("-----END")]
        assert len(begin_lines) == 3
        assert len(end_lines) == 3

    def test_pem_file_contains_all_certificate_blocks(self, tmp_path):
        cfg = _make_jira_config(data=SINGLE_LINE_BUNDLE)
        setup_jira_ssl_bundle(cfg, str(tmp_path))

        content = (tmp_path / "certificate" / "jira" / "combined.pem").read_text()
        assert "-----BEGIN CERTIFICATE-----" in content
        assert "-----BEGIN RSA PRIVATE KEY-----" in content
        assert content.count("-----BEGIN CERTIFICATE-----") == 2  # client + CA

    def test_pem_file_base64_not_on_marker_line(self, tmp_path):
        cfg = _make_jira_config(data=SINGLE_LINE_BUNDLE)
        setup_jira_ssl_bundle(cfg, str(tmp_path))

        content = (tmp_path / "certificate" / "jira" / "combined.pem").read_text()
        for line in content.strip().split("\n"):
            if line.startswith("-----"):
                # Marker lines should ONLY be the marker, no base64 appended
                assert line.endswith("-----")

    def test_returns_full_pem_path(self, tmp_path):
        cfg = _make_jira_config()
        result = setup_jira_ssl_bundle(cfg, str(tmp_path))
        expected = os.path.join(str(tmp_path), "certificate", "jira", "combined.pem")
        assert result == expected

    def test_deletes_and_recreates_existing_directory(self, tmp_path):
        stale_dir = tmp_path / "certificate" / "jira"
        stale_dir.mkdir(parents=True)
        stale_file = stale_dir / "old_cert.pem"
        stale_file.write_text("stale data")

        cfg = _make_jira_config()
        setup_jira_ssl_bundle(cfg, str(tmp_path))

        assert not stale_file.exists()
        assert (stale_dir / "combined.pem").exists()

    def test_creates_nested_bundle_path(self, tmp_path):
        cfg = _make_jira_config(bundle_path="a/b/c/d")
        result = setup_jira_ssl_bundle(cfg, str(tmp_path))

        expected = tmp_path / "a" / "b" / "c" / "d" / "combined.pem"
        assert expected.exists()
        assert result == str(expected)

    def test_writes_formatted_content_not_raw(self, tmp_path):
        """Verifies the file is formatted, not a raw single-line dump."""
        cfg = _make_jira_config(data=SINGLE_LINE_BUNDLE)
        setup_jira_ssl_bundle(cfg, str(tmp_path))

        content = (tmp_path / "certificate" / "jira" / "combined.pem").read_text()
        # Raw input has literal \n — file must not
        assert "\\n" not in content
        # Must be multi-line
        assert content.count("\n") > 3


# ==============================================================================
# Bootstrap integration tests
# ==============================================================================

class TestBootstrapIntegration:

    @patch("src.main.create_app")
    @patch("src.main.ConfigurationLoader")
    def test_bootstrap_stores_pem_path_in_jira_config(self, mock_loader_cls, mock_create_app, tmp_path):
        mock_loader = MagicMock()
        mock_loader_cls.return_value = mock_loader

        jira_raw = {
            "base_url": "https://jira.example.com",
            "email": "a@b.com",
            "api_token": "tok",
            "ssl": {
                "bundle_data": SINGLE_LINE_BUNDLE,
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

        call_kwargs = mock_create_app.call_args[1]
        jira_cfg = call_kwargs["jira_config"]
        expected_pem = os.path.join(str(tmp_path), "certificate", "jira", "combined.pem")
        assert jira_cfg["ssl"]["bundle_pem_path"] == expected_pem
        assert os.path.exists(expected_pem)

        # Verify the written file is properly formatted
        content = open(expected_pem).read()
        assert "\\n" not in content
        assert "-----BEGIN CERTIFICATE-----\n" in content

    @patch("src.main.create_app")
    @patch("src.main.ConfigurationLoader")
    def test_bootstrap_no_pem_path_when_ssl_not_configured(self, mock_loader_cls, mock_create_app, tmp_path):
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
            bootstrap()

        call_kwargs = mock_create_app.call_args[1]
        assert call_kwargs["jira_config"] is None
