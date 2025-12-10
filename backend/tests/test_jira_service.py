"""Tests for Jira Service"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import io


class TestJiraServiceInit:
    """Tests for JiraService initialization"""

    @patch('easylifeauth.services.jira_service.JIRA')
    def test_init_default(self, mock_jira):
        """Test default initialization (disabled)"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        assert service.enabled is False
        assert service.base_url is None
        assert service.email is None

    @pytest.mark.skip(reason="JIRA mock requires module reload - config properties tested in other tests")
    def test_init_with_config(self):
        """Test initialization with full config"""
        pass

    @patch('easylifeauth.services.jira_service.JIRA')
    def test_init_partial_config(self, mock_jira):
        """Test initialization with partial config (disabled)"""
        from easylifeauth.services.jira_service import JiraService
        config = {
            "base_url": "https://test.atlassian.net"
        }
        service = JiraService(config)
        assert service.enabled is False

    @patch('easylifeauth.services.jira_service.JIRA')
    def test_init_default_project_key(self, mock_jira):
        """Test default project key"""
        from easylifeauth.services.jira_service import JiraService
        config = {
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "token"
        }
        service = JiraService(config)
        assert service.project_key == "SCEN"
        assert service.issue_type == "Task"

    @pytest.mark.skip(reason="JIRA mock requires module reload - error handling tested in other tests")
    def test_init_jira_error(self):
        """Test initialization when JIRA raises error"""
        pass


class TestJiraServiceHelpers:
    """Tests for helper methods"""

    @pytest.fixture
    @patch('easylifeauth.services.jira_service.JIRA')
    def service(self, mock_jira):
        """Create enabled service"""
        from easylifeauth.services.jira_service import JiraService
        return JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token",
            "project_key": "TEST"
        })

    def test_build_description_basic(self, service):
        """Test building basic description"""
        request = {
            "requestId": "REQ-001",
            "requestType": "scenario",
            "dataDomain": "finance",
            "status": "pending",
            "description": "Test description",
            "email": "user@example.com",
            "row_add_stp": "2024-01-01"
        }
        desc = service._build_description(request)
        assert "REQ-001" in desc
        assert "scenario" in desc
        assert "finance" in desc
        assert "Test description" in desc

    def test_build_description_with_steps(self, service):
        """Test building description with steps"""
        request = {
            "requestId": "REQ-001",
            "steps": [
                {"description": "Step 1"},
                {"description": "Step 2"}
            ]
        }
        desc = service._build_description(request)
        assert "Steps:" in desc
        assert "Step 1" in desc
        assert "Step 2" in desc

    def test_build_description_empty_steps(self, service):
        """Test building description with empty steps"""
        request = {
            "requestId": "REQ-001",
            "steps": []
        }
        desc = service._build_description(request)
        assert "Steps:" not in desc

    def test_build_update_comment_status_change(self, service):
        """Test building status change comment"""
        request = {"status": "approved"}
        comment = service._build_update_comment(request, "status_change")
        assert "Status changed to:" in comment
        assert "approved" in comment

    def test_build_update_comment_comment(self, service):
        """Test building comment update"""
        request = {
            "comments": [
                {"username": "user1", "comment": "First comment"},
                {"username": "user2", "comment": "Latest comment"}
            ]
        }
        comment = service._build_update_comment(request, "comment")
        assert "user2" in comment
        assert "Latest comment" in comment

    def test_build_update_comment_empty_comments(self, service):
        """Test building comment with empty comments"""
        request = {"comments": []}
        comment = service._build_update_comment(request, "comment")
        assert "Comment added" in comment

    def test_build_update_comment_workflow(self, service):
        """Test building workflow update comment"""
        request = {
            "work_flow": [
                {"assigned_to_name": "John", "assigned_by_name": "Jane"}
            ]
        }
        comment = service._build_update_comment(request, "workflow")
        assert "John" in comment
        assert "Jane" in comment

    def test_build_update_comment_empty_workflow(self, service):
        """Test building workflow comment with empty workflow"""
        request = {"work_flow": []}
        comment = service._build_update_comment(request, "workflow")
        assert "Workflow updated" in comment

    def test_build_update_comment_file_upload(self, service):
        """Test building file upload comment"""
        comment = service._build_update_comment({}, "file_upload")
        assert "file uploaded" in comment

    def test_build_update_comment_general(self, service):
        """Test building general update comment"""
        comment = service._build_update_comment({}, "general")
        assert "updated" in comment


