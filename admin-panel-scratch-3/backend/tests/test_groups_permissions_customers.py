"""
Tests for groups, permissions, and customers endpoints.
"""
import pytest
from httpx import AsyncClient
from unittest.mock import patch


class TestGroups:
    """Test group management endpoints."""
    
    @pytest.mark.asyncio
    async def test_list_groups(self, app_client: AsyncClient, admin_headers: dict, sample_group):
        """Test listing groups."""
        response = await app_client.get("/api/groups", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    @pytest.mark.asyncio
    async def test_count_groups(self, app_client: AsyncClient, admin_headers: dict, sample_group):
        """Test counting groups."""
        response = await app_client.get("/api/groups/count", headers=admin_headers)
        assert response.status_code == 200
        assert "count" in response.json()
    
    @pytest.mark.asyncio
    async def test_get_group(self, app_client: AsyncClient, admin_headers: dict, sample_group):
        """Test getting a specific group."""
        response = await app_client.get(
            f"/api/groups/{sample_group['groupId']}",
            headers=admin_headers
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_create_group(self, app_client: AsyncClient, admin_headers: dict):
        """Test creating a group."""
        response = await app_client.post(
            "/api/groups",
            headers=admin_headers,
            json={
                "type": "custom",
                "groupId": "new-group-123",
                "name": "New Group",
                "description": "A new group",
                "permissions": ["read"],
                "domains": [],
                "status": "active",
                "priority": 5
            }
        )
        assert response.status_code == 201
    
    @pytest.mark.asyncio
    async def test_update_group(self, app_client: AsyncClient, admin_headers: dict, sample_group, mock_email_service):
        """Test updating a group."""
        with patch('app.routers.groups.email_service', mock_email_service):
            response = await app_client.put(
                f"/api/groups/{sample_group['groupId']}",
                headers=admin_headers,
                json={"name": "Updated Group Name"}
            )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_delete_group(self, app_client: AsyncClient, admin_headers: dict, mock_db):
        """Test deleting a group."""
        from datetime import datetime
        
        await mock_db["groups"].insert_one({
            "type": "custom",
            "groupId": "to-delete-group",
            "name": "To Delete",
            "permissions": [],
            "domains": [],
            "status": "active",
            "priority": 1,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })
        
        response = await app_client.delete(
            "/api/groups/to-delete-group",
            headers=admin_headers
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_toggle_group_status(self, app_client: AsyncClient, admin_headers: dict, sample_group, mock_email_service):
        """Test toggling group status."""
        with patch('app.routers.groups.email_service', mock_email_service):
            response = await app_client.post(
                f"/api/groups/{sample_group['groupId']}/toggle-status",
                headers=admin_headers
            )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_get_group_users(self, app_client: AsyncClient, admin_headers: dict, sample_group):
        """Test getting users in a group."""
        response = await app_client.get(
            f"/api/groups/{sample_group['groupId']}/users",
            headers=admin_headers
        )
        assert response.status_code == 200


class TestPermissions:
    """Test permission management endpoints."""
    
    @pytest.mark.asyncio
    async def test_list_permissions(self, app_client: AsyncClient, admin_headers: dict, sample_permission):
        """Test listing permissions."""
        response = await app_client.get("/api/permissions", headers=admin_headers)
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_list_modules(self, app_client: AsyncClient, admin_headers: dict, sample_permission):
        """Test listing permission modules."""
        response = await app_client.get("/api/permissions/modules", headers=admin_headers)
        assert response.status_code == 200
        assert "modules" in response.json()
    
    @pytest.mark.asyncio
    async def test_count_permissions(self, app_client: AsyncClient, admin_headers: dict, sample_permission):
        """Test counting permissions."""
        response = await app_client.get("/api/permissions/count", headers=admin_headers)
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_get_permission(self, app_client: AsyncClient, admin_headers: dict, sample_permission):
        """Test getting a specific permission."""
        response = await app_client.get(
            f"/api/permissions/{sample_permission['key']}",
            headers=admin_headers
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_create_permission(self, app_client: AsyncClient, admin_headers: dict):
        """Test creating a permission."""
        response = await app_client.post(
            "/api/permissions",
            headers=admin_headers,
            json={
                "key": "new.permission",
                "name": "New Permission",
                "description": "A new permission",
                "module": "new",
                "actions": ["create", "read"]
            }
        )
        assert response.status_code == 201
    
    @pytest.mark.asyncio
    async def test_update_permission(self, app_client: AsyncClient, admin_headers: dict, sample_permission):
        """Test updating a permission."""
        response = await app_client.put(
            f"/api/permissions/{sample_permission['key']}",
            headers=admin_headers,
            json={"name": "Updated Permission"}
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_delete_permission(self, app_client: AsyncClient, admin_headers: dict, mock_db):
        """Test deleting a permission."""
        from datetime import datetime
        
        await mock_db["permissions"].insert_one({
            "key": "to.delete",
            "name": "To Delete",
            "module": "test",
            "actions": ["read"],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })
        
        response = await app_client.delete(
            "/api/permissions/to.delete",
            headers=admin_headers
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_get_permission_roles(self, app_client: AsyncClient, admin_headers: dict, sample_permission):
        """Test getting roles with a permission."""
        response = await app_client.get(
            f"/api/permissions/{sample_permission['key']}/roles",
            headers=admin_headers
        )
        assert response.status_code == 200


class TestCustomers:
    """Test customer management endpoints."""
    
    @pytest.mark.asyncio
    async def test_list_customers(self, app_client: AsyncClient, admin_headers: dict, sample_customer):
        """Test listing customers."""
        response = await app_client.get("/api/customers", headers=admin_headers)
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_count_customers(self, app_client: AsyncClient, admin_headers: dict, sample_customer):
        """Test counting customers."""
        response = await app_client.get("/api/customers/count", headers=admin_headers)
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_get_customer(self, app_client: AsyncClient, admin_headers: dict, sample_customer):
        """Test getting a specific customer."""
        response = await app_client.get(
            f"/api/customers/{sample_customer['customerId']}",
            headers=admin_headers
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_create_customer(self, app_client: AsyncClient, admin_headers: dict):
        """Test creating a customer."""
        response = await app_client.post(
            "/api/customers",
            headers=admin_headers,
            json={
                "customerId": "new-customer-123",
                "name": "New Customer",
                "description": "A new customer",
                "status": "active"
            }
        )
        assert response.status_code == 201
    
    @pytest.mark.asyncio
    async def test_update_customer(self, app_client: AsyncClient, admin_headers: dict, sample_customer, mock_email_service):
        """Test updating a customer."""
        with patch('app.routers.customers.email_service', mock_email_service):
            response = await app_client.put(
                f"/api/customers/{sample_customer['customerId']}",
                headers=admin_headers,
                json={"name": "Updated Customer"}
            )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_toggle_customer_status(self, app_client: AsyncClient, admin_headers: dict, sample_customer, mock_email_service):
        """Test toggling customer status."""
        with patch('app.routers.customers.email_service', mock_email_service):
            response = await app_client.post(
                f"/api/customers/{sample_customer['customerId']}/toggle-status",
                headers=admin_headers
            )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_get_customer_users(self, app_client: AsyncClient, admin_headers: dict, sample_customer):
        """Test getting users for a customer."""
        response = await app_client.get(
            f"/api/customers/{sample_customer['customerId']}/users",
            headers=admin_headers
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_assign_users_to_customer(self, app_client: AsyncClient, admin_headers: dict, sample_customer, mock_email_service):
        """Test assigning users to a customer."""
        with patch('app.routers.customers.email_service', mock_email_service):
            response = await app_client.post(
                f"/api/customers/{sample_customer['customerId']}/assign-users",
                headers=admin_headers,
                json=["user@test.com"]
            )
        assert response.status_code == 200
