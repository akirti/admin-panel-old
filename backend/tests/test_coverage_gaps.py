"""Tests to cover missing lines in main.py, app.py, and token_manager.py."""
import sys
import os
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
import jwt

from easylifeauth.services.token_manager import TokenManager
from easylifeauth.errors.auth_error import AuthError
from mock_data import MOCK_EMAIL

# Constants
OID_9011 = "507f1f77bcf86cd799439011"
STR_HS256 = "HS256"
TEST_ISSUER = "easylife-auth"
TEST_AUDIENCE = "easylife-api"
TEST_SECRET_KEY = "test_secret_key"
PATCH_APP_DATABASE_MANAGER = "easylifeauth.app.DatabaseManager"
PATCH_APP_TOKEN_MANAGER = "easylifeauth.app.TokenManager"
PATCH_APP_INIT_DEPENDENCIES = "easylifeauth.app.init_dependencies"
PATCH_APP_EMAIL_SERVICE = "easylifeauth.app.EmailService"
PATCH_DEPS_ERROR_LOG_SERVICE = "easylifeauth.api.dependencies.get_error_log_service"


# ============================================================================
# main.py — lines 15, 18, 48
# ============================================================================
class TestMainSetPathBranches:
    """Cover set_path branches where paths are NOT yet in sys.path (lines 15, 18)."""

    def test_set_path_appends_when_not_in_sys_path(self):
        """Lines 15, 18: sys.path.append when paths are not present."""
        from main import set_path
        # Get the paths that set_path adds
        module_root = set_path()
        src_path = os.path.abspath(os.path.join(module_root, ".."))

        # Remove them from sys.path to force re-append
        while module_root in sys.path:
            sys.path.remove(module_root)
        while src_path in sys.path:
            sys.path.remove(src_path)

        # Now call set_path — should trigger lines 15 and 18
        result = set_path()
        assert result == module_root
        assert module_root in sys.path
        assert src_path in sys.path


class TestIsPlaceholder:
    """Cover _is_placeholder for non-string input (line 48)."""

    def test_non_string_returns_false(self):
        from main import _is_placeholder
        assert _is_placeholder(123) is False
        assert _is_placeholder(None) is False
        assert _is_placeholder([]) is False

    def test_valid_placeholder(self):
        from main import _is_placeholder
        assert _is_placeholder("{some.path}") is True

    def test_not_placeholder(self):
        from main import _is_placeholder
        assert _is_placeholder("plain_string") is False


class TestBuildDbConfigUnresolvedRequired:
    """Cover build_db_config when required keys have unresolved placeholders (line 78-83)."""

    def test_unresolved_host_returns_none(self):
        from main import build_db_config
        loader = MagicMock()
        loader.get_DB_config.return_value = {
            "host": "{env.db.host}",
            "username": "user",
            "password": "pass",
        }
        loader.get_config_by_path.return_value = None
        assert build_db_config(loader) is None

    def test_empty_password_returns_config(self):
        """Empty password is allowed (no-auth dev environments)."""
        from main import build_db_config
        loader = MagicMock()
        loader.get_DB_config.return_value = {
            "host": "localhost",
            "username": "user",
            "password": "",
        }
        loader.get_config_by_path.return_value = None
        result = build_db_config(loader)
        assert result is not None
        assert result["password"] == ""


