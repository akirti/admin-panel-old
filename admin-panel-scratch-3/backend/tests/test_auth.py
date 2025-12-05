"""
Tests for authentication endpoints.
"""
import pytest
from httpx import AsyncClient


class TestAuth:
    """Test authentication endpoints."""
    
    @pytest.mark.asyncio
    async def test_login_success(self, app_client: AsyncClient):
        """Test successful login."""
        response = await app_client.post(
            "/api/auth/login",
            json={"email": "admin@test.com", "password": "testpass123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
    
    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, app_client: AsyncClient):
        """Test login with invalid credentials."""
        response = await app_client.post(
            "/api/auth/login",
            json={"email": "admin@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401
        assert "Incorrect email or password" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, app_client: AsyncClient):
        """Test login with non-existent user."""
        response = await app_client.post(
            "/api/auth/login",
            json={"email": "nonexistent@test.com", "password": "password"}
        )
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_get_current_user(self, app_client: AsyncClient, admin_headers: dict):
        """Test getting current user info."""
        response = await app_client.get("/api/auth/me", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "admin@test.com"
        assert data["is_super_admin"] is True
    
    @pytest.mark.asyncio
    async def test_get_current_user_unauthorized(self, app_client: AsyncClient):
        """Test getting current user without auth."""
        response = await app_client.get("/api/auth/me")
        assert response.status_code == 403
    
    @pytest.mark.asyncio
    async def test_change_password(self, app_client: AsyncClient, admin_headers: dict, mock_db):
        """Test password change."""
        response = await app_client.post(
            "/api/auth/change-password",
            headers=admin_headers,
            json={
                "current_password": "testpass123",
                "new_password": "newpassword123"
            }
        )
        assert response.status_code == 200
        assert "Password changed successfully" in response.json()["message"]
    
    @pytest.mark.asyncio
    async def test_change_password_wrong_current(self, app_client: AsyncClient, admin_headers: dict):
        """Test password change with wrong current password."""
        response = await app_client.post(
            "/api/auth/change-password",
            headers=admin_headers,
            json={
                "current_password": "wrongpassword",
                "new_password": "newpassword123"
            }
        )
        assert response.status_code == 400
        assert "Current password is incorrect" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_request_password_reset(self, app_client: AsyncClient, mock_email_service):
        """Test password reset request."""
        response = await app_client.post(
            "/api/auth/request-password-reset",
            json={"email": "admin@test.com", "send_email": False}
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_request_password_reset_nonexistent(self, app_client: AsyncClient):
        """Test password reset for non-existent user."""
        response = await app_client.post(
            "/api/auth/request-password-reset",
            json={"email": "nonexistent@test.com", "send_email": False}
        )
        # Should return 200 to not reveal user existence
        assert response.status_code == 200
