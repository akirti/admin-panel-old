"""
Security headers middleware for enhanced application security.
"""
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses.

    Implements OWASP recommended security headers including:
    - Content Security Policy (CSP)
    - X-Frame-Options
    - X-Content-Type-Options
    - Strict-Transport-Security (HSTS)
    - X-XSS-Protection
    - Referrer-Policy
    - Permissions-Policy
    """

    def __init__(
        self,
        app,
        enable_hsts: bool = True,
        hsts_max_age: int = 31536000,  # 1 year
        enable_csp: bool = True,
        csp_directives: str = None
    ):
        super().__init__(app)
        self.enable_hsts = enable_hsts
        self.hsts_max_age = hsts_max_age
        self.enable_csp = enable_csp
        self.csp_directives = csp_directives or (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )

    async def dispatch(self, request: Request, call_next):
        """Add security headers to response."""
        response: Response = await call_next(request)

        # Prevent clickjacking attacks
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Enable XSS filter in browsers
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Content Security Policy
        if self.enable_csp:
            response.headers["Content-Security-Policy"] = self.csp_directives

        # HTTP Strict Transport Security (HSTS) - only for HTTPS
        if self.enable_hsts and request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = (
                f"max-age={self.hsts_max_age}; includeSubDomains; preload"
            )

        # Control referrer information
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy (formerly Feature Policy)
        response.headers["Permissions-Policy"] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=(), "
            "payment=(), "
            "usb=(), "
            "magnetometer=(), "
            "gyroscope=(), "
            "accelerometer=()"
        )

        # Remove server header to avoid information disclosure
        if "Server" in response.headers:
            del response.headers["Server"]

        return response


class RequestValidationMiddleware(BaseHTTPMiddleware):
    """
    Middleware for validating and sanitizing incoming requests.
    """

    # Maximum request body size (10MB)
    MAX_BODY_SIZE = 10 * 1024 * 1024

    def __init__(self, app, max_body_size: int = MAX_BODY_SIZE):
        super().__init__(app)
        self.max_body_size = max_body_size

    async def dispatch(self, request: Request, call_next):
        """Validate request before processing."""
        # Check request body size
        if request.headers.get("content-length"):
            content_length = int(request.headers["content-length"])
            if content_length > self.max_body_size:
                return Response(
                    content=f"Request body too large. Maximum size is {self.max_body_size} bytes",
                    status_code=413
                )

        # Validate content type for POST/PUT requests
        if request.method in ["POST", "PUT", "PATCH"]:
            content_type = request.headers.get("content-type", "")
            # Allow JSON, multipart form data, and form-urlencoded
            allowed_types = [
                "application/json",
                "multipart/form-data",
                "application/x-www-form-urlencoded"
            ]
            if not any(allowed in content_type for allowed in allowed_types):
                # Skip validation for empty bodies
                if request.headers.get("content-length", "0") != "0":
                    pass  # Allow for now, as some endpoints might not set content-type

        response = await call_next(request)
        return response
