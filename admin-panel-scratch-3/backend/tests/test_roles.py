"""
Tests for role management endpoints.
"""
import pytest
from httpx import AsyncClient
from unittest.mock import patch


class TestRoles:
    """Test role management endpoints."""
    
    @pytest.mark.asyncio
    async def test_list_roles(self, app_client: AsyncClient, admin_headers: dict, sample_role):
        """Test listing roles."""
        response = await app_client.get("/api/roles", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
    
    @pytest.mark.asyncio
    async def test_list_roles_with_search(self, app_client: AsyncClient, admin_headers: dict, sample_role):
        """Test listing roles with search."""
        response = await app_client.get(
            "/api/roles",
            headers=admin_headers,
            params={"search": "Test"}
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_list_roles_with_status(self, app_client: AsyncClient, admin_headers: dict, sample_role):
        """Test listing roles with status filter."""
        response = await app_client.get(
            "/api/roles",
            headers=admin_headers,
            params={"status": "active"}
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_count_roles(self, app_client: AsyncClient, admin_headers: dict, sample_role):
        """Test counting roles."""
        response = await app_client.get("/api/roles/count", headers=admin_headers)
        assert response.status_code == 200
        assert "count" in response.json()
    
    @pytest.mark.asyncio
    async def test_get_role(self, app_client: AsyncClient, admin_headers: dict, sample_role):
        """Test getting a specific role."""
        response = await app_client.get(
            f"/api/roles/{sample_role['roleId']}",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["roleId"] == sample_role["roleId"]
    
    @pytest.mark.asyncio
    async def test_get_role_not_found(self, app_client: AsyncClient, admin_headers: dict):
        """Test getting non-existent role."""
        response = await app_client.get(
            "/api/roles/nonexistent-role",
            headers=admin_headers
        )
        assert response.status_code == 404
    
    @pytest.mark.asyncio
    async def test_create_role(self, app_client: AsyncClient, admin_headers: dict):
        """Test creating a role."""
        response = await app_client.post(
            "/api/roles",
            headers=admin_headers,
            json={
                "type": "custom",
                "roleId": "new-role-123",
                "name": "New Role",
                "description": "A new role",
                "permissions": ["read"],
                "domains": [],
                "status": "active",
                "priority": 5
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["roleId"] == "new-role-123"
    
    @pytest.mark.asyncio
    async def test_create_role_duplicate(self, app_client: AsyncClient, admin_headers: dict, sample_role):
        """Test creating role with duplicate ID."""
        response = await app_client.post(
            "/api/roles",
            headers=admin_headers,
            json={
                "type": "custom",
                "roleId": sample_role["roleId"],
                "name": "Duplicate Role",
                "permissions": [],
                "domains": [],
                "status": "active",
                "priority": 1
            }
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_update_role(self, app_client: AsyncClient, admin_headers: dict, sample_role, mock_email_service):
        """Test updating a role."""
        with patch('app.routers.roles.email_service', mock_email_service):
            response = await app_client.put(
                f"/api/roles/{sample_role['roleId']}",
                headers=admin_headers,
                json={"name": "Updated Role Name"}
            )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Role Name"
    
    @pytest.mark.asyncio
    async def test_delete_role(self, app_client: AsyncClient, admin_headers: dict, mock_db):
        """Test deleting a role."""
        from datetime import datetime
        
        await mock_db["roles"].insert_one({
            "type": "custom",
            "roleId": "to-delete-role",
            "name": "To Delete",
            "permissions": [],
            "domains": [],
            "status": "active",
            "priority": 1,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })
        
        response = await app_client.delete(
            "/api/roles/to-delete-role",
            headers=admin_headers
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_toggle_role_status(self, app_client: AsyncClient, admin_headers: dict, sample_role, mock_email_service):
        """Test toggling role status."""
        with patch('app.routers.roles.email_service', mock_email_service):
            response = await app_client.post(
                f"/api/roles/{sample_role['roleId']}/toggle-status",
                headers=admin_headers
            )
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
    
    @pytest.mark.asyncio
    async def test_get_role_users(self, app_client: AsyncClient, admin_headers: dict, sample_role):
        """Test getting users with a specific role."""
        response = await app_client.get(
            f"/api/roles/{sample_role['roleId']}/users",
            headers=admin_headers
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)