class TestJiraServiceCreateTicket:
    """Tests for create_ticket method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_create_ticket_disabled(self, mock_jira):
        """Test create ticket when service is disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.create_ticket({})
        assert result is None

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_create_ticket_success(self, mock_jira):
        """Test successful ticket creation"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.id = "12345"
        mock_issue.key = "TEST-1"
        mock_jira.return_value.create_issue.return_value = mock_issue

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token",
            "project_key": "TEST"
        })

        result = await service.create_ticket({
            "requestId": "REQ-001",
            "name": "Test Request",
            "dataDomain": "finance"
        })

        assert result is not None
        assert result["ticket_id"] == "12345"
        assert result["ticket_key"] == "TEST-1"
        assert result["sync_status"] == "synced"

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_create_ticket_jira_error(self, mock_jira):
        """Test ticket creation with Jira error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.create_issue.side_effect = JIRAError("API Error")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token",
            "project_key": "TEST"
        })

        result = await service.create_ticket({"requestId": "REQ-001"})

        assert result["sync_status"] == "failed"
        assert "error" in result

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_create_ticket_exception(self, mock_jira):
        """Test ticket creation with general exception"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.create_issue.side_effect = Exception("Network error")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token",
            "project_key": "TEST"
        })

        result = await service.create_ticket({"requestId": "REQ-001"})

        assert result["sync_status"] == "failed"
        assert "Network error" in result["error"]


class TestJiraServiceUpdateTicket:
    """Tests for update_ticket method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_update_ticket_disabled(self, mock_jira):
        """Test update ticket when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.update_ticket("TEST-1", {})
        assert result is None

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_update_ticket_no_key(self, mock_jira):
        """Test update ticket without key"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })
        result = await service.update_ticket("", {})
        assert result is None

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_update_ticket_success(self, mock_jira):
        """Test successful ticket update"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.add_comment.return_value = MagicMock()

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.update_ticket("TEST-1", {"status": "approved"}, "status_change")

        assert result is not None
        assert result["sync_status"] == "synced"

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_update_ticket_jira_error(self, mock_jira):
        """Test ticket update with Jira error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.add_comment.side_effect = JIRAError("Not found")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.update_ticket("TEST-1", {})

        assert result["sync_status"] == "failed"

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_update_ticket_exception(self, mock_jira):
        """Test ticket update with exception"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.add_comment.side_effect = Exception("Connection error")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.update_ticket("TEST-1", {})

        assert result["sync_status"] == "failed"


class TestJiraServiceAddAttachment:
    """Tests for add_attachment method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_add_attachment_disabled(self, mock_jira):
        """Test add attachment when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.add_attachment("TEST-1", b"content", "file.txt")
        assert result is None

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_add_attachment_no_key(self, mock_jira):
        """Test add attachment without key"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })
        result = await service.add_attachment("", b"content", "file.txt")
        assert result is None

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_add_attachment_success(self, mock_jira):
        """Test successful attachment upload"""
        from easylifeauth.services.jira_service import JiraService

        mock_attachment = MagicMock()
        mock_attachment.id = "att-123"
        mock_jira.return_value.add_attachment.return_value = mock_attachment

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.add_attachment("TEST-1", b"file content", "test.txt")

        assert result is not None
        assert result["attachment_id"] == "att-123"

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_add_attachment_jira_error(self, mock_jira):
        """Test attachment upload with Jira error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.add_attachment.side_effect = JIRAError("File too large")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.add_attachment("TEST-1", b"content", "file.txt")

        assert result is None

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_add_attachment_exception(self, mock_jira):
        """Test attachment with exception"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.add_attachment.side_effect = Exception("Upload error")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.add_attachment("TEST-1", b"content", "file.txt")

        assert result is None


