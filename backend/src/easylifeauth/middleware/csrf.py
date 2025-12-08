"""
CSRF Protection Middleware for FastAPI
Implements Double Submit Cookie pattern with SameSite cookies
"""
import secrets
import hmac
import hashlib
from typing import Optional
from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp


class CSRFProtectMiddleware(BaseHTTPMiddleware):
    """
    CSRF Protection using Double Submit Cookie pattern

    How it works:
    1. Server generates a random CSRF token
    2. Token is sent to client in a cookie (HttpOnly, Secure, SameSite)
    3. Client must send the same token in a custom header (X-CSRF-Token)
    4. Server verifies both tokens match
    """

    def __init__(
        self,
        app: ASGIApp,
        secret_key: str,
        cookie_name: str = "csrf_token",
        header_name: str = "X-CSRF-Token",
        cookie_path: str = "/",
        cookie_domain: Optional[str] = None,
        cookie_secure: bool = True,
        cookie_samesite: str = "lax",
        exempt_methods: set = None,
        exempt_paths: set = None
    ):
        super().__init__(app)
        self.secret_key = secret_key.encode()
        self.cookie_name = cookie_name
        self.header_name = header_name
        self.cookie_path = cookie_path
        self.cookie_domain = cookie_domain
        self.cookie_secure = cookie_secure
        self.cookie_samesite = cookie_samesite
        self.exempt_methods = exempt_methods or {"GET", "HEAD", "OPTIONS", "TRACE"}
        self.exempt_paths = exempt_paths or set()

    def _generate_token(self) -> str:
        """Generate a cryptographically secure random token"""
        return secrets.token_urlsafe(32)

    def _sign_token(self, token: str) -> str:
        """Create HMAC signature of token"""
        signature = hmac.new(
            self.secret_key,
            token.encode(),
            hashlib.sha256
        ).hexdigest()
        return f"{token}.{signature}"

    def _verify_token(self, signed_token: str) -> bool:
        """Verify HMAC signature of token"""
        try:
            token, signature = signed_token.rsplit(".", 1)
            expected_signature = hmac.new(
                self.secret_key,
                token.encode(),
                hashlib.sha256
            ).hexdigest()
            return hmac.compare_digest(signature, expected_signature)
        except (ValueError, AttributeError):
            return False

    def _is_exempt(self, request: Request) -> bool:
        """Check if request is exempt from CSRF protection"""
        # Exempt safe methods
        if request.method in self.exempt_methods:
            return True

        path = request.url.path

        # Exempt specific paths (exact match)
        if path in self.exempt_paths:
            return True

        # Exempt paths by prefix (for patterns like /api/v1/auth/*)
        for exempt_path in self.exempt_paths:
            if exempt_path.endswith("*") and path.startswith(exempt_path[:-1]):
                return True

        # Exempt health check endpoints
        if "/health" in path:
            return True

        # Exempt docs endpoints
        if any(doc_path in path for doc_path in ["/docs", "/redoc", "/openapi.json"]):
            return True

        return False

    def _set_csrf_cookie(self, response: Response) -> str:
        """Generate and set a new CSRF token cookie, return the signed token"""
        token = self._generate_token()
        signed_token = self._sign_token(token)

        response.set_cookie(
            key=self.cookie_name,
            value=signed_token,
            path=self.cookie_path,
            domain=self.cookie_domain,
            secure=self.cookie_secure,
            httponly=False,  # Allow JavaScript to read for header
            samesite=self.cookie_samesite,
            max_age=86400  # 24 hours
        )
        return signed_token

    async def dispatch(self, request: Request, call_next):
        """Process request and apply CSRF protection"""

        # Check if request is exempt
        if self._is_exempt(request):
            response = await call_next(request)

            # Set CSRF token cookie on exempt requests (like GET)
            # This allows subsequent POST requests to have the token
            if request.method in {"GET", "HEAD"}:
                csrf_token_cookie = request.cookies.get(self.cookie_name)

                # Generate new token if missing or invalid signature
                if not csrf_token_cookie or not self._verify_token(csrf_token_cookie):
                    self._set_csrf_cookie(response)

            return response

        # For non-exempt requests (POST, PUT, DELETE, etc.), verify CSRF token
        csrf_token_cookie = request.cookies.get(self.cookie_name)
        csrf_token_header = request.headers.get(self.header_name)

        # Check if tokens are present
        if not csrf_token_cookie or not csrf_token_header:
            raise HTTPException(
                status_code=403,
                detail="CSRF token missing"
            )

        # Verify cookie token signature
        if not self._verify_token(csrf_token_cookie):
            raise HTTPException(
                status_code=403,
                detail="Invalid CSRF token signature"
            )

        # Verify tokens match
        if not hmac.compare_digest(csrf_token_cookie, csrf_token_header):
            raise HTTPException(
                status_code=403,
                detail="CSRF token mismatch"
            )

        # Token is valid, process request
        response = await call_next(request)
        return response


def get_csrf_token(request: Request, cookie_name: str = "csrf_token") -> Optional[str]:
    """
    Helper function to get CSRF token from request cookie
    Use this in templates or API responses
    """
    return request.cookies.get(cookie_name)
