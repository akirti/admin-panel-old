"""
Tests for uncovered lines in rate_limit.py and db_health.py middleware.

Covers:
  - rate_limit.py lines 63-90 (dispatch rate limit flow, 429 response, headers)
  - rate_limit.py line 131 (auth endpoint path branch)
  - rate_limit.py lines 76-78 (request_log overflow guard)
  - rate_limit.py lines 164-181 (cleanup_old_entries)
  - db_health.py lines 55, 68-89 (health check logic, exception handling)
"""
import pytest
import asyncio
import time
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.datastructures import Headers

from easylifeauth.middleware.rate_limit import RateLimitMiddleware
from easylifeauth.middleware.db_health import DatabaseHealthMiddleware


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_request(path="/api/data", client_host="127.0.0.1", headers=None):
    """Create a mock Starlette Request."""
    scope = {
        "type": "http",
        "method": "GET",
        "path": path,
        "query_string": b"",
        "headers": [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()],
    }
    mock_client = MagicMock()
    mock_client.host = client_host
    request = Request(scope)
    request._client = mock_client  # starlette stores client info here
    # Patch the client property
    scope["client"] = (client_host, 50000)
    return request


async def _ok_call_next(request):
    """A call_next that returns a 200 JSON response."""
    return JSONResponse({"message": "ok"})


# ===================================================================
# RateLimitMiddleware - dispatch flow (lines 63-90)
# ===================================================================

class TestRateLimitDispatchFlow:
    """Cover the full dispatch path including 429 responses and headers."""

    @pytest.mark.asyncio
    async def test_dispatch_returns_429_when_rate_exceeded(self):
        """When rate limit is exceeded, dispatch returns a 429 JSON response
        with a Retry-After header (lines 63-70)."""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            requests_per_minute=2,
            enabled=True,
            exempt_paths={"/_no_exempt_"},
        )

        # First two requests should succeed
        for _ in range(2):
            req = _make_request("/api/data")
            resp = await middleware.dispatch(req, _ok_call_next)
            assert resp.status_code == 200

        # Third request should be rate-limited (lines 63-70)
        req = _make_request("/api/data")
        resp = await middleware.dispatch(req, _ok_call_next)
        assert resp.status_code == 429
        assert resp.headers.get("Retry-After") == "60"
        body = resp.body.decode()
        assert "Rate limit exceeded" in body

    @pytest.mark.asyncio
    async def test_successful_response_has_rate_limit_headers(self):
        """A normal response includes X-RateLimit-* headers (lines 84-90)."""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            requests_per_minute=100,
            enabled=True,
            exempt_paths={"/_no_exempt_"},
        )

        req = _make_request("/api/data")
        resp = await middleware.dispatch(req, _ok_call_next)
        assert resp.status_code == 200
        assert "X-RateLimit-Limit" in resp.headers
        assert resp.headers["X-RateLimit-Limit"] == "100"
        assert "X-RateLimit-Remaining" in resp.headers
        assert "X-RateLimit-Reset" in resp.headers

    @pytest.mark.asyncio
    async def test_auth_endpoint_uses_stricter_limit(self):
        """Auth path rate limiting uses auth_requests_per_minute (line 131)."""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            requests_per_minute=100,
            auth_requests_per_minute=1,
            enabled=True,
            exempt_paths={"/_no_exempt_"},
        )

        # First auth request succeeds
        req = _make_request("/api/auth/login")
        resp = await middleware.dispatch(req, _ok_call_next)
        assert resp.status_code == 200

        # Second auth request should be rate-limited
        req = _make_request("/api/auth/login")
        resp = await middleware.dispatch(req, _ok_call_next)
        assert resp.status_code == 429

    @pytest.mark.asyncio
    async def test_non_auth_endpoint_not_affected_by_auth_limit(self):
        """Regular endpoints use requests_per_minute, not auth limit."""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            requests_per_minute=100,
            auth_requests_per_minute=1,
            enabled=True,
            exempt_paths={"/_no_exempt_"},
        )

        for _ in range(10):
            req = _make_request("/api/data")
            resp = await middleware.dispatch(req, _ok_call_next)
            assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_exempt_path_skips_rate_limiting(self):
        """Requests to exempt paths skip rate limiting entirely."""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            requests_per_minute=1,
            enabled=True,
        )

        # /health is in the default exempt paths
        req = _make_request("/health")
        resp = await middleware.dispatch(req, _ok_call_next)
        assert resp.status_code == 200

        # Second request to /health should also succeed (not rate limited)
        req = _make_request("/health")
        resp = await middleware.dispatch(req, _ok_call_next)
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_disabled_middleware_passes_through(self):
        """When enabled=False, dispatch passes through immediately."""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            requests_per_minute=1,
            enabled=False,
        )

        for _ in range(10):
            req = _make_request("/api/data")
            resp = await middleware.dispatch(req, _ok_call_next)
            assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_hour_rate_limit(self):
        """When hourly limit is exceeded, returns 429."""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            requests_per_minute=1000,
            requests_per_hour=2,
            enabled=True,
            exempt_paths={"/_no_exempt_"},
        )

        # Two requests succeed
        for _ in range(2):
            req = _make_request("/api/data")
            resp = await middleware.dispatch(req, _ok_call_next)
            assert resp.status_code == 200

        # Third request hits hourly limit
        req = _make_request("/api/data")
        resp = await middleware.dispatch(req, _ok_call_next)
        assert resp.status_code == 429
        body = resp.body.decode()
        assert "requests per hour" in body


