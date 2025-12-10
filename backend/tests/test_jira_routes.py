"""Tests for Jira API Routes"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from bson import ObjectId

from easylifeauth.api.jira_routes import router
from easylifeauth.security.access_control import CurrentUser


@pytest.fixture
def mock_current_user():
    """Create mock current user"""
    return CurrentUser(
        user_id="507f1f77bcf86cd799439011",
        email="test@example.com",
        roles=["administrator"],
        groups=[],
        domains=[]
    )


@pytest.fixture
def mock_jira_service():
    """Create mock Jira service"""
    mock = MagicMock()
    mock.enabled = True
    mock.test_connection = AsyncMock(return_value={
        "connected": True,
        "user": "Test User",
        "email": "jira@example.com"
    })
    mock.get_projects = AsyncMock(return_value=[
        {"id": "1", "key": "TEST", "name": "Test Project", "project_type": "software"}
    ])
    mock.get_latest_project = AsyncMock(return_value={
        "id": "1", "key": "TEST", "name": "Test Project", "project_type": "software"
    })
    mock.get_user_tasks = AsyncMock(return_value=[
        {
            "id": "10001",
            "key": "TEST-1",
            "summary": "Test Task",
            "status": "Open",
            "issue_type": "Task",
            "priority": "Medium",
            "created": "2024-01-01",
            "updated": "2024-01-02",
            "reporter": "Test User",
            "assignee": None,
            "url": "https://jira.example.com/browse/TEST-1"
        }
    ])
    mock.get_tasks_by_request_id = AsyncMock(return_value=[
        {
            "id": "10001",
            "key": "TEST-1",
            "summary": "[REQ-001] Test",
            "status": "Open",
            "issue_type": "Task",
            "priority": "Medium",
            "created": "2024-01-01",
            "updated": "2024-01-02",
            "reporter": None,
            "assignee": None,
            "url": "https://jira.example.com/browse/TEST-1"
        }
    ])
    mock.create_ticket = AsyncMock(return_value={
        "ticket_id": "12345",
        "ticket_key": "TEST-2",
        "ticket_url": "https://jira.example.com/browse/TEST-2",
        "project_key": "TEST",
        "created_at": "2024-01-01T00:00:00Z",
        "last_synced": "2024-01-01T00:00:00Z",
        "sync_status": "synced"
    })
    mock.transition_ticket = AsyncMock(return_value={
        "sync_status": "synced",
        "last_synced": "2024-01-01T00:00:00Z"
    })
    mock.add_attachment_from_url = AsyncMock(return_value={
        "attachment_id": "att-123",
        "filename": "test.txt",
        "uploaded_at": "2024-01-01T00:00:00Z"
    })
    mock.get_issue_types = AsyncMock(return_value=[
        {"id": "1", "name": "Task", "description": "A task"}
    ])
    mock.get_statuses = AsyncMock(return_value=[
        {"id": "1", "name": "Open", "category": "To Do"}
    ])
    mock.update_ticket = AsyncMock(return_value={
        "sync_status": "synced",
        "last_synced": "2024-01-01T00:00:00Z"
    })
    return mock


@pytest.fixture
def mock_db():
    """Create mock database manager"""
    mock = MagicMock()
    mock.db.scenario_requests.find_one = AsyncMock(return_value={
        "_id": ObjectId("507f1f77bcf86cd799439011"),
        "requestId": "REQ-SCR-0001",
        "name": "Test Request",
        "description": "Test Description",
        "dataDomain": "test",
        "jira_integration": None
    })
    mock.db.scenario_requests.update_one = AsyncMock()
    mock.db.configurations.find_one = AsyncMock(return_value=None)
    return mock


@pytest.fixture
def mock_file_storage():
    """Create mock file storage service"""
    mock = MagicMock()
    mock.download_file = AsyncMock(return_value=(b"content", "file.txt"))
    return mock


@pytest.fixture
def app_with_routes(mock_current_user, mock_jira_service, mock_db, mock_file_storage):
    """Create FastAPI app with jira routes"""
    from easylifeauth.api.dependencies import (
        get_jira_service, get_db, get_current_user, get_file_storage_service
    )

    app = FastAPI()
    app.include_router(router, prefix="/api/v1")

    # Override dependencies
    app.dependency_overrides[get_current_user] = lambda: mock_current_user
    app.dependency_overrides[get_jira_service] = lambda: mock_jira_service
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_file_storage_service] = lambda: mock_file_storage

    return app


class TestJiraStatusRoute:
    """Tests for GET /jira/status"""

    def test_get_status_success(self, app_with_routes):
        """Test successful status check"""
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/status")
        assert response.status_code == 200
        data = response.json()
        assert data["connected"] is True

    def test_get_status_disabled(self, app_with_routes, mock_jira_service):
        """Test status when Jira disabled"""
        mock_jira_service.enabled = False
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/status")
        assert response.status_code == 200
        data = response.json()
        assert data["connected"] is False


class TestJiraProjectsRoute:
    """Tests for GET /jira/projects"""

    def test_get_projects_success(self, app_with_routes):
        """Test successful get projects"""
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/projects")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["key"] == "TEST"

    def test_get_projects_disabled(self, app_with_routes, mock_jira_service):
        """Test get projects when Jira disabled"""
        mock_jira_service.enabled = False
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/projects")
        assert response.status_code == 503


class TestJiraLatestProjectRoute:
    """Tests for GET /jira/projects/latest"""

    def test_get_latest_project_success(self, app_with_routes):
        """Test successful get latest project"""
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/projects/latest")
        assert response.status_code == 200
        data = response.json()
        assert data["key"] == "TEST"

    def test_get_latest_project_none(self, app_with_routes, mock_jira_service):
        """Test get latest project when no projects"""
        mock_jira_service.get_latest_project = AsyncMock(return_value=None)
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/projects/latest")
        assert response.status_code == 200
        assert response.json() is None

    def test_get_latest_project_disabled(self, app_with_routes, mock_jira_service):
        """Test get latest project when Jira disabled"""
        mock_jira_service.enabled = False
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/projects/latest")
        assert response.status_code == 503


class TestJiraMyTasksRoute:
    """Tests for GET /jira/tasks/my"""

    def test_get_my_tasks_success(self, app_with_routes):
        """Test successful get my tasks"""
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/tasks/my")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["key"] == "TEST-1"

    def test_get_my_tasks_with_filters(self, app_with_routes):
        """Test get my tasks with filters"""
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/tasks/my?project_key=TEST&status=Open&max_results=10")
        assert response.status_code == 200

    def test_get_my_tasks_disabled(self, app_with_routes, mock_jira_service):
        """Test get my tasks when Jira disabled"""
        mock_jira_service.enabled = False
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/tasks/my")
        assert response.status_code == 503


class TestJiraTasksByRequestRoute:
    """Tests for GET /jira/tasks/by-request/{request_id}"""

    def test_get_tasks_by_request_success(self, app_with_routes):
        """Test successful get tasks by request"""
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/tasks/by-request/REQ-001")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

    def test_get_tasks_by_request_with_project(self, app_with_routes):
        """Test get tasks by request with project filter"""
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/tasks/by-request/REQ-001?project_key=TEST")
        assert response.status_code == 200

    def test_get_tasks_by_request_disabled(self, app_with_routes, mock_jira_service):
        """Test get tasks by request when Jira disabled"""
        mock_jira_service.enabled = False
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/tasks/by-request/REQ-001")
        assert response.status_code == 503


class TestJiraCreateTaskRoute:
    """Tests for POST /jira/tasks/create"""

    def test_create_task_success(self, app_with_routes):
        """Test successful create task"""
        client = TestClient(app_with_routes)
        response = client.post(
            "/api/v1/jira/tasks/create",
            json={"scenario_request_id": "507f1f77bcf86cd799439011"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["ticket_key"] == "TEST-2"
        assert data["sync_status"] == "synced"

    def test_create_task_already_exists(self, app_with_routes, mock_db):
        """Test create task when already exists"""
        mock_db.db.scenario_requests.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "requestId": "REQ-SCR-0001",
            "jira_integration": {
                "ticket_id": "existing-123",
                "ticket_key": "TEST-EXISTING",
                "ticket_url": "https://jira.example.com/browse/TEST-EXISTING",
                "project_key": "TEST"
            }
        })
        client = TestClient(app_with_routes)
        response = client.post(
            "/api/v1/jira/tasks/create",
            json={"scenario_request_id": "507f1f77bcf86cd799439011"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["sync_status"] == "already_exists"

    def test_create_task_not_found(self, app_with_routes, mock_db):
        """Test create task when request not found"""
        mock_db.db.scenario_requests.find_one = AsyncMock(return_value=None)
        client = TestClient(app_with_routes)
        response = client.post(
            "/api/v1/jira/tasks/create",
            json={"scenario_request_id": "507f1f77bcf86cd799439011"}
        )
        assert response.status_code == 404

    def test_create_task_failed(self, app_with_routes, mock_jira_service):
        """Test create task when creation fails"""
        mock_jira_service.create_ticket = AsyncMock(return_value=None)
        client = TestClient(app_with_routes)
        response = client.post(
            "/api/v1/jira/tasks/create",
            json={"scenario_request_id": "507f1f77bcf86cd799439011"}
        )
        assert response.status_code == 500

    def test_create_task_sync_failed(self, app_with_routes, mock_jira_service):
        """Test create task when sync fails"""
        mock_jira_service.create_ticket = AsyncMock(return_value={
            "sync_status": "failed",
            "error": "API error"
        })
        client = TestClient(app_with_routes)
        response = client.post(
            "/api/v1/jira/tasks/create",
            json={"scenario_request_id": "507f1f77bcf86cd799439011"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["sync_status"] == "failed"

    def test_create_task_disabled(self, app_with_routes, mock_jira_service):
        """Test create task when Jira disabled"""
        mock_jira_service.enabled = False
        client = TestClient(app_with_routes)
        response = client.post(
            "/api/v1/jira/tasks/create",
            json={"scenario_request_id": "507f1f77bcf86cd799439011"}
        )
        assert response.status_code == 503

    def test_create_task_with_project_config(self, app_with_routes, mock_db):
        """Test create task using domain config for project"""
        mock_db.db.configurations.find_one = AsyncMock(return_value={
            "type": "jira",
            "data": {"project_key": "CONFIGURED"}
        })
        client = TestClient(app_with_routes)
        response = client.post(
            "/api/v1/jira/tasks/create",
            json={"scenario_request_id": "507f1f77bcf86cd799439011"}
        )
        assert response.status_code == 200


class TestJiraTransitionRoute:
    """Tests for POST /jira/tasks/transition"""

    def test_transition_success(self, app_with_routes):
        """Test successful transition"""
        client = TestClient(app_with_routes)
        response = client.post(
            "/api/v1/jira/tasks/transition",
            json={"ticket_key": "TEST-1", "status": "In Progress"}
        )
        assert response.status_code == 200
        assert "transitioned" in response.json()["message"]

    def test_transition_not_found(self, app_with_routes, mock_jira_service):
        """Test transition when ticket not found"""
        mock_jira_service.transition_ticket = AsyncMock(return_value=None)
        client = TestClient(app_with_routes)
        response = client.post(
            "/api/v1/jira/tasks/transition",
            json={"ticket_key": "TEST-1", "status": "In Progress"}
        )
        assert response.status_code == 404

    def test_transition_failed(self, app_with_routes, mock_jira_service):
        """Test transition when it fails"""
        mock_jira_service.transition_ticket = AsyncMock(return_value={
            "sync_status": "failed",
            "error": "Transition not available"
        })
        client = TestClient(app_with_routes)
        response = client.post(
            "/api/v1/jira/tasks/transition",
            json={"ticket_key": "TEST-1", "status": "Invalid"}
        )
        assert response.status_code == 400

    def test_transition_disabled(self, app_with_routes, mock_jira_service):
        """Test transition when Jira disabled"""
        mock_jira_service.enabled = False
        client = TestClient(app_with_routes)
        response = client.post(
            "/api/v1/jira/tasks/transition",
            json={"ticket_key": "TEST-1", "status": "In Progress"}
        )
        assert response.status_code == 503


class TestJiraAttachmentRoute:
    """Tests for POST /jira/attachments/add"""

    def test_add_attachment_success(self, app_with_routes):
        """Test successful add attachment"""
        client = TestClient(app_with_routes)
        response = client.post(
            "/api/v1/jira/attachments/add",
            json={
                "ticket_key": "TEST-1",
                "file_url": "https://example.com/file.txt",
                "file_name": "test.txt"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["attachment_id"] == "att-123"

    def test_add_attachment_failed(self, app_with_routes, mock_jira_service):
        """Test add attachment when it fails"""
        mock_jira_service.add_attachment_from_url = AsyncMock(return_value=None)
        client = TestClient(app_with_routes)
        response = client.post(
            "/api/v1/jira/attachments/add",
            json={
                "ticket_key": "TEST-1",
                "file_url": "https://example.com/file.txt",
                "file_name": "test.txt"
            }
        )
        assert response.status_code == 500

    def test_add_attachment_disabled(self, app_with_routes, mock_jira_service):
        """Test add attachment when Jira disabled"""
        mock_jira_service.enabled = False
        client = TestClient(app_with_routes)
        response = client.post(
            "/api/v1/jira/attachments/add",
            json={
                "ticket_key": "TEST-1",
                "file_url": "https://example.com/file.txt",
                "file_name": "test.txt"
            }
        )
        assert response.status_code == 503


class TestJiraIssueTypesRoute:
    """Tests for GET /jira/issue-types"""

    def test_get_issue_types_success(self, app_with_routes):
        """Test successful get issue types"""
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/issue-types")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Task"

    def test_get_issue_types_disabled(self, app_with_routes, mock_jira_service):
        """Test get issue types when Jira disabled"""
        mock_jira_service.enabled = False
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/issue-types")
        assert response.status_code == 503


class TestJiraStatusesRoute:
    """Tests for GET /jira/statuses"""

    def test_get_statuses_success(self, app_with_routes):
        """Test successful get statuses"""
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/statuses")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Open"

    def test_get_statuses_disabled(self, app_with_routes, mock_jira_service):
        """Test get statuses when Jira disabled"""
        mock_jira_service.enabled = False
        client = TestClient(app_with_routes)
        response = client.get("/api/v1/jira/statuses")
        assert response.status_code == 503


class TestJiraSyncRequestRoute:
    """Tests for POST /jira/sync/request/{request_id}"""

    def test_sync_create_new(self, app_with_routes):
        """Test sync creates new ticket"""
        client = TestClient(app_with_routes)
        response = client.post("/api/v1/jira/sync/request/507f1f77bcf86cd799439011")
        assert response.status_code == 200
        data = response.json()
        assert data["ticket_key"] == "TEST-2"

    def test_sync_update_existing(self, app_with_routes, mock_db):
        """Test sync updates existing ticket"""
        mock_db.db.scenario_requests.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "requestId": "REQ-SCR-0001",
            "jira_integration": {
                "ticket_id": "existing-123",
                "ticket_key": "TEST-EXISTING",
                "ticket_url": "https://jira.example.com/browse/TEST-EXISTING",
                "project_key": "TEST"
            }
        })
        client = TestClient(app_with_routes)
        response = client.post("/api/v1/jira/sync/request/507f1f77bcf86cd799439011")
        assert response.status_code == 200
        data = response.json()
        assert data["ticket_key"] == "TEST-EXISTING"

    def test_sync_not_found(self, app_with_routes, mock_db):
        """Test sync when request not found"""
        mock_db.db.scenario_requests.find_one = AsyncMock(return_value=None)
        client = TestClient(app_with_routes)
        response = client.post("/api/v1/jira/sync/request/507f1f77bcf86cd799439011")
        assert response.status_code == 404

    def test_sync_disabled(self, app_with_routes, mock_jira_service):
        """Test sync when Jira disabled"""
        mock_jira_service.enabled = False
        client = TestClient(app_with_routes)
        response = client.post("/api/v1/jira/sync/request/507f1f77bcf86cd799439011")
        assert response.status_code == 503

    def test_sync_with_request_id_string(self, app_with_routes, mock_db):
        """Test sync with requestId string instead of ObjectId"""
        # First call raises exception (invalid ObjectId), second with requestId succeeds
        async def find_one_side_effect(query):
            if "_id" in query:
                raise Exception("Invalid ObjectId")
            return {
                "_id": ObjectId("507f1f77bcf86cd799439011"),
                "requestId": "REQ-SCR-0001",
                "jira_integration": None
            }
        mock_db.db.scenario_requests.find_one = AsyncMock(side_effect=find_one_side_effect)
        client = TestClient(app_with_routes)
        response = client.post("/api/v1/jira/sync/request/REQ-SCR-0001")
        assert response.status_code == 200

    def test_sync_create_failed(self, app_with_routes, mock_jira_service):
        """Test sync when create fails"""
        mock_jira_service.create_ticket = AsyncMock(return_value=None)
        client = TestClient(app_with_routes)
        response = client.post("/api/v1/jira/sync/request/507f1f77bcf86cd799439011")
        assert response.status_code == 200
        data = response.json()
        assert data["sync_status"] == "failed"