class TestJiraServiceTransitionTicket:
    """Tests for transition_ticket method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_transition_disabled(self, mock_jira):
        """Test transition when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.transition_ticket("TEST-1", "Done")
        assert result is None

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_transition_no_key(self, mock_jira):
        """Test transition without key"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })
        result = await service.transition_ticket("", "Done")
        assert result is None

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_transition_success(self, mock_jira):
        """Test successful transition"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.transitions.return_value = [
            {"id": "1", "name": "To Do"},
            {"id": "2", "name": "Done"}
        ]
        mock_jira.return_value.transition_issue.return_value = None

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.transition_ticket("TEST-1", "Done")

        assert result is not None
        assert result["sync_status"] == "synced"

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_transition_no_matching_status(self, mock_jira):
        """Test transition with no matching status"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.transitions.return_value = [
            {"id": "1", "name": "To Do"}
        ]

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.transition_ticket("TEST-1", "Unknown Status")

        assert result["sync_status"] == "failed"
        assert "not found" in result["error"]

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_transition_jira_error(self, mock_jira):
        """Test transition with Jira error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.transitions.side_effect = JIRAError("Not found")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.transition_ticket("TEST-1", "Done")

        assert result["sync_status"] == "failed"

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_transition_exception(self, mock_jira):
        """Test transition with exception"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.transitions.side_effect = Exception("Network error")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.transition_ticket("TEST-1", "Done")

        assert result["sync_status"] == "failed"


class TestJiraServiceTestConnection:
    """Tests for test_connection method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_connection_disabled(self, mock_jira):
        """Test connection when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.test_connection()
        assert result["connected"] is False

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_connection_success(self, mock_jira):
        """Test successful connection"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.myself.return_value = {
            "displayName": "Test User",
            "emailAddress": "test@example.com"
        }

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.test_connection()

        assert result["connected"] is True
        assert result["user"] == "Test User"

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_connection_error(self, mock_jira):
        """Test connection error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.myself.side_effect = JIRAError("Auth failed")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.test_connection()

        assert result["connected"] is False


class TestJiraServiceGetProjects:
    """Tests for get_projects method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_projects_disabled(self, mock_jira):
        """Test get projects when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.get_projects()
        assert result == []

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_projects_success(self, mock_jira):
        """Test successful get projects"""
        from easylifeauth.services.jira_service import JiraService

        mock_project = MagicMock()
        mock_project.id = "10001"
        mock_project.key = "TEST"
        mock_project.name = "Test Project"
        mock_project.projectTypeKey = "software"
        mock_jira.return_value.projects.return_value = [mock_project]

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.get_projects()

        assert len(result) == 1
        assert result[0]["key"] == "TEST"

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_projects_error(self, mock_jira):
        """Test get projects error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.projects.side_effect = JIRAError("Access denied")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.get_projects()

        assert result == []