# ===================================================================
# RateLimitMiddleware - request_log overflow guard (lines 76-78)
# ===================================================================

class TestRateLimitOverflowGuard:
    """Cover the branch where len(request_log) > 10000."""

    @pytest.mark.asyncio
    async def test_overflow_guard_evicts_oldest_ip(self):
        """When request_log exceeds 10000 unique IPs, the oldest IP
        entry is evicted (lines 76-78)."""
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            requests_per_minute=100_000,
            enabled=True,
            exempt_paths={"/_no_exempt_"},
        )

        # Pre-populate request_log with 10001 unique IPs
        now = datetime.utcnow()
        for i in range(10_001):
            ip = f"10.0.{i // 256}.{i % 256}"
            middleware.request_log[ip].append((now, "/api/data"))

        first_ip = next(iter(middleware.request_log))
        assert len(middleware.request_log) == 10_001

        # Make a request from a new IP
        req = _make_request("/api/data", client_host="99.99.99.99")
        resp = await middleware.dispatch(req, _ok_call_next)

        assert resp.status_code == 200
        # The oldest IP should have been evicted
        assert first_ip not in middleware.request_log
        # New IP should be present
        assert "99.99.99.99" in middleware.request_log


# ===================================================================
# RateLimitMiddleware - cleanup_old_entries (lines 164-181)
# ===================================================================

