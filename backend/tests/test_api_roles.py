"""Tests for Roles API Routes"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from bson import ObjectId

from easylifeauth.api.roles_routes import router, create_pagination_meta, notify_users_of_role_change
from easylifeauth.api import dependencies
from easylifeauth.security.access_control import CurrentUser, require_super_admin, require_group_admin


class TestRolesPaginationMeta:
    """Tests for roles pagination metadata"""

    def test_create_pagination_meta(self):
        """Test pagination meta creation"""
        meta = create_pagination_meta(total=50, page=1, limit=10)
        assert meta.total == 50
        assert meta.page == 1
        assert meta.limit == 10
        assert meta.pages == 5
        assert meta.has_next is True
        assert meta.has_prev is True


class TestNotifyUsersOfRoleChange:
    """Tests for user notification on role change"""

    @pytest.mark.asyncio
    async def test_notify_users_no_email_service(self):
        """Test notification without email service"""
        mock_db = MagicMock()
        await notify_users_of_role_change(mock_db, "role1", {"status": "changed"}, None)
        # Should not raise, just return

    @pytest.mark.asyncio
    async def test_notify_users_with_email_service(self):
        """Test notification with email service"""
        mock_db = MagicMock()
        mock_email_service = MagicMock()
        mock_email_service.send_role_change_notification = AsyncMock()

        # Mock user cursor
        async def user_generator():
            yield {
                "_id": ObjectId(),
                "email": "user1@example.com",
                "full_name": "User 1"
            }
            yield {
                "_id": ObjectId(),
                "email": "user2@example.com",
                "full_name": "User 2"
            }

        mock_db.users.find.return_value = user_generator()

        await notify_users_of_role_change(
            mock_db, "role1", {"status": "changed"}, mock_email_service
        )

        assert mock_email_service.send_role_change_notification.call_count == 2


class TestRolesRoutes:
    """Tests for roles management endpoints"""

    @pytest.fixture
    def mock_super_admin_user(self):
        """Create mock super admin user"""
        return CurrentUser(
            user_id="507f1f77bcf86cd799439011",
            email="admin@example.com",
            roles=["super-administrator"],
            groups=[],
            domains=[]
        )

    @pytest.fixture
    def mock_db(self):
        """Create mock database"""
        db = MagicMock()
        db.roles = MagicMock()
        db.roles.find_one = AsyncMock()
        db.roles.find = MagicMock()
        db.roles.insert_one = AsyncMock()
        db.roles.update_one = AsyncMock()
        db.roles.delete_one = AsyncMock()
        db.roles.count_documents = AsyncMock(return_value=0)
        db.users = MagicMock()
        db.users.find = MagicMock()
        db.users.update_many = AsyncMock()
        db.permissions = MagicMock()
        db.permissions.find_one = AsyncMock(return_value=None)
        db.domains = MagicMock()
        db.domains.find_one = AsyncMock(return_value=None)
        return db

    @pytest.fixture
    def mock_email_service(self):
        """Create mock email service"""
        service = MagicMock()
        service.send_role_change_notification = AsyncMock()
        return service

    @pytest.fixture
    def app(self, mock_super_admin_user, mock_db, mock_email_service):
        """Create test FastAPI app"""
        app = FastAPI()
        app.include_router(router)

        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin_user
        app.dependency_overrides[require_group_admin] = lambda: mock_super_admin_user
        app.dependency_overrides[dependencies.get_db] = lambda: mock_db
        app.dependency_overrides[dependencies.get_email_service] = lambda: mock_email_service

        return app

    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return TestClient(app)

    def test_list_roles_empty(self, client, mock_db):
        """Test listing roles when empty"""
        mock_db.roles.count_documents = AsyncMock(return_value=0)

        async def empty_cursor():
            return
            yield

        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = empty_cursor()
        mock_db.roles.find.return_value = mock_cursor

        response = client.get("/roles")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data

    def test_list_roles_with_filters(self, client, mock_db):
        """Test listing roles with filters"""
        mock_db.roles.count_documents = AsyncMock(return_value=0)

        async def empty_cursor():
            return
            yield

        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = empty_cursor()
        mock_db.roles.find.return_value = mock_cursor

        response = client.get("/roles?status=active&search=admin")
        assert response.status_code == 200

    def test_count_roles(self, client, mock_db):
        """Test counting roles"""
        mock_db.roles.count_documents = AsyncMock(return_value=5)

        response = client.get("/roles/count")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 5

    def test_get_role_success(self, client, mock_db):
        """Test getting a specific role"""
        role_data = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "roleId": "admin",
            "name": "Administrator",
            "description": "Admin role",
            "permissions": ["read", "write"],
            "status": "active",
            "priority": 1,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        mock_db.roles.find_one.return_value = role_data

        response = client.get("/roles/507f1f77bcf86cd799439011")
        assert response.status_code == 200
        data = response.json()
        assert data["roleId"] == "admin"

    def test_get_role_by_role_id(self, client, mock_db):
        """Test getting role by roleId"""
        role_data = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "roleId": "admin",
            "name": "Administrator",
            "description": "Admin role",
            "permissions": ["read", "write"],
            "status": "active",
            "priority": 1,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        # When "admin" is passed, ObjectId("admin") throws exception in the route
        # so it falls through to find by roleId - we just need to return role_data
        mock_db.roles.find_one = AsyncMock(return_value=role_data)

        response = client.get("/roles/admin")
        assert response.status_code == 200

    def test_get_role_not_found(self, client, mock_db):
        """Test getting non-existent role"""
        mock_db.roles.find_one = AsyncMock(return_value=None)

        response = client.get("/roles/nonexistent")
        assert response.status_code == 404

    def test_create_role_success(self, client, mock_db):
        """Test creating a new role"""
        mock_db.roles.find_one.return_value = None
        mock_db.roles.insert_one.return_value = MagicMock(
            inserted_id=ObjectId("507f1f77bcf86cd799439011")
        )

        response = client.post("/roles", json={
            "roleId": "editor",
            "name": "Editor",
            "description": "Editor role",
            "permissions": ["read", "write"],
            "status": "active",
            "priority": 2
        })

        assert response.status_code == 201
        data = response.json()
        assert data["roleId"] == "editor"

    def test_create_role_duplicate(self, client, mock_db):
        """Test creating role with existing roleId"""
        mock_db.roles.find_one.return_value = {"roleId": "admin"}

        response = client.post("/roles", json={
            "roleId": "admin",
            "name": "Administrator",
            "description": "Admin role",
            "permissions": ["read", "write"],
            "status": "active",
            "priority": 1
        })

        assert response.status_code == 400
        assert "Role ID already exists" in response.json()["detail"]

    def test_update_role_success(self, client, mock_db, mock_email_service):
        """Test updating a role"""
        existing_role = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "roleId": "editor",
            "name": "Editor",
            "description": "Old description",
            "permissions": ["read"],
            "status": "active",
            "priority": 2,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        mock_db.roles.find_one.return_value = existing_role

        # Mock user notification
        async def empty_cursor():
            return
            yield

        mock_db.users.find.return_value = empty_cursor()

        response = client.put("/roles/507f1f77bcf86cd799439011", json={
            "description": "Updated description"
        })

        assert response.status_code == 200
        mock_db.roles.update_one.assert_called_once()

    def test_update_role_permissions_notifies_users(self, client, mock_db, mock_email_service):
        """Test updating role permissions notifies users"""
        existing_role = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "roleId": "editor",
            "name": "Editor",
            "description": "Editor role",
            "permissions": ["read"],
            "status": "active",
            "priority": 2,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        mock_db.roles.find_one.return_value = existing_role

        # Mock user notification
        async def user_cursor():
            yield {
                "_id": ObjectId(),
                "email": "user@example.com",
                "full_name": "Test User"
            }

        mock_db.users.find.return_value = user_cursor()

        response = client.put("/roles/507f1f77bcf86cd799439011", json={
            "permissions": ["read", "write", "delete"]
        })

        assert response.status_code == 200

    def test_update_role_not_found(self, client, mock_db):
        """Test updating non-existent role"""
        mock_db.roles.find_one.return_value = None

        response = client.put("/roles/nonexistent", json={
            "description": "Updated"
        })

        assert response.status_code == 404

    def test_delete_role_success(self, client, mock_db):
        """Test deleting a role"""
        mock_db.roles.delete_one.return_value = MagicMock(deleted_count=1)

        response = client.delete("/roles/507f1f77bcf86cd799439011")
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]
        mock_db.users.update_many.assert_called_once()

    def test_delete_role_by_role_id(self, client, mock_db):
        """Test deleting role by roleId"""
        # When deleting by roleId "editor", ObjectId("editor") throws exception
        # Then find_one is called, followed by delete_one with the found _id
        mock_db.roles.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "roleId": "editor"
        })
        mock_db.roles.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))

        response = client.delete("/roles/editor")
        assert response.status_code == 200

    def test_delete_role_not_found(self, client, mock_db):
        """Test deleting non-existent role"""
        mock_db.roles.delete_one = AsyncMock(return_value=MagicMock(deleted_count=0))

        response = client.delete("/roles/nonexistent")
        assert response.status_code == 404

    def test_toggle_role_status(self, client, mock_db, mock_email_service):
        """Test toggling role status"""
        mock_db.roles.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "roleId": "editor",
            "status": "active"
        }

        # Mock user notification
        async def empty_cursor():
            return
            yield

        mock_db.users.find.return_value = empty_cursor()

        response = client.post("/roles/507f1f77bcf86cd799439011/toggle-status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "inactive"

    def test_toggle_role_status_inactive_to_active(self, client, mock_db, mock_email_service):
        """Test toggling role from inactive to active"""
        mock_db.roles.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "roleId": "editor",
            "status": "inactive"
        }

        async def empty_cursor():
            return
            yield

        mock_db.users.find.return_value = empty_cursor()

        response = client.post("/roles/507f1f77bcf86cd799439011/toggle-status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"

    def test_toggle_role_status_not_found(self, client, mock_db):
        """Test toggling status of non-existent role"""
        mock_db.roles.find_one.return_value = None

        response = client.post("/roles/nonexistent/toggle-status")
        assert response.status_code == 404

    def test_get_role_users(self, client, mock_db):
        """Test getting users with a specific role"""
        mock_db.roles.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "roleId": "editor"
        }

        async def user_cursor():
            yield {
                "_id": ObjectId(),
                "email": "user1@example.com",
                "full_name": "User 1",
                "roles": ["editor"]
            }
            yield {
                "_id": ObjectId(),
                "email": "user2@example.com",
                "full_name": "User 2",
                "roles": ["editor"]
            }

        mock_db.users.find.return_value = user_cursor()

        response = client.get("/roles/507f1f77bcf86cd799439011/users")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_role_users_role_not_found(self, client, mock_db):
        """Test getting users of non-existent role"""
        mock_db.roles.find_one.return_value = None

        response = client.get("/roles/nonexistent/users")
        assert response.status_code == 404
