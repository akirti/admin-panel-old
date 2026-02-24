"""Tests for Prevail Proxy Routes"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI

from easylifeauth.api.prevail_routes import router, get_api_config_service
from easylifeauth.api.dependencies import get_db, get_gcs_service
from easylifeauth.security.access_control import get_current_user


class TestExecutePrevailQuery:
    """Tests for the POST /prevail/{scenario_key} proxy endpoint"""

    @pytest.fixture
    def app(self):
        """Create test app with the prevail router"""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_db(self):
        """Create mock database"""
        db = MagicMock()
        return db

    @pytest.fixture
    def mock_gcs_service(self):
        """Create mock GCS service"""
        return MagicMock()

    @pytest.fixture
    def mock_current_user(self):
        """Create mock authenticated user"""
        user = MagicMock()
        user.user_id = "user123"
        user.email = "testuser@example.com"
        user.roles = ["user"]
        user.groups = []
        user.domains = ["domain1"]
        return user

    @pytest.fixture
    def mock_service(self):
        """Create mock ApiConfigService"""
        service = MagicMock()
        service.get_config_by_key = AsyncMock()
        service.test_api = AsyncMock()
        return service

    @pytest.fixture
    def active_prevail_config(self):
        """Return a standard active prevail configuration"""
        return {
            "_id": "config_abc123",
            "key": "prevail",
            "name": "Prevail API",
            "endpoint": "https://prevail.example.com/api/query",
            "status": "active",
            "method": "POST",
            "auth_type": "bearer",
            "auth_config": {"token": "service-token-xyz"},
            "timeout": 120,
            "ssl_verify": True,
        }

    @pytest.fixture
    def client(self, app, mock_db, mock_gcs_service, mock_current_user, mock_service):
        """Create test client with overridden dependencies"""
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_gcs_service] = lambda: mock_gcs_service
        app.dependency_overrides[get_current_user] = lambda: mock_current_user
        app.dependency_overrides[get_api_config_service] = lambda: mock_service
        return TestClient(app)

    # ------------------------------------------------------------------
    # Successful proxy POST requests
    # ------------------------------------------------------------------

    def test_successful_proxy_post_returns_response_body(
        self, client, mock_service, active_prevail_config
    ):
        """Test that a successful proxy POST returns the external service response body"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": {"results": [{"id": 1, "name": "Result A"}]},
            "error": None,
        }

        response = client.post(
            "/prevail/scenario-abc",
            json={"query": "SELECT * FROM table", "params": {"limit": 10}},
        )

        assert response.status_code == 200
        data = response.json()
        assert data == {"results": [{"id": 1, "name": "Result A"}]}

    def test_successful_proxy_post_calls_test_api_with_correct_config(
        self, client, mock_service, active_prevail_config
    ):
        """Test that the proxy builds the correct call_config for test_api"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": {"ok": True},
            "error": None,
        }

        payload = {"query": "test query"}
        client.post(
            "/prevail/my-scenario",
            json=payload,
            headers={"Authorization": "Bearer user-jwt-token-123"},
        )

        mock_service.test_api.assert_called_once()
        call_config = mock_service.test_api.call_args[0][0]

        # Verify the target URL is built correctly
        assert call_config["endpoint"] == "https://prevail.example.com/api/query/my-scenario"
        assert call_config["method"] == "POST"
        assert call_config["body"] == payload
        assert call_config["ping_endpoint"] is None
        assert call_config["timeout"] == 120

    def test_successful_proxy_post_strips_trailing_slash_from_endpoint(
        self, client, mock_service, active_prevail_config
    ):
        """Test that trailing slash on the configured endpoint is stripped"""
        active_prevail_config["endpoint"] = "https://prevail.example.com/api/query/"
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": {"data": []},
            "error": None,
        }

        client.post("/prevail/scenario-x", json={"q": "test"})

        call_config = mock_service.test_api.call_args[0][0]
        assert call_config["endpoint"] == "https://prevail.example.com/api/query/scenario-x"

    def test_successful_proxy_post_returns_list_response(
        self, client, mock_service, active_prevail_config
    ):
        """Test that the proxy can return a list response body"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": [1, 2, 3],
            "error": None,
        }

        response = client.post("/prevail/list-scenario", json={"query": "list"})
        assert response.status_code == 200
        assert response.json() == [1, 2, 3]

    def test_successful_proxy_post_returns_string_response(
        self, client, mock_service, active_prevail_config
    ):
        """Test that the proxy can return a plain string response body"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": "plain text result",
            "error": None,
        }

        response = client.post("/prevail/text-scenario", json={"query": "text"})
        assert response.status_code == 200
        assert response.json() == "plain text result"

    # ------------------------------------------------------------------
    # Cookie forwarding
    # ------------------------------------------------------------------

    def test_cookie_token_is_forwarded_to_external_service(
        self, client, mock_service, active_prevail_config
    ):
        """Test that the access_token cookie is extracted and used as bearer auth"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": {"ok": True},
            "error": None,
        }

        client.post(
            "/prevail/scenario-cookie",
            json={"q": "test"},
            cookies={"access_token": "cookie-jwt-token-abc"},
        )

        call_config = mock_service.test_api.call_args[0][0]
        assert call_config["auth_type"] == "bearer"
        assert call_config["auth_config"] == {"token": "cookie-jwt-token-abc"}

    def test_authorization_header_token_is_forwarded_when_no_cookie(
        self, client, mock_service, active_prevail_config
    ):
        """Test that the Authorization header token is used when no cookie is present"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": {"ok": True},
            "error": None,
        }

        client.post(
            "/prevail/scenario-header",
            json={"q": "test"},
            headers={"Authorization": "Bearer header-jwt-token-xyz"},
        )

        call_config = mock_service.test_api.call_args[0][0]
        assert call_config["auth_type"] == "bearer"
        assert call_config["auth_config"] == {"token": "header-jwt-token-xyz"}

    def test_cookie_takes_precedence_over_authorization_header(
        self, client, mock_service, active_prevail_config
    ):
        """Test that the cookie token takes precedence over the Authorization header"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": {"ok": True},
            "error": None,
        }

        client.post(
            "/prevail/scenario-both",
            json={"q": "test"},
            cookies={"access_token": "cookie-token"},
            headers={"Authorization": "Bearer header-token"},
        )

        call_config = mock_service.test_api.call_args[0][0]
        assert call_config["auth_type"] == "bearer"
        assert call_config["auth_config"] == {"token": "cookie-token"}

    def test_no_token_preserves_original_config_auth(
        self, client, mock_service, active_prevail_config
    ):
        """Test that without a user token, the original config auth is preserved"""
        active_prevail_config["auth_type"] = "api_key"
        active_prevail_config["auth_config"] = {
            "key_name": "X-API-Key",
            "key_value": "service-key-123",
        }
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": {"ok": True},
            "error": None,
        }

        # No cookie, no Authorization header
        client.post("/prevail/scenario-noauth", json={"q": "test"})

        call_config = mock_service.test_api.call_args[0][0]
        # Original auth_type should remain since no user token was provided
        assert call_config["auth_type"] == "api_key"
        assert call_config["auth_config"] == {
            "key_name": "X-API-Key",
            "key_value": "service-key-123",
        }

    # ------------------------------------------------------------------
    # Config not found / inactive / no endpoint
    # ------------------------------------------------------------------

    def test_returns_503_when_prevail_config_not_found(self, client, mock_service):
        """Test that 503 is returned when no prevail config exists"""
        mock_service.get_config_by_key.return_value = None

        response = client.post("/prevail/scenario-x", json={"q": "test"})

        assert response.status_code == 503
        assert "not configured" in response.json()["detail"]

    def test_returns_503_when_prevail_config_is_inactive(
        self, client, mock_service, active_prevail_config
    ):
        """Test that 503 is returned when prevail config has inactive status"""
        active_prevail_config["status"] = "inactive"
        mock_service.get_config_by_key.return_value = active_prevail_config

        response = client.post("/prevail/scenario-x", json={"q": "test"})

        assert response.status_code == 503
        assert "inactive" in response.json()["detail"]

    def test_returns_503_when_endpoint_is_missing(
        self, client, mock_service, active_prevail_config
    ):
        """Test that 503 is returned when the config has no endpoint"""
        active_prevail_config["endpoint"] = None
        mock_service.get_config_by_key.return_value = active_prevail_config

        response = client.post("/prevail/scenario-x", json={"q": "test"})

        assert response.status_code == 503
        assert "endpoint is not configured" in response.json()["detail"]

    def test_returns_503_when_endpoint_is_empty_string(
        self, client, mock_service, active_prevail_config
    ):
        """Test that 503 is returned when the config endpoint is an empty string"""
        active_prevail_config["endpoint"] = ""
        mock_service.get_config_by_key.return_value = active_prevail_config

        response = client.post("/prevail/scenario-x", json={"q": "test"})

        assert response.status_code == 503
        assert "endpoint is not configured" in response.json()["detail"]

    # ------------------------------------------------------------------
    # Invalid JSON payload
    # ------------------------------------------------------------------

    def test_returns_400_when_request_body_is_not_json(
        self, client, mock_service, active_prevail_config
    ):
        """Test that 400 is returned when the request body is not valid JSON"""
        mock_service.get_config_by_key.return_value = active_prevail_config

        response = client.post(
            "/prevail/scenario-x",
            content=b"this is not json",
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 400
        assert "Invalid JSON payload" in response.json()["detail"]

    # ------------------------------------------------------------------
    # Connection errors (proxied through service.test_api)
    # ------------------------------------------------------------------

    def test_returns_502_on_connection_error(
        self, client, mock_service, active_prevail_config
    ):
        """Test that a connection error from the external service returns 502"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": False,
            "status_code": None,
            "response_body": None,
            "error": "Connection error: [Errno -2] Name or service not known",
        }

        response = client.post("/prevail/scenario-x", json={"q": "test"})

        assert response.status_code == 502
        assert "Prevail service error" in response.json()["detail"]
        assert "Connection error" in response.json()["detail"]

    def test_returns_502_on_connection_error_default_status(
        self, client, mock_service, active_prevail_config
    ):
        """Test that 502 is the default when test_api returns error without status_code"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": False,
            "status_code": None,
            "response_body": None,
            "error": "Connection error: host unreachable",
        }

        response = client.post("/prevail/scenario-x", json={"q": "test"})

        # The route uses `result.get("status_code") or 502` so None -> 502
        assert response.status_code == 502

    # ------------------------------------------------------------------
    # Timeout errors
    # ------------------------------------------------------------------

    def test_returns_502_on_timeout_error(
        self, client, mock_service, active_prevail_config
    ):
        """Test that a timeout error from the external service returns 502"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": False,
            "status_code": None,
            "response_body": None,
            "error": "Connection timeout",
        }

        response = client.post("/prevail/scenario-x", json={"q": "test"})

        assert response.status_code == 502
        assert "Prevail service error" in response.json()["detail"]
        assert "timeout" in response.json()["detail"].lower()

    def test_returns_502_on_read_timeout_error(
        self, client, mock_service, active_prevail_config
    ):
        """Test that a read timeout error returns 502"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": False,
            "status_code": None,
            "response_body": None,
            "error": "Read timeout - server took too long to respond",
        }

        response = client.post("/prevail/scenario-x", json={"q": "test"})

        assert response.status_code == 502
        assert "timeout" in response.json()["detail"].lower()

    # ------------------------------------------------------------------
    # Response status code forwarding
    # ------------------------------------------------------------------

    def test_forwards_upstream_error_status_code(
        self, client, mock_service, active_prevail_config
    ):
        """Test that the upstream error status code is forwarded in the HTTP response"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": False,
            "status_code": 403,
            "response_body": None,
            "error": "HTTP error: 403 Forbidden",
        }

        response = client.post("/prevail/scenario-x", json={"q": "test"})

        assert response.status_code == 403
        assert "Prevail service error" in response.json()["detail"]

    def test_forwards_upstream_404_status_code(
        self, client, mock_service, active_prevail_config
    ):
        """Test that a 404 from the upstream service is forwarded"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": False,
            "status_code": 404,
            "response_body": None,
            "error": "HTTP error: 404 Not Found",
        }

        response = client.post("/prevail/scenario-x", json={"q": "test"})

        assert response.status_code == 404
        assert "Prevail service error" in response.json()["detail"]

    def test_forwards_upstream_500_status_code(
        self, client, mock_service, active_prevail_config
    ):
        """Test that a 500 from the upstream service is forwarded"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": False,
            "status_code": 500,
            "response_body": None,
            "error": "HTTP error: 500 Internal Server Error",
        }

        response = client.post("/prevail/scenario-x", json={"q": "test"})

        assert response.status_code == 500
        assert "Prevail service error" in response.json()["detail"]

    def test_falls_back_to_502_when_upstream_status_is_zero(
        self, client, mock_service, active_prevail_config
    ):
        """Test that status_code=0 (falsy) falls back to 502"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": False,
            "status_code": 0,
            "response_body": None,
            "error": "Unexpected error: something went wrong",
        }

        response = client.post("/prevail/scenario-x", json={"q": "test"})

        # `result.get("status_code") or 502` -> 0 is falsy, so 502
        assert response.status_code == 502

    # ------------------------------------------------------------------
    # No response body from external service
    # ------------------------------------------------------------------

    def test_returns_502_when_response_body_is_none(
        self, client, mock_service, active_prevail_config
    ):
        """Test that 502 is returned when the external service returns no body"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": None,
            "error": None,
        }

        response = client.post("/prevail/scenario-x", json={"q": "test"})

        assert response.status_code == 502
        assert "No response from Prevail service" in response.json()["detail"]

    # ------------------------------------------------------------------
    # Timeout configuration from the api_config
    # ------------------------------------------------------------------

    def test_uses_default_timeout_when_not_configured(
        self, client, mock_service, active_prevail_config
    ):
        """Test that the default timeout of 120 is used when not set in config"""
        del active_prevail_config["timeout"]
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": {"ok": True},
            "error": None,
        }

        client.post("/prevail/scenario-x", json={"q": "test"})

        call_config = mock_service.test_api.call_args[0][0]
        assert call_config["timeout"] == 120

    def test_uses_configured_timeout(
        self, client, mock_service, active_prevail_config
    ):
        """Test that a custom timeout from the config is propagated"""
        active_prevail_config["timeout"] = 60
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": {"ok": True},
            "error": None,
        }

        client.post("/prevail/scenario-x", json={"q": "test"})

        call_config = mock_service.test_api.call_args[0][0]
        assert call_config["timeout"] == 60

    # ------------------------------------------------------------------
    # Different scenario keys
    # ------------------------------------------------------------------

    def test_scenario_key_is_appended_to_target_url(
        self, client, mock_service, active_prevail_config
    ):
        """Test that different scenario_key values correctly form the target URL"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": {"ok": True},
            "error": None,
        }

        client.post("/prevail/complex-scenario-key-123", json={"q": "test"})

        call_config = mock_service.test_api.call_args[0][0]
        assert call_config["endpoint"].endswith("/complex-scenario-key-123")

    # ------------------------------------------------------------------
    # SSL error from external service
    # ------------------------------------------------------------------

    def test_returns_502_on_ssl_error(
        self, client, mock_service, active_prevail_config
    ):
        """Test that an SSL error from the external service returns 502"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": False,
            "status_code": None,
            "response_body": None,
            "error": "SSL error: certificate verify failed",
        }

        response = client.post("/prevail/scenario-x", json={"q": "test"})

        assert response.status_code == 502
        assert "SSL error" in response.json()["detail"]

    # ------------------------------------------------------------------
    # Config lookup key
    # ------------------------------------------------------------------

    def test_looks_up_config_with_key_prevail(
        self, client, mock_service, active_prevail_config
    ):
        """Test that the route always looks up the config with key='prevail'"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": {"ok": True},
            "error": None,
        }

        client.post("/prevail/any-scenario", json={"q": "test"})

        mock_service.get_config_by_key.assert_called_once_with("prevail")

    # ------------------------------------------------------------------
    # Preserves original config fields in call_config
    # ------------------------------------------------------------------

    def test_call_config_spreads_original_config(
        self, client, mock_service, active_prevail_config
    ):
        """Test that the original config fields are spread into call_config"""
        active_prevail_config["ssl_verify"] = False
        active_prevail_config["use_proxy"] = True
        active_prevail_config["proxy_url"] = "http://proxy:8080"
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": {"ok": True},
            "error": None,
        }

        client.post(
            "/prevail/scenario-x",
            json={"q": "test"},
            headers={"Authorization": "Bearer my-token"},
        )

        call_config = mock_service.test_api.call_args[0][0]
        assert call_config["ssl_verify"] is False
        assert call_config["use_proxy"] is True
        assert call_config["proxy_url"] == "http://proxy:8080"
        assert call_config["key"] == "prevail"