class TestRateLimitCleanup:
    """Cover the cleanup_old_entries coroutine method."""

    @pytest.mark.asyncio
    async def test_cleanup_old_entries_removes_stale_ips(self):
        """cleanup_old_entries removes entries older than 2 hours and
        deletes IPs with no remaining entries (lines 164-181)."""
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)

        old_time = datetime.utcnow() - timedelta(hours=3)
        recent_time = datetime.utcnow()

        middleware.request_log["1.1.1.1"] = [
            (old_time, "/api/old"),
            (recent_time, "/api/recent"),
        ]
        middleware.request_log["2.2.2.2"] = [
            (old_time, "/api/old"),
        ]
        middleware.request_log["3.3.3.3"] = [
            (recent_time, "/api/recent"),
        ]

        call_count = 0

        async def fake_sleep(seconds):
            nonlocal call_count
            call_count += 1
            if call_count > 1:
                raise asyncio.CancelledError()

        with patch("asyncio.sleep", side_effect=fake_sleep):
            with pytest.raises(asyncio.CancelledError):
                await middleware.cleanup_old_entries()

        # "1.1.1.1" should still exist but only with the recent entry
        assert "1.1.1.1" in middleware.request_log
        assert len(middleware.request_log["1.1.1.1"]) == 1

        # "2.2.2.2" had only old entries so should be deleted
        assert "2.2.2.2" not in middleware.request_log

        # "3.3.3.3" had only recent entries so should remain
        assert "3.3.3.3" in middleware.request_log

    @pytest.mark.asyncio
    async def test_cleanup_handles_empty_request_log(self):
        """cleanup_old_entries does not error on an empty request_log."""
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)

        call_count = 0

        async def fake_sleep(seconds):
            nonlocal call_count
            call_count += 1
            if call_count > 1:
                raise asyncio.CancelledError()

        with patch("asyncio.sleep", side_effect=fake_sleep):
            with pytest.raises(asyncio.CancelledError):
                await middleware.cleanup_old_entries()

        assert len(middleware.request_log) == 0


# ===================================================================
# RateLimitMiddleware - _get_client_ip branches
# ===================================================================

class TestRateLimitClientIP:
    """Cover _get_client_ip branches (lines 92-107)."""

    def test_x_forwarded_for(self):
        middleware = RateLimitMiddleware(app=MagicMock())
        req = _make_request(headers={"X-Forwarded-For": "1.2.3.4, 5.6.7.8"})
        assert middleware._get_client_ip(req) == "1.2.3.4"

    def test_x_real_ip(self):
        middleware = RateLimitMiddleware(app=MagicMock())
        req = _make_request(headers={"X-Real-IP": "9.8.7.6"})
        assert middleware._get_client_ip(req) == "9.8.7.6"

    def test_client_host(self):
        middleware = RateLimitMiddleware(app=MagicMock())
        req = _make_request(client_host="11.22.33.44")
        assert middleware._get_client_ip(req) == "11.22.33.44"

    def test_unknown_when_no_client(self):
        middleware = RateLimitMiddleware(app=MagicMock())
        scope = {
            "type": "http",
            "method": "GET",
            "path": "/api/data",
            "query_string": b"",
            "headers": [],
        }
        req = Request(scope)
        assert middleware._get_client_ip(req) == "unknown"


# ===================================================================
# RateLimitMiddleware - _get_remaining_requests
# ===================================================================

class TestRateLimitRemaining:
    """Cover _get_remaining_requests (lines 149-160)."""

    @pytest.mark.asyncio
    async def test_remaining_for_auth_path(self):
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            requests_per_minute=100,
            auth_requests_per_minute=5,
        )
        remaining = await middleware._get_remaining_requests("1.1.1.1", "/api/auth/login")
        assert remaining == 5

    @pytest.mark.asyncio
    async def test_remaining_for_regular_path(self):
        middleware = RateLimitMiddleware(
            app=MagicMock(),
            requests_per_minute=100,
        )
        remaining = await middleware._get_remaining_requests("1.1.1.1", "/api/data")
        assert remaining == 100


# ===================================================================
# RateLimitMiddleware - start/stop cleanup task
# ===================================================================

class TestRateLimitCleanupTask:
    """Cover start_cleanup_task and stop_cleanup_task (lines 183-192)."""

    def test_start_cleanup_task(self):
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)
        with patch("asyncio.create_task") as mock_create:
            mock_create.return_value = MagicMock()
            middleware.start_cleanup_task()
            mock_create.assert_called_once()
            assert middleware._cleanup_task is not None

    def test_start_cleanup_task_disabled(self):
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=False)
        with patch("asyncio.create_task") as mock_create:
            middleware.start_cleanup_task()
            mock_create.assert_not_called()

    def test_stop_cleanup_task(self):
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)
        mock_task = MagicMock()
        middleware._cleanup_task = mock_task
        middleware.stop_cleanup_task()
        mock_task.cancel.assert_called_once()
        assert middleware._cleanup_task is None

    def test_stop_cleanup_task_when_none(self):
        middleware = RateLimitMiddleware(app=MagicMock(), enabled=True)
        middleware.stop_cleanup_task()  # Should not raise


