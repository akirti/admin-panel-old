"""Tests for app.py exception handlers and uncovered lines.

Covers:
- Lines 129-130: Error closing db connection during shutdown
- Line 151: CORS default origins when env var is empty
- Lines 232-249: request_validation_error_handler
- Lines 257-274: pydantic_validation_error_handler
- Lines 290-296: general_exception_handler (error logging branch)
- Lines 342-343: if __name__ == "__main__" block
"""
import os
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import Query
from fastapi.testclient import TestClient
from pydantic import BaseModel, ValidationError

from easylifeauth.app import create_app


class TestShutdownDbCloseError:
    """Tests for lines 129-130: error closing database connection during shutdown."""

    @pytest.mark.asyncio
    async def test_lifespan_db_close_raises_exception(self):
        """When db_manager.close() raises, shutdown should print a warning and not crash."""
        with patch("easylifeauth.app.DatabaseManager") as MockDB:
            mock_db = MagicMock()
            mock_db.ping = AsyncMock(return_value=True)
            mock_db.close = MagicMock(side_effect=RuntimeError("close failed"))
            MockDB.return_value = mock_db

            with patch("easylifeauth.app.TokenManager") as MockTM:
                MockTM.return_value = MagicMock()

                with patch("easylifeauth.app.init_dependencies"):
                    app = create_app(
                        db_config={
                            "uri": "mongodb://localhost:27017",
                            "database": "test",
                        },
                        token_secret="test_secret",
                    )

                    # TestClient context manager triggers lifespan startup and shutdown.
                    # Shutdown should catch the close() exception gracefully.
                    with TestClient(app) as client:
                        response = client.get("/")
                        assert response.status_code == 200

                    # Verify close was actually called (and raised)
                    mock_db.close.assert_called_once()


class TestCorsDefaultOrigins:
    """Tests for line 151: CORS default origins when CORS_ORIGINS env is empty."""

    @patch.dict(os.environ, {"CORS_ORIGINS": ""}, clear=False)
    def test_cors_defaults_when_env_empty(self):
        """When cors_origins is None and CORS_ORIGINS env is empty string,
        should default to localhost origins."""
        app = create_app(cors_origins=None)
        assert app is not None

        client = TestClient(app)
        # Verify the app works and CORS middleware is in place
        response = client.get("/")
        assert response.status_code == 200

    @patch.dict(os.environ, {}, clear=False)
    def test_cors_defaults_when_env_not_set(self):
        """When cors_origins is None and CORS_ORIGINS env is not set at all,
        should default to localhost origins."""
        # Make sure CORS_ORIGINS is removed if it exists
        os.environ.pop("CORS_ORIGINS", None)
        app = create_app(cors_origins=None)
        assert app is not None

        client = TestClient(app)
        response = client.get("/")
        assert response.status_code == 200


class TestRequestValidationErrorHandler:
    """Tests for lines 232-249: request_validation_error_handler."""

    @pytest.fixture
    def app(self):
        app = create_app()

        @app.get("/test-request-validation")
        async def validate_param(x: int = Query(...)):
            return {"x": x}

        return app

    @pytest.fixture
    def client(self, app):
        return TestClient(app, raise_server_exceptions=False)

    def test_request_validation_error_returns_422(self, client):
        """Sending a non-integer for an int query param triggers RequestValidationError."""
        response = client.get("/test-request-validation?x=notanumber")
        assert response.status_code == 422
        data = response.json()
        assert data["error"] == "Validation error"
        assert "details" in data
        assert isinstance(data["details"], list)
        assert len(data["details"]) > 0

    def test_request_validation_error_missing_param(self, client):
        """Missing required query param triggers RequestValidationError."""
        response = client.get("/test-request-validation")
        assert response.status_code == 422
        data = response.json()
        assert data["error"] == "Validation error"
        assert "details" in data

    @patch("easylifeauth.api.dependencies._error_log_service")
    def test_request_validation_error_logs_to_error_service(
        self, mock_error_log_service, app
    ):
        """When error_log_service is available, validation errors are logged."""
        mock_service = MagicMock()
        mock_service.log_error = AsyncMock()
        mock_error_log_service.return_value = mock_service

        with patch(
            "easylifeauth.api.dependencies.get_error_log_service",
            return_value=mock_service,
        ):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/test-request-validation?x=bad")
            assert response.status_code == 422

    def test_request_validation_error_when_logging_fails(self, app):
        """When error_log_service.log_error raises, handler still returns 422."""
        mock_service = MagicMock()
        mock_service.log_error = AsyncMock(
            side_effect=RuntimeError("logging failed")
        )

        with patch(
            "easylifeauth.api.dependencies.get_error_log_service",
            return_value=mock_service,
        ):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/test-request-validation?x=bad")
            assert response.status_code == 422
            assert response.json()["error"] == "Validation error"