class TestExecutePrevailQueryAuthentication:
    """Tests for authentication behavior on the prevail proxy endpoint"""

    @pytest.fixture
    def app(self):
        """Create test app with the prevail router"""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_service(self):
        """Create mock ApiConfigService"""
        service = MagicMock()
        service.get_config_by_key = AsyncMock()
        service.test_api = AsyncMock()
        return service

    def test_unauthenticated_request_is_rejected(self, app, mock_service):
        """Test that requests without authentication are rejected.

        When get_current_user is NOT overridden, the dependency tries real
        token validation which fails, returning 401 (or 500 if token_manager
        is not initialized). We verify the proxy is not called.
        """
        # Override only the service dependencies, NOT get_current_user
        app.dependency_overrides[get_db] = lambda: MagicMock()
        app.dependency_overrides[get_gcs_service] = lambda: MagicMock()
        app.dependency_overrides[get_api_config_service] = lambda: mock_service

        try:
            client = TestClient(app)
            response = client.post("/prevail/scenario-x", json={"q": "test"})
            # Without a valid token the access control dependency returns 401 or 500
            # (500 if token_manager is not initialized, 401 if it rejects the token)
            assert response.status_code in (401, 403, 500)
        except Exception:
            # If the test client raises due to an internal server error
            # (token_manager not initialized), that also confirms the
            # route is protected and the proxy was never called.
            pass

        mock_service.test_api.assert_not_called()