# ===================================================================
# DatabaseHealthMiddleware - dispatch when enabled (lines 55, 68-77)
# ===================================================================

class TestDbHealthDispatchEnabled:
    """Cover dispatch when middleware is enabled and db_getter is set."""

    @pytest.mark.asyncio
    async def test_dispatch_db_connected(self):
        """When db.ensure_connected returns True the request proceeds."""
        mock_db = MagicMock()
        mock_db.ensure_connected = AsyncMock(return_value=True)

        middleware = DatabaseHealthMiddleware(
            app=MagicMock(),
            db_getter=lambda: mock_db,
            check_interval=0,
            enabled=True,
        )

        req = _make_request("/api/data")
        resp = await middleware.dispatch(req, _ok_call_next)
        assert resp.status_code == 200
        mock_db.ensure_connected.assert_called_once()

    @pytest.mark.asyncio
    async def test_dispatch_db_not_connected(self):
        """When db.ensure_connected returns False, request still passes."""
        mock_db = MagicMock()
        mock_db.ensure_connected = AsyncMock(return_value=False)

        middleware = DatabaseHealthMiddleware(
            app=MagicMock(),
            db_getter=lambda: mock_db,
            check_interval=0,
            enabled=True,
        )

        req = _make_request("/api/data")
        resp = await middleware.dispatch(req, _ok_call_next)
        assert resp.status_code == 200
        assert middleware._last_check_success is False

    @pytest.mark.asyncio
    async def test_dispatch_exempt_path_skips_check(self):
        """Requests to exempt paths skip the database health check."""
        mock_db = MagicMock()
        mock_db.ensure_connected = AsyncMock(return_value=True)

        middleware = DatabaseHealthMiddleware(
            app=MagicMock(),
            db_getter=lambda: mock_db,
            check_interval=0,
            enabled=True,
        )

        req = _make_request("/health/live")
        resp = await middleware.dispatch(req, _ok_call_next)
        assert resp.status_code == 200
        mock_db.ensure_connected.assert_not_called()

    @pytest.mark.asyncio
    async def test_dispatch_disabled(self):
        """When enabled=False, dispatch passes through immediately."""
        mock_db = MagicMock()
        mock_db.ensure_connected = AsyncMock(return_value=True)

        middleware = DatabaseHealthMiddleware(
            app=MagicMock(),
            db_getter=lambda: mock_db,
            check_interval=0,
            enabled=False,
        )

        req = _make_request("/api/data")
        resp = await middleware.dispatch(req, _ok_call_next)
        assert resp.status_code == 200
        mock_db.ensure_connected.assert_not_called()

    @pytest.mark.asyncio
    async def test_dispatch_no_db_getter(self):
        """When db_getter is None, dispatch passes through immediately."""
        middleware = DatabaseHealthMiddleware(
            app=MagicMock(),
            db_getter=None,
            check_interval=0,
            enabled=True,
        )

        req = _make_request("/api/data")
        resp = await middleware.dispatch(req, _ok_call_next)
        assert resp.status_code == 200


# ===================================================================
# DatabaseHealthMiddleware - timing / interval logic (lines 62-67)
# ===================================================================

