"""
Apigee identity middleware - sets response headers for Apigee proxy verification.

Mirrors the Flask app behaviour of exposing app name, hostname, and a
signature header so the Apigee proxy can confirm it is talking to the
correct backend instance.
"""
import socket

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


class ApigeeIdentityMiddleware(BaseHTTPMiddleware):
    """Add identity headers to every response for Apigee verification.

    Headers set:
        X-App-Name            – application name (from config or env var)
        X-Backend-Hostname    – machine hostname (``socket.gethostname()``)
    """

    def __init__(self, app, *, app_name: str = "easylife-admin-panel"):
        super().__init__(app)
        self.app_name = app_name
        self.hostname = socket.gethostname()

    async def dispatch(self, request: Request, call_next) -> Response:
        response: Response = await call_next(request)
        response.headers["X-App-Name"] = self.app_name
        response.headers["X-Backend-Hostname"] = self.hostname
        return response
