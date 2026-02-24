"""Comprehensive RBAC tests for access control module.

Tests cover:
- get_current_user with valid, expired, no, and invalid tokens
- require_admin allows admin + super-admin, rejects others
- require_super_admin allows only super-administrator
- require_group_admin allows group-admin + group-editor + admin + super
- require_admin_or_editor allows editors + admins + group roles
- Cookie-based auth vs header-based auth
- Edge cases: multiple roles, empty roles, partial payloads
"""
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi import HTTPException

from easylifeauth.security.access_control import (
    CurrentUser,
    AccessControl,
    get_current_user,
    require_admin,
    require_super_admin,
    require_group_admin,
    require_admin_or_editor,
    set_token_manager,
    get_token_manager,
)
from easylifeauth.errors.auth_error import AuthError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ALL_ROLES = [
    "viewer",
    "user",
    "editor",
    "group-editor",
    "group-administrator",
    "administrator",
    "super-administrator",
]

ADMIN_ONLY = {"administrator", "super-administrator"}
SUPER_ONLY = {"super-administrator"}
GROUP_ADMIN_ALLOWED = {"group-administrator", "group-editor", "administrator", "super-administrator"}
EDITOR_ALLOWED = {"administrator", "super-administrator", "editor", "group-administrator", "group-editor"}


def _make_user(role: str) -> CurrentUser:
    return CurrentUser(
        user_id="uid-test",
        email=f"{role}@example.com",
        roles=[role],
        groups=[],
        domains=[],
    )


def _make_mock_request(cookie_token=None):
    req = MagicMock()
    req.cookies = {}
    if cookie_token:
        req.cookies["access_token"] = cookie_token
    return req


def _make_mock_credentials(token=None):
    if token is None:
        return None
    cred = MagicMock()
    cred.credentials = token
    return cred


# ===========================================================================
# 1. require_admin – standalone function
# ===========================================================================
class TestRequireAdmin:
    """require_admin must allow ADMIN_ROLES and reject everything else."""

    @pytest.mark.parametrize("role", ALL_ROLES)
    def test_all_roles(self, role):
        user = _make_user(role)
        if role in ADMIN_ONLY:
            result = require_admin(user)
            assert result == user
        else:
            with pytest.raises(HTTPException) as exc_info:
                require_admin(user)
            assert exc_info.value.status_code == 403
            assert "Administrator access required" in exc_info.value.detail

    def test_multiple_roles_with_admin(self):
        user = CurrentUser(
            user_id="uid", email="multi@example.com",
            roles=["user", "administrator"], groups=[], domains=[],
        )
        assert require_admin(user) == user

    def test_empty_roles(self):
        user = CurrentUser(
            user_id="uid", email="empty@example.com",
            roles=[], groups=[], domains=[],
        )
        with pytest.raises(HTTPException) as exc_info:
            require_admin(user)
        assert exc_info.value.status_code == 403


# ===========================================================================
# 2. require_super_admin – standalone function
# ===========================================================================
class TestRequireSuperAdmin:
    """require_super_admin must allow only super-administrator."""

    @pytest.mark.parametrize("role", ALL_ROLES)
    def test_all_roles(self, role):
        user = _make_user(role)
        if role in SUPER_ONLY:
            assert require_super_admin(user) == user
        else:
            with pytest.raises(HTTPException) as exc_info:
                require_super_admin(user)
            assert exc_info.value.status_code == 403
            assert "Super Administrator access required" in exc_info.value.detail

    def test_admin_is_not_super(self):
        user = _make_user("administrator")
        with pytest.raises(HTTPException):
            require_super_admin(user)


# ===========================================================================
# 3. require_group_admin – standalone function
# ===========================================================================
class TestRequireGroupAdmin:
    """require_group_admin allows ADMIN_ROLES + GROUP_ADMIN_ROLES."""

    @pytest.mark.parametrize("role", ALL_ROLES)
    def test_all_roles(self, role):
        user = _make_user(role)
        if role in GROUP_ADMIN_ALLOWED:
            assert require_group_admin(user) == user
        else:
            with pytest.raises(HTTPException) as exc_info:
                require_group_admin(user)
            assert exc_info.value.status_code == 403
            assert "Group Administrator access required" in exc_info.value.detail

    def test_group_editor_allowed(self):
        user = _make_user("group-editor")
        assert require_group_admin(user) == user


# ===========================================================================
# 4. require_admin_or_editor – standalone function
# ===========================================================================
class TestRequireAdminOrEditor:
    """require_admin_or_editor allows EDITORS list."""

    @pytest.mark.parametrize("role", ALL_ROLES)
    def test_all_roles(self, role):
        user = _make_user(role)
        if role in EDITOR_ALLOWED:
            assert require_admin_or_editor(user) == user
        else:
            with pytest.raises(HTTPException) as exc_info:
                require_admin_or_editor(user)
            assert exc_info.value.status_code == 403
            assert "Administrator/Editor access required" in exc_info.value.detail

    def test_viewer_rejected(self):
        user = _make_user("viewer")
        with pytest.raises(HTTPException):
            require_admin_or_editor(user)


