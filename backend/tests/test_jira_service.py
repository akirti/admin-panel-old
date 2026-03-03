from mock_data import MOCK_EMAIL, MOCK_EMAIL_USER, MOCK_EMAIL_USER_TEST, MOCK_GCS_BUCKET_NAME_FILE, MOCK_URL_FILE_HTTP, MOCK_URL_FTP_INVALID, MOCK_URL_JIRA_BASE
"""Tests for Jira Service"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import io

EXPECTED_OPEN = "Open"
EXPECTED_TASK = "Task"

EXPECTED_NETWORK_ERROR = "Network error"
EXPECTED_TEST_COMMENT = "Test comment"
EXPECTED_TEST_REQUEST = "Test Request"
EXPECTED_TO_DO = "To Do"
DATE_2024_01_01 = "2024-01-01"
DATE_2024_01_02 = "2024-01-02"
FILE_FILE_TXT = "file.txt"
FILE_TEST_TXT = "test.txt"
NUM_10001 = "10001"
NUM_12345 = "12345"
PATCH_JIRA_SERVICE_JIRA = "easylifeauth.services.jira_service.JIRA"
STR_ATT_123 = "att-123"
STR_DONE = "Done"
STR_REQUESTID = "requestId"
STR_REQ_001 = "REQ-001"
STR_TEST = "TEST"
STR_TEST_1 = "TEST-1"
STR_USER2 = "user2"






class TestJiraServiceInit:
    """Tests for JiraService initialization"""

    @patch(PATCH_JIRA_SERVICE_JIRA)
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

    @patch(PATCH_JIRA_SERVICE_JIRA)
    def test_init_partial_config(self, mock_jira):
        """Test initialization with partial config (disabled)"""
        from easylifeauth.services.jira_service import JiraService
        config = {
            "base_url": MOCK_URL_JIRA_BASE
        }
        service = JiraService(config)
        assert service.enabled is False

    @patch(PATCH_JIRA_SERVICE_JIRA)
    def test_init_default_project_key(self, mock_jira):
        """Test default project key"""
        from easylifeauth.services.jira_service import JiraService
        config = {
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "token"
        }
        service = JiraService(config)
        assert service.project_key == "SCEN"
        assert service.issue_type == EXPECTED_TASK

    @pytest.mark.skip(reason="JIRA mock requires module reload - error handling tested in other tests")
    def test_init_jira_error(self):
        """Test initialization when JIRA raises error"""
        pass


class TestJiraServiceHelpers:
    """Tests for helper methods"""

    @pytest.fixture
    @patch(PATCH_JIRA_SERVICE_JIRA)
    def service(self, mock_jira):
        """Create enabled service"""
        from easylifeauth.services.jira_service import JiraService
        return JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token",
            "project_key": STR_TEST
        })

    def test_build_description_basic(self, service):
        """Test building basic description"""
        request = {
            STR_REQUESTID: STR_REQ_001,
            "requestType": "scenario",
            "dataDomain": "finance",
            "status": "pending",
            "description": "Test description",
            "email": MOCK_EMAIL_USER,
            "row_add_stp": DATE_2024_01_01
        }
        desc = service._build_description(request)
        assert STR_REQ_001 in desc
        assert "scenario" in desc
        assert "finance" in desc
        assert "Test description" in desc

    def test_build_description_with_steps(self, service):
        """Test building description with steps"""
        request = {
            STR_REQUESTID: STR_REQ_001,
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
            STR_REQUESTID: STR_REQ_001,
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
                {"username": STR_USER2, "comment": "Latest comment"}
            ]
        }
        comment = service._build_update_comment(request, "comment")
        assert STR_USER2 in comment
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
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_create_ticket_disabled(self, mock_jira):
        """Test create ticket when service is disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.create_ticket({})
        assert result is None

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_create_ticket_success(self, mock_jira):
        """Test successful ticket creation"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.id = NUM_12345
        mock_issue.key = STR_TEST_1
        mock_jira.return_value.create_issue.return_value = mock_issue

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token",
            "project_key": STR_TEST
        })

        result = await service.create_ticket({
            STR_REQUESTID: STR_REQ_001,
            "name": EXPECTED_TEST_REQUEST,
            "dataDomain": "finance"
        })

        assert result is not None
        assert result["ticket_id"] == NUM_12345
        assert result["ticket_key"] == STR_TEST_1
        assert result["sync_status"] == "synced"

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_create_ticket_jira_error(self, mock_jira):
        """Test ticket creation with Jira error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.create_issue.side_effect = JIRAError("API Error")

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token",
            "project_key": STR_TEST
        })

        result = await service.create_ticket({STR_REQUESTID: STR_REQ_001})

        assert result["sync_status"] == "failed"
        assert "error" in result

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_create_ticket_exception(self, mock_jira):
        """Test ticket creation with general exception"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.create_issue.side_effect = Exception(EXPECTED_NETWORK_ERROR)

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token",
            "project_key": STR_TEST
        })

        result = await service.create_ticket({STR_REQUESTID: STR_REQ_001})

        assert result["sync_status"] == "failed"
        assert EXPECTED_NETWORK_ERROR in result["error"]


class TestJiraServiceUpdateTicket:
    """Tests for update_ticket method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_update_ticket_disabled(self, mock_jira):
        """Test update ticket when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.update_ticket(STR_TEST_1, {})
        assert result is None

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_update_ticket_no_key(self, mock_jira):
        """Test update ticket without key"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })
        result = await service.update_ticket("", {})
        assert result is None

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_update_ticket_success(self, mock_jira):
        """Test successful ticket update"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.add_comment.return_value = MagicMock()

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.update_ticket(STR_TEST_1, {"status": "approved"}, "status_change")

        assert result is not None
        assert result["sync_status"] == "synced"

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_update_ticket_jira_error(self, mock_jira):
        """Test ticket update with Jira error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.add_comment.side_effect = JIRAError("Not found")

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.update_ticket(STR_TEST_1, {})

        assert result["sync_status"] == "failed"

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_update_ticket_exception(self, mock_jira):
        """Test ticket update with exception"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.add_comment.side_effect = Exception("Connection error")

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.update_ticket(STR_TEST_1, {})

        assert result["sync_status"] == "failed"


class TestJiraServiceAddAttachment:
    """Tests for add_attachment method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_add_attachment_disabled(self, mock_jira):
        """Test add attachment when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.add_attachment(STR_TEST_1, b"content", FILE_FILE_TXT)
        assert result is None

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_add_attachment_no_key(self, mock_jira):
        """Test add attachment without key"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })
        result = await service.add_attachment("", b"content", FILE_FILE_TXT)
        assert result is None

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_add_attachment_success(self, mock_jira):
        """Test successful attachment upload"""
        from easylifeauth.services.jira_service import JiraService

        mock_attachment = MagicMock()
        mock_attachment.id = STR_ATT_123
        mock_jira.return_value.add_attachment.return_value = mock_attachment

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.add_attachment(STR_TEST_1, b"file content", FILE_TEST_TXT)

        assert result is not None
        assert result["attachment_id"] == STR_ATT_123

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_add_attachment_jira_error(self, mock_jira):
        """Test attachment upload with Jira error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.add_attachment.side_effect = JIRAError("File too large")

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.add_attachment(STR_TEST_1, b"content", FILE_FILE_TXT)

        assert result is None

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_add_attachment_exception(self, mock_jira):
        """Test attachment with exception"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.add_attachment.side_effect = Exception("Upload error")

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.add_attachment(STR_TEST_1, b"content", FILE_FILE_TXT)

        assert result is None


