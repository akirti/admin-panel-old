"""Tests for ApigeeIdentityMiddleware."""
import socket
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from easylifeauth.middleware.apigee_identity import ApigeeIdentityMiddleware


@pytest.fixture
def app_default():
    """FastAPI app with ApigeeIdentityMiddleware using defaults."""
    app = FastAPI()
    app.add_middleware(ApigeeIdentityMiddleware)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.post("/data")
    async def post_data():
        return {"created": True}

    return app


@pytest.fixture
def app_custom_name():
    """FastAPI app with custom app_name."""
    app = FastAPI()
    app.add_middleware(ApigeeIdentityMiddleware, app_name="my-custom-app")

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


@pytest.fixture
def client_default(app_default):
    return TestClient(app_default)


@pytest.fixture
def client_custom(app_custom_name):
    return TestClient(app_custom_name)


class TestApigeeIdentityMiddleware:
    """Tests for Apigee identity response headers."""

    def test_default_app_name_header(self, client_default):
        response = client_default.get("/health")
        assert response.status_code == 200
        assert response.headers["X-App-Name"] == "easylife-admin-panel"

    def test_custom_app_name_header(self, client_custom):
        response = client_custom.get("/health")
        assert response.status_code == 200
        assert response.headers["X-App-Name"] == "my-custom-app"

    def test_hostname_header_present(self, client_default):
        response = client_default.get("/health")
        assert response.headers["X-Backend-Hostname"] == socket.gethostname()

    def test_headers_on_post_request(self, client_default):
        response = client_default.post("/data")
        assert response.status_code == 200
        assert "X-App-Name" in response.headers
        assert "X-Backend-Hostname" in response.headers

    def test_headers_on_404(self, client_default):
        response = client_default.get("/nonexistent")
        assert response.status_code == 404
        assert response.headers["X-App-Name"] == "easylife-admin-panel"
        assert "X-Backend-Hostname" in response.headers

    @patch("easylifeauth.middleware.apigee_identity.socket.gethostname",
           return_value="test-host-123")
    def test_hostname_from_socket(self, mock_gethostname):
        app = FastAPI()
        app.add_middleware(ApigeeIdentityMiddleware)

        @app.get("/ping")
        async def ping():
            return {"pong": True}

        client = TestClient(app)
        response = client.get("/ping")
        assert response.headers["X-Backend-Hostname"] == "test-host-123"
        mock_gethostname.assert_called_once()
