"""Tests for certificate_util: format_pem_bundle() and setup_jira_ssl_bundle()"""
import os
import shutil
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from mock_data import MOCK_EMAIL_BOT, MOCK_API_TOKEN, MOCK_SECRET, MOCK_URL_JIRA_EXAMPLE
from src.easylifeauth.utils.certificate_util import format_pem_bundle, setup_jira_ssl_bundle

# -- PEM markers ---------------------------------------------------------------
PEM_BEGIN_CERT = "-----BEGIN CERTIFICATE-----"
PEM_END_CERT = "-----END CERTIFICATE-----"
PEM_BEGIN_RSA_KEY = "-----BEGIN RSA PRIVATE KEY-----"
PEM_END_RSA_KEY = "-----END RSA PRIVATE KEY-----"
PEM_BEGIN_EC_KEY = "-----BEGIN EC PRIVATE KEY-----"
PEM_END_EC_KEY = "-----END EC PRIVATE KEY-----"
PEM_BEGIN_KEY = "-----BEGIN PRIVATE KEY-----"
PEM_END_KEY = "-----END PRIVATE KEY-----"
PEM_MARKER_PREFIX = "-----BEGIN"
PEM_MARKER_SUFFIX = "-----"

# -- File / path defaults ------------------------------------------------------
DEFAULT_PEM_FILE = "combined.pem"
DEFAULT_BUNDLE_PATH = "certificate/jira"
CERT_DIR = "certificate"

# -- Config path strings -------------------------------------------------------
CFG_AUTH_SECRET_KEY = "environment.app_secrets.auth_secret_key"
CFG_SMTP = "environment.smtp"
CFG_CORS_ORIGINS = "environment.cors.origins"
CFG_STORAGE = "environment.storage"
CFG_JIRA = "environment.jira"

# -- Patch targets -------------------------------------------------------------
PATCH_CREATE_APP = "src.main.create_app"
PATCH_CONFIG_LOADER = "src.main.ConfigurationLoader"
PATCH_RESOLVE_CONFIG = "src.main.resolve_config_path"
PATCH_RESOLVE_ENV = "src.main.resolve_environment"

# -- Sample data ---------------------------------------------------------------

# A realistic multi-block bundle as it would appear in an env var (single line,
# literal \n).  Contains: client cert + private key + CA cert.
CLIENT_CERT_B64 = "MIICpDCCAYwCCQDU+pQ4pHgSpDANBgkqhkiG9w0BAQsFADAUMRIwEAYDVQQDDAls"
KEY_B64 = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7o4qne60TB3pM"
CA_CERT_B64 = "MIIDXTCCAkWgAwIBAgIJAJC1HiIAZAiUMA0GCSqGSIb3Qq9BQBCwUAMEUxCzAJBg"

SINGLE_LINE_BUNDLE = (
    f"{PEM_BEGIN_CERT}\\n"
    f"{CLIENT_CERT_B64}\\n"
    f"{PEM_END_CERT}\\n"
    f"{PEM_BEGIN_RSA_KEY}\\n"
    f"{KEY_B64}\\n"
    f"{PEM_END_RSA_KEY}\\n"
    f"{PEM_BEGIN_CERT}\\n"
    f"{CA_CERT_B64}\\n"
    f"{PEM_END_CERT}"
)

# Same bundle but with spaces instead of \n (another common env-var encoding)
SPACE_SEPARATED_BUNDLE = (
    f"{PEM_BEGIN_CERT} "
    f"{CLIENT_CERT_B64} "
    f"{PEM_END_CERT} "
    f"{PEM_BEGIN_RSA_KEY} "
    f"{KEY_B64} "
    f"{PEM_END_RSA_KEY} "
    f"{PEM_BEGIN_CERT} "
    f"{CA_CERT_B64} "
    f"{PEM_END_CERT}"
)

# Already properly formatted PEM (should pass through unchanged)
PROPER_PEM = (
    f"{PEM_BEGIN_CERT}\n"
    f"{CLIENT_CERT_B64}\n"
    f"{PEM_END_CERT}\n"
    f"{PEM_BEGIN_RSA_KEY}\n"
    f"{KEY_B64}\n"
    f"{PEM_END_RSA_KEY}\n"
    f"{PEM_BEGIN_CERT}\n"
    f"{CA_CERT_B64}\n"
    f"{PEM_END_CERT}\n"
)

