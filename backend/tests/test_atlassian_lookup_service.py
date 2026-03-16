"""Tests for Atlassian Lookup Service"""
from mock_data import MOCK_EMAIL, MOCK_URL_JIRA_BASE
import pytest
from unittest.mock import MagicMock, patch

PATCH_ATLASSIAN_INIT_CLIENT = "easylifeauth.services.atlassian_lookup_service.AtlassianLookupService._init_client"
STR_TEST = "TEST"
STR_CLOUD = "cloud"
STR_SERVER = "server"
STR_TEST_TOKEN = "test_token"
STR_ADMIN = "admin"
STR_SECRET = "secret"
STR_JOHN = "john"
STR_JOHN_DOE = "John Doe"
STR_ACTIVE_USER = "Active User"
STR_DEV_BOARD = "Dev Board"
STR_SCRUM = "scrum"
STR_KANBAN = "kanban"
STR_ACCOUNT_ABC123 = "abc123"
STR_ACCOUNT_JDOE = "jdoe"
EMAIL_JOHN = "john@example.com"
INT_MAX_RESULTS = 50

CLOUD_CONFIG = {
    "base_url": MOCK_URL_JIRA_BASE,
    "email": MOCK_EMAIL,
    "api_token": STR_TEST_TOKEN,
    "jira_type": STR_CLOUD,
}

SERVER_CONFIG = {
    "base_url": MOCK_URL_JIRA_BASE,
    "username": STR_ADMIN,
    "password": STR_SECRET,
    "jira_type": STR_SERVER,
}

MINIMAL_CLOUD_CONFIG = {
    "base_url": MOCK_URL_JIRA_BASE,
    "email": MOCK_EMAIL,
    "api_token": STR_TEST_TOKEN,
}


def _make_service_with_mock(config):
    """Create an AtlassianLookupService with a pre-injected mock client."""
    from easylifeauth.services.atlassian_lookup_service import AtlassianLookupService
    service = AtlassianLookupService(config)
    mock_client = MagicMock()
    service._client = mock_client
    service._client_initialized = True
    return service, mock_client


class TestAtlassianLookupServiceInit:
    """Tests for AtlassianLookupService initialization"""

    def test_init_default(self):
        """Test default initialization (disabled)"""
        from easylifeauth.services.atlassian_lookup_service import AtlassianLookupService
        service = AtlassianLookupService()
        assert service.enabled is False
        assert service.base_url is None
        assert service.jira_type == STR_CLOUD

    def test_init_with_cloud_config(self):
        """Test initialization with cloud config"""
        from easylifeauth.services.atlassian_lookup_service import AtlassianLookupService
        service = AtlassianLookupService(CLOUD_CONFIG)
        assert service.enabled is True
        assert service.base_url == MOCK_URL_JIRA_BASE
        assert service.jira_type == STR_CLOUD

    def test_init_with_server_config(self):
        """Test initialization with server config"""
        from easylifeauth.services.atlassian_lookup_service import AtlassianLookupService
        service = AtlassianLookupService(SERVER_CONFIG)
        assert service.enabled is True
        assert service.jira_type == STR_SERVER

    def test_init_partial_config(self):
        """Test initialization with partial config (disabled)"""
        from easylifeauth.services.atlassian_lookup_service import AtlassianLookupService
        config = {"base_url": MOCK_URL_JIRA_BASE}
        service = AtlassianLookupService(config)
        assert service.enabled is False

    def test_init_defaults_to_cloud(self):
        """Test jira_type defaults to cloud"""
        from easylifeauth.services.atlassian_lookup_service import AtlassianLookupService
        service = AtlassianLookupService(MINIMAL_CLOUD_CONFIG)
        assert service.jira_type == STR_CLOUD

    @patch(PATCH_ATLASSIAN_INIT_CLIENT)
    def test_init_client_failure(self, mock_init):
        """Test client init failure disables service"""
        mock_init.side_effect = Exception("Connection failed")
        from easylifeauth.services.atlassian_lookup_service import AtlassianLookupService
        service = AtlassianLookupService(MINIMAL_CLOUD_CONFIG)
        client = service._get_client()
        assert client is None
        assert service.enabled is False


