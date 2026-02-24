"""Tests for Scenario Request Routes"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
from bson import ObjectId
from datetime import datetime

from easylifeauth.api.scenario_request_routes import router
from easylifeauth.api.dependencies import get_current_user, get_scenario_request_service
from easylifeauth.security.access_control import require_admin_or_editor
from easylifeauth.errors.auth_error import AuthError


class TestScenarioRequestRoutes:
    """Tests for scenario request API routes"""

    @pytest.fixture
    def app(self):
        """Create test app"""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_scenario_request_service(self):
        """Create mock scenario request service"""
        service = MagicMock()
        # Default get returns matching user for ownership checks
        service.get = AsyncMock(return_value={
            "user_id": "user_123",
            "email": "user@test.com",
            "request_id": "req_123"
        })
        return service

    @pytest.fixture
    def mock_user(self):
        """Create mock user"""
        user = MagicMock()
        user.email = "user@test.com"
        user.user_id = "user_123"
        user.roles = ["user"]
        user.model_dump = MagicMock(return_value={
            "email": "user@test.com",
            "user_id": "user_123",
            "roles": ["user"]
        })
        return user

    @pytest.fixture
    def mock_admin(self):
        """Create mock admin user"""
        user = MagicMock()
        user.email = "admin@test.com"
        user.user_id = "admin_123"
        user.roles = ["administrator"]
        user.model_dump = MagicMock(return_value={
            "email": "admin@test.com",
            "user_id": "admin_123",
            "roles": ["administrator"]
        })
        return user

    @pytest.fixture
    def client(self, app, mock_scenario_request_service, mock_user, mock_admin):
        """Create test client with overridden dependencies"""
        app.dependency_overrides[get_scenario_request_service] = lambda: mock_scenario_request_service
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[require_admin_or_editor] = lambda: mock_admin
        return TestClient(app)

    def test_get_status_options(self, client):
        """Test get status options endpoint"""
        response = client.get("/ask_scenarios/lookup/statuses")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Check that we have status options
        assert len(data) > 0
        # Each option should have value and label
        for item in data:
            assert "value" in item
            assert "label" in item

    def test_get_request_type_options(self, client):
        """Test get request type options endpoint"""
        response = client.get("/ask_scenarios/lookup/request_types")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 6
        # Check for expected types
        values = [item["value"] for item in data]
        assert "scenario" in values
        assert "scenario_update" in values
        assert "new_feature" in values

    def test_get_domain_options(self, client, mock_scenario_request_service):
        """Test get domain options endpoint"""
        domains = [
            {"value": "domain-a", "label": "Domain A"},
            {"value": "domain-b", "label": "Domain B"}
        ]
        mock_scenario_request_service.get_domains = AsyncMock(return_value=domains)

        response = client.get("/ask_scenarios/lookup/domains")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_domain_options_error(self, client, mock_scenario_request_service):
        """Test get domain options with error"""
        mock_scenario_request_service.get_domains = AsyncMock(side_effect=Exception("DB error"))

        response = client.get("/ask_scenarios/lookup/domains")
        assert response.status_code == 500

    def test_search_users(self, client, mock_scenario_request_service):
        """Test search users endpoint"""
        users = [
            {"user_id": "user_1", "email": "john@test.com", "name": "John"},
            {"user_id": "user_2", "email": "jane@test.com", "name": "Jane"}
        ]
        mock_scenario_request_service.search_users = AsyncMock(return_value=users)

        response = client.get("/ask_scenarios/lookup/users?q=jo")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_search_users_error(self, client, mock_scenario_request_service):
        """Test search users with error"""
        mock_scenario_request_service.search_users = AsyncMock(side_effect=Exception("Search error"))

        response = client.get("/ask_scenarios/lookup/users?q=test")
        assert response.status_code == 500

    def test_get_all_scenario_requests(self, client, mock_scenario_request_service):
        """Test get all scenario requests endpoint"""
        result = {
            "data": [
                {"request_id": "req_1", "title": "Request 1"},
                {"request_id": "req_2", "title": "Request 2"}
            ],
            "pagination": {"total": 2, "page": 0, "limit": 25}
        }
        mock_scenario_request_service.get_all = AsyncMock(return_value=result)

        response = client.get("/ask_scenarios/all")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data

    def test_get_all_scenario_requests_with_pagination(self, client, mock_scenario_request_service):
        """Test get all scenario requests with pagination"""
        result = {"data": [], "pagination": {"total": 0, "page": 1, "limit": 10}}
        mock_scenario_request_service.get_all = AsyncMock(return_value=result)

        response = client.get("/ask_scenarios/all?page=1&limit=10")
        assert response.status_code == 200

    def test_get_all_scenario_requests_error(self, client, mock_scenario_request_service):
        """Test get all scenario requests with error"""
        # AuthError defaults to status_code=400
        mock_scenario_request_service.get_all = AsyncMock(side_effect=AuthError("Unauthorized"))

        response = client.get("/ask_scenarios/all")
        assert response.status_code == 400  # AuthError default status_code

    def test_create_scenario_request(self, client, mock_scenario_request_service, mock_user):
        """Test create scenario request endpoint"""
        result = {
            "request_id": "req_123",
            "name": "New Request",
            "status": "new"
        }
        mock_scenario_request_service.save = AsyncMock(return_value=result)

        # ScenarioRequestCreate requires: dataDomain, name, description
        request_data = {
            "name": "New Request",
            "requestType": "scenario",
            "dataDomain": "domain-a",
            "description": "Test description for the new request"
        }

        response = client.post("/ask_scenarios", json=request_data)
        assert response.status_code == 201

    def test_create_scenario_request_error(self, client, mock_scenario_request_service):
        """Test create scenario request with error"""
        mock_scenario_request_service.save = AsyncMock(side_effect=AuthError("Unauthorized"))

        request_data = {
            "name": "New Request",
            "requestType": "scenario",
            "dataDomain": "domain-a",
            "description": "Test description"
        }

        response = client.post("/ask_scenarios", json=request_data)
        assert response.status_code == 400  # AuthError default status_code

    def test_update_scenario_request(self, client, mock_scenario_request_service):
        """Test update scenario request endpoint"""
        result = {"request_id": "req_123", "title": "Updated Request"}
        mock_scenario_request_service.update = AsyncMock(return_value=result)

        response = client.put("/ask_scenarios/req_123", json={"title": "Updated Request"})
        assert response.status_code == 200

    def test_update_scenario_request_error(self, client, mock_scenario_request_service):
        """Test update scenario request with error"""
        mock_scenario_request_service.update = AsyncMock(side_effect=AuthError("Unauthorized"))

        response = client.put("/ask_scenarios/req_123", json={"title": "Updated"})
        assert response.status_code == 400  # AuthError default status_code

    def test_get_scenario_request(self, client, mock_scenario_request_service):
        """Test get scenario request by ID"""
        result = {
            "request_id": "req_123",
            "title": "Test Request",
            "status": "new",
            "user_id": "user_123",
            "email": "user@test.com"
        }
        mock_scenario_request_service.get = AsyncMock(return_value=result)

        response = client.get("/ask_scenarios/req_123")
        assert response.status_code == 200
        data = response.json()
        assert data["request_id"] == "req_123"

    def test_get_scenario_request_error(self, client, mock_scenario_request_service):
        """Test get scenario request with error"""
        mock_scenario_request_service.get = AsyncMock(side_effect=AuthError("Not found", 404))

        response = client.get("/ask_scenarios/req_123")
        assert response.status_code == 404

    def test_upload_user_file(self, client, mock_scenario_request_service):
        """Test upload user file endpoint"""
        result = {
            "file_name": "test.csv",
            "file_path": "files/test.csv",
            "size": 100
        }
        mock_scenario_request_service.upload_file = AsyncMock(return_value=result)

        response = client.post(
            "/ask_scenarios/req_123/files",
            files={"file": ("test.csv", b"test content", "text/csv")}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["file_name"] == "test.csv"

    def test_upload_user_file_error(self, client, mock_scenario_request_service):
        """Test upload user file with error"""
        mock_scenario_request_service.upload_file = AsyncMock(side_effect=AuthError("Forbidden"))

        response = client.post(
            "/ask_scenarios/req_123/files",
            files={"file": ("test.csv", b"test content", "text/csv")}
        )
        assert response.status_code == 400  # AuthError default status_code

    def test_upload_bucket_file(self, client, mock_scenario_request_service):
        """Test upload bucket file endpoint (admin)"""
        result = {
            "file_name": "output.json",
            "file_path": "buckets/output.json",
            "size": 500
        }
        mock_scenario_request_service.upload_file = AsyncMock(return_value=result)

        response = client.post(
            "/ask_scenarios/req_123/buckets",
            files={"file": ("output.json", b"json content", "application/json")},
            data={"comment": "Output file"}
        )
        assert response.status_code == 200

    def test_upload_bucket_file_error(self, client, mock_scenario_request_service):
        """Test upload bucket file with error"""
        mock_scenario_request_service.upload_file = AsyncMock(side_effect=AuthError("Forbidden"))

        response = client.post(
            "/ask_scenarios/req_123/buckets",
            files={"file": ("output.json", b"json content", "application/json")}
        )
        assert response.status_code == 400  # AuthError default status_code

    def test_preview_file(self, client, mock_scenario_request_service):
        """Test file preview endpoint"""
        result = {
            "columns": ["col1", "col2"],
            "data": [{"col1": "a", "col2": "b"}],
            "total_rows": 1
        }
        mock_scenario_request_service.get_file_preview = AsyncMock(return_value=result)

        response = client.get("/ask_scenarios/req_123/files/test.csv/preview")
        assert response.status_code == 200

    def test_preview_file_error(self, client, mock_scenario_request_service):
        """Test file preview with error"""
        mock_scenario_request_service.get_file_preview = AsyncMock(side_effect=AuthError("Forbidden"))

        response = client.get("/ask_scenarios/req_123/files/test.csv/preview")
        assert response.status_code == 400  # AuthError default status_code

    def test_download_file(self, client, mock_scenario_request_service):
        """Test file download endpoint"""
        mock_scenario_request_service.download_file = AsyncMock(
            return_value=(b"file content", "test.csv")
        )

        response = client.get("/ask_scenarios/req_123/files/test.csv/download")
        assert response.status_code == 200
        assert response.headers["content-disposition"] == 'attachment; filename="test.csv"'

    def test_download_file_not_found(self, client, mock_scenario_request_service):
        """Test file download when file not found"""
        mock_scenario_request_service.download_file = AsyncMock(return_value=None)

        response = client.get("/ask_scenarios/req_123/files/nonexistent.csv/download")
        assert response.status_code == 404

    def test_download_file_error(self, client, mock_scenario_request_service):
        """Test file download with error"""
        mock_scenario_request_service.download_file = AsyncMock(side_effect=AuthError("Forbidden"))

        response = client.get("/ask_scenarios/req_123/files/test.csv/download")
        assert response.status_code == 400  # AuthError default status_code

    def test_add_comment(self, client, mock_scenario_request_service):
        """Test add comment endpoint"""
        result = {"request_id": "req_123", "comments": [{"comment": "Test comment"}]}
        mock_scenario_request_service.update = AsyncMock(return_value=result)

        response = client.post(
            "/ask_scenarios/req_123/comment",
            data={"comment": "Test comment"}
        )
        assert response.status_code == 200

    def test_add_comment_error(self, client, mock_scenario_request_service):
        """Test add comment with error"""
        mock_scenario_request_service.update = AsyncMock(side_effect=AuthError("Forbidden"))

        response = client.post(
            "/ask_scenarios/req_123/comment",
            data={"comment": "Test comment"}
        )
        assert response.status_code == 400  # AuthError default status_code

    def test_add_workflow(self, client, mock_scenario_request_service):
        """Test add workflow endpoint (admin)"""
        result = {"request_id": "req_123", "status": "in_progress"}
        mock_scenario_request_service.update = AsyncMock(return_value=result)

        response = client.post(
            "/ask_scenarios/req_123/workflow",
            data={
                "assigned_to": "user_456",
                "to_status": "in_progress",
                "comment": "Assigned to John"
            }
        )
        assert response.status_code == 200

    def test_add_workflow_error(self, client, mock_scenario_request_service):
        """Test add workflow with error"""
        mock_scenario_request_service.update = AsyncMock(side_effect=AuthError("Forbidden"))

        response = client.post(
            "/ask_scenarios/req_123/workflow",
            data={"to_status": "in_progress"}
        )
        assert response.status_code == 400  # AuthError default status_code

    def test_update_status(self, client, mock_scenario_request_service):
        """Test update status endpoint (admin)"""
        result = {"request_id": "req_123", "status": "completed"}
        mock_scenario_request_service.update = AsyncMock(return_value=result)

        response = client.put(
            "/ask_scenarios/req_123/status",
            data={
                "new_status": "completed",
                "comment": "Request completed successfully"
            }
        )
        assert response.status_code == 200

    def test_update_status_error(self, client, mock_scenario_request_service):
        """Test update status with error"""
        mock_scenario_request_service.update = AsyncMock(side_effect=AuthError("Forbidden"))

        response = client.put(
            "/ask_scenarios/req_123/status",
            data={"new_status": "completed"}
        )
        assert response.status_code == 400  # AuthError default status_code


class TestScenarioRequestRoutesEditorUser:
    """Tests for scenario request routes with editor user"""

    @pytest.fixture
    def app(self):
        """Create test app"""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_scenario_request_service(self):
        """Create mock scenario request service"""
        return MagicMock()

    @pytest.fixture
    def mock_editor(self):
        """Create mock editor user"""
        user = MagicMock()
        user.email = "editor@test.com"
        user.user_id = "editor_123"
        user.roles = ["editor"]
        user.model_dump = MagicMock(return_value={
            "email": "editor@test.com",
            "user_id": "editor_123",
            "roles": ["editor"]
        })
        return user

    @pytest.fixture
    def client(self, app, mock_scenario_request_service, mock_editor):
        """Create test client with editor user"""
        app.dependency_overrides[get_scenario_request_service] = lambda: mock_scenario_request_service
        app.dependency_overrides[get_current_user] = lambda: mock_editor
        app.dependency_overrides[require_admin_or_editor] = lambda: mock_editor
        return TestClient(app)

    def test_get_all_scenario_requests_editor_sees_all(self, client, mock_scenario_request_service, mock_editor):
        """Test editor sees all requests"""
        result = {"data": [], "pagination": {"total": 0}}
        mock_scenario_request_service.get_all = AsyncMock(return_value=result)

        response = client.get("/ask_scenarios/all")
        assert response.status_code == 200
        # Verify service was called with user_id=None (editor sees all)
        mock_scenario_request_service.get_all.assert_called_once()
        call_args = mock_scenario_request_service.get_all.call_args
        assert call_args.kwargs.get("user_id") is None


class TestScenarioRequestRoutesAdminEndpoints:
    """Tests for admin-specific endpoints"""

    @pytest.fixture
    def app(self):
        """Create test app"""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_scenario_request_service(self):
        """Create mock scenario request service"""
        return MagicMock()

    @pytest.fixture
    def mock_admin(self):
        """Create mock admin user"""
        user = MagicMock()
        user.email = "admin@test.com"
        user.user_id = "admin_123"
        user.roles = ["administrator"]
        user.model_dump = MagicMock(return_value={
            "email": "admin@test.com",
            "user_id": "admin_123",
            "roles": ["administrator"]
        })
        return user

    @pytest.fixture
    def client(self, app, mock_scenario_request_service, mock_admin):
        """Create test client with admin user"""
        app.dependency_overrides[get_scenario_request_service] = lambda: mock_scenario_request_service
        app.dependency_overrides[get_current_user] = lambda: mock_admin
        app.dependency_overrides[require_admin_or_editor] = lambda: mock_admin
        return TestClient(app)

    def test_admin_update_scenario_request(self, client, mock_scenario_request_service):
        """Test admin update scenario request endpoint"""
        result = {"request_id": "req_123", "status": "accepted"}
        mock_scenario_request_service.update = AsyncMock(return_value=result)

        # Use valid ScenarioRequestStatusTypes value
        response = client.put("/ask_scenarios/req_123/admin", json={"status": "accepted"})
        assert response.status_code == 200

    def test_admin_update_with_assigned_to(self, client, mock_scenario_request_service):
        """Test admin update with assigned_to field"""
        result = {"request_id": "req_123", "assigned_to": "user_456"}
        mock_scenario_request_service.update = AsyncMock(return_value=result)

        response = client.put("/ask_scenarios/req_123/admin", json={"assigned_to": "user_456"})
        assert response.status_code == 200
