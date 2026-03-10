"""Targeted coverage tests for main.py lines 184 and 199.

Line 184: the actual create_app() call inside bootstrap() (not mocked).
Line 199: the uvicorn.run() inside ``if __name__ == '__main__'``.
"""
import sys
import runpy
from unittest.mock import MagicMock, patch

import pytest

PATCH_MAIN_CONFIG_LOADER = "main.ConfigurationLoader"
PATCH_MAIN_SETUP_SSL = "main.setup_jira_ssl_bundle"


def _make_config_loader():
    loader = MagicMock()
    loader.get_DB_config.return_value = None
    loader.get_config_by_path.return_value = None
    return loader


class TestBootstrapCreatesApp:
    """Call bootstrap() WITHOUT mocking create_app so line 184 executes."""

    @patch(PATCH_MAIN_SETUP_SSL, return_value=None)
    @patch(PATCH_MAIN_CONFIG_LOADER)
    def test_bootstrap_returns_fastapi_app(self, mock_cl_cls, _mock_ssl):
        mock_cl_cls.return_value = _make_config_loader()
        from main import bootstrap
        app = bootstrap()
        from fastapi import FastAPI
        assert isinstance(app, FastAPI)


class TestMainBlockCoverage:
    """Execute the real main.py source as __main__ so line 199 is covered."""

    @patch(PATCH_MAIN_SETUP_SSL, return_value=None)
    @patch(PATCH_MAIN_CONFIG_LOADER)
    def test_main_block_calls_uvicorn(self, mock_cl_cls, _mock_ssl):
        mock_cl_cls.return_value = _make_config_loader()
        mock_uvicorn = MagicMock()
        sys.modules["uvicorn"] = mock_uvicorn
        try:
            runpy.run_module("main", run_name="__main__", alter_sys=False)
            mock_uvicorn.run.assert_called_once_with(
                "src.main:app", host="0.0.0.0", port=8000, reload=True,
            )
        finally:
            del sys.modules["uvicorn"]
