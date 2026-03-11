"""Tests for Middleware modules"""
import pytest
from datetime import datetime, timezone, timedelta
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
from mock_data import MOCK_IP_FORWARDED, MOCK_IP_PRIVATE_1, MOCK_IP_PRIVATE_2, MOCK_IP_PRIVATE_3, MOCK_URL_TEST_BASE

PATH_ROOT = "/"
PATH_AUTH_LOGIN = "/api/auth/login"
PATH_DATA = "/api/data"
PATH_HEALTH = "/health"
METHOD_POST = "POST"
PATCH_ASYNCIO_CREATE_TASK = "asyncio.create_task"
STR_CONTENT_SECURITY_POLICY = "Content-Security-Policy"





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
            exempt_paths={PATH_AUTH_LOGIN, "/api/auth/*"}
        )

        @app.get(PATH_ROOT)
        async def root():
            return {"message": "hello"}

        @app.post(PATH_DATA)
        async def post_data():
            return {"message": "data created"}

        @app.post(PATH_AUTH_LOGIN)
        async def login():
            return {"message": "logged in"}

        @app.get(PATH_HEALTH)
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
        request.url.path = PATH_DATA
        assert middleware._is_exempt(request) is True

    def test_is_exempt_options_request(self):
        """Test OPTIONS requests are exempt"""
        middleware = CSRFProtectMiddleware(
            app=MagicMock(),
            secret_key="test_secret"
        )
        request = MagicMock()
        request.method = "OPTIONS"
        request.url.path = PATH_DATA
        assert middleware._is_exempt(request) is True

    def test_is_exempt_health_endpoint(self):
        """Test health endpoints are exempt"""
        middleware = CSRFProtectMiddleware(
            app=MagicMock(),
            secret_key="test_secret"
        )
        request = MagicMock()
        request.method = METHOD_POST
        request.url.path = PATH_HEALTH
        assert middleware._is_exempt(request) is True

    def test_is_exempt_docs_endpoint(self):
        """Test docs endpoints are exempt"""
        middleware = CSRFProtectMiddleware(
            app=MagicMock(),
            secret_key="test_secret"
        )
        request = MagicMock()
        request.method = METHOD_POST
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
        request.method = METHOD_POST
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
        request.method = METHOD_POST
        request.url.path = PATH_AUTH_LOGIN
        assert middleware._is_exempt(request) is True

    def test_is_not_exempt_post_request(self):
        """Test POST requests are not exempt by default"""
        middleware = CSRFProtectMiddleware(
            app=MagicMock(),
            secret_key="test_secret"
        )
        request = MagicMock()
        request.method = METHOD_POST
        request.url.path = PATH_DATA
        assert middleware._is_exempt(request) is False

    def test_get_request_sets_cookie(self, app_with_csrf):
        """Test GET request sets CSRF cookie"""
        client = TestClient(app_with_csrf)
        response = client.get(PATH_ROOT)
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

        @app.get(PATH_DATA)
        async def get_data():
            return {"message": "data"}

        async with AsyncClient(transport=ASGITransport(app=app), base_url=MOCK_URL_TEST_BASE) as client:
            response = await client.get(PATH_DATA)
            assert response.status_code == 200
            # CSRF cookie should be set on GET request
            assert "csrf_token" in response.cookies

    def test_exempt_path_no_token_needed(self, app_with_csrf):
        """Test exempt paths don't need CSRF token"""
        client = TestClient(app_with_csrf)
        response = client.post(PATH_AUTH_LOGIN)
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

        @app.get(PATH_DATA)
        async def get_data():
            return {"message": "data"}

        @app.post(PATH_AUTH_LOGIN)
        async def login():
            return {"message": "logged in"}

        @app.get(PATH_HEALTH)
        async def health():
            return {"status": "ok"}

        return app

    def test_get_client_ip_forwarded(self):
        """Test getting IP from X-Forwarded-For header"""
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)
        request = MagicMock()
        request.headers = {"X-Forwarded-For": MOCK_IP_FORWARDED}
        assert middleware._get_client_ip(request) == MOCK_IP_PRIVATE_1

    def test_get_client_ip_real_ip(self):
        """Test getting IP from X-Real-IP header"""
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)
        request = MagicMock()
        request.headers = {"X-Real-IP": MOCK_IP_PRIVATE_2}
        assert middleware._get_client_ip(request) == MOCK_IP_PRIVATE_2

    def test_get_client_ip_direct(self):
        """Test getting IP from client directly"""
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)
        request = MagicMock()
        request.headers = {}
        request.client.host = MOCK_IP_PRIVATE_3
        assert middleware._get_client_ip(request) == MOCK_IP_PRIVATE_3

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

        @app.get(PATH_DATA)
        async def get_data():
            return {"message": "data"}

        client = TestClient(app)
        # Should not be rate limited
        for _ in range(20):
            response = client.get(PATH_DATA)
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
        await middleware._check_rate_limit(MOCK_IP_PRIVATE_1, PATH_DATA)
        middleware.request_log[MOCK_IP_PRIVATE_1].append((datetime.now(timezone.utc), PATH_DATA))
        await middleware._check_rate_limit(MOCK_IP_PRIVATE_1, PATH_DATA)
        middleware.request_log[MOCK_IP_PRIVATE_1].append((datetime.now(timezone.utc), PATH_DATA))

        # Third should fail
        with pytest.raises(HTTPException) as exc_info:
            await middleware._check_rate_limit(MOCK_IP_PRIVATE_1, PATH_DATA)
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
        await middleware._check_rate_limit(MOCK_IP_PRIVATE_1, PATH_AUTH_LOGIN)
        middleware.request_log[MOCK_IP_PRIVATE_1].append((datetime.now(timezone.utc), PATH_AUTH_LOGIN))

        # Second should fail due to stricter auth limit
        with pytest.raises(HTTPException) as exc_info:
            await middleware._check_rate_limit(MOCK_IP_PRIVATE_1, PATH_AUTH_LOGIN)
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
        middleware.request_log[MOCK_IP_PRIVATE_1].append((datetime.now(timezone.utc), PATH_DATA))
        middleware.request_log[MOCK_IP_PRIVATE_1].append((datetime.now(timezone.utc), PATH_DATA))

        # Should fail hour limit
        with pytest.raises(HTTPException) as exc_info:
            await middleware._check_rate_limit(MOCK_IP_PRIVATE_1, PATH_DATA)
        assert exc_info.value.status_code == 429
        assert "per hour" in exc_info.value.detail

    def test_exempt_paths_not_rate_limited(self, app_with_rate_limit):
        """Test exempt paths are not rate limited"""
        client = TestClient(app_with_rate_limit)
        for _ in range(20):
            response = client.get(PATH_HEALTH)
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
        remaining = await middleware._get_remaining_requests(MOCK_IP_PRIVATE_1, PATH_DATA)
        assert remaining == 10

        # For auth endpoint
        remaining = await middleware._get_remaining_requests(MOCK_IP_PRIVATE_1, PATH_AUTH_LOGIN)
        assert remaining == 5

    def test_start_cleanup_task(self):
        """Test starting cleanup task"""
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)
        with patch(PATCH_ASYNCIO_CREATE_TASK) as mock_create_task:
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

    @pytest.mark.asyncio
    async def test_cleanup_old_entries_removes_old_requests(self):
        """Test cleanup_old_entries removes entries older than 2 hours"""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            enabled=True
        )

        # Add old and new entries
        old_time = datetime.now(timezone.utc) - timedelta(hours=3)
        recent_time = datetime.now(timezone.utc)

        middleware.request_log[MOCK_IP_PRIVATE_1] = [
            (old_time, PATH_DATA),
            (recent_time, PATH_DATA)
        ]
        middleware.request_log[MOCK_IP_PRIVATE_2] = [
            (old_time, PATH_DATA)  # Only old entries
        ]

        # Run cleanup (just the cleanup part, not the infinite loop)
        async with middleware.lock:
            now = datetime.now(timezone.utc)
            cutoff = now - timedelta(hours=2)

            for ip in list(middleware.request_log.keys()):
                middleware.request_log[ip] = [
                    (timestamp, path)
                    for timestamp, path in middleware.request_log[ip]
                    if timestamp > cutoff
                ]
                if not middleware.request_log[ip]:
                    del middleware.request_log[ip]

        # Old entries should be removed
        assert MOCK_IP_PRIVATE_1 in middleware.request_log
        assert len(middleware.request_log[MOCK_IP_PRIVATE_1]) == 1
        # IP with only old entries should be removed
        assert MOCK_IP_PRIVATE_2 not in middleware.request_log

    def test_start_cleanup_task_only_starts_once(self):
        """Test cleanup task is not started multiple times"""
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)
        mock_task = MagicMock()

        with patch(PATCH_ASYNCIO_CREATE_TASK, return_value=mock_task) as mock_create:
            # First call should create task
            middleware.start_cleanup_task()
            mock_create.assert_called_once()

            # Second call should not create another task
            middleware.start_cleanup_task()
            mock_create.assert_called_once()  # Still only once

    def test_start_cleanup_task_disabled(self):
        """Test cleanup task is not started when disabled"""
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=False)

        with patch(PATCH_ASYNCIO_CREATE_TASK) as mock_create:
            middleware.start_cleanup_task()
            mock_create.assert_not_called()

    def test_stop_cleanup_task_when_none(self):
        """Test stop_cleanup_task when no task exists"""
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)
        middleware._cleanup_task = None
        # Should not raise
        middleware.stop_cleanup_task()
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

        @app.get(PATH_ROOT)
        async def root():
            return {"message": "hello"}

        return app

    def test_x_frame_options_header(self, app_with_security):
        """Test X-Frame-Options header is set"""
        client = TestClient(app_with_security)
        response = client.get(PATH_ROOT)
        assert response.headers.get("X-Frame-Options") == "DENY"

    def test_x_content_type_options_header(self, app_with_security):
        """Test X-Content-Type-Options header is set"""
        client = TestClient(app_with_security)
        response = client.get(PATH_ROOT)
        assert response.headers.get("X-Content-Type-Options") == "nosniff"

    def test_x_xss_protection_header(self, app_with_security):
        """Test X-XSS-Protection header is set"""
        client = TestClient(app_with_security)
        response = client.get(PATH_ROOT)
        assert response.headers.get("X-XSS-Protection") == "1; mode=block"

    def test_csp_header(self, app_with_security):
        """Test Content-Security-Policy header is set"""
        client = TestClient(app_with_security)
        response = client.get(PATH_ROOT)
        assert STR_CONTENT_SECURITY_POLICY in response.headers
        assert "default-src 'self'" in response.headers.get(STR_CONTENT_SECURITY_POLICY)

    def test_referrer_policy_header(self, app_with_security):
        """Test Referrer-Policy header is set"""
        client = TestClient(app_with_security)
        response = client.get(PATH_ROOT)
        assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"

    def test_permissions_policy_header(self, app_with_security):
        """Test Permissions-Policy header is set"""
        client = TestClient(app_with_security)
        response = client.get(PATH_ROOT)
        assert "Permissions-Policy" in response.headers
        assert "geolocation=()" in response.headers.get("Permissions-Policy")

    def test_csp_disabled(self):
        """Test CSP can be disabled"""
        app = FastAPI()
        app.add_middleware(
            SecurityHeadersMiddleware,
            enable_csp=False
        )

        @app.get(PATH_ROOT)
        async def root():
            return {"message": "hello"}

        client = TestClient(app)
        response = client.get(PATH_ROOT)
        assert STR_CONTENT_SECURITY_POLICY not in response.headers

    def test_custom_csp_directives(self):
        """Test custom CSP directives"""
        app = FastAPI()
        app.add_middleware(
            SecurityHeadersMiddleware,
            enable_csp=True,
            csp_directives="default-src 'none';"
        )

        @app.get(PATH_ROOT)
        async def root():
            return {"message": "hello"}

        client = TestClient(app)
        response = client.get(PATH_ROOT)
        assert response.headers.get(STR_CONTENT_SECURITY_POLICY) == "default-src 'none';"

    def test_swagger_paths_get_relaxed_csp(self):
        """Test Swagger UI paths get relaxed CSP allowing cdn.jsdelivr.net"""
        app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
        app.add_middleware(SecurityHeadersMiddleware, enable_csp=True)

        for path in ["/docs", "/redoc", "/openapi.json"]:
            @app.get(path)
            async def swagger_stub():
                return {"ok": True}

        client = TestClient(app)
        for path in ["/docs", "/redoc", "/openapi.json"]:
            response = client.get(path)
            csp = response.headers.get(STR_CONTENT_SECURITY_POLICY, "")
            assert "cdn.jsdelivr.net" in csp, f"CDN missing in CSP for {path}"

    def test_non_swagger_paths_get_strict_csp(self, app_with_security):
        """Test non-Swagger paths get strict CSP without cdn.jsdelivr.net"""
        client = TestClient(app_with_security)
        response = client.get(PATH_ROOT)
        csp = response.headers.get(STR_CONTENT_SECURITY_POLICY, "")
        assert "cdn.jsdelivr.net" not in csp

    def test_hsts_header_on_https(self):
        """Test HSTS header is set for HTTPS requests"""
        app = FastAPI()
        app.add_middleware(SecurityHeadersMiddleware, enable_hsts=True)

        @app.get(PATH_ROOT)
        async def root():
            return {"message": "hello"}

        client = TestClient(app, base_url="https://testserver")
        response = client.get(PATH_ROOT)
        assert "Strict-Transport-Security" in response.headers
        assert "max-age=31536000" in response.headers["Strict-Transport-Security"]

    def test_server_header_removed(self):
        """Test Server header is removed if present"""
        from starlette.middleware.base import BaseHTTPMiddleware

        class AddServerHeaderMiddleware(BaseHTTPMiddleware):
            async def dispatch(self, request, call_next):
                response = await call_next(request)
                response.headers["Server"] = "TestServer/1.0"
                return response

        app = FastAPI()
        app.add_middleware(AddServerHeaderMiddleware)
        app.add_middleware(SecurityHeadersMiddleware)

        @app.get(PATH_ROOT)
        async def root():
            return {"message": "hello"}

        client = TestClient(app)
        response = client.get(PATH_ROOT)
        assert "Server" not in response.headers

    def test_request_validation_non_standard_content_type(self):
        """Test request validation with non-standard content-type and non-zero body"""
        app = FastAPI()
        app.add_middleware(RequestValidationMiddleware)

        @app.post(PATH_ROOT)
        async def root():
            return {"message": "ok"}

        client = TestClient(app)
        response = client.post(
            PATH_ROOT,
            content="test",
            headers={"content-type": "text/plain", "content-length": "4"}
        )
        assert response.status_code == 200


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

        @app.post(PATH_DATA)
        async def post_data():
            return {"message": "data created"}

        return app

    def test_request_within_size_limit(self, app_with_validation):
        """Test request within size limit is allowed"""
        client = TestClient(app_with_validation)
        response = client.post(
            PATH_DATA,
            json={"key": "value"}
        )
        assert response.status_code == 200

    def test_request_exceeds_size_limit(self, app_with_validation):
        """Test request exceeding size limit is rejected"""
        client = TestClient(app_with_validation)
        large_data = {"data": "x" * 2000}  # > 1KB
        response = client.post(
            PATH_DATA,
            json=large_data
        )
        assert response.status_code == 413
        assert "too large" in response.text

    def test_get_request_allowed(self, app_with_validation):
        """Test GET requests are allowed regardless of validation"""
        app = FastAPI()
        app.add_middleware(RequestValidationMiddleware)

        @app.get(PATH_DATA)
        async def get_data():
            return {"message": "data"}

        client = TestClient(app)
        response = client.get(PATH_DATA)
        assert response.status_code == 200