class TestJiraServiceTransitionTicket:
    """Tests for transition_ticket method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_transition_disabled(self, mock_jira):
        """Test transition when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.transition_ticket(STR_TEST_1, STR_DONE)
        assert result is None

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_transition_no_key(self, mock_jira):
        """Test transition without key"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })
        result = await service.transition_ticket("", STR_DONE)
        assert result is None

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_transition_success(self, mock_jira):
        """Test successful transition"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.transitions.return_value = [
            {"id": "1", "name": EXPECTED_TO_DO},
            {"id": "2", "name": STR_DONE}
        ]
        mock_jira.return_value.transition_issue.return_value = None

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.transition_ticket(STR_TEST_1, STR_DONE)

        assert result is not None
        assert result["sync_status"] == "synced"

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_transition_no_matching_status(self, mock_jira):
        """Test transition with no matching status"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.transitions.return_value = [
            {"id": "1", "name": EXPECTED_TO_DO}
        ]

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.transition_ticket(STR_TEST_1, "Unknown Status")

        assert result["sync_status"] == "failed"
        assert "not found" in result["error"]

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_transition_jira_error(self, mock_jira):
        """Test transition with Jira error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.transitions.side_effect = JIRAError("Not found")

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.transition_ticket(STR_TEST_1, STR_DONE)

        assert result["sync_status"] == "failed"

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_transition_exception(self, mock_jira):
        """Test transition with exception"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.transitions.side_effect = Exception(EXPECTED_NETWORK_ERROR)

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.transition_ticket(STR_TEST_1, STR_DONE)

        assert result["sync_status"] == "failed"


class TestJiraServiceTestConnection:
    """Tests for test_connection method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_connection_disabled(self, mock_jira):
        """Test connection when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.test_connection()
        assert result["connected"] is False

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_connection_success(self, mock_jira):
        """Test successful connection"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.myself.return_value = {
            "displayName": "Test User",
            "emailAddress": MOCK_EMAIL
        }

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.test_connection()

        assert result["connected"] is True
        assert result["user"] == "Test User"

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_connection_error(self, mock_jira):
        """Test connection error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.myself.side_effect = JIRAError("Auth failed")

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.test_connection()

        assert result["connected"] is False


class TestJiraServiceGetProjects:
    """Tests for get_projects method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_projects_disabled(self, mock_jira):
        """Test get projects when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.get_projects()
        assert result == []

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_projects_success(self, mock_jira):
        """Test successful get projects"""
        from easylifeauth.services.jira_service import JiraService

        mock_project = MagicMock()
        mock_project.id = NUM_10001
        mock_project.key = STR_TEST
        mock_project.name = "Test Project"
        mock_project.projectTypeKey = "software"
        mock_jira.return_value.projects.return_value = [mock_project]

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.get_projects()

        assert len(result) == 1
        assert result[0]["key"] == STR_TEST

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_projects_error(self, mock_jira):
        """Test get projects error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.projects.side_effect = JIRAError("Access denied")

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.get_projects()

        assert result == []


