"""
Database health middleware for automatic reconnection after system resume.

This middleware monitors database connectivity and triggers automatic
reconnection when stale connections are detected (e.g., after system
sleep/resume cycles).
"""
import time
import asyncio
import logging
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


class DatabaseHealthMiddleware(BaseHTTPMiddleware):
    """
    Middleware to check database connectivity and auto-reconnect on failures.

    This addresses the issue where MongoDB connections become stale after
    system sleep/resume, causing 504 Gateway Timeout errors.

    The middleware:
    1. Tracks the last successful database operation
    2. If too much time has passed, proactively checks connectivity
    3. Triggers reconnection if needed before the request proceeds
    """

    def __init__(
        self,
        app,
        db_getter=None,
        check_interval: int = 60,  # Check if last success was > 60 seconds ago
        enabled: bool = True,
        exempt_paths: set = None
    ):
        super().__init__(app)
        self.db_getter = db_getter
        self.check_interval = check_interval
        self.enabled = enabled
        self.exempt_paths = exempt_paths or {
            "/health/live",
            "/docs",
            "/redoc",
            "/openapi.json",
        }
        self._last_check_time = time.time()
        self._last_check_success = True

    async def dispatch(self, request: Request, call_next):
        """Check database health before processing request."""
        if not self.enabled or not self.db_getter:
            return await call_next(request)

        # Skip health checks for exempt paths
        path = request.url.path
        if any(path.endswith(exempt) for exempt in self.exempt_paths):
            return await call_next(request)

        # Check if we should verify database connectivity
        current_time = time.time()
        time_since_last_check = current_time - self._last_check_time

        # Only check if enough time has passed or last check failed
        if time_since_last_check > self.check_interval or not self._last_check_success:
            try:
                db = self.db_getter()
                if db:
                    # Quick ping with short timeout
                    is_connected = await asyncio.wait_for(
                        db.ensure_connected(max_retries=2),
                        timeout=10.0
                    )
                    self._last_check_success = is_connected
                    self._last_check_time = current_time

                    if not is_connected:
                        logger.warning("Database health check failed, request may fail")
            except asyncio.TimeoutError:
                logger.warning("Database health check timed out")
                self._last_check_success = False
            except RuntimeError:
                # Dependencies not yet initialized during startup
                pass
            except Exception as e:
                logger.warning(f"Database health check error: {e}")
                self._last_check_success = False

        return await call_next(request)
