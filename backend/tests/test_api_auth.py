"""Tests for Authentication API Routes"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from bson import ObjectId

from easylifeauth.api.auth_routes import router
from easylifeauth.api import dependencies
from easylifeauth.errors.auth_error import AuthError
from easylifeauth.security.access_control import CurrentUser


class TestAuthRoutes:
    """Tests for authentication endpoints"""

    @pytest.fixture
    def mock_user_service(self):
        """Create mock user service"""
        service = MagicMock()
        service.register_user = AsyncMock()
        service.login_user = AsyncMock()
        service.logout_user = AsyncMock()
        service.get_user_by_id = AsyncMock()
        service.update_user_data = AsyncMock()
        return service

    @pytest.fixture
    def mock_token_manager(self):
        """Create mock token manager"""
        manager = MagicMock()
        manager.refresh_access_token = AsyncMock()
        manager.verify_token = AsyncMock()
        return manager

    @pytest.fixture
    def mock_password_service(self):
        """Create mock password service"""
        service = MagicMock()
        service.request_password_reset = AsyncMock()
        service.reset_password = AsyncMock()
        service.update_user_password = AsyncMock()
        return service

    @pytest.fixture
    def mock_activity_log(self):
        """Create mock activity log service"""
        service = MagicMock()
        service.log = AsyncMock()
        return service

    @pytest.fixture
    def mock_db(self):
        """Create mock database"""
        db = MagicMock()
        return db

    @pytest.fixture
    def app(self, mock_user_service, mock_token_manager, mock_password_service, mock_activity_log, mock_db):
        """Create test FastAPI app with mocked dependencies"""
        app = FastAPI()
        app.include_router(router)

        # Override dependencies
        app.dependency_overrides[dependencies.get_user_service] = lambda: mock_user_service
        app.dependency_overrides[dependencies.get_token_manager] = lambda: mock_token_manager
        app.dependency_overrides[dependencies.get_password_service] = lambda: mock_password_service
        app.dependency_overrides[dependencies.get_activity_log_service] = lambda: mock_activity_log

        return app

    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return TestClient(app)

    def test_csrf_token_no_cookie(self, client):
        """Test CSRF token endpoint without existing cookie"""
        response = client.get("/auth/csrf-token")
        assert response.status_code == 200
        data = response.json()
        # Either returns token or message about cookie being set
        assert "csrf_token" in data

    def test_register_success(self, client, mock_user_service):
        """Test successful user registration"""
        mock_user_service.register_user.return_value = {
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "username": "testuser",
            "full_name": "Test User",
            "roles": ["user"],
            "groups": ["viewer"],
            "domains": [],
            "access_token": "test_token",
            "refresh_token": "refresh_token",
            "expires_in": 3600
        }

        response = client.post("/auth/register", json={
            "email": "test@example.com",
            "username": "testuser",
            "password": "password123",
            "full_name": "Test User"
        })

        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["email"] == "test@example.com"

    def test_register_auth_error(self, client, mock_user_service):
        """Test registration with auth error"""
        mock_user_service.register_user.side_effect = AuthError("Email already exists", 400)

        response = client.post("/auth/register", json={
            "email": "test@example.com",
            "username": "testuser",
            "password": "password123",
            "full_name": "Test User"
        })

        assert response.status_code == 400
        assert "Email already exists" in response.json()["detail"]

    def test_login_success(self, client, mock_user_service, mock_activity_log):
        """Test successful login"""
        mock_user_service.login_user.return_value = {
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "username": "testuser",
            "full_name": "Test User",
            "roles": ["user"],
            "groups": [],
            "domains": [],
            "access_token": "test_token",
            "refresh_token": "refresh_token",
            "expires_in": 3600,
            "user": {"_id": "507f1f77bcf86cd799439011", "email": "test@example.com"}
        }

        response = client.post("/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        mock_activity_log.log.assert_called_once()

    def test_login_failed(self, client, mock_user_service, mock_activity_log):
        """Test failed login"""
        mock_user_service.login_user.side_effect = AuthError("Invalid credentials", 401)

        response = client.post("/auth/login", json={
            "email": "test@example.com",
            "password": "wrongpassword"
        })

        assert response.status_code == 401
        # Activity log should record failed attempt
        mock_activity_log.log.assert_called_once()

    def test_refresh_token_success(self, client, mock_token_manager, mock_db):
        """Test successful token refresh"""
        mock_token_manager.refresh_access_token.return_value = {
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "username": "testuser",
            "roles": ["user"],
            "groups": [],
            "domains": [],
            "access_token": "new_token",
            "refresh_token": "new_refresh_token",
            "expires_in": 3600
        }

        # Mock get_db - need to patch where it's imported in auth_routes
        with patch('easylifeauth.api.auth_routes.get_db', return_value=mock_db):
            response = client.post("/auth/refresh", json={
                "refresh_token": "old_refresh_token"
            })

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data

    def test_refresh_token_invalid(self, client, mock_token_manager, mock_db):
        """Test token refresh with invalid token"""
        mock_token_manager.refresh_access_token.side_effect = AuthError("Invalid token", 401)

        with patch('easylifeauth.api.auth_routes.get_db', return_value=mock_db):
            response = client.post("/auth/refresh", json={
                "refresh_token": "invalid_token"
            })

        assert response.status_code == 401

    def test_forgot_password_success(self, client, mock_password_service):
        """Test forgot password request"""
        mock_password_service.request_password_reset.return_value = {
            "message": "Password reset email sent"
        }

        response = client.post("/auth/forgot_password", json={
            "email": "test@example.com"
        })

        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    def test_forgot_password_with_reset_url(self, client, mock_password_service):
        """Test forgot password with custom reset URL"""
        mock_password_service.request_password_reset.return_value = {
            "message": "Password reset email sent"
        }

        response = client.post("/auth/forgot_password", json={
            "email": "test@example.com",
            "reset_url": "https://custom.com/reset"
        })

        assert response.status_code == 200
        mock_password_service.request_password_reset.assert_called_with(
            "test@example.com", "https://custom.com/reset"
        )

    def test_reset_password_success(self, client, mock_password_service):
        """Test password reset"""
        mock_password_service.reset_password.return_value = {
            "message": "Password reset successfully"
        }

        response = client.post("/auth/reset_password", json={
            "token": "reset_token",
            "new_password": "newpassword123"
        })

        assert response.status_code == 200

    def test_reset_password_invalid_token(self, client, mock_password_service):
        """Test password reset with invalid token"""
        mock_password_service.reset_password.side_effect = AuthError("Invalid or expired token", 400)

        response = client.post("/auth/reset_password", json={
            "token": "invalid_token",
            "new_password": "newpassword123"
        })

        assert response.status_code == 400


class TestAuthRoutesProtected:
    """Tests for protected auth endpoints"""

    @pytest.fixture
    def mock_current_user(self):
        """Create mock current user"""
        return CurrentUser(
            user_id="507f1f77bcf86cd799439011",
            email="test@example.com",
            roles=["user"],
            groups=[],
            domains=[]
        )

    @pytest.fixture
    def mock_user_service(self):
        """Create mock user service"""
        service = MagicMock()
        service.get_user_by_id = AsyncMock()
        service.update_user_data = AsyncMock()
        service.logout_user = AsyncMock()
        return service

    @pytest.fixture
    def mock_password_service(self):
        """Create mock password service"""
        service = MagicMock()
        service.update_user_password = AsyncMock()
        return service

    @pytest.fixture
    def app(self, mock_current_user, mock_user_service, mock_password_service):
        """Create test app with mocked auth"""
        from easylifeauth.security.access_control import get_current_user

        app = FastAPI()
        app.include_router(router)

        app.dependency_overrides[get_current_user] = lambda: mock_current_user
        app.dependency_overrides[dependencies.get_user_service] = lambda: mock_user_service
        app.dependency_overrides[dependencies.get_password_service] = lambda: mock_password_service

        return app

    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return TestClient(app)

    def test_get_profile_success(self, client, mock_user_service):
        """Test getting user profile"""
        mock_user_service.get_user_by_id.return_value = {
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "username": "testuser",
            "full_name": "Test User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "domains": []
        }

        response = client.get("/auth/profile")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"

    def test_get_profile_not_found(self, client, mock_user_service):
        """Test getting non-existent profile"""
        mock_user_service.get_user_by_id.return_value = None

        response = client.get("/auth/profile")
        assert response.status_code == 404

    def test_update_profile_success(self, client, mock_user_service):
        """Test updating user profile"""
        mock_user_service.update_user_data.return_value = {
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "username": "testuser",
            "full_name": "Updated Name",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "domains": []
        }

        response = client.put("/auth/profile", json={
            "full_name": "Updated Name"
        })

        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Updated Name"

    def test_update_password_success(self, client, mock_password_service):
        """Test updating password"""
        mock_password_service.update_user_password.return_value = {
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "username": "testuser",
            "roles": ["user"],
            "groups": [],
            "domains": [],
            "access_token": "new_token",
            "refresh_token": "new_refresh",
            "expires_in": 3600
        }

        response = client.post("/auth/update_password", json={
            "password": "oldpassword",
            "new_password": "newpassword123"
        })

        assert response.status_code == 200

    def test_logout_success(self, client, mock_user_service):
        """Test logout"""
        mock_user_service.logout_user.return_value = {
            "message": "Logged out successfully"
        }

        response = client.post("/auth/logout")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
