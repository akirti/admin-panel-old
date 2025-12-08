"""Tests for Middleware modules"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi import FastAPI, Request, HTTPException
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

from easylifeauth.middleware.csrf import CSRFProtectMiddleware, get_csrf_token
from easylifeauth.middleware.rate_limit import RateLimitMiddleware
from easylifeauth.middleware.security import (
    SecurityHeadersMiddleware,
    RequestValidationMiddleware
)


class TestCSRFProtectMiddleware:
    """Tests for CSRF Protection Middleware"""

    @pytest.fixture
    def app_with_csrf(self):
        """Create FastAPI app with CSRF middleware"""
        app = FastAPI()
        app.add_middleware(
            CSRFProtectMiddleware,
            secret_key="test_secret_key_12345",
            cookie_secure=False,  # For testing without HTTPS
            exempt_paths={"/api/auth/login", "/api/auth/*"}
        )

        @app.get("/")
        async def root():
            return {"message": "hello"}

        @app.post("/api/data")
        async def post_data():
            return {"message": "data created"}

        @app.post("/api/auth/login")
        async def login():
            return {"message": "logged in"}

        @app.get("/health")
        async def health():
            return {"status": "ok"}

        return app

    def test_generate_token(self):
        """Test token generation"""
        middleware = CSRFProtectMiddleware(
            app=MagicMock(),
            secret_key="test_secret"
        )
        token = middleware._generate_token()
        assert token is not None
        assert len(token) > 20

    def test_sign_token(self):
        """Test token signing"""
        middleware = CSRFProtectMiddleware(
            app=MagicMock(),
            secret_key="test_secret"
        )
        token = "test_token"
        signed = middleware._sign_token(token)
        assert "." in signed
        assert signed.startswith("test_token.")

    def test_verify_valid_token(self):
        """Test verifying valid signed token"""
        middleware = CSRFProtectMiddleware(
            app=MagicMock(),
            secret_key="test_secret"
        )
        token = middleware._generate_token()
        signed = middleware._sign_token(token)
        assert middleware._verify_token(signed) is True

    def test_verify_invalid_token(self):
        """Test verifying invalid token"""
        middleware = CSRFProtectMiddleware(
            app=MagicMock(),
            secret_key="test_secret"
        )
        assert middleware._verify_token("invalid_token") is False

    def test_verify_tampered_token(self):
        """Test verifying tampered token"""
        middleware = CSRFProtectMiddleware(
            app=MagicMock(),
            secret_key="test_secret"
        )
        token = middleware._generate_token()
        signed = middleware._sign_token(token)
        tampered = signed + "extra"
        assert middleware._verify_token(tampered) is False

    def test_is_exempt_get_request(self):
        """Test GET requests are exempt"""
        middleware = CSRFProtectMiddleware(
            app=MagicMock(),
            secret_key="test_secret"
        )
        request = MagicMock()
        request.method = "GET"
        request.url.path = "/api/data"
        assert middleware._is_exempt(request) is True

    def test_is_exempt_options_request(self):
        """Test OPTIONS requests are exempt"""
        middleware = CSRFProtectMiddleware(
            app=MagicMock(),
            secret_key="test_secret"
        )
        request = MagicMock()
        request.method = "OPTIONS"
        request.url.path = "/api/data"
        assert middleware._is_exempt(request) is True

    def test_is_exempt_health_endpoint(self):
        """Test health endpoints are exempt"""
        middleware = CSRFProtectMiddleware(
            app=MagicMock(),
            secret_key="test_secret"
        )
        request = MagicMock()
        request.method = "POST"
        request.url.path = "/health"
        assert middleware._is_exempt(request) is True

    def test_is_exempt_docs_endpoint(self):
        """Test docs endpoints are exempt"""
        middleware = CSRFProtectMiddleware(
            app=MagicMock(),
            secret_key="test_secret"
        )
        request = MagicMock()
        request.method = "POST"
        request.url.path = "/docs"
        assert middleware._is_exempt(request) is True

    def test_is_exempt_custom_path(self):
        """Test custom exempt paths"""
        middleware = CSRFProtectMiddleware(
            app=MagicMock(),
            secret_key="test_secret",
            exempt_paths={"/api/exempt"}
        )
        request = MagicMock()
        request.method = "POST"
        request.url.path = "/api/exempt"
        assert middleware._is_exempt(request) is True

    def test_is_exempt_wildcard_path(self):
        """Test wildcard exempt paths"""
        middleware = CSRFProtectMiddleware(
            app=MagicMock(),
            secret_key="test_secret",
            exempt_paths={"/api/auth/*"}
        )
        request = MagicMock()
        request.method = "POST"
        request.url.path = "/api/auth/login"
        assert middleware._is_exempt(request) is True

    def test_is_not_exempt_post_request(self):
        """Test POST requests are not exempt by default"""
        middleware = CSRFProtectMiddleware(
            app=MagicMock(),
            secret_key="test_secret"
        )
        request = MagicMock()
        request.method = "POST"
        request.url.path = "/api/data"
        assert middleware._is_exempt(request) is False

    def test_get_request_sets_cookie(self, app_with_csrf):
        """Test GET request sets CSRF cookie"""
        client = TestClient(app_with_csrf)
        response = client.get("/")
        assert response.status_code == 200
        assert "csrf_token" in response.cookies

    @pytest.mark.asyncio
    async def test_dispatch_exempt_request(self):
        """Test dispatch for exempt request"""
        app = FastAPI()
        app.add_middleware(
            CSRFProtectMiddleware,
            secret_key="test_secret_key",
            cookie_secure=False
        )

        @app.get("/api/data")
        async def get_data():
            return {"message": "data"}

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/api/data")
            assert response.status_code == 200
            # CSRF cookie should be set on GET request
            assert "csrf_token" in response.cookies

    def test_exempt_path_no_token_needed(self, app_with_csrf):
        """Test exempt paths don't need CSRF token"""
        client = TestClient(app_with_csrf)
        response = client.post("/api/auth/login")
        assert response.status_code == 200

    def test_get_csrf_token_function(self):
        """Test get_csrf_token helper function"""
        request = MagicMock()
        request.cookies = {"csrf_token": "test_token_value"}
        token = get_csrf_token(request)
        assert token == "test_token_value"

    def test_get_csrf_token_missing(self):
        """Test get_csrf_token when token is missing"""
        request = MagicMock()
        request.cookies = {}
        token = get_csrf_token(request)
        assert token is None


