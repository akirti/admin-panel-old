"""Tests for Users API Routes"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from bson import ObjectId

from easylifeauth.api.users_routes import router, create_pagination_meta
from easylifeauth.api import dependencies
from easylifeauth.security.access_control import CurrentUser, require_super_admin


class TestPaginationMeta:
    """Tests for pagination metadata helper"""

    def test_create_pagination_meta_basic(self):
        """Test basic pagination meta creation"""
        meta = create_pagination_meta(total=100, page=0, limit=25)
        assert meta.total == 100
        assert meta.page == 0
        assert meta.limit == 25
        assert meta.pages == 4
        assert meta.has_next is True
        assert meta.has_prev is False

    def test_create_pagination_meta_last_page(self):
        """Test pagination meta for last page"""
        meta = create_pagination_meta(total=100, page=3, limit=25)
        assert meta.has_next is False
        assert meta.has_prev is True

    def test_create_pagination_meta_middle_page(self):
        """Test pagination meta for middle page"""
        meta = create_pagination_meta(total=100, page=2, limit=25)
        assert meta.has_next is True
        assert meta.has_prev is True

    def test_create_pagination_meta_zero_limit(self):
        """Test pagination with zero limit"""
        meta = create_pagination_meta(total=100, page=0, limit=0)
        assert meta.pages == 0

    def test_create_pagination_meta_single_page(self):
        """Test pagination with single page"""
        meta = create_pagination_meta(total=10, page=0, limit=25)
        assert meta.pages == 1
        assert meta.has_next is False
        assert meta.has_prev is False


class TestUsersRoutes:
    """Tests for users management endpoints"""

    @pytest.fixture
    def mock_super_admin_user(self):
        """Create mock super admin user"""
        return CurrentUser(
            user_id="507f1f77bcf86cd799439011",
            email="admin@example.com",
            roles=["super_admin"],
            groups=[],
            domains=[]
        )

    @pytest.fixture
    def mock_db(self):
        """Create mock database"""
        db = MagicMock()
        db.users = MagicMock()
        db.users.find_one = AsyncMock()
        db.users.find = MagicMock()
        db.users.insert_one = AsyncMock()
        db.users.update_one = AsyncMock()
        db.users.delete_one = AsyncMock()
        db.users.count_documents = AsyncMock(return_value=0)
        return db

    @pytest.fixture
    def mock_email_service(self):
        """Create mock email service"""
        service = MagicMock()
        service.send_welcome_email = AsyncMock()
        service.send_password_reset_email = AsyncMock()
        return service

    @pytest.fixture
    def mock_activity_log(self):
        """Create mock activity log service"""
        service = MagicMock()
        service.log = AsyncMock()
        return service

    @pytest.fixture
    def app(self, mock_super_admin_user, mock_db, mock_email_service, mock_activity_log):
        """Create test FastAPI app"""
        app = FastAPI()
        app.include_router(router)

        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin_user
        app.dependency_overrides[dependencies.get_db] = lambda: mock_db
        app.dependency_overrides[dependencies.get_email_service] = lambda: mock_email_service
        app.dependency_overrides[dependencies.get_activity_log_service] = lambda: mock_activity_log

        return app

    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return TestClient(app)

    def test_list_users_empty(self, client, mock_db):
        """Test listing users when empty"""
        mock_db.users.count_documents = AsyncMock(return_value=0)

        async def empty_cursor():
            return
            yield  # Makes it an async generator

        # Create a proper chain mock where each method returns an object that has the next method
        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = empty_cursor()
        mock_db.users.find.return_value = mock_cursor

        response = client.get("/users")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data

    def test_list_users_with_filters(self, client, mock_db):
        """Test listing users with filters"""
        mock_db.users.count_documents = AsyncMock(return_value=0)

        async def empty_cursor():
            return
            yield

        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = empty_cursor()
        mock_db.users.find.return_value = mock_cursor

        response = client.get("/users?is_active=true&search=test")
        assert response.status_code == 200

    def test_count_users(self, client, mock_db):
        """Test counting users"""
        mock_db.users.count_documents = AsyncMock(return_value=42)

        response = client.get("/users/count")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 42

    def test_count_users_with_filter(self, client, mock_db):
        """Test counting users with filter"""
        mock_db.users.count_documents = AsyncMock(return_value=10)

        response = client.get("/users/count?is_active=true")
        assert response.status_code == 200

    def test_get_user_success(self, client, mock_db):
        """Test getting a specific user"""
        user_data = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "username": "testuser",
            "full_name": "Test User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "domains": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        mock_db.users.find_one.return_value = user_data

        response = client.get("/users/507f1f77bcf86cd799439011")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"

    def test_get_user_not_found(self, client, mock_db):
        """Test getting non-existent user"""
        mock_db.users.find_one.return_value = None

        response = client.get("/users/nonexistent")
        assert response.status_code == 404

    def test_create_user_success(self, client, mock_db, mock_email_service, mock_activity_log):
        """Test creating a new user"""
        mock_db.users.find_one.return_value = None  # No existing user
        mock_db.users.insert_one.return_value = MagicMock(
            inserted_id=ObjectId("507f1f77bcf86cd799439011")
        )

        response = client.post("/users", json={
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "password123",
            "full_name": "New User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "domains": [],
            "send_password_email": False
        })

        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        mock_activity_log.log.assert_called_once()

    def test_create_user_email_exists(self, client, mock_db):
        """Test creating user with existing email"""
        mock_db.users.find_one.return_value = {"email": "existing@example.com"}

        response = client.post("/users", json={
            "email": "existing@example.com",
            "username": "newuser",
            "password": "password123",
            "full_name": "New User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "domains": []
        })

        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]

    def test_create_user_username_exists(self, client, mock_db):
        """Test creating user with existing username"""
        # First call returns None (email doesn't exist)
        # Second call returns user (username exists)
        mock_db.users.find_one.side_effect = [None, {"username": "existinguser"}]

        response = client.post("/users", json={
            "email": "new@example.com",
            "username": "existinguser",
            "password": "password123",
            "full_name": "New User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "domains": []
        })

        assert response.status_code == 400
        assert "Username already taken" in response.json()["detail"]

    def test_create_user_with_email(self, client, mock_db, mock_email_service, mock_activity_log):
        """Test creating user with welcome email"""
        mock_db.users.find_one.return_value = None
        mock_db.users.insert_one.return_value = MagicMock(
            inserted_id=ObjectId("507f1f77bcf86cd799439011")
        )

        response = client.post("/users", json={
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "password123",
            "full_name": "New User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "domains": [],
            "send_password_email": True
        })

        assert response.status_code == 201
        mock_email_service.send_welcome_email.assert_called_once()

    def test_update_user_success(self, client, mock_db, mock_activity_log):
        """Test updating a user"""
        existing_user = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "username": "testuser",
            "full_name": "Test User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "domains": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        mock_db.users.find_one.return_value = existing_user

        response = client.put("/users/507f1f77bcf86cd799439011", json={
            "full_name": "Updated Name"
        })

        assert response.status_code == 200
        mock_db.users.update_one.assert_called_once()
        mock_activity_log.log.assert_called_once()

    def test_update_user_not_found(self, client, mock_db):
        """Test updating non-existent user"""
        mock_db.users.find_one.return_value = None

        response = client.put("/users/nonexistent", json={
            "full_name": "Updated Name"
        })

        assert response.status_code == 404

    def test_delete_user_success(self, client, mock_db, mock_activity_log):
        """Test deleting a user"""
        mock_db.users.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com"
        }
        mock_db.users.delete_one.return_value = MagicMock(deleted_count=1)

        response = client.delete("/users/507f1f77bcf86cd799439011")
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]
        mock_activity_log.log.assert_called_once()

    def test_delete_user_not_found(self, client, mock_db):
        """Test deleting non-existent user"""
        mock_db.users.find_one.return_value = None
        mock_db.users.delete_one.return_value = MagicMock(deleted_count=0)

        response = client.delete("/users/nonexistent")
        assert response.status_code == 404

    def test_toggle_user_status(self, client, mock_db, mock_activity_log):
        """Test toggling user status"""
        mock_db.users.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "is_active": True
        }

        response = client.post("/users/507f1f77bcf86cd799439011/toggle-status")
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False  # Toggled from True

    def test_toggle_user_status_not_found(self, client, mock_db):
        """Test toggling status of non-existent user"""
        mock_db.users.find_one.return_value = None

        response = client.post("/users/nonexistent/toggle-status")
        assert response.status_code == 404

    def test_send_password_reset_email(self, client, mock_db, mock_email_service):
        """Test sending password reset email"""
        mock_db.users.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "full_name": "Test User"
        }

        response = client.post("/users/507f1f77bcf86cd799439011/send-password-reset?send_email=true")
        assert response.status_code == 200
        mock_email_service.send_password_reset_email.assert_called_once()

    def test_send_password_reset_no_email(self, client, mock_db, mock_email_service):
        """Test password reset without sending email"""
        mock_db.users.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "full_name": "Test User"
        }

        response = client.post("/users/507f1f77bcf86cd799439011/send-password-reset?send_email=false")
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        mock_email_service.send_password_reset_email.assert_not_called()

    def test_admin_reset_password(self, client, mock_db, mock_email_service):
        """Test admin resetting user password"""
        mock_db.users.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "full_name": "Test User"
        }

        response = client.post("/users/507f1f77bcf86cd799439011/reset-password?send_email=true")
        assert response.status_code == 200
        mock_db.users.update_one.assert_called_once()
        mock_email_service.send_welcome_email.assert_called_once()

    def test_admin_reset_password_no_email(self, client, mock_db, mock_email_service):
        """Test admin reset password without email"""
        mock_db.users.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "full_name": "Test User"
        }

        response = client.post("/users/507f1f77bcf86cd799439011/reset-password?send_email=false")
        assert response.status_code == 200
        data = response.json()
        assert "temp_password" in data

    def test_admin_reset_password_not_found(self, client, mock_db):
        """Test admin reset password for non-existent user"""
        mock_db.users.find_one.return_value = None

        response = client.post("/users/nonexistent/reset-password")
        assert response.status_code == 404