class TestJiraServiceGetUserTasks:
    """Tests for get_user_tasks method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_user_tasks_disabled(self, mock_jira):
        """Test get user tasks when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.get_user_tasks(MOCK_EMAIL_USER_TEST)
        assert result == []

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_user_tasks_success(self, mock_jira):
        """Test successful get user tasks"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.id = NUM_10001
        mock_issue.key = STR_TEST_1
        mock_issue.fields.summary = "Test Issue"
        mock_issue.fields.status.name = EXPECTED_OPEN
        mock_issue.fields.issuetype.name = EXPECTED_TASK
        mock_issue.fields.priority = MagicMock()
        mock_issue.fields.priority.name = "Medium"
        mock_issue.fields.created = DATE_2024_01_01
        mock_issue.fields.updated = DATE_2024_01_02
        mock_issue.fields.reporter = MagicMock()
        mock_issue.fields.reporter.displayName = "Reporter"
        mock_issue.fields.assignee = MagicMock()
        mock_issue.fields.assignee.displayName = "Assignee"

        mock_jira.return_value.search_issues.return_value = [mock_issue]

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.get_user_tasks(MOCK_EMAIL_USER_TEST)

        assert len(result) == 1
        assert result[0]["key"] == STR_TEST_1

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_user_tasks_with_filters(self, mock_jira):
        """Test get user tasks with project and status filters"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.search_issues.return_value = []

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.get_user_tasks(MOCK_EMAIL_USER_TEST, project_key=STR_TEST, status=EXPECTED_OPEN)

        assert result == []

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_user_tasks_error(self, mock_jira):
        """Test get user tasks error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.search_issues.side_effect = JIRAError("Search failed")

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.get_user_tasks(MOCK_EMAIL_USER_TEST)

        assert result == []


class TestJiraServiceGetTasksByRequestId:
    """Tests for get_tasks_by_request_id method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_tasks_by_request_id_disabled(self, mock_jira):
        """Test get tasks by request ID when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.get_tasks_by_request_id(STR_REQ_001)
        assert result == []

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_tasks_by_request_id_success(self, mock_jira):
        """Test successful get tasks by request ID"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.id = NUM_10001
        mock_issue.key = STR_TEST_1
        mock_issue.fields.summary = "[REQ-001] Test"
        mock_issue.fields.status.name = EXPECTED_OPEN

        mock_jira.return_value.search_issues.return_value = [mock_issue]

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.get_tasks_by_request_id(STR_REQ_001)

        assert len(result) == 1
        assert result[0]["key"] == STR_TEST_1