class TestRateLimitMiddleware:
    """Tests for Rate Limit Middleware"""

    @pytest.fixture
    def app_with_rate_limit(self):
        """Create FastAPI app with rate limit middleware"""
        app = FastAPI()
        app.add_middleware(
            RateLimitMiddleware,
            requests_per_minute=5,
            requests_per_hour=100,
            auth_requests_per_minute=2,
            enabled=True
        )

        @app.get("/api/data")
        async def get_data():
            return {"message": "data"}

        @app.post("/api/auth/login")
        async def login():
            return {"message": "logged in"}

        @app.get("/health")
        async def health():
            return {"status": "ok"}

        return app

    def test_get_client_ip_forwarded(self):
        """Test getting IP from X-Forwarded-For header"""
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)
        request = MagicMock()
        request.headers = {"X-Forwarded-For": "192.168.1.1, 10.0.0.1"}
        assert middleware._get_client_ip(request) == "192.168.1.1"

    def test_get_client_ip_real_ip(self):
        """Test getting IP from X-Real-IP header"""
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)
        request = MagicMock()
        request.headers = {"X-Real-IP": "192.168.1.2"}
        assert middleware._get_client_ip(request) == "192.168.1.2"

    def test_get_client_ip_direct(self):
        """Test getting IP from client directly"""
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)
        request = MagicMock()
        request.headers = {}
        request.client.host = "192.168.1.3"
        assert middleware._get_client_ip(request) == "192.168.1.3"

    def test_get_client_ip_unknown(self):
        """Test getting IP when no client info available"""
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)
        request = MagicMock()
        request.headers = {}
        request.client = None
        assert middleware._get_client_ip(request) == "unknown"

    def test_rate_limit_disabled(self, app_with_rate_limit):
        """Test rate limiting can be disabled"""
        app = FastAPI()
        app.add_middleware(RateLimitMiddleware, enabled=False)

        @app.get("/api/data")
        async def get_data():
            return {"message": "data"}

        client = TestClient(app)
        # Should not be rate limited
        for _ in range(20):
            response = client.get("/api/data")
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_check_rate_limit(self):
        """Test rate limit check functionality"""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            requests_per_minute=2,
            enabled=True
        )

        # First two requests should pass
        await middleware._check_rate_limit("192.168.1.1", "/api/data")
        middleware.request_log["192.168.1.1"].append((datetime.utcnow(), "/api/data"))
        await middleware._check_rate_limit("192.168.1.1", "/api/data")
        middleware.request_log["192.168.1.1"].append((datetime.utcnow(), "/api/data"))

        # Third should fail
        with pytest.raises(HTTPException) as exc_info:
            await middleware._check_rate_limit("192.168.1.1", "/api/data")
        assert exc_info.value.status_code == 429

    @pytest.mark.asyncio
    async def test_check_rate_limit_auth_endpoint(self):
        """Test auth endpoints have stricter rate limits"""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            requests_per_minute=60,
            auth_requests_per_minute=1,
            enabled=True
        )

        # First auth request should pass
        await middleware._check_rate_limit("192.168.1.1", "/api/auth/login")
        middleware.request_log["192.168.1.1"].append((datetime.utcnow(), "/api/auth/login"))

        # Second should fail due to stricter auth limit
        with pytest.raises(HTTPException) as exc_info:
            await middleware._check_rate_limit("192.168.1.1", "/api/auth/login")
        assert exc_info.value.status_code == 429

    @pytest.mark.asyncio
    async def test_check_rate_limit_hour_limit(self):
        """Test hourly rate limit"""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            requests_per_minute=1000,
            requests_per_hour=2,
            enabled=True
        )

        # Fill up hour limit
        middleware.request_log["192.168.1.1"].append((datetime.utcnow(), "/api/data"))
        middleware.request_log["192.168.1.1"].append((datetime.utcnow(), "/api/data"))

        # Should fail hour limit
        with pytest.raises(HTTPException) as exc_info:
            await middleware._check_rate_limit("192.168.1.1", "/api/data")
        assert exc_info.value.status_code == 429
        assert "per hour" in exc_info.value.detail

    def test_exempt_paths_not_rate_limited(self, app_with_rate_limit):
        """Test exempt paths are not rate limited"""
        client = TestClient(app_with_rate_limit)
        for _ in range(20):
            response = client.get("/health")
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_remaining_requests(self):
        """Test getting remaining requests count"""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            requests_per_minute=10,
            auth_requests_per_minute=5,
            enabled=True
        )

        # No requests yet - should return full limit
        remaining = await middleware._get_remaining_requests("192.168.1.1", "/api/data")
        assert remaining == 10

        # For auth endpoint
        remaining = await middleware._get_remaining_requests("192.168.1.1", "/api/auth/login")
        assert remaining == 5

    def test_start_cleanup_task(self):
        """Test starting cleanup task"""
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)
        with patch('asyncio.create_task') as mock_create_task:
            middleware.start_cleanup_task()
            mock_create_task.assert_called_once()

    def test_stop_cleanup_task(self):
        """Test stopping cleanup task"""
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)
        mock_task = MagicMock()
        middleware._cleanup_task = mock_task
        middleware.stop_cleanup_task()
        mock_task.cancel.assert_called_once()
        assert middleware._cleanup_task is None