SIMPLE_PEM = f"{PEM_BEGIN_CERT}\nMIIBxTCCAW\n{PEM_END_CERT}\n"


# -- Cleanup fixture -----------------------------------------------------------
# Module-level app = bootstrap() in src.main creates a real SSL directory under
# the config path when jira ssl bundle_data is configured.  Clean it up after
# all tests in this module finish so it doesn't persist on the filesystem.

@pytest.fixture(autouse=True, scope="module")
def _cleanup_ssl_cert_directory():
    yield
    config_path = os.environ.get(
        "CONFIG_PATH",
        str(Path(__file__).resolve().parent.parent / "src" / "config"),
    )
    cert_dir = os.path.normpath(os.path.join(config_path, CERT_DIR))
    if os.path.isdir(cert_dir):
        shutil.rmtree(cert_dir, ignore_errors=True)


# ==============================================================================
# format_pem_bundle tests
# ==============================================================================

class TestFormatPemBundle:

    def test_converts_literal_backslash_n_to_newlines(self):
        raw = f"{PEM_BEGIN_CERT}\\nMIIBxTCCAW\\n{PEM_END_CERT}"
        result = format_pem_bundle(raw)
        assert "\\n" not in result
        assert result.startswith(f"{PEM_BEGIN_CERT}\n")

    def test_formats_single_line_bundle_with_three_blocks(self):
        result = format_pem_bundle(SINGLE_LINE_BUNDLE)
        blocks = result.strip().split("-----END")
        # 3 END markers means 3 blocks
        assert len(blocks) == 4  # 3 blocks + trailing empty after last END

    def test_each_block_has_begin_and_end_on_own_lines(self):
        result = format_pem_bundle(SINGLE_LINE_BUNDLE)
        lines = result.strip().split("\n")
        begin_lines = [l for l in lines if l.startswith(PEM_MARKER_PREFIX)]
        end_lines = [l for l in lines if l.startswith("-----END")]
        assert len(begin_lines) == 3
        assert len(end_lines) == 3

    def test_base64_body_on_separate_lines_from_markers(self):
        result = format_pem_bundle(SINGLE_LINE_BUNDLE)
        lines = result.strip().split("\n")
        # Line after each BEGIN should be base64, not another marker
        for i, line in enumerate(lines):
            if line.startswith(PEM_MARKER_PREFIX):
                assert not lines[i + 1].startswith(PEM_MARKER_SUFFIX)

    def test_handles_space_separated_bundle(self):
        result = format_pem_bundle(SPACE_SEPARATED_BUNDLE)
        lines = result.strip().split("\n")
        begin_lines = [l for l in lines if l.startswith(PEM_MARKER_PREFIX)]
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
        raw = f"{PEM_BEGIN_CERT}\\n{long_b64}\\n{PEM_END_CERT}"
        result = format_pem_bundle(raw)
        lines = result.strip().split("\n")
        body_lines = [l for l in lines if not l.startswith(PEM_MARKER_SUFFIX)]
        for line in body_lines:
            assert len(line) <= 64

    def test_handles_private_key_block_type(self):
        raw = f"{PEM_BEGIN_RSA_KEY}\\nMIIEvQ\\n{PEM_END_RSA_KEY}"
        result = format_pem_bundle(raw)
        assert f"{PEM_BEGIN_RSA_KEY}\n" in result
        assert PEM_END_RSA_KEY in result

    def test_handles_ec_private_key_block_type(self):
        raw = f"{PEM_BEGIN_EC_KEY}\\nMHQC\\n{PEM_END_EC_KEY}"
        result = format_pem_bundle(raw)
        assert f"{PEM_BEGIN_EC_KEY}\n" in result
        assert PEM_END_EC_KEY in result

    def test_handles_generic_private_key_type(self):
        raw = f"{PEM_BEGIN_KEY}\\nMIIE\\n{PEM_END_KEY}"
        result = format_pem_bundle(raw)
        assert f"{PEM_BEGIN_KEY}\n" in result

    def test_returns_raw_data_when_no_pem_blocks_found(self):
        raw = "not a certificate at all"
        result = format_pem_bundle(raw)
        assert result == raw

    def test_ends_with_trailing_newline(self):
        raw = f"{PEM_BEGIN_CERT}\\nABC\\n{PEM_END_CERT}"
        result = format_pem_bundle(raw)
        assert result.endswith("\n")

    def test_mixed_literal_newlines_and_spaces(self):
        raw = (
            f"{PEM_BEGIN_CERT}\\n"
            f"{CLIENT_CERT_B64}\\n"
            f"{PEM_END_CERT} "
            f"{PEM_BEGIN_CERT}\\n"
            f"{CA_CERT_B64}\\n"
            f"{PEM_END_CERT}"
        )
        result = format_pem_bundle(raw)
        begin_count = result.count(PEM_BEGIN_CERT)
        assert begin_count == 2