class TestJiraServiceGetLatestProject:
    """Tests for get_latest_project method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_latest_project_success(self, mock_jira):
        """Test successful get latest project"""
        from easylifeauth.services.jira_service import JiraService

        mock_project = MagicMock()
        mock_project.id = NUM_10001
        mock_project.key = STR_TEST
        mock_project.name = "Test Project"
        mock_project.projectTypeKey = "software"
        mock_jira.return_value.projects.return_value = [mock_project]

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.get_latest_project()

        assert result is not None
        assert result["key"] == STR_TEST

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_latest_project_none(self, mock_jira):
        """Test get latest project when no projects"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.projects.return_value = []

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.get_latest_project()

        assert result is None


class TestJiraServiceGetIssueTypes:
    """Tests for get_issue_types method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_issue_types_disabled(self, mock_jira):
        """Test get issue types when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.get_issue_types()
        assert result == []

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_issue_types_success(self, mock_jira):
        """Test successful get issue types"""
        from easylifeauth.services.jira_service import JiraService

        mock_type = MagicMock()
        mock_type.id = "1"
        mock_type.name = EXPECTED_TASK
        mock_type.description = "A task"
        mock_jira.return_value.issue_types.return_value = [mock_type]

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.get_issue_types()

        assert len(result) == 1
        assert result[0]["name"] == EXPECTED_TASK


class TestJiraServiceGetStatuses:
    """Tests for get_statuses method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_statuses_disabled(self, mock_jira):
        """Test get statuses when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.get_statuses()
        assert result == []

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_statuses_success(self, mock_jira):
        """Test successful get statuses"""
        from easylifeauth.services.jira_service import JiraService

        mock_status = MagicMock()
        mock_status.id = "1"
        mock_status.name = EXPECTED_OPEN
        mock_status.statusCategory = MagicMock()
        mock_status.statusCategory.name = EXPECTED_TO_DO
        mock_jira.return_value.statuses.return_value = [mock_status]

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.get_statuses()

        assert len(result) == 1
        assert result[0]["name"] == EXPECTED_OPEN