# ============================================================================
# token_manager.py — lines 89, 185-186, 191
# ============================================================================
class TestTokenManagerCoverageGaps:
    """Cover missing lines in token_manager.py."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.tokens = MagicMock()
        db.tokens.find_one = AsyncMock(return_value=None)
        db.tokens.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        db.tokens.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        return db

    @pytest.fixture
    def token_manager(self, mock_db):
        return TokenManager(
            secret_key=TEST_SECRET_KEY,
            db=mock_db,
            issuer=TEST_ISSUER,
            audience=TEST_AUDIENCE,
        )

    @pytest.mark.asyncio
    async def test_validate_backend_token_uses_self_db_when_db_none(self, token_manager, mock_db):
        """Line 89: when db param is None, falls back to self.db."""
        now = datetime.now(timezone.utc)
        mock_db.tokens.find_one = AsyncMock(return_value={
            "user_id": OID_9011,
            "email": MOCK_EMAIL,
            "token_hash": "tok",
            "expires_at": now + timedelta(hours=1),
        })
        result = await token_manager.validate_backend_token(
            user_id=OID_9011,
            email=MOCK_EMAIL,
            token="tok",
            token_type="access",
            db=None,  # triggers line 89
        )
        assert result is not None
        mock_db.tokens.find_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_verify_refresh_token_hash_match(self, token_manager, mock_db):
        """Lines 185-186: verify_token with refresh token_type matching refresh_token_hash."""
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "refresh_token",
            "iss": TEST_ISSUER,
            "aud": TEST_AUDIENCE,
            "user_id": OID_9011,
            "email": MOCK_EMAIL,
            "roles": ["user"],
            "groups": [],
            "domains": [],
            "iat": now,
            "exp": now + timedelta(minutes=60),
            "type": "refresh",
        }
        token = jwt.encode(payload, TEST_SECRET_KEY, algorithm=STR_HS256)

        mock_db.tokens.find_one = AsyncMock(return_value={
            "user_id": OID_9011,
            "email": MOCK_EMAIL,
            "token_hash": "some_access_token",
            "refresh_token_hash": token,  # matches the refresh token
            "expires_at": now + timedelta(hours=2),
        })

        result = await token_manager.verify_token(token, token_type="refresh")
        assert result["user_id"] == OID_9011
        assert result["type"] == "refresh"

    @pytest.mark.asyncio
    async def test_verify_token_mismatch_raises_invalid(self, token_manager, mock_db):
        """Line 191: token valid JWT but hash doesn't match backend — raises AuthError."""
        now = datetime.now(timezone.utc)
        payload = {
            "sub": "access_token",
            "iss": TEST_ISSUER,
            "aud": TEST_AUDIENCE,
            "user_id": OID_9011,
            "email": MOCK_EMAIL,
            "roles": ["user"],
            "groups": [],
            "domains": [],
            "iat": now,
            "exp": now + timedelta(minutes=15),
            "type": "access",
        }
        token = jwt.encode(payload, TEST_SECRET_KEY, algorithm=STR_HS256)

        # Backend has a different token_hash — mismatch
        mock_db.tokens.find_one = AsyncMock(return_value={
            "user_id": OID_9011,
            "email": MOCK_EMAIL,
            "token_hash": "completely_different_token",
            "refresh_token_hash": "some_refresh",
            "expires_at": now + timedelta(hours=1),
        })

        with pytest.raises(AuthError) as exc_info:
            await token_manager.verify_token(token, token_type="access")
        assert exc_info.value.status_code == 401