class TestSearchBoards:
    """Tests for search_boards method"""

    @pytest.fixture
    def service_with_mock_client(self):
        return _make_service_with_mock(MINIMAL_CLOUD_CONFIG)

    @pytest.mark.asyncio
    async def test_search_boards_returns_results(self, service_with_mock_client):
        service, mock_client = service_with_mock_client
        mock_client.get_all_boards.return_value = {
            "values": [
                {"id": 1, "name": STR_DEV_BOARD, "type": STR_SCRUM},
                {"id": 2, "name": "QA Board", "type": STR_KANBAN},
            ]
        }
        result = await service.search_boards(search="Dev")
        assert len(result) == 2
        assert result[0]["id"] == 1
        assert result[0]["name"] == STR_DEV_BOARD
        mock_client.get_all_boards.assert_called_once()

    @pytest.mark.asyncio
    async def test_search_boards_with_project_key(self, service_with_mock_client):
        service, mock_client = service_with_mock_client
        mock_client.get_all_boards.return_value = {"values": []}
        await service.search_boards(project_key=STR_TEST, search="Dev")
        call_kwargs = mock_client.get_all_boards.call_args[1]
        assert call_kwargs["projectKeyOrID"] == STR_TEST
        assert call_kwargs["board_name"] == "Dev"

    @pytest.mark.asyncio
    async def test_search_boards_empty(self, service_with_mock_client):
        service, mock_client = service_with_mock_client
        mock_client.get_all_boards.return_value = {"values": []}
        result = await service.search_boards()
        assert result == []

    @pytest.mark.asyncio
    async def test_search_boards_error(self, service_with_mock_client):
        service, mock_client = service_with_mock_client
        mock_client.get_all_boards.side_effect = Exception("API error")
        result = await service.search_boards()
        assert result == []

    @pytest.mark.asyncio
    async def test_search_boards_disabled(self):
        from easylifeauth.services.atlassian_lookup_service import AtlassianLookupService
        service = AtlassianLookupService()
        result = await service.search_boards()
        assert result == []


class TestSearchUsers:
    """Tests for search_users method"""

    @pytest.fixture
    def cloud_service(self):
        return _make_service_with_mock(CLOUD_CONFIG)

    @pytest.fixture
    def server_service(self):
        return _make_service_with_mock(SERVER_CONFIG)

    @pytest.mark.asyncio
    async def test_search_users_cloud(self, cloud_service):
        service, mock_client = cloud_service
        mock_client.user_find_by_user_string.return_value = [
            {"accountId": STR_ACCOUNT_ABC123, "displayName": STR_JOHN_DOE, "emailAddress": EMAIL_JOHN, "active": True},
        ]
        result = await service.search_users(query=STR_JOHN)
        assert len(result) == 1
        assert result[0]["accountId"] == STR_ACCOUNT_ABC123
        assert result[0]["displayName"] == STR_JOHN_DOE
        mock_client.user_find_by_user_string.assert_called_once_with(query=STR_JOHN, maxResults=INT_MAX_RESULTS)

    @pytest.mark.asyncio
    async def test_search_users_server(self, server_service):
        service, mock_client = server_service
        mock_client.user_find_by_user_string.return_value = [
            {"key": STR_ACCOUNT_JDOE, "displayName": STR_JOHN_DOE, "emailAddress": EMAIL_JOHN, "active": True},
        ]
        result = await service.search_users(query=STR_JOHN)
        assert len(result) == 1
        assert result[0]["accountId"] == STR_ACCOUNT_JDOE
        mock_client.user_find_by_user_string.assert_called_once_with(username=STR_JOHN, maxResults=INT_MAX_RESULTS)

    @pytest.mark.asyncio
    async def test_search_users_filters_inactive(self, cloud_service):
        service, mock_client = cloud_service
        mock_client.user_find_by_user_string.return_value = [
            {"accountId": STR_ACCOUNT_ABC123, "displayName": STR_ACTIVE_USER, "active": True},
            {"accountId": "def456", "displayName": "Inactive User", "active": False},
        ]
        result = await service.search_users(query="user")
        assert len(result) == 1
        assert result[0]["displayName"] == STR_ACTIVE_USER

    @pytest.mark.asyncio
    async def test_search_users_error(self, cloud_service):
        service, mock_client = cloud_service
        mock_client.user_find_by_user_string.side_effect = Exception("API error")
        result = await service.search_users(query="test")
        assert result == []

    @pytest.mark.asyncio
    async def test_search_users_disabled(self):
        from easylifeauth.services.atlassian_lookup_service import AtlassianLookupService
        service = AtlassianLookupService()
        result = await service.search_users(query="test")
        assert result == []

    @pytest.mark.asyncio
    async def test_search_users_non_list_response(self, cloud_service):
        service, mock_client = cloud_service
        mock_client.user_find_by_user_string.return_value = {"error": "bad response"}
        result = await service.search_users(query="test")
        assert result == []


class TestClose:
    def test_close(self):
        from easylifeauth.services.atlassian_lookup_service import AtlassianLookupService
        service = AtlassianLookupService()
        service.close()  # Should not raise