class TestJiraServiceGetUserTasks:
    """Tests for get_user_tasks method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_user_tasks_disabled(self, mock_jira):
        """Test get user tasks when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.get_user_tasks("user@test.com")
        assert result == []

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_user_tasks_success(self, mock_jira):
        """Test successful get user tasks"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.id = "10001"
        mock_issue.key = "TEST-1"
        mock_issue.fields.summary = "Test Issue"
        mock_issue.fields.status.name = "Open"
        mock_issue.fields.issuetype.name = "Task"
        mock_issue.fields.priority = MagicMock()
        mock_issue.fields.priority.name = "Medium"
        mock_issue.fields.created = "2024-01-01"
        mock_issue.fields.updated = "2024-01-02"
        mock_issue.fields.reporter = MagicMock()
        mock_issue.fields.reporter.displayName = "Reporter"
        mock_issue.fields.assignee = MagicMock()
        mock_issue.fields.assignee.displayName = "Assignee"

        mock_jira.return_value.search_issues.return_value = [mock_issue]

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.get_user_tasks("user@test.com")

        assert len(result) == 1
        assert result[0]["key"] == "TEST-1"

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_user_tasks_with_filters(self, mock_jira):
        """Test get user tasks with project and status filters"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.search_issues.return_value = []

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.get_user_tasks("user@test.com", project_key="TEST", status="Open")

        assert result == []

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_user_tasks_error(self, mock_jira):
        """Test get user tasks error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.search_issues.side_effect = JIRAError("Search failed")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.get_user_tasks("user@test.com")

        assert result == []


class TestJiraServiceGetTasksByRequestId:
    """Tests for get_tasks_by_request_id method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_tasks_by_request_id_disabled(self, mock_jira):
        """Test get tasks by request ID when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.get_tasks_by_request_id("REQ-001")
        assert result == []

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_tasks_by_request_id_success(self, mock_jira):
        """Test successful get tasks by request ID"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.id = "10001"
        mock_issue.key = "TEST-1"
        mock_issue.fields.summary = "[REQ-001] Test"
        mock_issue.fields.status.name = "Open"

        mock_jira.return_value.search_issues.return_value = [mock_issue]

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.get_tasks_by_request_id("REQ-001")

        assert len(result) == 1
        assert result[0]["key"] == "TEST-1"


class TestJiraServiceGetLatestProject:
    """Tests for get_latest_project method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_latest_project_success(self, mock_jira):
        """Test successful get latest project"""
        from easylifeauth.services.jira_service import JiraService

        mock_project = MagicMock()
        mock_project.id = "10001"
        mock_project.key = "TEST"
        mock_project.name = "Test Project"
        mock_project.projectTypeKey = "software"
        mock_jira.return_value.projects.return_value = [mock_project]

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.get_latest_project()

        assert result is not None
        assert result["key"] == "TEST"

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_latest_project_none(self, mock_jira):
        """Test get latest project when no projects"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.projects.return_value = []

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.get_latest_project()

        assert result is None


class TestJiraServiceGetIssueTypes:
    """Tests for get_issue_types method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_issue_types_disabled(self, mock_jira):
        """Test get issue types when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.get_issue_types()
        assert result == []

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_issue_types_success(self, mock_jira):
        """Test successful get issue types"""
        from easylifeauth.services.jira_service import JiraService

        mock_type = MagicMock()
        mock_type.id = "1"
        mock_type.name = "Task"
        mock_type.description = "A task"
        mock_jira.return_value.issue_types.return_value = [mock_type]

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.get_issue_types()

        assert len(result) == 1
        assert result[0]["name"] == "Task"


class TestJiraServiceGetStatuses:
    """Tests for get_statuses method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_statuses_disabled(self, mock_jira):
        """Test get statuses when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.get_statuses()
        assert result == []

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_statuses_success(self, mock_jira):
        """Test successful get statuses"""
        from easylifeauth.services.jira_service import JiraService

        mock_status = MagicMock()
        mock_status.id = "1"
        mock_status.name = "Open"
        mock_status.statusCategory = MagicMock()
        mock_status.statusCategory.name = "To Do"
        mock_jira.return_value.statuses.return_value = [mock_status]

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.get_statuses()

        assert len(result) == 1
        assert result[0]["name"] == "Open"


