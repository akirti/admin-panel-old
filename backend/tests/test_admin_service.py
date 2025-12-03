"""Tests for Admin Service"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId

from easylifeauth.services.admin_service import AdminService
from easylifeauth.errors.auth_error import AuthError


class TestAdminService:
    """Tests for AdminService"""

    @pytest.fixture
    def admin_service(self, mock_db):
        """Create admin service with mocks"""
        return AdminService(mock_db)

    @pytest.mark.asyncio
    async def test_get_all_users_success(self, admin_service, mock_db, sample_user_data):
        """Test getting all users"""
        sample_user_data["_id"] = ObjectId(sample_user_data["_id"])
        
        mock_cursor = AsyncMock()
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_user_data])
        
        mock_db.users.find = MagicMock(return_value=mock_cursor)
        mock_db.users.count_documents = AsyncMock(return_value=1)
        
        result = await admin_service.get_all_users(
            current_user={"roles": ["administrator"]},
            pagination={"page": 0, "limit": 25}
        )
        
        assert "data" in result
        assert "pagination" in result

    @pytest.mark.asyncio
    async def test_get_all_users_group_admin(self, admin_service, mock_db, sample_user_data):
        """Test getting users as group admin (filtered by groups)"""
        sample_user_data["_id"] = ObjectId(sample_user_data["_id"])
        
        mock_cursor = AsyncMock()
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_user_data])
        
        mock_db.users.find = MagicMock(return_value=mock_cursor)
        mock_db.users.count_documents = AsyncMock(return_value=1)
        
        result = await admin_service.get_all_users(
            current_user={"roles": ["group-administrator"], "groups": ["team-a"]},
            pagination={"page": 0, "limit": 25}
        )
        
        assert "data" in result

    @pytest.mark.asyncio
    async def test_update_user_status_activate(self, admin_service, mock_db):
        """Test activating a user"""
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        
        result = await admin_service.update_user_status(
            "507f1f77bcf86cd799439011",
            True
        )
        
        assert "activated" in result["message"]

    @pytest.mark.asyncio
    async def test_update_user_status_deactivate(self, admin_service, mock_db):
        """Test deactivating a user"""
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        
        result = await admin_service.update_user_status(
            "507f1f77bcf86cd799439011",
            False
        )
        
        assert "deactivate" in result["message"]

    @pytest.mark.asyncio
    async def test_update_user_status_not_found(self, admin_service, mock_db):
        """Test updating status of non-existent user"""
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=0))
        
        result = await admin_service.update_user_status(
            "nonexistent",
            True
        )
        
        # Returns AuthError object instead of raising
        assert isinstance(result, AuthError)

    @pytest.mark.asyncio
    async def test_update_user_role_success(self, admin_service, mock_db):
        """Test updating user roles"""
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        
        result = await admin_service.update_user_role(
            "507f1f77bcf86cd799439011",
            ["user", "editor"]
        )
        
        assert result["message"] == "User role updated successfully"

    @pytest.mark.asyncio
    async def test_update_user_role_invalid_roles(self, admin_service, mock_db):
        """Test updating with invalid roles"""
        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_role(
                "507f1f77bcf86cd799439011",
                ["invalid_role"]
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_update_user_role_not_found(self, admin_service, mock_db):
        """Test updating roles of non-existent user"""
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=0))
        
        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_role(
                "nonexistent",
                ["user"]
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_update_user_groups_success(self, admin_service, mock_db):
        """Test updating user groups"""
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        
        result = await admin_service.update_user_groups(
            "507f1f77bcf86cd799439011",
            ["viewer", "editor"]
        )
        
        assert result["message"] == "User groups updated successfully"

    @pytest.mark.asyncio
    async def test_update_user_groups_not_found(self, admin_service, mock_db):
        """Test updating groups of non-existent user"""
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=0))
        
        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_groups(
                "nonexistent",
                ["viewer"]
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_update_user_domains_success(self, admin_service, mock_db):
        """Test updating user domains"""
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        
        result = await admin_service.update_user_domains(
            "507f1f77bcf86cd799439011",
            ["domain1", "domain2"]
        )
        
        assert result["message"] == "User domains updated successfully"

    @pytest.mark.asyncio
    async def test_update_user_domains_not_found(self, admin_service, mock_db):
        """Test updating domains of non-existent user"""
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=0))
        
        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_domains(
                "nonexistent",
                ["domain1"]
            )
        assert exc_info.value.status_code == 404