# ==============================================================================
# setup_jira_ssl_bundle tests
# ==============================================================================

def _make_jira_config(bundle_path=DEFAULT_BUNDLE_PATH, file_name=DEFAULT_PEM_FILE, data=SINGLE_LINE_BUNDLE):
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
        cfg = {"ssl": {"bundle_path": "cert/jira", "bundle_file_name": DEFAULT_PEM_FILE}}
        assert setup_jira_ssl_bundle(cfg, "/tmp") is None

    def test_returns_none_when_bundle_path_missing(self):
        cfg = {"ssl": {"bundle_data": SINGLE_LINE_BUNDLE, "bundle_file_name": DEFAULT_PEM_FILE}}
        assert setup_jira_ssl_bundle(cfg, "/tmp") is None

    def test_returns_none_when_bundle_file_name_missing(self):
        cfg = {"ssl": {"bundle_data": SINGLE_LINE_BUNDLE, "bundle_path": "cert/jira"}}
        assert setup_jira_ssl_bundle(cfg, "/tmp") is None


class TestSetupJiraSslBundleHappyPath:

    def test_creates_directory_and_pem_file(self, tmp_path):
        cfg = _make_jira_config()
        result = setup_jira_ssl_bundle(cfg, str(tmp_path))
        expected = tmp_path / DEFAULT_BUNDLE_PATH / DEFAULT_PEM_FILE
        assert expected.exists()
        assert result is not None

    def test_pem_file_has_proper_format(self, tmp_path):
        cfg = _make_jira_config(data=SINGLE_LINE_BUNDLE)
        setup_jira_ssl_bundle(cfg, str(tmp_path))

        pem_file = tmp_path / DEFAULT_BUNDLE_PATH / DEFAULT_PEM_FILE
        content = pem_file.read_text()

        # Should NOT contain literal \n
        assert "\\n" not in content
        # Should have proper BEGIN/END on their own lines
        lines = content.strip().split("\n")
        begin_lines = [l for l in lines if l.startswith(PEM_MARKER_PREFIX)]
        end_lines = [l for l in lines if l.startswith("-----END")]
        assert len(begin_lines) == 3
        assert len(end_lines) == 3

    def test_pem_file_contains_all_certificate_blocks(self, tmp_path):
        cfg = _make_jira_config(data=SINGLE_LINE_BUNDLE)
        setup_jira_ssl_bundle(cfg, str(tmp_path))

        content = (tmp_path / DEFAULT_BUNDLE_PATH / DEFAULT_PEM_FILE).read_text()
        assert PEM_BEGIN_CERT in content
        assert PEM_BEGIN_RSA_KEY in content
        assert content.count(PEM_BEGIN_CERT) == 2  # client + CA

    def test_pem_file_base64_not_on_marker_line(self, tmp_path):
        cfg = _make_jira_config(data=SINGLE_LINE_BUNDLE)
        setup_jira_ssl_bundle(cfg, str(tmp_path))

        content = (tmp_path / DEFAULT_BUNDLE_PATH / DEFAULT_PEM_FILE).read_text()
        for line in content.strip().split("\n"):
            if line.startswith(PEM_MARKER_SUFFIX):
                # Marker lines should ONLY be the marker, no base64 appended
                assert line.endswith(PEM_MARKER_SUFFIX)

    def test_returns_full_pem_path(self, tmp_path):
        cfg = _make_jira_config()
        result = setup_jira_ssl_bundle(cfg, str(tmp_path))
        # Use os.path.normpath on both sides for cross-platform compatibility
        expected = os.path.normpath(
            os.path.join(str(tmp_path), DEFAULT_BUNDLE_PATH, DEFAULT_PEM_FILE)
        )
        assert result == expected

    def test_deletes_and_recreates_existing_directory(self, tmp_path):
        stale_dir = tmp_path / DEFAULT_BUNDLE_PATH
        stale_dir.mkdir(parents=True)
        stale_file = stale_dir / "old_cert.pem"
        stale_file.write_text("stale data")

        cfg = _make_jira_config()
        setup_jira_ssl_bundle(cfg, str(tmp_path))

        assert not stale_file.exists()
        assert (stale_dir / DEFAULT_PEM_FILE).exists()

    def test_creates_nested_bundle_path(self, tmp_path):
        cfg = _make_jira_config(bundle_path="a/b/c/d")
        result = setup_jira_ssl_bundle(cfg, str(tmp_path))

        expected_path = tmp_path / "a" / "b" / "c" / "d" / DEFAULT_PEM_FILE
        assert expected_path.exists()
        # Compare normalized paths for cross-platform consistency
        assert os.path.normpath(result) == os.path.normpath(str(expected_path))

    def test_writes_formatted_content_not_raw(self, tmp_path):
        """Verifies the file is formatted, not a raw single-line dump."""
        cfg = _make_jira_config(data=SINGLE_LINE_BUNDLE)
        setup_jira_ssl_bundle(cfg, str(tmp_path))

        content = (tmp_path / DEFAULT_BUNDLE_PATH / DEFAULT_PEM_FILE).read_text()
        # Raw input has literal \n — file must not
        assert "\\n" not in content
        # Must be multi-line
        assert content.count("\n") > 3