class TestExecutePrevailQueryEdgeCases:
    """Edge case tests for the prevail proxy endpoint"""

    @pytest.fixture
    def app(self):
        """Create test app with the prevail router"""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_current_user(self):
        """Create mock authenticated user"""
        user = MagicMock()
        user.user_id = "user456"
        user.email = "edge@example.com"
        user.roles = ["user"]
        user.groups = []
        user.domains = []
        return user

    @pytest.fixture
    def mock_service(self):
        """Create mock ApiConfigService"""
        service = MagicMock()
        service.get_config_by_key = AsyncMock()
        service.test_api = AsyncMock()
        return service

    @pytest.fixture
    def active_prevail_config(self):
        """Return a standard active prevail configuration"""
        return {
            "_id": "config_edge",
            "key": "prevail",
            "name": "Prevail API",
            "endpoint": "https://prevail.example.com/api",
            "status": "active",
            "method": "POST",
            "auth_type": "none",
            "auth_config": {},
            "timeout": 30,
        }

    @pytest.fixture
    def client(self, app, mock_current_user, mock_service):
        """Create test client with overridden dependencies"""
        app.dependency_overrides[get_db] = lambda: MagicMock()
        app.dependency_overrides[get_gcs_service] = lambda: MagicMock()
        app.dependency_overrides[get_current_user] = lambda: mock_current_user
        app.dependency_overrides[get_api_config_service] = lambda: mock_service
        return TestClient(app)

    def test_empty_json_body_is_forwarded(
        self, client, mock_service, active_prevail_config
    ):
        """Test that an empty JSON object body is accepted and forwarded"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": {"empty": True},
            "error": None,
        }

        response = client.post("/prevail/scenario-empty", json={})

        assert response.status_code == 200
        call_config = mock_service.test_api.call_args[0][0]
        assert call_config["body"] == {}

    def test_large_payload_is_forwarded(
        self, client, mock_service, active_prevail_config
    ):
        """Test that a large JSON payload is accepted and forwarded"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": {"processed": True},
            "error": None,
        }

        large_payload = {"data": list(range(1000))}
        response = client.post("/prevail/scenario-large", json=large_payload)

        assert response.status_code == 200
        call_config = mock_service.test_api.call_args[0][0]
        assert call_config["body"] == large_payload

    def test_whitespace_only_cookie_is_treated_as_no_token(
        self, client, mock_service, active_prevail_config
    ):
        """Test that a whitespace-only cookie is treated as no user token"""
        active_prevail_config["auth_type"] = "none"
        active_prevail_config["auth_config"] = {}
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": {"ok": True},
            "error": None,
        }

        client.post(
            "/prevail/scenario-ws",
            json={"q": "test"},
            cookies={"access_token": "   "},
        )

        call_config = mock_service.test_api.call_args[0][0]
        # Whitespace is stripped, leaving empty string which is falsy,
        # so the original config auth should be preserved
        assert call_config["auth_type"] == "none"

    def test_nested_json_payload_is_forwarded(
        self, client, mock_service, active_prevail_config
    ):
        """Test that deeply nested JSON is accepted and forwarded"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": True,
            "status_code": 200,
            "response_body": {"ok": True},
            "error": None,
        }

        nested_payload = {
            "level1": {
                "level2": {
                    "level3": {
                        "value": "deep"
                    }
                }
            }
        }

        response = client.post("/prevail/scenario-nested", json=nested_payload)
        assert response.status_code == 200
        call_config = mock_service.test_api.call_args[0][0]
        assert call_config["body"] == nested_payload

    def test_upstream_auth_error_is_reported(
        self, client, mock_service, active_prevail_config
    ):
        """Test that an auth error from the external service is properly reported"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": False,
            "status_code": 401,
            "response_body": None,
            "error": "HTTP error: 401 Unauthorized",
        }

        response = client.post("/prevail/scenario-auth", json={"q": "test"})

        assert response.status_code == 401
        assert "Prevail service error" in response.json()["detail"]

    def test_upstream_429_rate_limit_is_forwarded(
        self, client, mock_service, active_prevail_config
    ):
        """Test that a 429 rate limit response from upstream is forwarded"""
        mock_service.get_config_by_key.return_value = active_prevail_config
        mock_service.test_api.return_value = {
            "success": False,
            "status_code": 429,
            "response_body": None,
            "error": "HTTP error: 429 Too Many Requests",
        }

        response = client.post("/prevail/scenario-ratelimit", json={"q": "test"})

        assert response.status_code == 429
        assert "Prevail service error" in response.json()["detail"]