class TestJiraServiceClose:
    """Tests for close method"""

    @patch('easylifeauth.services.jira_service.JIRA')
    def test_close(self, mock_jira):
        """Test close executor"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        service.close()
        assert service._executor._shutdown is True


class TestJiraServiceSyncStatusChange:
    """Tests for sync_status_change method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_sync_status_change_disabled(self, mock_jira):
        """Test sync status when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.sync_status_change("TEST-1", "approved")
        assert result is None

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_sync_status_change_no_key(self, mock_jira):
        """Test sync status without key"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })
        result = await service.sync_status_change("", "approved")
        assert result is None

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_sync_status_change_success(self, mock_jira):
        """Test successful status sync with transition"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.transitions.return_value = [
            {"id": "1", "name": "To Do"},
            {"id": "2", "name": "Accepted"}
        ]
        mock_jira.return_value.transition_issue.return_value = None
        mock_jira.return_value.add_comment.return_value = None

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.sync_status_change("TEST-1", "accepted", comment="Status updated")

        assert result is not None
        assert result["sync_status"] == "synced"

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_sync_status_change_transition_not_found(self, mock_jira):
        """Test status sync when transition not found"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.transitions.return_value = [
            {"id": "1", "name": "To Do"}
        ]
        mock_jira.return_value.add_comment.return_value = None

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.sync_status_change("TEST-1", "unknown-status")

        # Should still sync even if transition not found, just add comment
        assert result is not None

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_sync_status_change_jira_error(self, mock_jira):
        """Test status sync with Jira error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.transitions.side_effect = JIRAError("API Error")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.sync_status_change("TEST-1", "accepted")

        assert result["sync_status"] == "failed"


class TestJiraServiceUpdateDescription:
    """Tests for update_description method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_update_description_disabled(self, mock_jira):
        """Test update description when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.update_description("TEST-1", {})
        assert result is None

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_update_description_success(self, mock_jira):
        """Test successful description update"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.update.return_value = None
        mock_jira.return_value.issue.return_value = mock_issue

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.update_description("TEST-1", {
            "requestId": "REQ-001",
            "description": "Updated description"
        })

        assert result is not None
        assert result["sync_status"] == "synced"

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_update_description_jira_error(self, mock_jira):
        """Test description update with error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.issue.side_effect = JIRAError("Issue not found")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.update_description("TEST-1", {})

        assert result["sync_status"] == "failed"


class TestJiraServiceAddComment:
    """Tests for add_comment method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_add_comment_disabled(self, mock_jira):
        """Test add comment when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.add_comment("TEST-1", "Test comment")
        assert result is None

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_add_comment_success(self, mock_jira):
        """Test successful add comment"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.add_comment.return_value = MagicMock()

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.add_comment("TEST-1", "Test comment", author_name="John Doe")

        assert result is not None
        assert result["sync_status"] == "synced"

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_add_comment_jira_error(self, mock_jira):
        """Test add comment with error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.add_comment.side_effect = JIRAError("Comment failed")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.add_comment("TEST-1", "Test comment")

        assert result["sync_status"] == "failed"


class TestJiraServiceUpdateDueDate:
    """Tests for update_due_date method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_update_due_date_disabled(self, mock_jira):
        """Test update due date when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.update_due_date("TEST-1", datetime.now())
        assert result is None

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_update_due_date_success(self, mock_jira):
        """Test successful due date update"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.update.return_value = None
        mock_jira.return_value.issue.return_value = mock_issue

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.update_due_date("TEST-1", datetime.now())

        assert result is not None
        assert result["sync_status"] == "synced"

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_update_due_date_jira_error(self, mock_jira):
        """Test due date update with error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.issue.side_effect = JIRAError("Issue not found")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.update_due_date("TEST-1", datetime.now())

        assert result["sync_status"] == "failed"


class TestJiraServiceStripHtml:
    """Tests for _strip_html helper method"""

    @patch('easylifeauth.services.jira_service.JIRA')
    def test_strip_html_basic(self, mock_jira):
        """Test stripping basic HTML"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = service._strip_html("<p>Hello <b>World</b></p>")
        assert result == "Hello World"

    @patch('easylifeauth.services.jira_service.JIRA')
    def test_strip_html_with_br(self, mock_jira):
        """Test stripping HTML with line breaks"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = service._strip_html("<p>Line 1<br>Line 2</p>")
        assert "Line 1" in result
        assert "Line 2" in result

    @patch('easylifeauth.services.jira_service.JIRA')
    def test_strip_html_empty(self, mock_jira):
        """Test stripping empty HTML"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = service._strip_html("")
        assert result == ""

    @patch('easylifeauth.services.jira_service.JIRA')
    def test_strip_html_no_html(self, mock_jira):
        """Test stripping plain text"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = service._strip_html("Plain text without HTML")
        assert result == "Plain text without HTML"


class TestJiraServiceInitClient:
    """Tests for _init_client method"""

    @patch('easylifeauth.services.jira_service.JIRA')
    def test_init_client_jira_error(self, mock_jira):
        """Test init client with JiraError"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.side_effect = JIRAError("Authentication failed")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "bad_token"
        })

        # Force initialization
        service._init_client()

        assert service.enabled is False
        assert service._client is None

    @patch('easylifeauth.services.jira_service.JIRA')
    def test_init_client_exception(self, mock_jira):
        """Test init client with general exception"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.side_effect = Exception("Network error")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        # Force initialization
        service._init_client()

        assert service.enabled is False
        assert service._client is None


class TestJiraServiceGetClient:
    """Tests for _get_client method"""

    @patch('easylifeauth.services.jira_service.JIRA')
    def test_get_client_disabled(self, mock_jira):
        """Test get client when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = service._get_client()
        assert result is None

    @patch('easylifeauth.services.jira_service.JIRA')
    def test_get_client_lazy_init(self, mock_jira):
        """Test get client initializes lazily"""
        from easylifeauth.services.jira_service import JiraService

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        assert service._client_initialized is False
        client = service._get_client()
        assert service._client_initialized is True


