"""Tests for Groups API Routes"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from bson import ObjectId

from easylifeauth.api.groups_routes import router, create_pagination_meta, notify_users_of_group_change
from easylifeauth.api import dependencies
from easylifeauth.security.access_control import CurrentUser, require_super_admin, require_group_admin


class TestGroupsPaginationMeta:
    """Tests for groups pagination metadata"""

    def test_create_pagination_meta(self):
        """Test pagination meta creation"""
        meta = create_pagination_meta(total=50, page=1, limit=10)
        assert meta.total == 50
        assert meta.page == 1
        assert meta.limit == 10
        assert meta.pages == 5
        assert meta.has_next is True
        assert meta.has_prev is True

    def test_create_pagination_meta_first_page(self):
        """Test pagination meta for first page"""
        meta = create_pagination_meta(total=50, page=0, limit=10)
        assert meta.has_prev is False
        assert meta.has_next is True

    def test_create_pagination_meta_last_page(self):
        """Test pagination meta for last page"""
        meta = create_pagination_meta(total=50, page=4, limit=10)
        assert meta.has_prev is True
        assert meta.has_next is False


class TestNotifyUsersOfGroupChange:
    """Tests for user notification on group change"""

    @pytest.mark.asyncio
    async def test_notify_users_no_email_service(self):
        """Test notification without email service"""
        mock_db = MagicMock()
        await notify_users_of_group_change(mock_db, "group1", {"status": "changed"}, None)
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

        await notify_users_of_group_change(
            mock_db, "group1", {"status": "changed"}, mock_email_service
        )

        assert mock_email_service.send_role_change_notification.call_count == 2


class TestGroupsRoutes:
    """Tests for groups management endpoints"""

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
        db.groups = MagicMock()
        db.groups.find_one = AsyncMock()
        db.groups.find = MagicMock()
        db.groups.insert_one = AsyncMock()
        db.groups.update_one = AsyncMock()
        db.groups.delete_one = AsyncMock()
        db.groups.count_documents = AsyncMock(return_value=0)
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

    def test_list_groups_empty(self, client, mock_db):
        """Test listing groups when empty"""
        mock_db.groups.count_documents = AsyncMock(return_value=0)

        async def empty_cursor():
            return
            yield

        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = empty_cursor()
        mock_db.groups.find.return_value = mock_cursor

        response = client.get("/groups")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data

    def test_list_groups_with_filters(self, client, mock_db):
        """Test listing groups with filters"""
        mock_db.groups.count_documents = AsyncMock(return_value=0)

        async def empty_cursor():
            return
            yield

        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = empty_cursor()
        mock_db.groups.find.return_value = mock_cursor

        response = client.get("/groups?status=active&search=admin")
        assert response.status_code == 200

    def test_count_groups(self, client, mock_db):
        """Test counting groups"""
        mock_db.groups.count_documents = AsyncMock(return_value=5)

        response = client.get("/groups/count")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 5

    def test_get_group_success(self, client, mock_db):
        """Test getting a specific group"""
        group_data = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "groupId": "admins",
            "name": "Administrators",
            "description": "Admin group",
            "permissions": ["read", "write"],
            "status": "active",
            "priority": 1,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        mock_db.groups.find_one = AsyncMock(return_value=group_data)

        response = client.get("/groups/507f1f77bcf86cd799439011")
        assert response.status_code == 200
        data = response.json()
        assert data["groupId"] == "admins"

    def test_get_group_by_group_id(self, client, mock_db):
        """Test getting group by groupId"""
        group_data = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "groupId": "admins",
            "name": "Administrators",
            "description": "Admin group",
            "permissions": ["read", "write"],
            "status": "active",
            "priority": 1,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        mock_db.groups.find_one = AsyncMock(return_value=group_data)

        response = client.get("/groups/admins")
        assert response.status_code == 200

    def test_get_group_not_found(self, client, mock_db):
        """Test getting non-existent group"""
        mock_db.groups.find_one = AsyncMock(return_value=None)

        response = client.get("/groups/nonexistent")
        assert response.status_code == 404

    def test_create_group_success(self, client, mock_db):
        """Test creating a new group"""
        mock_db.groups.find_one = AsyncMock(return_value=None)
        mock_db.groups.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId("507f1f77bcf86cd799439011"))
        )

        response = client.post("/groups", json={
            "groupId": "editors",
            "name": "Editors",
            "description": "Editor group",
            "permissions": ["read", "write"],
            "status": "active",
            "priority": 2
        })

        assert response.status_code == 201
        data = response.json()
        assert data["groupId"] == "editors"

    def test_create_group_duplicate(self, client, mock_db):
        """Test creating group with existing groupId"""
        mock_db.groups.find_one = AsyncMock(return_value={"groupId": "admins"})

        response = client.post("/groups", json={
            "groupId": "admins",
            "name": "Administrators",
            "description": "Admin group",
            "permissions": ["read", "write"],
            "status": "active",
            "priority": 1
        })

        assert response.status_code == 400
        assert "Group ID already exists" in response.json()["detail"]

    def test_update_group_success(self, client, mock_db, mock_email_service):
        """Test updating a group"""
        existing_group = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "groupId": "editors",
            "name": "Editors",
            "description": "Old description",
            "permissions": ["read"],
            "status": "active",
            "priority": 2,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        mock_db.groups.find_one = AsyncMock(return_value=existing_group)

        # Mock user notification
        async def empty_cursor():
            return
            yield

        mock_db.users.find.return_value = empty_cursor()

        response = client.put("/groups/507f1f77bcf86cd799439011", json={
            "description": "Updated description"
        })

        assert response.status_code == 200
        mock_db.groups.update_one.assert_called_once()

    def test_update_group_not_found(self, client, mock_db):
        """Test updating non-existent group"""
        mock_db.groups.find_one = AsyncMock(return_value=None)

        response = client.put("/groups/nonexistent", json={
            "description": "Updated"
        })

        assert response.status_code == 404

    def test_delete_group_success(self, client, mock_db):
        """Test deleting a group"""
        mock_db.groups.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))

        response = client.delete("/groups/507f1f77bcf86cd799439011")
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]
        mock_db.users.update_many.assert_called_once()

    def test_delete_group_by_group_id(self, client, mock_db):
        """Test deleting group by groupId"""
        mock_db.groups.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "groupId": "editors"
        })
        mock_db.groups.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))

        response = client.delete("/groups/editors")
        assert response.status_code == 200

    def test_delete_group_not_found(self, client, mock_db):
        """Test deleting non-existent group"""
        mock_db.groups.delete_one = AsyncMock(return_value=MagicMock(deleted_count=0))

        response = client.delete("/groups/nonexistent")
        assert response.status_code == 404

    def test_toggle_group_status(self, client, mock_db, mock_email_service):
        """Test toggling group status"""
        mock_db.groups.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "groupId": "editors",
            "status": "active"
        })

        # Mock user notification
        async def empty_cursor():
            return
            yield

        mock_db.users.find.return_value = empty_cursor()

        response = client.post("/groups/507f1f77bcf86cd799439011/toggle-status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "inactive"

    def test_toggle_group_status_inactive_to_active(self, client, mock_db, mock_email_service):
        """Test toggling group from inactive to active"""
        mock_db.groups.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "groupId": "editors",
            "status": "inactive"
        })

        async def empty_cursor():
            return
            yield

        mock_db.users.find.return_value = empty_cursor()

        response = client.post("/groups/507f1f77bcf86cd799439011/toggle-status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"

    def test_toggle_group_status_not_found(self, client, mock_db):
        """Test toggling status of non-existent group"""
        mock_db.groups.find_one = AsyncMock(return_value=None)

        response = client.post("/groups/nonexistent/toggle-status")
        assert response.status_code == 404

    def test_get_group_users(self, client, mock_db):
        """Test getting users with a specific group"""
        mock_db.groups.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "groupId": "editors"
        })

        async def user_cursor():
            yield {
                "_id": ObjectId(),
                "email": "user1@example.com",
                "full_name": "User 1",
                "groups": ["editors"]
            }
            yield {
                "_id": ObjectId(),
                "email": "user2@example.com",
                "full_name": "User 2",
                "groups": ["editors"]
            }

        mock_db.users.find.return_value = user_cursor()

        response = client.get("/groups/507f1f77bcf86cd799439011/users")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_group_users_group_not_found(self, client, mock_db):
        """Test getting users of non-existent group"""
        mock_db.groups.find_one = AsyncMock(return_value=None)

        response = client.get("/groups/nonexistent/users")
        assert response.status_code == 404
