"""
Tests for user management endpoints.
"""
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock


class TestUsers:
    """Test user management endpoints."""
    
    @pytest.mark.asyncio
    async def test_list_users(self, app_client: AsyncClient, admin_headers: dict):
        """Test listing users."""
        response = await app_client.get("/api/users", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2  # admin and user from fixtures
    
    @pytest.mark.asyncio
    async def test_list_users_unauthorized(self, app_client: AsyncClient, user_headers: dict):
        """Test listing users with non-admin user."""
        response = await app_client.get("/api/users", headers=user_headers)
        assert response.status_code == 403
    
    @pytest.mark.asyncio
    async def test_list_users_with_search(self, app_client: AsyncClient, admin_headers: dict):
        """Test listing users with search."""
        response = await app_client.get(
            "/api/users",
            headers=admin_headers,
            params={"search": "admin"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
    
    @pytest.mark.asyncio
    async def test_list_users_with_filter(self, app_client: AsyncClient, admin_headers: dict):
        """Test listing users with active filter."""
        response = await app_client.get(
            "/api/users",
            headers=admin_headers,
            params={"is_active": True}
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_count_users(self, app_client: AsyncClient, admin_headers: dict):
        """Test counting users."""
        response = await app_client.get("/api/users/count", headers=admin_headers)
        assert response.status_code == 200
        assert "count" in response.json()
    
    @pytest.mark.asyncio
    async def test_get_user(self, app_client: AsyncClient, admin_headers: dict):
        """Test getting a specific user."""
        response = await app_client.get(
            "/api/users/user@test.com",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "user@test.com"
    
    @pytest.mark.asyncio
    async def test_get_user_not_found(self, app_client: AsyncClient, admin_headers: dict):
        """Test getting non-existent user."""
        response = await app_client.get(
            "/api/users/nonexistent@test.com",
            headers=admin_headers
        )
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_create_user(self, app_client: AsyncClient, admin_headers: dict, mock_email_service):
        """Test creating a user."""
        with patch('app.routers.users.email_service', mock_email_service):
            response = await app_client.post(
                "/api/users",
                headers=admin_headers,
                json={
                    "email": "newuser@test.com",
                    "username": "newuser",
                    "full_name": "New User",
                    "password": "newpassword123",
                    "roles": [],
                    "groups": [],
                    "customers": [],
                    "is_active": True,
                    "send_password_email": False
                }
            )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@test.com"
    
    @pytest.mark.asyncio
    async def test_create_user_duplicate_email(self, app_client: AsyncClient, admin_headers: dict):
        """Test creating user with duplicate email."""
        response = await app_client.post(
            "/api/users",
            headers=admin_headers,
            json={
                "email": "admin@test.com",
                "username": "duplicate",
                "full_name": "Duplicate User",
                "password": "password123",
                "roles": [],
                "groups": [],
                "customers": [],
                "is_active": True,
                "send_password_email": False
            }
        )
        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_update_user(self, app_client: AsyncClient, admin_headers: dict, mock_email_service):
        """Test updating a user."""
        with patch('app.routers.users.email_service', mock_email_service):
            response = await app_client.put(
                "/api/users/user@test.com",
                headers=admin_headers,
                json={"full_name": "Updated User Name"}
            )
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Updated User Name"
    
    @pytest.mark.asyncio
    async def test_delete_user(self, app_client: AsyncClient, admin_headers: dict, mock_db):
        """Test deleting a user."""
        # First create a user to delete
        from app.auth import get_password_hash
        from datetime import datetime
        
        await mock_db["users"].insert_one({
            "email": "todelete@test.com",
            "username": "todelete",
            "full_name": "To Delete",
            "password_hash": get_password_hash("password123"),
            "roles": [],
            "groups": [],
            "customers": [],
            "is_active": True,
            "is_super_admin": False,
            "last_login": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })
        
        response = await app_client.delete(
            "/api/users/todelete@test.com",
            headers=admin_headers
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_toggle_user_status(self, app_client: AsyncClient, admin_headers: dict, mock_email_service):
        """Test toggling user status."""
        with patch('app.routers.users.email_service', mock_email_service):
            response = await app_client.post(
                "/api/users/user@test.com/toggle-status",
                headers=admin_headers
            )
        assert response.status_code == 200
        data = response.json()
        assert "is_active" in data
    
    @pytest.mark.asyncio
    async def test_send_password_reset(self, app_client: AsyncClient, admin_headers: dict, mock_email_service):
        """Test sending password reset email."""
        with patch('app.routers.users.email_service', mock_email_service):
            response = await app_client.post(
                "/api/users/user@test.com/send-password-reset",
                headers=admin_headers,
                params={"send_email": False}
            )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
    
    @pytest.mark.asyncio
    async def test_admin_reset_password(self, app_client: AsyncClient, admin_headers: dict, mock_email_service):
        """Test admin resetting user password."""
        with patch('app.routers.users.email_service', mock_email_service):
            response = await app_client.post(
                "/api/users/user@test.com/reset-password",
                headers=admin_headers,
                params={"send_email": False}
            )
        assert response.status_code == 200
        data = response.json()
        assert "temp_password" in data