class TestJiraServiceSetStartDate:
    """Tests for _set_start_date method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_set_start_date_disabled(self, mock_jira):
        """Test set start date when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        # Should not raise
        await service._set_start_date("TEST-1", datetime.now())

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_set_start_date_success(self, mock_jira):
        """Test set start date success"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.update.return_value = None
        mock_jira.return_value.issue.return_value = mock_issue

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        # Should not raise
        await service._set_start_date("TEST-1", datetime.now())


class TestJiraServiceAddAttachmentFromUrl:
    """Tests for add_attachment_from_url method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_add_attachment_from_url_disabled(self, mock_jira):
        """Test add attachment from URL when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.add_attachment_from_url("TEST-1", "http://example.com/file.txt", "file.txt")
        assert result is None

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_add_attachment_from_url_no_key(self, mock_jira):
        """Test add attachment from URL without key"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })
        result = await service.add_attachment_from_url("", "http://example.com/file.txt", "file.txt")
        assert result is None

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_add_attachment_from_gcs_url(self, mock_jira):
        """Test add attachment from GCS URL"""
        from easylifeauth.services.jira_service import JiraService

        mock_attachment = MagicMock()
        mock_attachment.id = "att-123"
        mock_jira.return_value.add_attachment.return_value = mock_attachment

        mock_gcs_client = MagicMock()
        mock_blob = MagicMock()
        mock_blob.download_as_bytes.return_value = b"file content"
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob
        mock_gcs_client.bucket.return_value = mock_bucket

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.add_attachment_from_url(
            "TEST-1",
            "gs://bucket-name/path/to/file.txt",
            "file.txt",
            gcs_client=mock_gcs_client
        )

        assert result is not None
        assert result["attachment_id"] == "att-123"

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_add_attachment_from_invalid_url(self, mock_jira):
        """Test add attachment from invalid URL"""
        from easylifeauth.services.jira_service import JiraService

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.add_attachment_from_url(
            "TEST-1",
            "ftp://invalid.url/file.txt",
            "file.txt"
        )

        assert result is None


