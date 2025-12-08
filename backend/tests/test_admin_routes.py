"""Tests for Admin Management Routes"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from bson import ObjectId

from easylifeauth.app import create_app
from easylifeauth.api.admin_routes import router
from easylifeauth.errors.auth_error import AuthError
from easylifeauth import API_BASE_ROUTE


@pytest.fixture
def mock_admin_service():
    """Mock admin service"""
    service = MagicMock()
    return service


@pytest.fixture
def app(mock_admin_service):
    """Create test app with mocked dependencies"""
    app = create_app()

    # Override dependencies
    from easylifeauth.api.dependencies import get_admin_service
    from easylifeauth.security.access_control import require_group_admin, require_super_admin

    async def mock_get_admin_service():
        return mock_admin_service

    async def mock_require_group_admin():
        return MagicMock(
            user_id="admin_user_id",
            email="admin@test.com",
            roles=["admin"],
            groups=["super_admin"],
            domains=["*"],
            model_dump=lambda: {
                "user_id": "admin_user_id",
                "email": "admin@test.com",
                "roles": ["admin"],
                "groups": ["super_admin"],
                "domains": ["*"]
            }
        )

    async def mock_require_super_admin():
        return MagicMock(
            user_id="super_admin_id",
            email="superadmin@test.com",
            roles=["super_admin"],
            groups=["super_admin"],
            domains=["*"],
            model_dump=lambda: {
                "user_id": "super_admin_id",
                "email": "superadmin@test.com",
                "roles": ["super_admin"],
                "groups": ["super_admin"],
                "domains": ["*"]
            }
        )

    app.dependency_overrides[get_admin_service] = mock_get_admin_service
    app.dependency_overrides[require_group_admin] = mock_require_group_admin
    app.dependency_overrides[require_super_admin] = mock_require_super_admin

    return app


@pytest.fixture
def client(app):
    """Create test client"""
    return TestClient(app)


class TestGetAllUsers:
    """Tests for get all users endpoint"""

    def test_get_all_users_success(self, client, mock_admin_service):
        """Test successful get all users"""
        result = {
            "users": [
                {"user_id": "1", "email": "user1@test.com"},
                {"user_id": "2", "email": "user2@test.com"}
            ],
            "total": 2,
            "page": 0,
            "limit": 25
        }
        mock_admin_service.get_all_users = AsyncMock(return_value=result)

        response = client.get(f"{API_BASE_ROUTE}/admin/management/users")
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert len(data["users"]) == 2

    def test_get_all_users_with_pagination(self, client, mock_admin_service):
        """Test get all users with pagination"""
        result = {
            "users": [{"user_id": "1", "email": "user1@test.com"}],
            "total": 100,
            "page": 2,
            "limit": 10
        }
        mock_admin_service.get_all_users = AsyncMock(return_value=result)

        response = client.get(f"{API_BASE_ROUTE}/admin/management/users?page=2&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2
        assert data["limit"] == 10

    def test_get_all_users_auth_error(self, client, mock_admin_service):
        """Test get all users with auth error"""
        mock_admin_service.get_all_users = AsyncMock(side_effect=AuthError("Forbidden", 403))

        response = client.get(f"{API_BASE_ROUTE}/admin/management/users")
        assert response.status_code == 403


class TestGetUser:
    """Tests for get user by ID endpoint"""

    def test_get_user_success(self, client, mock_admin_service):
        """Test successful get user by ID"""
        user_id = str(ObjectId())
        result = {
            "user_id": user_id,
            "email": "user@test.com",
            "username": "testuser",
            "full_name": "Test User",
            "roles": ["user"],
            "groups": ["viewer"],
            "is_active": True
        }
        mock_admin_service.get_user_by_id = AsyncMock(return_value=result)

        response = client.get(f"{API_BASE_ROUTE}/admin/management/users/{user_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "user@test.com"

    def test_get_user_not_found(self, client, mock_admin_service):
        """Test get user not found"""
        user_id = str(ObjectId())
        mock_admin_service.get_user_by_id = AsyncMock(return_value=None)

        response = client.get(f"{API_BASE_ROUTE}/admin/management/users/{user_id}")
        assert response.status_code == 404

    def test_get_user_auth_error(self, client, mock_admin_service):
        """Test get user with auth error"""
        user_id = str(ObjectId())
        mock_admin_service.get_user_by_id = AsyncMock(side_effect=AuthError("Forbidden", 403))

        response = client.get(f"{API_BASE_ROUTE}/admin/management/users/{user_id}")
        assert response.status_code == 403


class TestUpdateUserStatus:
    """Tests for update user status endpoint"""

    def test_update_status_success(self, client, mock_admin_service):
        """Test successful status update"""
        user_id = str(ObjectId())
        result = {"message": "User status updated successfully"}
        mock_admin_service.update_user_status = AsyncMock(return_value=result)

        response = client.put(
            f"{API_BASE_ROUTE}/admin/management/users/{user_id}/status",
            json={"is_active": False}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    def test_update_status_auth_error(self, client, mock_admin_service):
        """Test status update with auth error"""
        user_id = str(ObjectId())
        mock_admin_service.update_user_status = AsyncMock(
            side_effect=AuthError("Cannot modify this user", 403)
        )

        response = client.put(
            f"{API_BASE_ROUTE}/admin/management/users/{user_id}/status",
            json={"is_active": False}
        )
        assert response.status_code == 403


class TestUpdateUserRoles:
    """Tests for update user roles endpoint"""

    def test_update_roles_success(self, client, mock_admin_service):
        """Test successful roles update"""
        user_id = str(ObjectId())
        result = {"message": "User roles updated successfully"}
        mock_admin_service.update_user_role = AsyncMock(return_value=result)

        response = client.put(
            f"{API_BASE_ROUTE}/admin/management/users/{user_id}/roles",
            json={"roles": ["admin", "user"]}
        )
        assert response.status_code == 200

    def test_update_roles_auth_error(self, client, mock_admin_service):
        """Test roles update with auth error"""
        user_id = str(ObjectId())
        mock_admin_service.update_user_role = AsyncMock(
            side_effect=AuthError("Forbidden", 403)
        )

        response = client.put(
            f"{API_BASE_ROUTE}/admin/management/users/{user_id}/roles",
            json={"roles": ["admin"]}
        )
        assert response.status_code == 403


class TestUpdateUserGroups:
    """Tests for update user groups endpoint"""

    def test_update_groups_success(self, client, mock_admin_service):
        """Test successful groups update"""
        user_id = str(ObjectId())
        result = {"message": "User groups updated successfully"}
        mock_admin_service.update_user_groups = AsyncMock(return_value=result)

        response = client.put(
            f"{API_BASE_ROUTE}/admin/management/users/{user_id}/groups",
            json={"groups": ["admins", "viewers"]}
        )
        assert response.status_code == 200

    def test_update_groups_auth_error(self, client, mock_admin_service):
        """Test groups update with auth error"""
        user_id = str(ObjectId())
        mock_admin_service.update_user_groups = AsyncMock(
            side_effect=AuthError("Forbidden", 403)
        )

        response = client.put(
            f"{API_BASE_ROUTE}/admin/management/users/{user_id}/groups",
            json={"groups": ["admins"]}
        )
        assert response.status_code == 403


class TestUpdateUserDomains:
    """Tests for update user domains endpoint"""

    def test_update_domains_success(self, client, mock_admin_service):
        """Test successful domains update"""
        user_id = str(ObjectId())
        result = {"message": "User domains updated successfully"}
        mock_admin_service.update_user_domains = AsyncMock(return_value=result)

        response = client.put(
            f"{API_BASE_ROUTE}/admin/management/users/{user_id}/domains",
            json={"domains": ["finance", "marketing"]}
        )
        assert response.status_code == 200

    def test_update_domains_auth_error(self, client, mock_admin_service):
        """Test domains update with auth error"""
        user_id = str(ObjectId())
        mock_admin_service.update_user_domains = AsyncMock(
            side_effect=AuthError("Forbidden", 403)
        )

        response = client.put(
            f"{API_BASE_ROUTE}/admin/management/users/{user_id}/domains",
            json={"domains": ["finance"]}
        )
        assert response.status_code == 403


class TestDeleteUser:
    """Tests for delete user endpoint"""

    def test_delete_user_success(self, client, mock_admin_service):
        """Test successful user deletion"""
        user_id = str(ObjectId())
        result = {"message": "User deleted successfully"}
        mock_admin_service.delete_user = AsyncMock(return_value=result)

        response = client.delete(f"{API_BASE_ROUTE}/admin/management/users/{user_id}")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    def test_delete_user_auth_error(self, client, mock_admin_service):
        """Test delete user with auth error"""
        user_id = str(ObjectId())
        mock_admin_service.delete_user = AsyncMock(
            side_effect=AuthError("Cannot delete self", 403)
        )

        response = client.delete(f"{API_BASE_ROUTE}/admin/management/users/{user_id}")
        assert response.status_code == 403

    def test_delete_user_not_found(self, client, mock_admin_service):
        """Test delete user not found"""
        user_id = str(ObjectId())
        mock_admin_service.delete_user = AsyncMock(
            side_effect=AuthError("User not found", 404)
        )

        response = client.delete(f"{API_BASE_ROUTE}/admin/management/users/{user_id}")
        assert response.status_code == 404