# ==============================================================================
# Bootstrap integration tests
# ==============================================================================

class TestBootstrapIntegration:

    @patch(PATCH_CREATE_APP)
    @patch(PATCH_CONFIG_LOADER)
    def test_bootstrap_stores_pem_path_in_jira_config(self, mock_loader_cls, mock_create_app, tmp_path):
        from src.main import bootstrap

        mock_loader = MagicMock()
        mock_loader_cls.return_value = mock_loader

        jira_raw = {
            "base_url": MOCK_URL_JIRA_EXAMPLE,
            "email": MOCK_EMAIL_BOT,
            "api_token": MOCK_API_TOKEN,
            "ssl": {
                "bundle_data": SINGLE_LINE_BUNDLE,
                "bundle_path": DEFAULT_BUNDLE_PATH,
                "bundle_file_name": DEFAULT_PEM_FILE,
            },
        }

        def side_effect(path):
            mapping = {
                CFG_AUTH_SECRET_KEY: MOCK_SECRET,
                CFG_SMTP: None,
                CFG_CORS_ORIGINS: None,
                CFG_STORAGE: None,
                CFG_JIRA: jira_raw,
            }
            return mapping.get(path)

        mock_loader.get_config_by_path.side_effect = side_effect
        mock_loader.get_DB_config.return_value = {"host": "localhost"}
        mock_create_app.return_value = "fake_app"

        with patch(PATCH_RESOLVE_CONFIG, return_value=str(tmp_path)), \
             patch(PATCH_RESOLVE_ENV, return_value="test"):
            bootstrap()

        call_kwargs = mock_create_app.call_args[1]
        jira_cfg = call_kwargs["jira_config"]
        expected_pem = os.path.normpath(
            os.path.join(str(tmp_path), DEFAULT_BUNDLE_PATH, DEFAULT_PEM_FILE)
        )
        assert jira_cfg["ssl"]["bundle_pem_path"] == expected_pem
        assert os.path.exists(expected_pem)

        # Verify the written file is properly formatted
        with open(expected_pem) as f:
            content = f.read()
        assert "\\n" not in content
        assert f"{PEM_BEGIN_CERT}\n" in content

    @patch(PATCH_CREATE_APP)
    @patch(PATCH_CONFIG_LOADER)
    def test_bootstrap_no_pem_path_when_ssl_not_configured(self, mock_loader_cls, mock_create_app, tmp_path):
        from src.main import bootstrap

        mock_loader = MagicMock()
        mock_loader_cls.return_value = mock_loader

        def side_effect(path):
            mapping = {
                CFG_AUTH_SECRET_KEY: MOCK_SECRET,
                CFG_SMTP: None,
                CFG_CORS_ORIGINS: None,
                CFG_STORAGE: None,
                CFG_JIRA: None,
            }
            return mapping.get(path)

        mock_loader.get_config_by_path.side_effect = side_effect
        mock_loader.get_DB_config.return_value = {"host": "localhost"}
        mock_create_app.return_value = "fake_app"

        with patch(PATCH_RESOLVE_CONFIG, return_value=str(tmp_path)), \
             patch(PATCH_RESOLVE_ENV, return_value="test"):
            bootstrap()

        call_kwargs = mock_create_app.call_args[1]
        assert call_kwargs["jira_config"] is None
