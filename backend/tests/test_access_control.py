"""Tests for Access Control"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
import jwt

from easylifeauth.security.access_control import (
    CurrentUser, get_current_user, set_token_manager,
    require_admin, require_super_admin, require_group_admin,
    require_admin_or_editor
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


class TestGetCurrentUser:
    """Tests for get_current_user dependency"""

    @pytest.mark.asyncio
    async def test_get_current_user_success(self, mock_token_manager):
        """Test getting current user with valid token"""
        set_token_manager(mock_token_manager)
        mock_token_manager.verify_token = MagicMock(return_value={
            "user_id": "123",
            "email": "test@example.com",
            "roles": ["user"],
            "groups": ["viewer"],
            "domains": []
        })
        
        user = await get_current_user(token="valid_token")
        
        assert user.user_id == "123"
        assert user.email == "test@example.com"

    @pytest.mark.asyncio
    async def test_get_current_user_missing_token(self, mock_token_manager):
        """Test getting current user without token"""
        set_token_manager(mock_token_manager)
        
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(token=None)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_get_current_user_invalid_token(self, mock_token_manager):
        """Test getting current user with invalid token"""
        set_token_manager(mock_token_manager)
        mock_token_manager.verify_token = MagicMock(
            side_effect=AuthError("Invalid token", 401)
        )
        
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(token="invalid_token")
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_get_current_user_no_token_manager(self):
        """Test getting current user without token manager set"""
        # Reset token manager to None
        from easylifeauth.security import access_control
        access_control._token_manager = None
        
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(token="some_token")
        assert exc_info.value.status_code == 500


class TestRequireAdmin:
    """Tests for require_admin dependency"""

    @pytest.mark.asyncio
    async def test_require_admin_success(self, mock_token_manager):
        """Test admin access with admin role"""
        set_token_manager(mock_token_manager)
        mock_token_manager.verify_token = MagicMock(return_value={
            "user_id": "123",
            "email": "admin@example.com",
            "roles": ["administrator"],
            "groups": [],
            "domains": []
        })
        
        user = await require_admin(token="admin_token")
        
        assert "administrator" in user.roles

    @pytest.mark.asyncio
    async def test_require_admin_forbidden(self, mock_token_manager):
        """Test admin access without admin role"""
        set_token_manager(mock_token_manager)
        mock_token_manager.verify_token = MagicMock(return_value={
            "user_id": "123",
            "email": "user@example.com",
            "roles": ["user"],
            "groups": [],
            "domains": []
        })
        
        with pytest.raises(HTTPException) as exc_info:
            await require_admin(token="user_token")
        assert exc_info.value.status_code == 403


class TestRequireSuperAdmin:
    """Tests for require_super_admin dependency"""

    @pytest.mark.asyncio
    async def test_require_super_admin_success(self, mock_token_manager):
        """Test super admin access"""
        set_token_manager(mock_token_manager)
        mock_token_manager.verify_token = MagicMock(return_value={
            "user_id": "123",
            "email": "super@example.com",
            "roles": ["super-administrator"],
            "groups": [],
            "domains": []
        })
        
        user = await require_super_admin(token="super_token")
        
        assert "super-administrator" in user.roles

    @pytest.mark.asyncio
    async def test_require_super_admin_forbidden(self, mock_token_manager):
        """Test super admin access without super admin role"""
        set_token_manager(mock_token_manager)
        mock_token_manager.verify_token = MagicMock(return_value={
            "user_id": "123",
            "email": "admin@example.com",
            "roles": ["administrator"],  # Not super admin
            "groups": [],
            "domains": []
        })
        
        with pytest.raises(HTTPException) as exc_info:
            await require_super_admin(token="admin_token")
        assert exc_info.value.status_code == 403


class TestRequireGroupAdmin:
    """Tests for require_group_admin dependency"""

    @pytest.mark.asyncio
    async def test_require_group_admin_with_admin(self, mock_token_manager):
        """Test group admin access with admin role"""
        set_token_manager(mock_token_manager)
        mock_token_manager.verify_token = MagicMock(return_value={
            "user_id": "123",
            "email": "admin@example.com",
            "roles": ["administrator"],
            "groups": [],
            "domains": []
        })
        
        user = await require_group_admin(token="admin_token")
        
        assert user is not None

    @pytest.mark.asyncio
    async def test_require_group_admin_with_group_admin(self, mock_token_manager):
        """Test group admin access with group-administrator role"""
        set_token_manager(mock_token_manager)
        mock_token_manager.verify_token = MagicMock(return_value={
            "user_id": "123",
            "email": "groupadmin@example.com",
            "roles": ["group-administrator"],
            "groups": [],
            "domains": []
        })
        
        user = await require_group_admin(token="group_admin_token")
        
        assert user is not None

    @pytest.mark.asyncio
    async def test_require_group_admin_forbidden(self, mock_token_manager):
        """Test group admin access without proper role"""
        set_token_manager(mock_token_manager)
        mock_token_manager.verify_token = MagicMock(return_value={
            "user_id": "123",
            "email": "user@example.com",
            "roles": ["user"],
            "groups": [],
            "domains": []
        })
        
        with pytest.raises(HTTPException) as exc_info:
            await require_group_admin(token="user_token")
        assert exc_info.value.status_code == 403


class TestRequireAdminOrEditor:
    """Tests for require_admin_or_editor dependency"""

    @pytest.mark.asyncio
    async def test_require_admin_or_editor_with_admin(self, mock_token_manager):
        """Test access with admin role"""
        set_token_manager(mock_token_manager)
        mock_token_manager.verify_token = MagicMock(return_value={
            "user_id": "123",
            "email": "admin@example.com",
            "roles": ["administrator"],
            "groups": [],
            "domains": []
        })
        
        user = await require_admin_or_editor(token="admin_token")
        
        assert user is not None

    @pytest.mark.asyncio
    async def test_require_admin_or_editor_with_editor(self, mock_token_manager):
        """Test access with editor role"""
        set_token_manager(mock_token_manager)
        mock_token_manager.verify_token = MagicMock(return_value={
            "user_id": "123",
            "email": "editor@example.com",
            "roles": ["editor"],
            "groups": [],
            "domains": []
        })
        
        user = await require_admin_or_editor(token="editor_token")
        
        assert user is not None

    @pytest.mark.asyncio
    async def test_require_admin_or_editor_with_group_editor(self, mock_token_manager):
        """Test access with group-editor role"""
        set_token_manager(mock_token_manager)
        mock_token_manager.verify_token = MagicMock(return_value={
            "user_id": "123",
            "email": "groupeditor@example.com",
            "roles": ["group-editor"],
            "groups": [],
            "domains": []
        })
        
        user = await require_admin_or_editor(token="group_editor_token")
        
        assert user is not None

    @pytest.mark.asyncio
    async def test_require_admin_or_editor_forbidden(self, mock_token_manager):
        """Test access without admin or editor role"""
        set_token_manager(mock_token_manager)
        mock_token_manager.verify_token = MagicMock(return_value={
            "user_id": "123",
            "email": "user@example.com",
            "roles": ["user"],
            "groups": [],
            "domains": []
        })
        
        with pytest.raises(HTTPException) as exc_info:
            await require_admin_or_editor(token="user_token")
        assert exc_info.value.status_code == 403