class TestJiraServiceClose:
    """Tests for close method"""

    @patch(PATCH_JIRA_SERVICE_JIRA)
    def test_close(self, mock_jira):
        """Test close executor"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        service.close()
        assert service._executor._shutdown is True


class TestJiraServiceSyncStatusChange:
    """Tests for sync_status_change method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_sync_status_change_disabled(self, mock_jira):
        """Test sync status when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.sync_status_change(STR_TEST_1, "approved")
        assert result is None

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_sync_status_change_no_key(self, mock_jira):
        """Test sync status without key"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })
        result = await service.sync_status_change("", "approved")
        assert result is None

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_sync_status_change_success(self, mock_jira):
        """Test successful status sync with transition"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.transitions.return_value = [
            {"id": "1", "name": EXPECTED_TO_DO},
            {"id": "2", "name": "Accepted"}
        ]
        mock_jira.return_value.transition_issue.return_value = None
        mock_jira.return_value.add_comment.return_value = None

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.sync_status_change(STR_TEST_1, "accepted", comment="Status updated")

        assert result is not None
        assert result["sync_status"] == "synced"

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_sync_status_change_transition_not_found(self, mock_jira):
        """Test status sync when transition not found"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.transitions.return_value = [
            {"id": "1", "name": EXPECTED_TO_DO}
        ]
        mock_jira.return_value.add_comment.return_value = None

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.sync_status_change(STR_TEST_1, "unknown-status")

        # Should still sync even if transition not found, just add comment
        assert result is not None

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_sync_status_change_jira_error(self, mock_jira):
        """Test status sync with Jira error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.transitions.side_effect = JIRAError("API Error")

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.sync_status_change(STR_TEST_1, "accepted")

        assert result["sync_status"] == "failed"


class TestJiraServiceUpdateDescription:
    """Tests for update_description method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_update_description_disabled(self, mock_jira):
        """Test update description when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.update_description(STR_TEST_1, {})
        assert result is None

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_update_description_success(self, mock_jira):
        """Test successful description update"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.update.return_value = None
        mock_jira.return_value.issue.return_value = mock_issue

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.update_description(STR_TEST_1, {
            STR_REQUESTID: STR_REQ_001,
            "description": "Updated description"
        })

        assert result is not None
        assert result["sync_status"] == "synced"

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_update_description_jira_error(self, mock_jira):
        """Test description update with error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.issue.side_effect = JIRAError("Issue not found")

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.update_description(STR_TEST_1, {})

        assert result["sync_status"] == "failed"


class TestJiraServiceAddComment:
    """Tests for add_comment method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_add_comment_disabled(self, mock_jira):
        """Test add comment when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.add_comment(STR_TEST_1, EXPECTED_TEST_COMMENT)
        assert result is None

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_add_comment_success(self, mock_jira):
        """Test successful add comment"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.add_comment.return_value = MagicMock()

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.add_comment(STR_TEST_1, EXPECTED_TEST_COMMENT, author_name="John Doe")

        assert result is not None
        assert result["sync_status"] == "synced"

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_add_comment_jira_error(self, mock_jira):
        """Test add comment with error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.add_comment.side_effect = JIRAError("Comment failed")

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.add_comment(STR_TEST_1, EXPECTED_TEST_COMMENT)

        assert result["sync_status"] == "failed"


class TestJiraServiceUpdateDueDate:
    """Tests for update_due_date method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_update_due_date_disabled(self, mock_jira):
        """Test update due date when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.update_due_date(STR_TEST_1, datetime.now())
        assert result is None

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_update_due_date_success(self, mock_jira):
        """Test successful due date update"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.update.return_value = None
        mock_jira.return_value.issue.return_value = mock_issue

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.update_due_date(STR_TEST_1, datetime.now())

        assert result is not None
        assert result["sync_status"] == "synced"

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_update_due_date_jira_error(self, mock_jira):
        """Test due date update with error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.issue.side_effect = JIRAError("Issue not found")

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.update_due_date(STR_TEST_1, datetime.now())

        assert result["sync_status"] == "failed"


class TestJiraServiceStripHtml:
    """Tests for _strip_html helper method"""

    @patch(PATCH_JIRA_SERVICE_JIRA)
    def test_strip_html_basic(self, mock_jira):
        """Test stripping basic HTML"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = service._strip_html("<p>Hello <b>World</b></p>")
        assert result == "Hello World"

    @patch(PATCH_JIRA_SERVICE_JIRA)
    def test_strip_html_with_br(self, mock_jira):
        """Test stripping HTML with line breaks"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = service._strip_html("<p>Line 1<br>Line 2</p>")
        assert "Line 1" in result
        assert "Line 2" in result

    @patch(PATCH_JIRA_SERVICE_JIRA)
    def test_strip_html_empty(self, mock_jira):
        """Test stripping empty HTML"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = service._strip_html("")
        assert result == ""

    @patch(PATCH_JIRA_SERVICE_JIRA)
    def test_strip_html_no_html(self, mock_jira):
        """Test stripping plain text"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = service._strip_html("Plain text without HTML")
        assert result == "Plain text without HTML"


class TestJiraServiceInitClient:
    """Tests for _init_client method"""

    @patch(PATCH_JIRA_SERVICE_JIRA)
    def test_init_client_jira_error(self, mock_jira):
        """Test init client with JiraError"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.side_effect = JIRAError("Authentication failed")

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "bad_token"
        })

        # Force initialization
        service._init_client()

        assert service.enabled is False
        assert service._client is None

    @patch(PATCH_JIRA_SERVICE_JIRA)
    def test_init_client_exception(self, mock_jira):
        """Test init client with general exception"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.side_effect = Exception(EXPECTED_NETWORK_ERROR)

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        # Force initialization
        service._init_client()

        assert service.enabled is False
        assert service._client is None


class TestJiraServiceGetClient:
    """Tests for _get_client method"""

    @patch(PATCH_JIRA_SERVICE_JIRA)
    def test_get_client_disabled(self, mock_jira):
        """Test get client when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = service._get_client()
        assert result is None

    @patch(PATCH_JIRA_SERVICE_JIRA)
    def test_get_client_lazy_init(self, mock_jira):
        """Test get client initializes lazily"""
        from easylifeauth.services.jira_service import JiraService

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        assert service._client_initialized is False
        client = service._get_client()
        assert service._client_initialized is True