# ===========================================================================
# 5. AccessControl class methods
# ===========================================================================
class TestAccessControlClass:
    """Tests for the class-based AccessControl methods."""

    @pytest.fixture
    def ac(self, mock_token_manager):
        mock_token_manager.verify_token = AsyncMock(return_value={
            "user_id": "123", "email": "t@ex.com",
            "roles": ["user"], "groups": [], "domains": [],
        })
        return AccessControl(mock_token_manager)

    # require_admin (class) -------------------------------------------------
    @pytest.mark.parametrize("role", ALL_ROLES)
    def test_class_require_admin(self, ac, role):
        user = _make_user(role)
        if role in ADMIN_ONLY:
            assert ac.require_admin(user) == user
        else:
            with pytest.raises(HTTPException) as exc:
                ac.require_admin(user)
            assert exc.value.status_code == 403

    # require_super_admin (class) -------------------------------------------
    @pytest.mark.parametrize("role", ALL_ROLES)
    def test_class_require_super_admin(self, ac, role):
        user = _make_user(role)
        if role in SUPER_ONLY:
            assert ac.require_super_admin(user) == user
        else:
            with pytest.raises(HTTPException):
                ac.require_super_admin(user)

    # require_group_admin (class) -------------------------------------------
    @pytest.mark.parametrize("role", ALL_ROLES)
    def test_class_require_group_admin(self, ac, role):
        user = _make_user(role)
        if role in GROUP_ADMIN_ALLOWED:
            assert ac.require_group_admin(user) == user
        else:
            with pytest.raises(HTTPException):
                ac.require_group_admin(user)

    # require_admin_or_editor (class) ---------------------------------------
    @pytest.mark.parametrize("role", ALL_ROLES)
    def test_class_require_admin_or_editor(self, ac, role):
        user = _make_user(role)
        if role in EDITOR_ALLOWED:
            assert ac.require_admin_or_editor(user) == user
        else:
            with pytest.raises(HTTPException):
                ac.require_admin_or_editor(user)


# ===========================================================================
# 6. get_current_user (AccessControl class) – token flow
# ===========================================================================
class TestAccessControlGetCurrentUser:
    """Tests for AccessControl.get_current_user covering token scenarios."""

    @pytest.mark.asyncio
    async def test_valid_token_from_header(self, mock_token_manager):
        mock_token_manager.verify_token = AsyncMock(return_value={
            "user_id": "u1", "email": "a@b.com",
            "roles": ["user", "editor"], "groups": ["g1"], "domains": ["d1"],
        })
        ac = AccessControl(mock_token_manager)
        request = _make_mock_request()
        creds = _make_mock_credentials("valid_token")

        result = await ac.get_current_user(request, creds)
        assert result.user_id == "u1"
        assert result.email == "a@b.com"
        assert "editor" in result.roles
        assert "g1" in result.groups
        assert "d1" in result.domains

    @pytest.mark.asyncio
    async def test_valid_token_from_cookie(self, mock_token_manager):
        mock_token_manager.verify_token = AsyncMock(return_value={
            "user_id": "u2", "email": "c@d.com",
            "roles": ["administrator"], "groups": [], "domains": ["all"],
        })
        ac = AccessControl(mock_token_manager)
        request = _make_mock_request(cookie_token="cookie_token")

        result = await ac.get_current_user(request, None)
        assert result.user_id == "u2"
        mock_token_manager.verify_token.assert_called_once_with("cookie_token")

    @pytest.mark.asyncio
    async def test_cookie_takes_precedence_over_header(self, mock_token_manager):
        """Cookie token should be preferred when both are present."""
        mock_token_manager.verify_token = AsyncMock(return_value={
            "user_id": "u3", "email": "e@f.com",
            "roles": ["user"], "groups": [], "domains": [],
        })
        ac = AccessControl(mock_token_manager)
        request = _make_mock_request(cookie_token="cookie_tok")
        creds = _make_mock_credentials("header_tok")

        await ac.get_current_user(request, creds)
        mock_token_manager.verify_token.assert_called_once_with("cookie_tok")

    @pytest.mark.asyncio
    async def test_no_token_raises_401(self, mock_token_manager):
        ac = AccessControl(mock_token_manager)
        request = _make_mock_request()

        with pytest.raises(HTTPException) as exc_info:
            await ac.get_current_user(request, None)
        assert exc_info.value.status_code == 401
        assert "Not authenticated" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_expired_token_raises_401(self, mock_token_manager):
        mock_token_manager.verify_token = AsyncMock(
            side_effect=AuthError("Token expired", 401)
        )
        ac = AccessControl(mock_token_manager)
        request = _make_mock_request()
        creds = _make_mock_credentials("expired_token")

        with pytest.raises(HTTPException) as exc_info:
            await ac.get_current_user(request, creds)
        assert exc_info.value.status_code == 401
        assert "Token expired" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_invalid_token_raises_401(self, mock_token_manager):
        mock_token_manager.verify_token = AsyncMock(
            side_effect=AuthError("Invalid token", 401)
        )
        ac = AccessControl(mock_token_manager)
        request = _make_mock_request()
        creds = _make_mock_credentials("bad_token")

        with pytest.raises(HTTPException) as exc_info:
            await ac.get_current_user(request, creds)
        assert exc_info.value.status_code == 401
        assert exc_info.value.headers["WWW-Authenticate"] == "Bearer"

    @pytest.mark.asyncio
    async def test_partial_payload_uses_defaults(self, mock_token_manager):
        mock_token_manager.verify_token = AsyncMock(return_value={})
        ac = AccessControl(mock_token_manager)
        request = _make_mock_request()
        creds = _make_mock_credentials("partial_token")

        result = await ac.get_current_user(request, creds)
        assert result.user_id == ""
        assert result.email == ""
        assert result.roles == []
        assert result.groups == []
        assert result.domains == []


