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
        mock_db.users.find_one = AsyncMock(return_value=None)

        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_status(
                "507f1f77bcf86cd799439099",
                True
            )
        assert exc_info.value.status_code == 404

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
                "507f1f77bcf86cd799439099",
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
                "507f1f77bcf86cd799439099",
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
                "507f1f77bcf86cd799439099",
                ["domain1"]
            )
        assert exc_info.value.status_code == 404

    # ===================== Additional Tests for Coverage =====================

    @pytest.mark.asyncio
    async def test_get_all_users_super_admin(self, admin_service, mock_db, sample_user_data):
        """Test getting all users as super admin (no filtering)"""
        sample_user_data["_id"] = ObjectId(sample_user_data["_id"])

        mock_cursor = AsyncMock()
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_user_data])

        mock_db.users.find = MagicMock(return_value=mock_cursor)
        mock_db.users.count_documents = AsyncMock(return_value=1)

        result = await admin_service.get_all_users(
            current_user={"roles": ["super-administrator"]},
            pagination={"page": 0, "limit": 25}
        )

        assert "data" in result
        # Super admin should see all users (empty query)
        mock_db.users.find.assert_called()

    @pytest.mark.asyncio
    async def test_get_all_users_regular_user_forbidden(self, admin_service, mock_db):
        """Test that regular users cannot get all users"""
        with pytest.raises(AuthError) as exc_info:
            await admin_service.get_all_users(
                current_user={"roles": ["user"]},
                pagination={"page": 0, "limit": 25}
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_get_all_users_with_string_pagination(self, admin_service, mock_db, sample_user_data):
        """Test pagination with string values (converted from query params)"""
        sample_user_data["_id"] = ObjectId(sample_user_data["_id"])

        mock_cursor = AsyncMock()
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_user_data])

        mock_db.users.find = MagicMock(return_value=mock_cursor)
        mock_db.users.count_documents = AsyncMock(return_value=50)

        result = await admin_service.get_all_users(
            current_user={"roles": ["administrator"]},
            pagination={
                "page": "2",
                "limit": "10",
                "skip": "20",
                "total": "50"
            }
        )

        assert "data" in result
        assert result["pagination"]["total"] == 50

    @pytest.mark.asyncio
    async def test_get_all_users_no_current_user(self, admin_service, mock_db, sample_user_data):
        """Test getting all users without current_user (system call)"""
        sample_user_data["_id"] = ObjectId(sample_user_data["_id"])

        mock_cursor = AsyncMock()
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_user_data])

        mock_db.users.find = MagicMock(return_value=mock_cursor)
        mock_db.users.count_documents = AsyncMock(return_value=1)

        result = await admin_service.get_all_users(
            current_user=None,
            pagination={"page": 0, "limit": 25}
        )

        assert "data" in result

    @pytest.mark.asyncio
    async def test_update_user_status_with_permission_check(self, admin_service, mock_db):
        """Test updating user status with permission check"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["user"],
            "groups": ["team-a"],
            "domains": ["domain1"]
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))

        # Super admin can manage anyone
        result = await admin_service.update_user_status(
            target_user_id,
            True,
            current_user={"roles": ["super-administrator"]}
        )

        assert "activated" in result["message"]

    @pytest.mark.asyncio
    async def test_update_user_status_admin_managing_user(self, admin_service, mock_db):
        """Test admin updating regular user status"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["user"],
            "groups": ["team-a"]
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))

        result = await admin_service.update_user_status(
            target_user_id,
            False,
            current_user={"roles": ["administrator"]}
        )

        assert "deactivate" in result["message"]

    @pytest.mark.asyncio
    async def test_update_user_status_admin_cannot_manage_super_admin(self, admin_service, mock_db):
        """Test that admin cannot manage super-admin"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["super-administrator"]
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)

        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_status(
                target_user_id,
                False,
                current_user={"roles": ["administrator"]}
            )
        assert exc_info.value.status_code == 403
        assert "super-administrator" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_update_user_status_group_admin_same_group(self, admin_service, mock_db):
        """Test group admin can manage users in same group"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["user"],
            "groups": ["team-a"],
            "domains": []
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))

        result = await admin_service.update_user_status(
            target_user_id,
            True,
            current_user={
                "roles": ["group-administrator"],
                "groups": ["team-a"],
                "domains": []
            }
        )

        assert "activated" in result["message"]

    @pytest.mark.asyncio
    async def test_update_user_status_group_admin_same_domain(self, admin_service, mock_db):
        """Test group admin can manage users in same domain"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["user"],
            "groups": [],
            "domains": ["finance"]
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))

        result = await admin_service.update_user_status(
            target_user_id,
            True,
            current_user={
                "roles": ["group-administrator"],
                "groups": [],
                "domains": ["finance"]
            }
        )

        assert "activated" in result["message"]

    @pytest.mark.asyncio
    async def test_update_user_status_group_admin_cannot_manage_admin(self, admin_service, mock_db):
        """Test group admin cannot manage administrator"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["administrator"],
            "groups": ["team-a"]
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)

        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_status(
                target_user_id,
                False,
                current_user={
                    "roles": ["group-administrator"],
                    "groups": ["team-a"],
                    "domains": []
                }
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_update_user_status_group_admin_different_group(self, admin_service, mock_db):
        """Test group admin cannot manage users in different group"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["user"],
            "groups": ["team-b"],
            "domains": []
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)

        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_status(
                target_user_id,
                False,
                current_user={
                    "roles": ["group-administrator"],
                    "groups": ["team-a"],
                    "domains": []
                }
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_update_user_status_regular_user_unauthorized(self, admin_service, mock_db):
        """Test regular user cannot manage others"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["user"],
            "groups": ["team-a"]
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)

        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_status(
                target_user_id,
                False,
                current_user={"roles": ["user"], "groups": ["team-a"]}
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_update_user_role_with_current_user_permission(self, admin_service, mock_db):
        """Test updating user role with permission check"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["user"]
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))

        result = await admin_service.update_user_role(
            target_user_id,
            ["user", "editor"],
            current_user={"roles": ["super-administrator"]}
        )

        assert result["message"] == "User role updated successfully"

    @pytest.mark.asyncio
    async def test_update_user_role_admin_cannot_assign_super_admin(self, admin_service, mock_db):
        """Test admin cannot assign super-administrator role"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["user"]
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)

        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_role(
                target_user_id,
                ["super-administrator"],
                current_user={"roles": ["administrator"]}
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_update_user_role_group_admin_limited_roles(self, admin_service, mock_db):
        """Test group admin can only assign viewer/user/editor roles"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["user"],
            "groups": ["team-a"]
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)

        # Group admin trying to assign administrator role
        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_role(
                target_user_id,
                ["administrator"],
                current_user={
                    "roles": ["group-administrator"],
                    "groups": ["team-a"]
                }
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_update_user_role_group_admin_allowed_roles(self, admin_service, mock_db):
        """Test group admin can assign viewer/user/editor roles"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["user"],
            "groups": ["team-a"],
            "domains": []
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))

        result = await admin_service.update_user_role(
            target_user_id,
            ["viewer", "editor"],
            current_user={
                "roles": ["group-administrator"],
                "groups": ["team-a"],
                "domains": []
            }
        )

        assert result["message"] == "User role updated successfully"

    @pytest.mark.asyncio
    async def test_update_user_role_regular_user_unauthorized(self, admin_service, mock_db):
        """Test regular user cannot update roles"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["user"]
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)

        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_role(
                target_user_id,
                ["editor"],
                current_user={"roles": ["user"]}
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_update_user_role_user_not_found_after_check(self, admin_service, mock_db):
        """Test role update when user not found during find_one"""
        mock_db.users.find_one = AsyncMock(return_value=None)

        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_role(
                "507f1f77bcf86cd799439011",
                ["user"],
                current_user={"roles": ["administrator"]}
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_update_user_groups_with_permission(self, admin_service, mock_db):
        """Test updating user groups with permission check"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["user"],
            "groups": ["team-a"],
            "domains": []
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))

        result = await admin_service.update_user_groups(
            target_user_id,
            ["team-a", "team-b"],
            current_user={
                "roles": ["administrator"],
                "groups": [],
                "domains": []
            }
        )

        assert result["message"] == "User groups updated successfully"

    @pytest.mark.asyncio
    async def test_update_user_groups_target_not_found(self, admin_service, mock_db):
        """Test updating groups when target user not found"""
        mock_db.users.find_one = AsyncMock(return_value=None)

        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_groups(
                "507f1f77bcf86cd799439011",
                ["team-a"],
                current_user={"roles": ["administrator"]}
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_update_user_domains_with_permission(self, admin_service, mock_db):
        """Test updating user domains with permission check"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["user"],
            "groups": [],
            "domains": ["finance"]
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))

        result = await admin_service.update_user_domains(
            target_user_id,
            ["finance", "marketing"],
            current_user={
                "roles": ["administrator"],
                "groups": [],
                "domains": []
            }
        )

        assert result["message"] == "User domains updated successfully"

    @pytest.mark.asyncio
    async def test_update_user_domains_group_admin_invalid_domains(self, admin_service, mock_db):
        """Test group admin cannot assign domains they don't have"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["user"],
            "groups": [],
            "domains": ["finance"]
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)

        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_domains(
                target_user_id,
                ["marketing", "hr"],  # domains they don't have
                current_user={
                    "roles": ["group-administrator"],
                    "groups": [],
                    "domains": ["finance"]  # only has finance
                }
            )
        assert exc_info.value.status_code == 403
        assert "Cannot assign domains" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_update_user_domains_group_admin_valid_domains(self, admin_service, mock_db):
        """Test group admin can assign their own domains"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["user"],
            "groups": [],
            "domains": ["finance"]
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))

        result = await admin_service.update_user_domains(
            target_user_id,
            ["finance"],  # domain they have
            current_user={
                "roles": ["group-administrator"],
                "groups": [],
                "domains": ["finance"]
            }
        )

        assert result["message"] == "User domains updated successfully"

    @pytest.mark.asyncio
    async def test_update_user_domains_target_not_found(self, admin_service, mock_db):
        """Test updating domains when target user not found"""
        mock_db.users.find_one = AsyncMock(return_value=None)

        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_domains(
                "507f1f77bcf86cd799439011",
                ["finance"],
                current_user={"roles": ["administrator"]}
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_user_by_id_success(self, admin_service, mock_db):
        """Test getting user by ID successfully"""
        user_id = "507f1f77bcf86cd799439011"
        user_data = {
            "_id": ObjectId(user_id),
            "email": "test@example.com",
            "username": "testuser",
            "password_hash": "secret_hash",
            "roles": ["user"]
        }

        mock_db.users.find_one = AsyncMock(return_value=user_data)

        result = await admin_service.get_user_by_id(user_id)

        assert result is not None
        assert result["_id"] == user_id
        assert result["email"] == "test@example.com"
        assert "password_hash" not in result

    @pytest.mark.asyncio
    async def test_get_user_by_id_not_found(self, admin_service, mock_db):
        """Test getting non-existent user by ID"""
        mock_db.users.find_one = AsyncMock(return_value=None)

        result = await admin_service.get_user_by_id("507f1f77bcf86cd799439011")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_by_id_invalid_id(self, admin_service, mock_db):
        """Test getting user with invalid ID format"""
        mock_db.users.find_one = AsyncMock(side_effect=Exception("Invalid ObjectId"))

        result = await admin_service.get_user_by_id("invalid_id")

        assert result is None

    @pytest.mark.asyncio
    async def test_delete_user_success(self, admin_service, mock_db):
        """Test successful user deletion by super admin"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "email": "delete@example.com"
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)
        mock_db.users.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
        mock_db.tokens.delete_many = AsyncMock(return_value=MagicMock(deleted_count=5))

        result = await admin_service.delete_user(
            target_user_id,
            current_user={
                "user_id": "different_user_id",
                "roles": ["super-administrator"]
            }
        )

        assert result["message"] == "User deleted successfully"
        mock_db.tokens.delete_many.assert_called_once_with({"user_id": target_user_id})

    @pytest.mark.asyncio
    async def test_delete_user_not_super_admin(self, admin_service, mock_db):
        """Test that non-super-admin cannot delete users"""
        with pytest.raises(AuthError) as exc_info:
            await admin_service.delete_user(
                "507f1f77bcf86cd799439011",
                current_user={"roles": ["administrator"]}
            )
        assert exc_info.value.status_code == 403
        assert "super-administrator" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_delete_user_not_found(self, admin_service, mock_db):
        """Test deleting non-existent user"""
        mock_db.users.find_one = AsyncMock(return_value=None)

        with pytest.raises(AuthError) as exc_info:
            await admin_service.delete_user(
                "507f1f77bcf86cd799439011",
                current_user={"roles": ["super-administrator"]}
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_user_cannot_delete_self(self, admin_service, mock_db):
        """Test user cannot delete themselves"""
        user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(user_id),
            "email": "self@example.com"
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)

        with pytest.raises(AuthError) as exc_info:
            await admin_service.delete_user(
                user_id,
                current_user={
                    "user_id": user_id,
                    "roles": ["super-administrator"]
                }
            )
        assert exc_info.value.status_code == 400
        assert "yourself" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_delete_user_delete_failed(self, admin_service, mock_db):
        """Test when delete_one returns 0 deleted count"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "email": "delete@example.com"
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)
        mock_db.users.delete_one = AsyncMock(return_value=MagicMock(deleted_count=0))

        with pytest.raises(AuthError) as exc_info:
            await admin_service.delete_user(
                target_user_id,
                current_user={
                    "user_id": "different_user_id",
                    "roles": ["super-administrator"]
                }
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_user_no_current_user(self, admin_service, mock_db):
        """Test deleting user without current_user (system call)"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "email": "delete@example.com"
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)
        mock_db.users.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
        mock_db.tokens.delete_many = AsyncMock(return_value=MagicMock(deleted_count=0))

        result = await admin_service.delete_user(target_user_id, current_user=None)

        assert result["message"] == "User deleted successfully"

    @pytest.mark.asyncio
    async def test_update_user_status_update_matched_zero(self, admin_service, mock_db):
        """Test status update when update_one matches 0 (race condition)"""
        target_user_id = "507f1f77bcf86cd799439011"
        target_user = {
            "_id": ObjectId(target_user_id),
            "roles": ["user"]
        }

        mock_db.users.find_one = AsyncMock(return_value=target_user)
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=0))

        with pytest.raises(AuthError) as exc_info:
            await admin_service.update_user_status(
                target_user_id,
                True,
                current_user={"roles": ["super-administrator"]}
            )
        assert exc_info.value.status_code == 404
