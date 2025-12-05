"""
Tests for bulk upload and dashboard endpoints.
"""
import pytest
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock
import io


class TestBulkUpload:
    """Test bulk upload endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_template_csv(self, app_client: AsyncClient, admin_headers: dict):
        """Test getting CSV template."""
        response = await app_client.get(
            "/api/bulk/template/users",
            headers=admin_headers,
            params={"format": "csv"}
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]
    
    @pytest.mark.asyncio
    async def test_get_template_xlsx(self, app_client: AsyncClient, admin_headers: dict):
        """Test getting XLSX template."""
        response = await app_client.get(
            "/api/bulk/template/roles",
            headers=admin_headers,
            params={"format": "xlsx"}
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_get_template_invalid_type(self, app_client: AsyncClient, admin_headers: dict):
        """Test getting template for invalid entity type."""
        response = await app_client.get(
            "/api/bulk/template/invalid",
            headers=admin_headers
        )
        assert response.status_code == 400
    
    @pytest.mark.asyncio
    async def test_bulk_upload_users(self, app_client: AsyncClient, admin_headers: dict, mock_email_service):
        """Test bulk uploading users."""
        csv_content = "email,username,full_name,is_active\nbulk1@test.com,bulk1,Bulk User 1,true\nbulk2@test.com,bulk2,Bulk User 2,true"
        files = {"file": ("users.csv", csv_content, "text/csv")}
        
        with patch('app.services.bulk_upload_service.email_service', mock_email_service):
            response = await app_client.post(
                "/api/bulk/upload/users",
                headers=admin_headers,
                files=files,
                params={"send_password_emails": False}
            )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert data["successful"] >= 0
    
    @pytest.mark.asyncio
    async def test_bulk_upload_roles(self, app_client: AsyncClient, admin_headers: dict):
        """Test bulk uploading roles."""
        csv_content = "roleId,name,description,status,priority\nbulk-role-1,Bulk Role 1,Test,active,1\nbulk-role-2,Bulk Role 2,Test,active,2"
        files = {"file": ("roles.csv", csv_content, "text/csv")}
        
        response = await app_client.post(
            "/api/bulk/upload/roles",
            headers=admin_headers,
            files=files
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_bulk_upload_groups(self, app_client: AsyncClient, admin_headers: dict):
        """Test bulk uploading groups."""
        csv_content = "groupId,name,description,status,priority\nbulk-group-1,Bulk Group 1,Test,active,1"
        files = {"file": ("groups.csv", csv_content, "text/csv")}
        
        response = await app_client.post(
            "/api/bulk/upload/groups",
            headers=admin_headers,
            files=files
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_bulk_upload_permissions(self, app_client: AsyncClient, admin_headers: dict):
        """Test bulk uploading permissions."""
        csv_content = "key,name,module,actions\nbulk.perm1,Bulk Perm 1,bulk,read"
        files = {"file": ("permissions.csv", csv_content, "text/csv")}
        
        response = await app_client.post(
            "/api/bulk/upload/permissions",
            headers=admin_headers,
            files=files
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_bulk_upload_customers(self, app_client: AsyncClient, admin_headers: dict):
        """Test bulk uploading customers."""
        csv_content = "customerId,name,description,status\nbulk-cust-1,Bulk Customer 1,Test,active"
        files = {"file": ("customers.csv", csv_content, "text/csv")}
        
        response = await app_client.post(
            "/api/bulk/upload/customers",
            headers=admin_headers,
            files=files
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_bulk_upload_domains(self, app_client: AsyncClient, admin_headers: dict):
        """Test bulk uploading domains."""
        csv_content = "key,name,path,status,order\nbulk-domain-1,Bulk Domain 1,/bulk,active,1"
        files = {"file": ("domains.csv", csv_content, "text/csv")}
        
        response = await app_client.post(
            "/api/bulk/upload/domains",
            headers=admin_headers,
            files=files
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_bulk_upload_invalid_entity(self, app_client: AsyncClient, admin_headers: dict):
        """Test bulk upload with invalid entity type."""
        csv_content = "col1,col2\nval1,val2"
        files = {"file": ("invalid.csv", csv_content, "text/csv")}
        
        response = await app_client.post(
            "/api/bulk/upload/invalid",
            headers=admin_headers,
            files=files
        )
        assert response.status_code == 400
    
    @pytest.mark.asyncio
    async def test_bulk_upload_invalid_file_format(self, app_client: AsyncClient, admin_headers: dict):
        """Test bulk upload with invalid file format."""
        files = {"file": ("test.txt", "some text", "text/plain")}
        
        response = await app_client.post(
            "/api/bulk/upload/users",
            headers=admin_headers,
            files=files
        )
        assert response.status_code == 400
    
    @pytest.mark.asyncio
    async def test_gcs_status(self, app_client: AsyncClient, admin_headers: dict, mock_gcs_service):
        """Test GCS status endpoint."""
        with patch('app.routers.bulk_upload.gcs_service', mock_gcs_service):
            response = await app_client.get(
                "/api/bulk/gcs/status",
                headers=admin_headers
            )
        assert response.status_code == 200
        assert "configured" in response.json()
    
    @pytest.mark.asyncio
    async def test_gcs_list_files(self, app_client: AsyncClient, admin_headers: dict, mock_gcs_service):
        """Test GCS list files endpoint."""
        with patch('app.routers.bulk_upload.gcs_service', mock_gcs_service):
            response = await app_client.get(
                "/api/bulk/gcs/list",
                headers=admin_headers
            )
        assert response.status_code == 200
        assert "files" in response.json()


class TestDashboard:
    """Test dashboard endpoints."""
    
    @pytest.mark.asyncio
    async def test_get_dashboard_stats(self, app_client: AsyncClient, admin_headers: dict):
        """Test getting dashboard statistics."""
        response = await app_client.get("/api/dashboard/stats", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "active_users" in data
        assert "total_roles" in data
        assert "total_groups" in data
    
    @pytest.mark.asyncio
    async def test_get_summary(self, app_client: AsyncClient, admin_headers: dict):
        """Test getting dashboard summary."""
        response = await app_client.get("/api/dashboard/summary", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "roles" in data
        assert "groups" in data
    
    @pytest.mark.asyncio
    async def test_get_recent_logins(self, app_client: AsyncClient, admin_headers: dict):
        """Test getting recent logins."""
        response = await app_client.get("/api/dashboard/recent-logins", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "recent_logins" in data


class TestHealthAndRoot:
    """Test health and root endpoints."""
    
    @pytest.mark.asyncio
    async def test_root(self, app_client: AsyncClient):
        """Test root endpoint."""
        response = await app_client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
    
    @pytest.mark.asyncio
    async def test_health(self, app_client: AsyncClient):
        """Test health endpoint."""
        response = await app_client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
