"""
Rate limiting middleware for API endpoints.
"""
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from collections import defaultdict
from datetime import datetime, timedelta
import asyncio
from typing import Dict, Tuple


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware that tracks requests per IP address.

    Implements a sliding window rate limiter with configurable limits
    for different endpoint categories.
    """

    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
        auth_requests_per_minute: int = 5,  # Stricter limit for auth endpoints
        enabled: bool = True
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self.auth_requests_per_minute = auth_requests_per_minute
        self.enabled = enabled

        # Storage for request timestamps: {ip: [(timestamp, endpoint), ...]}
        self.request_log: Dict[str, list] = defaultdict(list)

        # Lock for thread-safe operations
        self.lock = asyncio.Lock()

        # Start cleanup task
        if enabled:
            asyncio.create_task(self._cleanup_old_entries())

    async def dispatch(self, request: Request, call_next):
        """Process request and apply rate limiting."""
        if not self.enabled:
            return await call_next(request)

        # Get client IP
        client_ip = self._get_client_ip(request)

        # Skip rate limiting for health check endpoint
        if request.url.path in ["/health", "/", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)

        # Check rate limits
        try:
            await self._check_rate_limit(client_ip, request.url.path)
        except HTTPException as e:
            return JSONResponse(
                status_code=e.status_code,
                content={"detail": e.detail},
                headers={"Retry-After": "60"}
            )

        # Record this request
        async with self.lock:
            now = datetime.utcnow()
            self.request_log[client_ip].append((now, request.url.path))

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        remaining = await self._get_remaining_requests(client_ip, request.url.path)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int((datetime.utcnow() + timedelta(minutes=1)).timestamp()))

        return response

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request."""
        # Check for forwarded IP (when behind a proxy)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # Fall back to direct client IP
        if request.client:
            return request.client.host

        return "unknown"

    async def _check_rate_limit(self, client_ip: str, path: str) -> None:
        """Check if client has exceeded rate limits."""
        async with self.lock:
            now = datetime.utcnow()
            requests = self.request_log.get(client_ip, [])

            # Filter requests within time windows
            minute_ago = now - timedelta(minutes=1)
            hour_ago = now - timedelta(hours=1)

            recent_minute = [r for r in requests if r[0] > minute_ago]
            recent_hour = [r for r in requests if r[0] > hour_ago]

            # Determine which limit to use based on endpoint
            if path.startswith("/api/auth/"):
                limit_per_minute = self.auth_requests_per_minute
            else:
                limit_per_minute = self.requests_per_minute

            # Check minute limit
            if len(recent_minute) >= limit_per_minute:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded: Maximum {limit_per_minute} requests per minute"
                )

            # Check hour limit
            if len(recent_hour) >= self.requests_per_hour:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Rate limit exceeded: Maximum {self.requests_per_hour} requests per hour"
                )

    async def _get_remaining_requests(self, client_ip: str, path: str) -> int:
        """Get remaining requests for client."""
        async with self.lock:
            now = datetime.utcnow()
            minute_ago = now - timedelta(minutes=1)
            requests = self.request_log.get(client_ip, [])
            recent = [r for r in requests if r[0] > minute_ago]

            if path.startswith("/api/auth/"):
                return max(0, self.auth_requests_per_minute - len(recent))
            else:
                return max(0, self.requests_per_minute - len(recent))

    async def _cleanup_old_entries(self):
        """Periodically clean up old request entries."""
        while True:
            await asyncio.sleep(300)  # Run every 5 minutes

            async with self.lock:
                now = datetime.utcnow()
                cutoff = now - timedelta(hours=2)

                for ip in list(self.request_log.keys()):
                    # Remove requests older than 2 hours
                    self.request_log[ip] = [
                        (timestamp, path)
                        for timestamp, path in self.request_log[ip]
                        if timestamp > cutoff
                    ]

                    # Remove IP if no recent requests
                    if not self.request_log[ip]:
                        del self.request_log[ip]