class TestJiraServiceSetStartDate:
    """Tests for _set_start_date method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_set_start_date_disabled(self, mock_jira):
        """Test set start date when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        # Should not raise
        await service._set_start_date(STR_TEST_1, datetime.now())

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_set_start_date_success(self, mock_jira):
        """Test set start date success"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.update.return_value = None
        mock_jira.return_value.issue.return_value = mock_issue

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        # Should not raise
        await service._set_start_date(STR_TEST_1, datetime.now())


class TestJiraServiceAddAttachmentFromUrl:
    """Tests for add_attachment_from_url method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_add_attachment_from_url_disabled(self, mock_jira):
        """Test add attachment from URL when disabled"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService()
        result = await service.add_attachment_from_url(STR_TEST_1, MOCK_URL_FILE_HTTP, FILE_FILE_TXT)
        assert result is None

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_add_attachment_from_url_no_key(self, mock_jira):
        """Test add attachment from URL without key"""
        from easylifeauth.services.jira_service import JiraService
        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })
        result = await service.add_attachment_from_url("", MOCK_URL_FILE_HTTP, FILE_FILE_TXT)
        assert result is None

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_add_attachment_from_gcs_url(self, mock_jira):
        """Test add attachment from GCS URL"""
        from easylifeauth.services.jira_service import JiraService

        mock_attachment = MagicMock()
        mock_attachment.id = STR_ATT_123
        mock_jira.return_value.add_attachment.return_value = mock_attachment

        mock_gcs_client = MagicMock()
        mock_blob = MagicMock()
        mock_blob.download_as_bytes.return_value = b"file content"
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob
        mock_gcs_client.bucket.return_value = mock_bucket

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.add_attachment_from_url(
            STR_TEST_1,
            MOCK_GCS_BUCKET_NAME_FILE,
            FILE_FILE_TXT,
            gcs_client=mock_gcs_client
        )

        assert result is not None
        assert result["attachment_id"] == STR_ATT_123

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_add_attachment_from_invalid_url(self, mock_jira):
        """Test add attachment from invalid URL"""
        from easylifeauth.services.jira_service import JiraService

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.add_attachment_from_url(
            STR_TEST_1,
            MOCK_URL_FTP_INVALID,
            FILE_FILE_TXT
        )

        assert result is None


class TestJiraServiceCreateTicketAdvanced:
    """Advanced tests for create_ticket method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_create_ticket_no_project(self, mock_jira):
        """Test create ticket when no project available"""
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.projects.return_value = []

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token",
            "project_key": None  # No default project
        })

        result = await service.create_ticket({STR_REQUESTID: STR_REQ_001})

        assert result["sync_status"] == "failed"
        assert "No project" in result["error"]

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_create_ticket_with_comments(self, mock_jira):
        """Test create ticket with existing comments"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.id = NUM_12345
        mock_issue.key = STR_TEST_1
        mock_jira.return_value.create_issue.return_value = mock_issue
        mock_jira.return_value.add_comment.return_value = MagicMock()

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token",
            "project_key": STR_TEST
        })

        result = await service.create_ticket({
            STR_REQUESTID: STR_REQ_001,
            "name": EXPECTED_TEST_REQUEST,
            "comments": [
                {"comment": "First comment", "username": "user1", "commentDate": DATE_2024_01_01},
                {"comment": "Second comment", "username": STR_USER2, "commentDate": DATE_2024_01_02}
            ]
        })

        assert result["sync_status"] == "synced"
        # Should have added comments
        assert mock_jira.return_value.add_comment.call_count >= 2

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_create_ticket_with_files(self, mock_jira):
        """Test create ticket with file attachments"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.id = NUM_12345
        mock_issue.key = STR_TEST_1
        mock_jira.return_value.create_issue.return_value = mock_issue
        mock_jira.return_value.add_attachment.return_value = MagicMock(id=STR_ATT_123)

        mock_file_storage = MagicMock()
        mock_file_storage.download_file = AsyncMock(return_value=(b"file content", FILE_TEST_TXT))

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token",
            "project_key": STR_TEST
        })

        result = await service.create_ticket({
            STR_REQUESTID: STR_REQ_001,
            "name": EXPECTED_TEST_REQUEST,
            "files": [
                {"gcs_path": "path/to/file.txt", "file_name": FILE_TEST_TXT}
            ]
        }, file_storage_service=mock_file_storage)

        assert result["sync_status"] == "synced"

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_create_ticket_with_custom_target_days(self, mock_jira):
        """Test create ticket with custom target days"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.id = NUM_12345
        mock_issue.key = STR_TEST_1
        mock_jira.return_value.create_issue.return_value = mock_issue

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token",
            "project_key": STR_TEST
        })

        result = await service.create_ticket({
            STR_REQUESTID: STR_REQ_001,
            "name": EXPECTED_TEST_REQUEST,
            "row_add_stp": "2024-01-01T00:00:00Z"
        }, target_days=14)

        assert result["sync_status"] == "synced"


class TestJiraServiceGetTasksByRequestIdAdvanced:
    """Advanced tests for get_tasks_by_request_id method"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_tasks_with_project_filter(self, mock_jira):
        """Test get tasks by request ID with project filter"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.id = NUM_10001
        mock_issue.key = STR_TEST_1
        mock_issue.fields.summary = "[REQ-001] Test"
        mock_issue.fields.status.name = EXPECTED_OPEN
        mock_jira.return_value.search_issues.return_value = [mock_issue]

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.get_tasks_by_request_id(STR_REQ_001, project_key=STR_TEST)

        assert len(result) == 1

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_tasks_jira_error(self, mock_jira):
        """Test get tasks by request ID with Jira error"""
        from jira.exceptions import JIRAError
        from easylifeauth.services.jira_service import JiraService

        mock_jira.return_value.search_issues.side_effect = JIRAError("Search failed")

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.get_tasks_by_request_id(STR_REQ_001)

        assert result == []


class TestJiraServiceGetUserTasksAdvanced:
    """Advanced tests for get_user_tasks"""

    @pytest.mark.asyncio
    @patch(PATCH_JIRA_SERVICE_JIRA)
    async def test_get_user_tasks_no_priority(self, mock_jira):
        """Test get user tasks when issue has no priority"""
        from easylifeauth.services.jira_service import JiraService

        mock_issue = MagicMock()
        mock_issue.id = NUM_10001
        mock_issue.key = STR_TEST_1
        mock_issue.fields.summary = "Test Issue"
        mock_issue.fields.status.name = EXPECTED_OPEN
        mock_issue.fields.issuetype.name = EXPECTED_TASK
        mock_issue.fields.priority = None  # No priority
        mock_issue.fields.created = DATE_2024_01_01
        mock_issue.fields.updated = DATE_2024_01_02
        mock_issue.fields.reporter = None
        mock_issue.fields.assignee = None

        mock_jira.return_value.search_issues.return_value = [mock_issue]

        service = JiraService({
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "test_token"
        })

        result = await service.get_user_tasks(MOCK_EMAIL_USER_TEST)

        assert len(result) == 1
        assert result[0]["priority"] == "Medium"  # Default
        assert result[0]["reporter"] is None
        assert result[0]["assignee"] is None