class TestSecurityHeadersMiddleware:
    """Tests for Security Headers Middleware"""

    @pytest.fixture
    def app_with_security(self):
        """Create FastAPI app with security headers middleware"""
        app = FastAPI()
        app.add_middleware(
            SecurityHeadersMiddleware,
            enable_hsts=True,
            enable_csp=True
        )

        @app.get("/")
        async def root():
            return {"message": "hello"}

        return app

    def test_x_frame_options_header(self, app_with_security):
        """Test X-Frame-Options header is set"""
        client = TestClient(app_with_security)
        response = client.get("/")
        assert response.headers.get("X-Frame-Options") == "DENY"

    def test_x_content_type_options_header(self, app_with_security):
        """Test X-Content-Type-Options header is set"""
        client = TestClient(app_with_security)
        response = client.get("/")
        assert response.headers.get("X-Content-Type-Options") == "nosniff"

    def test_x_xss_protection_header(self, app_with_security):
        """Test X-XSS-Protection header is set"""
        client = TestClient(app_with_security)
        response = client.get("/")
        assert response.headers.get("X-XSS-Protection") == "1; mode=block"

    def test_csp_header(self, app_with_security):
        """Test Content-Security-Policy header is set"""
        client = TestClient(app_with_security)
        response = client.get("/")
        assert "Content-Security-Policy" in response.headers
        assert "default-src 'self'" in response.headers.get("Content-Security-Policy")

    def test_referrer_policy_header(self, app_with_security):
        """Test Referrer-Policy header is set"""
        client = TestClient(app_with_security)
        response = client.get("/")
        assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"

    def test_permissions_policy_header(self, app_with_security):
        """Test Permissions-Policy header is set"""
        client = TestClient(app_with_security)
        response = client.get("/")
        assert "Permissions-Policy" in response.headers
        assert "geolocation=()" in response.headers.get("Permissions-Policy")

    def test_csp_disabled(self):
        """Test CSP can be disabled"""
        app = FastAPI()
        app.add_middleware(
            SecurityHeadersMiddleware,
            enable_csp=False
        )

        @app.get("/")
        async def root():
            return {"message": "hello"}

        client = TestClient(app)
        response = client.get("/")
        assert "Content-Security-Policy" not in response.headers

    def test_custom_csp_directives(self):
        """Test custom CSP directives"""
        app = FastAPI()
        app.add_middleware(
            SecurityHeadersMiddleware,
            enable_csp=True,
            csp_directives="default-src 'none';"
        )

        @app.get("/")
        async def root():
            return {"message": "hello"}

        client = TestClient(app)
        response = client.get("/")
        assert response.headers.get("Content-Security-Policy") == "default-src 'none';"


