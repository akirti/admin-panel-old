"""
@log_route decorator — auto-logs request/response for FastAPI route handlers.

Usage:
    @router.get("/items")
    @log_route(level="INFO")
    async def list_items(request: Request):
        ...

Logs: method, path, IP, response status, duration_ms, user_email (if available).
"""
import time
import logging
import functools
from typing import Optional
from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("easylife.routes")


def log_route(level: str = "INFO", log_body: bool = False, log_response: bool = False):
    """Decorator that logs request and response details to Python logging.

    Args:
        level: Log level name (DEBUG, INFO, WARNING, ERROR).
        log_body: If True, log request body (careful with sensitive data).
        log_response: If True, log response body snippet.
    """
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Find the Request object from args/kwargs
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if request is None:
                request = kwargs.get("request")

            start = time.perf_counter()
            extra = {}

            if request:
                extra["request_method"] = request.method
                extra["request_path"] = str(request.url.path)
                extra["request_ip"] = request.client.host if request.client else None
                if hasattr(request, "state"):
                    extra["user_email"] = getattr(request.state, "user_email", None)

            try:
                response = await func(*args, **kwargs)
                duration_ms = round((time.perf_counter() - start) * 1000, 2)
                extra["duration_ms"] = duration_ms

                if isinstance(response, JSONResponse):
                    extra["response_status"] = response.status_code
                elif hasattr(response, "status_code"):
                    extra["response_status"] = response.status_code

                logger.log(
                    numeric_level,
                    "%s %s → %s (%.1fms)",
                    extra.get("request_method", "?"),
                    extra.get("request_path", func.__name__),
                    extra.get("response_status", "OK"),
                    duration_ms,
                    extra=extra,
                )
                return response
            except Exception as exc:
                duration_ms = round((time.perf_counter() - start) * 1000, 2)
                extra["duration_ms"] = duration_ms
                extra["response_status"] = 500
                logger.log(
                    logging.ERROR,
                    "%s %s → ERROR: %s (%.1fms)",
                    extra.get("request_method", "?"),
                    extra.get("request_path", func.__name__),
                    str(exc)[:200],
                    duration_ms,
                    extra=extra,
                )
                raise
        return wrapper
    return decorator