# ============================================================================
# app.py — lifespan, exception handlers, CORS fallback, root endpoint
# ============================================================================
class TestCreateAppLifespan:
    """Cover create_app lifespan (lines 89-137) and CORS fallback (lines 154-159)."""

    def test_lifespan_with_db_config_and_token_secret(self):
        """Lines 89-137: startup with db_config + token_secret triggers DB init."""
        with patch(PATCH_APP_DATABASE_MANAGER) as MockDBM, \
             patch(PATCH_APP_TOKEN_MANAGER), \
             patch(PATCH_APP_INIT_DEPENDENCIES) as mock_init:
            mock_db = MagicMock()
            mock_db.ping = AsyncMock(return_value=True)
            mock_db.close = MagicMock()
            MockDBM.return_value = mock_db

            from easylifeauth.app import create_app
            from starlette.testclient import TestClient
            app = create_app(
                db_config={"host": "localhost", "port": 27017},
                token_secret="secret123",
            )
            with TestClient(app) as client:
                resp = client.get("/")
                assert resp.status_code == 200

            MockDBM.assert_called_once()
            mock_db.ping.assert_called_once()
            mock_init.assert_called_once()

    def test_lifespan_db_ping_fails(self):
        """Line 99: db ping returns False."""
        with patch(PATCH_APP_DATABASE_MANAGER) as MockDBM, \
             patch(PATCH_APP_TOKEN_MANAGER), \
             patch(PATCH_APP_INIT_DEPENDENCIES):
            mock_db = MagicMock()
            mock_db.ping = AsyncMock(return_value=False)
            mock_db.close = MagicMock()
            MockDBM.return_value = mock_db

            from easylifeauth.app import create_app
            from starlette.testclient import TestClient
            app = create_app(db_config={"host": "localhost"}, token_secret="secret")
            with TestClient(app) as client:
                client.get("/")

    def test_lifespan_db_ping_exception(self):
        """Line 100-101: db ping raises exception."""
        with patch(PATCH_APP_DATABASE_MANAGER) as MockDBM, \
             patch(PATCH_APP_TOKEN_MANAGER), \
             patch(PATCH_APP_INIT_DEPENDENCIES):
            mock_db = MagicMock()
            mock_db.ping = AsyncMock(side_effect=ConnectionError("timeout"))
            mock_db.close = MagicMock()
            MockDBM.return_value = mock_db

            from easylifeauth.app import create_app
            from starlette.testclient import TestClient
            app = create_app(db_config={"host": "localhost"}, token_secret="secret")
            with TestClient(app) as client:
                client.get("/")

    def test_lifespan_email_service_configured(self):
        """Lines 113-115: email service init when smtp_config has required keys."""
        with patch(PATCH_APP_DATABASE_MANAGER) as MockDBM, \
             patch(PATCH_APP_TOKEN_MANAGER), \
             patch(PATCH_APP_EMAIL_SERVICE) as MockEmail, \
             patch(PATCH_APP_INIT_DEPENDENCIES):
            mock_db = MagicMock()
            mock_db.ping = AsyncMock(return_value=True)
            mock_db.close = MagicMock()
            MockDBM.return_value = mock_db

            from easylifeauth.app import create_app
            from starlette.testclient import TestClient
            app = create_app(
                db_config={"host": "localhost"},
                token_secret="secret",
                smtp_config={"smtp_server": "mail.test.com", "smtp_port": 587, "email": "bot@test.com"},
            )
            with TestClient(app) as client:
                client.get("/")

            MockEmail.assert_called_once()

    def test_lifespan_shutdown_db_close_error(self):
        """Lines 136-137: db.close() raises during shutdown."""
        with patch(PATCH_APP_DATABASE_MANAGER) as MockDBM, \
             patch(PATCH_APP_TOKEN_MANAGER), \
             patch(PATCH_APP_INIT_DEPENDENCIES):
            mock_db = MagicMock()
            mock_db.ping = AsyncMock(return_value=True)
            mock_db.close = MagicMock(side_effect=RuntimeError("close failed"))
            MockDBM.return_value = mock_db

            from easylifeauth.app import create_app
            from starlette.testclient import TestClient
            app = create_app(db_config={"host": "localhost"}, token_secret="secret")
            with TestClient(app) as client:
                client.get("/")
            # No exception raised — gracefully handled

    def test_cors_origins_none_with_env_var(self, monkeypatch):
        """Lines 154-157: cors_origins=None falls back to CORS_ORIGINS env var."""
        monkeypatch.setenv("CORS_ORIGINS", "https://a.com, https://b.com")
        monkeypatch.setenv("ENV", "development")

        from easylifeauth.app import create_app
        from starlette.testclient import TestClient
        app = create_app(cors_origins=None)
        with TestClient(app) as client:
            resp = client.get("/")
            assert resp.status_code == 200

    def test_cors_origins_none_no_env_defaults(self, monkeypatch):
        """Lines 158-159: cors_origins=None and no CORS_ORIGINS env, uses defaults."""
        monkeypatch.delenv("CORS_ORIGINS", raising=False)
        monkeypatch.setenv("ENV", "development")

        from easylifeauth.app import create_app
        from starlette.testclient import TestClient
        app = create_app(cors_origins=None)
        with TestClient(app) as client:
            resp = client.get("/")
            assert resp.status_code == 200