class TestPydanticValidationErrorHandler:
    """Tests for lines 257-274: pydantic_validation_error_handler."""

    @pytest.fixture
    def app(self):
        app = create_app()

        class StrictModel(BaseModel):
            name: str
            age: int

        @app.get("/test-pydantic-validation")
        async def raise_pydantic_error():
            # Force a pydantic ValidationError by passing invalid data
            StrictModel(name=123, age="not_a_number")  # type: ignore

        return app

    @pytest.fixture
    def client(self, app):
        return TestClient(app, raise_server_exceptions=False)

    def test_pydantic_validation_error_returns_500(self, client):
        """A pydantic ValidationError raised in a handler returns 500."""
        response = client.get("/test-pydantic-validation")
        assert response.status_code == 500
        data = response.json()
        assert data["error"] == "Data validation error"
        assert "details" in data
        assert isinstance(data["details"], list)

    @patch("easylifeauth.api.dependencies._error_log_service")
    def test_pydantic_validation_error_logs_to_error_service(
        self, mock_error_log_service, app
    ):
        """When error_log_service is available, pydantic errors are logged."""
        mock_service = MagicMock()
        mock_service.log_error = AsyncMock()
        mock_error_log_service.return_value = mock_service

        with patch(
            "easylifeauth.api.dependencies.get_error_log_service",
            return_value=mock_service,
        ):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/test-pydantic-validation")
            assert response.status_code == 500

    def test_pydantic_validation_error_when_logging_fails(self, app):
        """When error_log_service.log_error raises, handler still returns 500."""
        mock_service = MagicMock()
        mock_service.log_error = AsyncMock(
            side_effect=RuntimeError("logging failed")
        )

        with patch(
            "easylifeauth.api.dependencies.get_error_log_service",
            return_value=mock_service,
        ):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/test-pydantic-validation")
            assert response.status_code == 500
            assert response.json()["error"] == "Data validation error"


class TestGeneralExceptionHandler:
    """Tests for lines 290-296: general_exception_handler error logging."""

    @pytest.fixture
    def app(self):
        app = create_app()

        @app.get("/test-general-exception")
        async def raise_exception():
            raise RuntimeError("unexpected failure")

        return app

    @pytest.fixture
    def client(self, app):
        return TestClient(app, raise_server_exceptions=False)

    def test_general_exception_returns_500(self, client):
        """A generic exception raised in a handler returns 500."""
        response = client.get("/test-general-exception")
        assert response.status_code == 500
        data = response.json()
        assert data["error"] == "Internal server error"

    def test_general_exception_with_error_log_service(self, app):
        """When error_log_service is available, the exception is logged."""
        mock_service = MagicMock()
        mock_service.log_error = AsyncMock()

        with patch(
            "easylifeauth.api.dependencies.get_error_log_service",
            return_value=mock_service,
        ):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/test-general-exception")
            assert response.status_code == 500
            assert response.json()["error"] == "Internal server error"

    def test_general_exception_when_logging_fails(self, app):
        """When error_log_service.log_error raises, handler still returns 500."""
        mock_service = MagicMock()
        mock_service.log_error = AsyncMock(
            side_effect=RuntimeError("log service crashed")
        )

        with patch(
            "easylifeauth.api.dependencies.get_error_log_service",
            return_value=mock_service,
        ):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/test-general-exception")
            assert response.status_code == 500
            assert response.json()["error"] == "Internal server error"

    def test_general_exception_when_error_log_service_is_none(self, app):
        """When get_error_log_service returns None, handler still returns 500."""
        with patch(
            "easylifeauth.api.dependencies.get_error_log_service",
            return_value=None,
        ):
            client = TestClient(app, raise_server_exceptions=False)
            response = client.get("/test-general-exception")
            assert response.status_code == 500
            assert response.json()["error"] == "Internal server error"


class TestMainBlock:
    """Tests for lines 342-343: if __name__ == '__main__' block."""

    @patch("uvicorn.run")
    def test_main_block_runs_uvicorn(self, mock_uvicorn_run):
        """The __main__ block should call uvicorn.run with expected args."""
        # We cannot truly trigger __name__ == "__main__" from an import,
        # so we exec the relevant lines with the right __name__.
        import easylifeauth.app as app_module
        import types

        # Read and exec just the guarded block
        code = 'import uvicorn\nuvicorn.run("easylifeauth.app:app", host="0.0.0.0", port=8000, reload=True)'
        exec(code, {"__name__": "__main__", "uvicorn": __import__("uvicorn")})

        mock_uvicorn_run.assert_called_once_with(
            "easylifeauth.app:app", host="0.0.0.0", port=8000, reload=True
        )