class TestRequestValidationMiddleware:
    """Tests for Request Validation Middleware"""

    @pytest.fixture
    def app_with_validation(self):
        """Create FastAPI app with request validation middleware"""
        app = FastAPI()
        app.add_middleware(
            RequestValidationMiddleware,
            max_body_size=1024  # 1KB for testing
        )

        @app.post("/api/data")
        async def post_data():
            return {"message": "data created"}

        return app

    def test_request_within_size_limit(self, app_with_validation):
        """Test request within size limit is allowed"""
        client = TestClient(app_with_validation)
        response = client.post(
            "/api/data",
            json={"key": "value"}
        )
        assert response.status_code == 200

    def test_request_exceeds_size_limit(self, app_with_validation):
        """Test request exceeding size limit is rejected"""
        client = TestClient(app_with_validation)
        large_data = {"data": "x" * 2000}  # > 1KB
        response = client.post(
            "/api/data",
            json=large_data
        )
        assert response.status_code == 413
        assert "too large" in response.text

    def test_get_request_allowed(self, app_with_validation):
        """Test GET requests are allowed regardless of validation"""
        app = FastAPI()
        app.add_middleware(RequestValidationMiddleware)

        @app.get("/api/data")
        async def get_data():
            return {"message": "data"}

        client = TestClient(app)
        response = client.get("/api/data")
        assert response.status_code == 200