class TestCreateAppExceptionHandlers:
    """Cover exception handlers in app.py (lines 228, 235, 243-309, 345)."""

    @pytest.fixture
    def client(self, monkeypatch):
        monkeypatch.setenv("ENV", "development")
        from easylifeauth.app import create_app
        from starlette.testclient import TestClient
        app = create_app(cors_origins=["http://localhost:3000"])
        self._app = app
        return TestClient(app, raise_server_exceptions=False)

    def test_auth_error_handler(self, client):
        """Line 228: AuthError exception handler returns proper JSON."""
        from fastapi import APIRouter
        router = APIRouter()

        @router.get("/test-auth-error")
        async def raise_auth_error():
            raise AuthError("Unauthorized access", 401)

        self._app.include_router(router)
        resp = client.get("/test-auth-error")
        assert resp.status_code == 401
        assert resp.json()["error"] == "Unauthorized access"

    def test_http_exception_handler(self, client):
        """Line 235: HTTPException handler returns proper JSON."""
        from fastapi import APIRouter, HTTPException
        router = APIRouter()

        @router.get("/test-http-error")
        async def raise_http_error():
            raise HTTPException(status_code=403, detail="Forbidden")

        self._app.include_router(router)
        resp = client.get("/test-http-error")
        assert resp.status_code == 403
        assert resp.json()["error"] == "Forbidden"

    def test_general_exception_handler(self, client):
        """Lines 293-309: unhandled exception returns 500."""
        from fastapi import APIRouter
        router = APIRouter()

        @router.get("/test-general-error")
        async def raise_generic():
            raise RuntimeError("unexpected boom")

        self._app.include_router(router)
        resp = client.get("/test-general-error")
        assert resp.status_code == 500
        assert resp.json()["error"] == "Internal server error"

    def test_request_validation_error_handler(self, client):
        """Lines 243-263: request validation error returns 422."""
        from fastapi import APIRouter, Query
        router = APIRouter()

        @router.get("/test-validation")
        async def needs_int(count: int = Query(...)):
            return {"count": count}

        self._app.include_router(router)
        resp = client.get("/test-validation?count=not_a_number")
        assert resp.status_code == 422
        data = resp.json()
        assert data["error"] == "Validation error"
        assert "details" in data

    def test_root_endpoint(self, client):
        """Line 345: root endpoint returns API info."""
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "EasyLife Auth API"
        assert "version" in data
        assert data["docs"] == "/docs"

    def test_request_validation_error_with_error_log_service(self, client):
        """Lines 247-258: error_log_service is available and logs the error."""
        from fastapi import APIRouter, Query
        router = APIRouter()

        @router.get("/test-val-log")
        async def needs_int(count: int = Query(...)):
            return {"count": count}

        self._app.include_router(router)

        mock_log_svc = MagicMock()
        mock_log_svc.log_error = AsyncMock()
        with patch(PATCH_DEPS_ERROR_LOG_SERVICE, return_value=mock_log_svc):
            resp = client.get("/test-val-log?count=abc")
            assert resp.status_code == 422

    def test_general_exception_with_error_log_service(self, client):
        """Lines 297-307: general exception handler logs via error_log_service."""
        from fastapi import APIRouter
        router = APIRouter()

        @router.get("/test-gen-log")
        async def raise_boom():
            raise RuntimeError("boom")

        self._app.include_router(router)

        mock_log_svc = MagicMock()
        mock_log_svc.log_error = AsyncMock()
        with patch(PATCH_DEPS_ERROR_LOG_SERVICE, return_value=mock_log_svc):
            resp = client.get("/test-gen-log")
            assert resp.status_code == 500

    def test_general_exception_error_log_service_fails(self, client):
        """Lines 306-307: error_log_service.log_error raises, caught gracefully."""
        from fastapi import APIRouter
        router = APIRouter()

        @router.get("/test-gen-log-fail")
        async def raise_boom():
            raise RuntimeError("boom")

        self._app.include_router(router)

        mock_log_svc = MagicMock()
        mock_log_svc.log_error = AsyncMock(side_effect=Exception("log failed"))
        with patch(PATCH_DEPS_ERROR_LOG_SERVICE, return_value=mock_log_svc):
            resp = client.get("/test-gen-log-fail")
            assert resp.status_code == 500

    def test_pydantic_validation_error_handler(self, client):
        """Lines 268-288: Pydantic ValidationError returns 500."""
        from fastapi import APIRouter
        from pydantic import BaseModel
        router = APIRouter()

        class StrictModel(BaseModel):
            value: int

        @router.get("/test-pydantic-error")
        async def trigger_pydantic_error():
            # Force a Pydantic ValidationError by validating bad data
            StrictModel.model_validate({"value": "not_an_int"})

        self._app.include_router(router)
        resp = client.get("/test-pydantic-error")
        assert resp.status_code == 500
        assert resp.json()["error"] == "Data validation error"