class TestDbHealthTiming:
    """Cover the time_since_last_check > check_interval branch."""

    @pytest.mark.asyncio
    async def test_health_check_skipped_when_within_interval(self):
        """If time since last check is within interval AND last check
        succeeded, the health check is skipped."""
        mock_db = MagicMock()
        mock_db.ensure_connected = AsyncMock(return_value=True)

        middleware = DatabaseHealthMiddleware(
            app=MagicMock(),
            db_getter=lambda: mock_db,
            check_interval=3600,
            enabled=True,
        )
        middleware._last_check_time = time.time()
        middleware._last_check_success = True

        req = _make_request("/api/data")
        resp = await middleware.dispatch(req, _ok_call_next)
        assert resp.status_code == 200
        mock_db.ensure_connected.assert_not_called()

    @pytest.mark.asyncio
    async def test_health_check_triggered_when_last_check_failed(self):
        """If previous check failed, next request triggers a new
        health check regardless of interval."""
        mock_db = MagicMock()
        mock_db.ensure_connected = AsyncMock(return_value=True)

        middleware = DatabaseHealthMiddleware(
            app=MagicMock(),
            db_getter=lambda: mock_db,
            check_interval=3600,
            enabled=True,
        )
        middleware._last_check_time = time.time()
        middleware._last_check_success = False

        req = _make_request("/api/data")
        resp = await middleware.dispatch(req, _ok_call_next)
        assert resp.status_code == 200
        mock_db.ensure_connected.assert_called_once()


# ===================================================================
# DatabaseHealthMiddleware - db_getter returns None (line 70)
# ===================================================================

class TestDbHealthDbGetterReturnsNone:
    """Cover the `if db:` branch when db_getter returns None."""

    @pytest.mark.asyncio
    async def test_db_getter_returns_none(self):
        """When db_getter() returns None, the health check body is
        skipped and the request proceeds."""
        middleware = DatabaseHealthMiddleware(
            app=MagicMock(),
            db_getter=lambda: None,
            check_interval=0,
            enabled=True,
        )

        req = _make_request("/api/data")
        resp = await middleware.dispatch(req, _ok_call_next)
        assert resp.status_code == 200


# ===================================================================
# DatabaseHealthMiddleware - exception handling (lines 81-89)
# ===================================================================

class TestDbHealthExceptionHandling:
    """Cover TimeoutError, RuntimeError, and generic Exception branches."""

    @pytest.mark.asyncio
    async def test_timeout_error(self):
        """asyncio.TimeoutError is caught; _last_check_success becomes False."""
        mock_db = MagicMock()
        mock_db.ensure_connected = AsyncMock(return_value=True)

        middleware = DatabaseHealthMiddleware(
            app=MagicMock(),
            db_getter=lambda: mock_db,
            check_interval=0,
            enabled=True,
        )

        with patch("asyncio.wait_for", side_effect=asyncio.TimeoutError()):
            req = _make_request("/api/data")
            resp = await middleware.dispatch(req, _ok_call_next)

        assert resp.status_code == 200
        assert middleware._last_check_success is False

    @pytest.mark.asyncio
    async def test_runtime_error_is_silently_ignored(self):
        """RuntimeError is caught and silently ignored; _last_check_success
        is NOT changed."""
        mock_db = MagicMock()
        mock_db.ensure_connected = AsyncMock(return_value=True)

        middleware = DatabaseHealthMiddleware(
            app=MagicMock(),
            db_getter=lambda: mock_db,
            check_interval=0,
            enabled=True,
        )
        middleware._last_check_success = True

        with patch("asyncio.wait_for", side_effect=RuntimeError("not ready")):
            req = _make_request("/api/data")
            resp = await middleware.dispatch(req, _ok_call_next)

        assert resp.status_code == 200
        assert middleware._last_check_success is True

    @pytest.mark.asyncio
    async def test_generic_exception(self):
        """A generic Exception is caught; _last_check_success becomes False."""
        mock_db = MagicMock()
        mock_db.ensure_connected = AsyncMock(return_value=True)

        middleware = DatabaseHealthMiddleware(
            app=MagicMock(),
            db_getter=lambda: mock_db,
            check_interval=0,
            enabled=True,
        )

        with patch("asyncio.wait_for", side_effect=ConnectionError("refused")):
            req = _make_request("/api/data")
            resp = await middleware.dispatch(req, _ok_call_next)

        assert resp.status_code == 200
        assert middleware._last_check_success is False
