"""Tests for Access Control"""
import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from fastapi import HTTPException

from easylifeauth.security.access_control import (
    CurrentUser, set_token_manager, get_token_manager,
    require_admin, require_super_admin, require_group_admin,
    require_admin_or_editor, AccessControl
)
from easylifeauth.errors.auth_error import AuthError


class TestCurrentUser:
    """Tests for CurrentUser model"""

    def test_create_current_user(self):
        """Test creating CurrentUser instance"""
        user = CurrentUser(
            user_id="123",
            email="test@example.com",
            roles=["user"]
        )

        assert user.user_id == "123"
        assert user.email == "test@example.com"
        assert user.roles == ["user"]

    def test_current_user_defaults(self):
        """Test CurrentUser default values"""
        user = CurrentUser(
            user_id="123",
            email="test@example.com",
            roles=["user"]
        )

        assert user.groups == []
        assert user.domains == []


class TestSetTokenManager:
    """Tests for set_token_manager"""

    def test_set_token_manager(self, mock_token_manager):
        """Test setting token manager"""
        set_token_manager(mock_token_manager)
        # Should not raise
        result = get_token_manager()
        assert result is mock_token_manager

    def test_get_token_manager_not_set(self):
        """Test get_token_manager raises when not set"""
        import easylifeauth.security.access_control as ac
        original = ac._token_manager
        try:
            ac._token_manager = None
            with pytest.raises(HTTPException) as exc_info:
                get_token_manager()
            assert exc_info.value.status_code == 500
        finally:
            ac._token_manager = original


class TestAccessControlClass:
    """Tests for AccessControl class methods"""

    @pytest.fixture
    def access_control(self, mock_token_manager):
        """Create access control instance with mock"""
        mock_token_manager.verify_token = AsyncMock(return_value={
            "user_id": "123",
            "email": "test@example.com",
            "roles": ["user"],
            "groups": ["viewer"],
            "domains": []
        })
        return AccessControl(mock_token_manager)

    def test_require_admin_success(self, access_control):
        """Test require_admin with admin user"""
        user = CurrentUser(
            user_id="123",
            email="admin@example.com",
            roles=["administrator"],
            groups=[],
            domains=[]
        )
        result = access_control.require_admin(user)
        assert result == user

    def test_require_admin_forbidden(self, access_control):
        """Test require_admin with non-admin user"""
        user = CurrentUser(
            user_id="123",
            email="user@example.com",
            roles=["user"],
            groups=[],
            domains=[]
        )
        with pytest.raises(HTTPException) as exc_info:
            access_control.require_admin(user)
        assert exc_info.value.status_code == 403

    def test_require_super_admin_success(self, access_control):
        """Test require_super_admin with super admin"""
        user = CurrentUser(
            user_id="123",
            email="super@example.com",
            roles=["super-administrator"],
            groups=[],
            domains=[]
        )
        result = access_control.require_super_admin(user)
        assert result == user

    def test_require_super_admin_forbidden(self, access_control):
        """Test require_super_admin without super admin role"""
        user = CurrentUser(
            user_id="123",
            email="admin@example.com",
            roles=["administrator"],
            groups=[],
            domains=[]
        )
        with pytest.raises(HTTPException) as exc_info:
            access_control.require_super_admin(user)
        assert exc_info.value.status_code == 403

    def test_require_admin_or_editor_with_admin(self, access_control):
        """Test require_admin_or_editor with admin"""
        user = CurrentUser(
            user_id="123",
            email="admin@example.com",
            roles=["administrator"],
            groups=[],
            domains=[]
        )
        result = access_control.require_admin_or_editor(user)
        assert result == user

    def test_require_admin_or_editor_with_editor(self, access_control):
        """Test require_admin_or_editor with editor"""
        user = CurrentUser(
            user_id="123",
            email="editor@example.com",
            roles=["editor"],
            groups=[],
            domains=[]
        )
        result = access_control.require_admin_or_editor(user)
        assert result == user

    def test_require_admin_or_editor_forbidden(self, access_control):
        """Test require_admin_or_editor without proper role"""
        user = CurrentUser(
            user_id="123",
            email="user@example.com",
            roles=["user"],
            groups=[],
            domains=[]
        )
        with pytest.raises(HTTPException) as exc_info:
            access_control.require_admin_or_editor(user)
        assert exc_info.value.status_code == 403

    def test_require_group_admin_with_admin(self, access_control):
        """Test require_group_admin with admin"""
        user = CurrentUser(
            user_id="123",
            email="admin@example.com",
            roles=["administrator"],
            groups=[],
            domains=[]
        )
        result = access_control.require_group_admin(user)
        assert result == user

    def test_require_group_admin_with_group_admin(self, access_control):
        """Test require_group_admin with group-administrator"""
        user = CurrentUser(
            user_id="123",
            email="groupadmin@example.com",
            roles=["group-administrator"],
            groups=[],
            domains=[]
        )
        result = access_control.require_group_admin(user)
        assert result == user

    def test_require_group_admin_forbidden(self, access_control):
        """Test require_group_admin without proper role"""
        user = CurrentUser(
            user_id="123",
            email="user@example.com",
            roles=["user"],
            groups=[],
            domains=[]
        )
        with pytest.raises(HTTPException) as exc_info:
            access_control.require_group_admin(user)
        assert exc_info.value.status_code == 403