class TestJiraServiceCreateTicketAdvanced:
    """Advanced tests for create_ticket method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_create_ticket_no_project(self, mock_jira):
        """Test create ticket when no project available"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.projects.return_value = []

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token",
            "project_key": None  # No default project
        })

        result = await service.create_ticket({"requestId": "REQ-001"})

        assert result["sync_status"] == "failed"
        assert "No project" in result["error"]

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_create_ticket_with_comments(self, mock_jira):
        """Test create ticket with existing comments"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.id = "12345"
        mock_issue.key = "TEST-1"
        mock_jira.return_value.create_issue.return_value = mock_issue
        mock_jira.return_value.add_comment.return_value = MagicMock()

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token",
            "project_key": "TEST"
        })

        result = await service.create_ticket({
            "requestId": "REQ-001",
            "name": "Test Request",
            "comments": [
                {"comment": "First comment", "username": "user1", "commentDate": "2024-01-01"},
                {"comment": "Second comment", "username": "user2", "commentDate": "2024-01-02"}
            ]
        })

        assert result["sync_status"] == "synced"
        # Should have added comments
        assert mock_jira.return_value.add_comment.call_count >= 2

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_create_ticket_with_files(self, mock_jira):
        """Test create ticket with file attachments"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.id = "12345"
        mock_issue.key = "TEST-1"
        mock_jira.return_value.create_issue.return_value = mock_issue
        mock_jira.return_value.add_attachment.return_value = MagicMock(id="att-123")

        mock_file_storage = MagicMock()
        mock_file_storage.download_file = AsyncMock(return_value=(b"file content", "test.txt"))

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token",
            "project_key": "TEST"
        })

        result = await service.create_ticket({
            "requestId": "REQ-001",
            "name": "Test Request",
            "files": [
                {"gcs_path": "path/to/file.txt", "file_name": "test.txt"}
            ]
        }, file_storage_service=mock_file_storage)

        assert result["sync_status"] == "synced"

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_create_ticket_with_custom_target_days(self, mock_jira):
        """Test create ticket with custom target days"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.id = "12345"
        mock_issue.key = "TEST-1"
        mock_jira.return_value.create_issue.return_value = mock_issue

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token",
            "project_key": "TEST"
        })

        result = await service.create_ticket({
            "requestId": "REQ-001",
            "name": "Test Request",
            "row_add_stp": "2024-01-01T00:00:00Z"
        }, target_days=14)

        assert result["sync_status"] == "synced"


class TestJiraServiceGetTasksByRequestIdAdvanced:
    """Advanced tests for get_tasks_by_request_id method"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_tasks_with_project_filter(self, mock_jira):
        """Test get tasks by request ID with project filter"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.id = "10001"
        mock_issue.key = "TEST-1"
        mock_issue.fields.summary = "[REQ-001] Test"
        mock_issue.fields.status.name = "Open"
        mock_jira.return_value.search_issues.return_value = [mock_issue]

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.get_tasks_by_request_id("REQ-001", project_key="TEST")

        assert len(result) == 1

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_tasks_jira_error(self, mock_jira):
        """Test get tasks by request ID with Jira error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.search_issues.side_effect = JIRAError("Search failed")

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.get_tasks_by_request_id("REQ-001")

        assert result == []


class TestJiraServiceGetUserTasksAdvanced:
    """Advanced tests for get_user_tasks"""

    @pytest.mark.asyncio
    @patch('easylifeauth.services.jira_service.JIRA')
    async def test_get_user_tasks_no_priority(self, mock_jira):
        """Test get user tasks when issue has no priority"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.id = "10001"
        mock_issue.key = "TEST-1"
        mock_issue.fields.summary = "Test Issue"
        mock_issue.fields.status.name = "Open"
        mock_issue.fields.issuetype.name = "Task"
        mock_issue.fields.priority = None  # No priority
        mock_issue.fields.created = "2024-01-01"
        mock_issue.fields.updated = "2024-01-02"
        mock_issue.fields.reporter = None
        mock_issue.fields.assignee = None

        mock_jira.return_value.search_issues.return_value = [mock_issue]

        service = JiraService({
            "base_url": "https://test.atlassian.net",
            "email": "test@example.com",
            "api_token": "test_token"
        })

        result = await service.get_user_tasks("user@test.com")

        assert len(result) == 1
        assert result[0]["priority"] == "Medium"  # Default
        assert result[0]["reporter"] is None
        assert result[0]["assignee"] is None
