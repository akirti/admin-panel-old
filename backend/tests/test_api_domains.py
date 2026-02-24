"""Tests for Domain API Routes"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from bson import ObjectId

from easylifeauth.api.domain_routes import (
    router, create_pagination_meta, check_domain_access, get_user_accessible_domains
)
from easylifeauth.api import dependencies
from easylifeauth.security.access_control import CurrentUser, require_super_admin, get_current_user


class TestDomainsPaginationMeta:
    """Tests for domains pagination metadata"""

    def test_create_pagination_meta(self):
        """Test pagination meta creation"""
        meta = create_pagination_meta(total=50, page=1, limit=10)
        assert meta.total == 50
        assert meta.page == 1
        assert meta.limit == 10
        assert meta.pages == 5


class TestCheckDomainAccess:
    """Tests for domain access checking"""

    def test_check_domain_access_with_all(self):
        """Test access check with 'all' permission"""
        assert check_domain_access(["all"], "any_domain") is True

    def test_check_domain_access_with_specific_domain(self):
        """Test access check with specific domain"""
        assert check_domain_access(["domain1", "domain2"], "domain1") is True
        assert check_domain_access(["domain1", "domain2"], "domain3") is False

    def test_check_domain_access_empty_list(self):
        """Test access check with empty domain list"""
        assert check_domain_access([], "domain1") is False


class TestGetUserAccessibleDomains:
    """Tests for getting user accessible domains"""

    @pytest.mark.asyncio
    async def test_super_admin_gets_all(self):
        """Test super admin gets all domains"""
        mock_db = MagicMock()
        mock_user_service = MagicMock()

        current_user = CurrentUser(
            user_id="test",
            email="admin@example.com",
            roles=["super-administrator"],
            groups=[],
            domains=[]
        )

        result = await get_user_accessible_domains(current_user, mock_db, mock_user_service)
        assert result == ["all"]

    @pytest.mark.asyncio
    async def test_regular_user_no_user_found(self):
        """Test regular user not found returns empty"""
        mock_db = MagicMock()
        mock_db.users.find_one = AsyncMock(return_value=None)
        mock_user_service = MagicMock()

        current_user = CurrentUser(
            user_id="test",
            email="user@example.com",
            roles=["user"],
            groups=[],
            domains=[]
        )

        result = await get_user_accessible_domains(current_user, mock_db, mock_user_service)
        assert result == []

    @pytest.mark.asyncio
    async def test_regular_user_with_resolved_domains(self):
        """Test regular user gets resolved domains"""
        mock_db = MagicMock()
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId(),
            "email": "user@example.com"
        })
        mock_user_service = MagicMock()
        mock_user_service.resolve_user_domains = AsyncMock(return_value=["domain1", "domain2"])

        current_user = CurrentUser(
            user_id="test",
            email="user@example.com",
            roles=["user"],
            groups=[],
            domains=[]
        )

        result = await get_user_accessible_domains(current_user, mock_db, mock_user_service)
        assert result == ["domain1", "domain2"]


class TestDomainsRoutes:
    """Tests for domains management endpoints"""

    @pytest.fixture
    def mock_super_admin_user(self):
        """Create mock super admin user"""
        return CurrentUser(
            user_id="507f1f77bcf86cd799439011",
            email="admin@example.com",
            roles=["super_admin", "super-administrator"],
            groups=[],
            domains=[]
        )

    @pytest.fixture
    def mock_regular_user(self):
        """Create mock regular user"""
        return CurrentUser(
            user_id="507f1f77bcf86cd799439012",
            email="user@example.com",
            roles=["user"],
            groups=["viewer"],
            domains=["domain1"]
        )

    @pytest.fixture
    def mock_db(self):
        """Create mock database"""
        db = MagicMock()
        db.domains = MagicMock()
        db.domains.find_one = AsyncMock()
        db.domains.find = MagicMock()
        db.domains.insert_one = AsyncMock()
        db.domains.update_one = AsyncMock()
        db.domains.delete_one = AsyncMock()
        db.domains.count_documents = AsyncMock(return_value=0)
        db.users = MagicMock()
        db.users.find_one = AsyncMock()
        return db

    @pytest.fixture
    def mock_user_service(self):
        """Create mock user service"""
        service = MagicMock()
        service.resolve_user_domains = AsyncMock(return_value=["domain1"])
        return service

    @pytest.fixture
    def app(self, mock_super_admin_user, mock_db, mock_user_service):
        """Create test FastAPI app"""
        app = FastAPI()
        app.include_router(router)

        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin_user
        app.dependency_overrides[get_current_user] = lambda: mock_super_admin_user
        app.dependency_overrides[dependencies.get_db] = lambda: mock_db
        app.dependency_overrides[dependencies.get_user_service] = lambda: mock_user_service

        return app

    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return TestClient(app)

    def test_get_all_domains_super_admin(self, client, mock_db):
        """Test getting all domains as super admin"""
        async def domain_cursor():
            yield {
                "_id": ObjectId("507f1f77bcf86cd799439011"),
                "key": "domain1",
                "name": "Domain 1",
                "description": "Test domain",
                "path": "/domain1",
                "status": "active",
                "order": 1,
                "subDomains": [],
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }

        mock_cursor = MagicMock()
        mock_cursor.sort.return_value = domain_cursor()
        mock_db.domains.find.return_value = mock_cursor

        response = client.get("/domains/all")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_list_domains(self, client, mock_db):
        """Test listing domains with pagination"""
        mock_db.domains.count_documents = AsyncMock(return_value=0)

        async def empty_cursor():
            return
            yield

        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = empty_cursor()
        mock_db.domains.find.return_value = mock_cursor

        response = client.get("/domains")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data

    def test_count_domains(self, client, mock_db):
        """Test counting domains"""
        mock_db.domains.count_documents = AsyncMock(return_value=10)

        response = client.get("/domains/count")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 10

    def test_get_domain_success(self, client, mock_db):
        """Test getting a specific domain"""
        domain_data = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "key": "domain1",
            "name": "Domain 1",
            "description": "Test domain",
            "path": "/domain1",
            "status": "active",
            "order": 1,
            "subDomains": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        mock_db.domains.find_one = AsyncMock(return_value=domain_data)

        response = client.get("/domains/507f1f77bcf86cd799439011")
        assert response.status_code == 200
        data = response.json()
        assert data["key"] == "domain1"

    def test_get_domain_not_found(self, client, mock_db):
        """Test getting non-existent domain"""
        mock_db.domains.find_one = AsyncMock(return_value=None)

        response = client.get("/domains/nonexistent")
        assert response.status_code == 404

    def test_create_domain_success(self, client, mock_db):
        """Test creating a new domain"""
        mock_db.domains.find_one = AsyncMock(return_value=None)
        mock_db.domains.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId("507f1f77bcf86cd799439011"))
        )

        response = client.post("/domains", json={
            "key": "newdomain",
            "name": "New Domain",
            "description": "A new domain",
            "path": "/newdomain",
            "order": 1
        })

        assert response.status_code == 201
        data = response.json()
        assert data["key"] == "newdomain"

    def test_create_domain_duplicate(self, client, mock_db):
        """Test creating domain with existing key"""
        mock_db.domains.find_one = AsyncMock(return_value={"key": "existing"})

        response = client.post("/domains", json={
            "key": "existing",
            "name": "Existing Domain",
            "description": "Already exists",
            "path": "/existing",
            "order": 1
        })

        assert response.status_code == 400
        assert "Domain key already exists" in response.json()["detail"]

    def test_update_domain_success(self, client, mock_db):
        """Test updating a domain"""
        existing_domain = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "key": "domain1",
            "name": "Domain 1",
            "description": "Old description",
            "path": "/domain1",
            "status": "active",
            "order": 1,
            "subDomains": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        mock_db.domains.find_one = AsyncMock(return_value=existing_domain)

        response = client.put("/domains/507f1f77bcf86cd799439011", json={
            "description": "Updated description"
        })

        assert response.status_code == 200
        mock_db.domains.update_one.assert_called_once()

    def test_update_domain_not_found(self, client, mock_db):
        """Test updating non-existent domain"""
        mock_db.domains.find_one = AsyncMock(return_value=None)

        response = client.put("/domains/nonexistent", json={
            "description": "Updated"
        })

        assert response.status_code == 404

    def test_delete_domain_success(self, client, mock_db):
        """Test deleting a domain"""
        mock_db.domains.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "key": "domain1"
        })
        mock_db.domains.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
        mock_db.roles = MagicMock()
        mock_db.roles.update_many = AsyncMock()
        mock_db.groups = MagicMock()
        mock_db.groups.update_many = AsyncMock()
        mock_db.users.update_many = AsyncMock()
        mock_db.domain_scenarios = MagicMock()
        mock_db.domain_scenarios.delete_many = AsyncMock()

        response = client.delete("/domains/507f1f77bcf86cd799439011")
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]

    def test_delete_domain_not_found(self, client, mock_db):
        """Test deleting non-existent domain"""
        mock_db.domains.find_one = AsyncMock(return_value=None)
        mock_db.domains.delete_one = AsyncMock(return_value=MagicMock(deleted_count=0))

        response = client.delete("/domains/nonexistent")
        assert response.status_code == 404

    def test_toggle_domain_status(self, client, mock_db):
        """Test toggling domain status"""
        mock_db.domains.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "key": "domain1",
            "status": "active"
        })

        response = client.post("/domains/507f1f77bcf86cd799439011/toggle-status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "inactive"

    def test_toggle_domain_status_not_found(self, client, mock_db):
        """Test toggling status of non-existent domain"""
        mock_db.domains.find_one = AsyncMock(return_value=None)

        response = client.post("/domains/nonexistent/toggle-status")
        assert response.status_code == 404

    def test_add_subdomain(self, client, mock_db):
        """Test adding a subdomain"""
        domain_data = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "key": "domain1",
            "name": "Domain 1",
            "path": "/domain1",
            "status": "active",
            "subDomains": []
        }
        # find_one called twice: once to check exists, once to get updated
        mock_db.domains.find_one = AsyncMock(side_effect=[domain_data, domain_data])

        response = client.post("/domains/507f1f77bcf86cd799439011/subdomains", json={
            "key": "subdomain1",
            "name": "Subdomain 1",
            "path": "/subdomain1",
            "status": "active"
        })

        assert response.status_code == 200
        mock_db.domains.update_one.assert_called_once()

    def test_add_subdomain_domain_not_found(self, client, mock_db):
        """Test adding subdomain to non-existent domain"""
        mock_db.domains.find_one = AsyncMock(return_value=None)

        response = client.post("/domains/nonexistent/subdomains", json={
            "key": "subdomain1",
            "name": "Subdomain 1",
            "path": "/subdomain1",
            "status": "active"
        })

        assert response.status_code == 404

    def test_remove_subdomain(self, client, mock_db):
        """Test removing a subdomain"""
        mock_db.domains.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "key": "domain1",
            "subDomains": [{"key": "subdomain1", "name": "Subdomain 1"}]
        })

        response = client.delete("/domains/507f1f77bcf86cd799439011/subdomains/subdomain1")
        assert response.status_code == 200
        mock_db.domains.update_one.assert_called_once()

    def test_remove_subdomain_domain_not_found(self, client, mock_db):
        """Test removing subdomain from non-existent domain"""
        mock_db.domains.find_one = AsyncMock(return_value=None)

        response = client.delete("/domains/nonexistent/subdomains/subdomain1")
        assert response.status_code == 404