# ===========================================================================
# 7. Standalone get_current_user function
# ===========================================================================
class TestStandaloneGetCurrentUser:
    """Tests for the module-level get_current_user dependency."""

    @pytest.mark.asyncio
    async def test_success(self, mock_token_manager):
        mock_token_manager.verify_token = AsyncMock(return_value={
            "user_id": "u-standalone", "email": "s@t.com",
            "roles": ["administrator"], "groups": ["admins"], "domains": ["all"],
        })
        set_token_manager(mock_token_manager)
        request = _make_mock_request()
        creds = _make_mock_credentials("good_token")

        result = await get_current_user(request, creds)
        assert result.user_id == "u-standalone"
        assert "administrator" in result.roles

    @pytest.mark.asyncio
    async def test_no_token(self, mock_token_manager):
        set_token_manager(mock_token_manager)
        request = _make_mock_request()

        with pytest.raises(HTTPException) as exc:
            await get_current_user(request, None)
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_auth_error(self, mock_token_manager):
        mock_token_manager.verify_token = AsyncMock(
            side_effect=AuthError("Token revoked", 401)
        )
        set_token_manager(mock_token_manager)
        request = _make_mock_request()
        creds = _make_mock_credentials("revoked")

        with pytest.raises(HTTPException) as exc:
            await get_current_user(request, creds)
        assert exc.value.status_code == 401
        assert "Token revoked" in exc.value.detail

    @pytest.mark.asyncio
    async def test_cookie_auth(self, mock_token_manager):
        mock_token_manager.verify_token = AsyncMock(return_value={
            "user_id": "u-cookie", "email": "cookie@ex.com",
            "roles": ["user"], "groups": [], "domains": [],
        })
        set_token_manager(mock_token_manager)
        request = _make_mock_request(cookie_token="my_cookie_token")

        result = await get_current_user(request, None)
        assert result.user_id == "u-cookie"
        mock_token_manager.verify_token.assert_called_once_with("my_cookie_token")


# ===========================================================================
# 8. Token manager helpers
# ===========================================================================
class TestTokenManagerHelpers:
    """Tests for set/get token_manager module helpers."""

    def test_set_and_get(self, mock_token_manager):
        set_token_manager(mock_token_manager)
        assert get_token_manager() is mock_token_manager

    def test_get_uninitialized(self):
        import easylifeauth.security.access_control as ac
        original = ac._token_manager
        try:
            ac._token_manager = None
            with pytest.raises(HTTPException) as exc:
                get_token_manager()
            assert exc.value.status_code == 500
        finally:
            ac._token_manager = original


# ===========================================================================
# 9. CurrentUser model edge cases
# ===========================================================================
class TestCurrentUserModel:

    def test_basic_creation(self):
        u = CurrentUser(user_id="1", email="a@b.com", roles=["viewer"])
        assert u.user_id == "1"
        assert u.groups == []
        assert u.domains == []

    def test_full_creation(self):
        u = CurrentUser(
            user_id="2", email="b@c.com",
            roles=["admin", "editor"],
            groups=["g1", "g2"],
            domains=["d1", "d2"],
        )
        assert len(u.roles) == 2
        assert len(u.groups) == 2
        assert len(u.domains) == 2

    def test_empty_roles(self):
        u = CurrentUser(user_id="3", email="c@d.com", roles=[])
        assert u.roles == []