class TestRequireFunctions:
    """Tests for require_* functions that take CurrentUser directly"""

    def test_require_admin_function_success(self):
        """Test require_admin function with admin role"""
        user = CurrentUser(
            user_id="123",
            email="admin@example.com",
            roles=["administrator"],
            groups=[],
            domains=[]
        )
        # Call directly with CurrentUser - the default gets the user
        result = require_admin(user)
        assert result == user

    def test_require_admin_function_forbidden(self):
        """Test require_admin function without admin role"""
        user = CurrentUser(
            user_id="123",
            email="user@example.com",
            roles=["user"],
            groups=[],
            domains=[]
        )
        with pytest.raises(HTTPException) as exc_info:
            require_admin(user)
        assert exc_info.value.status_code == 403

    def test_require_super_admin_function_success(self):
        """Test require_super_admin function"""
        user = CurrentUser(
            user_id="123",
            email="super@example.com",
            roles=["super-administrator"],
            groups=[],
            domains=[]
        )
        result = require_super_admin(user)
        assert result == user

    def test_require_super_admin_function_forbidden(self):
        """Test require_super_admin function without super admin"""
        user = CurrentUser(
            user_id="123",
            email="admin@example.com",
            roles=["administrator"],
            groups=[],
            domains=[]
        )
        with pytest.raises(HTTPException) as exc_info:
            require_super_admin(user)
        assert exc_info.value.status_code == 403

    def test_require_group_admin_function_success(self):
        """Test require_group_admin with admin"""
        user = CurrentUser(
            user_id="123",
            email="admin@example.com",
            roles=["administrator"],
            groups=[],
            domains=[]
        )
        result = require_group_admin(user)
        assert result == user

    def test_require_group_admin_function_with_group_admin(self):
        """Test require_group_admin with group-administrator"""
        user = CurrentUser(
            user_id="123",
            email="groupadmin@example.com",
            roles=["group-administrator"],
            groups=[],
            domains=[]
        )
        result = require_group_admin(user)
        assert result == user

    def test_require_group_admin_function_forbidden(self):
        """Test require_group_admin without proper role"""
        user = CurrentUser(
            user_id="123",
            email="user@example.com",
            roles=["user"],
            groups=[],
            domains=[]
        )
        with pytest.raises(HTTPException) as exc_info:
            require_group_admin(user)
        assert exc_info.value.status_code == 403

    def test_require_admin_or_editor_function_with_admin(self):
        """Test require_admin_or_editor with admin"""
        user = CurrentUser(
            user_id="123",
            email="admin@example.com",
            roles=["administrator"],
            groups=[],
            domains=[]
        )
        result = require_admin_or_editor(user)
        assert result == user

    def test_require_admin_or_editor_function_with_editor(self):
        """Test require_admin_or_editor with editor"""
        user = CurrentUser(
            user_id="123",
            email="editor@example.com",
            roles=["editor"],
            groups=[],
            domains=[]
        )
        result = require_admin_or_editor(user)
        assert result == user

    def test_require_admin_or_editor_function_with_group_editor(self):
        """Test require_admin_or_editor with group-editor"""
        user = CurrentUser(
            user_id="123",
            email="groupeditor@example.com",
            roles=["group-editor"],
            groups=[],
            domains=[]
        )
        result = require_admin_or_editor(user)
        assert result == user

    def test_require_admin_or_editor_function_forbidden(self):
        """Test require_admin_or_editor without proper role"""
        user = CurrentUser(
            user_id="123",
            email="user@example.com",
            roles=["user"],
            groups=[],
            domains=[]
        )
        with pytest.raises(HTTPException) as exc_info:
            require_admin_or_editor(user)
        assert exc_info.value.status_code == 403
