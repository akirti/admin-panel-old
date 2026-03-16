"""Tests for Atlassian Lookup API Routes"""
from mock_data import MOCK_EMAIL
import pytest
from unittest.mock import MagicMock, AsyncMock
from fastapi import FastAPI
from fastapi.testclient import TestClient

from easylifeauth.api.atlassian_lookup_routes import router
from easylifeauth.security.access_control import CurrentUser

PATH_SEARCH_BOARDS = "/api/v1/atlassian/search/boards"
PATH_SEARCH_USERS = "/api/v1/atlassian/search/users"
OID_9011 = "507f1f77bcf86cd799439011"
STR_TEST = "TEST"
STR_DEV_BOARD = "Dev Board"
STR_JOHN_DOE = "John Doe"
STR_JOHN = "john"
INT_DEFAULT_MAX = 50
HTTP_200 = 200
HTTP_503 = 503


def _make_disabled_client(mock_current_user):
    """Build a TestClient with a disabled AtlassianLookupService."""
    from easylifeauth.api.dependencies import get_current_user, get_atlassian_lookup_service

    mock_service = MagicMock()
    mock_service.enabled = False

    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: mock_current_user
    app.dependency_overrides[get_atlassian_lookup_service] = lambda: mock_service
    return TestClient(app)


def _make_none_client(mock_current_user):
    """Build a TestClient with service=None."""
    from easylifeauth.api.dependencies import get_current_user, get_atlassian_lookup_service

    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: mock_current_user
    app.dependency_overrides[get_atlassian_lookup_service] = lambda: None
    return TestClient(app)


@pytest.fixture
def mock_current_user():
    return CurrentUser(
        user_id=OID_9011,
        email=MOCK_EMAIL,
        roles=["administrator"],
        groups=[],
        domains=[],
    )


@pytest.fixture
def mock_atlassian_service():
    mock = MagicMock()
    mock.enabled = True
    mock.search_boards = AsyncMock(return_value=[
        {"id": 1, "name": STR_DEV_BOARD, "type": "scrum"},
        {"id": 2, "name": "QA Board", "type": "kanban"},
    ])
    mock.search_users = AsyncMock(return_value=[
        {"accountId": "abc123", "displayName": STR_JOHN_DOE, "emailAddress": "john@example.com", "avatarUrl": ""},
    ])
    return mock


@pytest.fixture
def client(mock_current_user, mock_atlassian_service):
    from easylifeauth.api.dependencies import get_current_user, get_atlassian_lookup_service

    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: mock_current_user
    app.dependency_overrides[get_atlassian_lookup_service] = lambda: mock_atlassian_service
    return TestClient(app)


class TestSearchBoardsEndpoint:
    def test_search_boards_success(self, client, mock_atlassian_service):
        response = client.get(PATH_SEARCH_BOARDS, params={"search": "Dev"})
        assert response.status_code == HTTP_200
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] == STR_DEV_BOARD

    def test_search_boards_with_project_key(self, client, mock_atlassian_service):
        response = client.get(PATH_SEARCH_BOARDS, params={"project_key": STR_TEST, "search": "Dev"})
        assert response.status_code == HTTP_200
        mock_atlassian_service.search_boards.assert_called_once_with(
            project_key=STR_TEST, search="Dev", max_results=INT_DEFAULT_MAX
        )

    def test_search_boards_no_params(self, client):
        response = client.get(PATH_SEARCH_BOARDS)
        assert response.status_code == HTTP_200

    def test_search_boards_service_disabled(self, mock_current_user):
        test_client = _make_disabled_client(mock_current_user)
        response = test_client.get(PATH_SEARCH_BOARDS)
        assert response.status_code == HTTP_503

    def test_search_boards_service_none(self, mock_current_user):
        test_client = _make_none_client(mock_current_user)
        response = test_client.get(PATH_SEARCH_BOARDS)
        assert response.status_code == HTTP_503


class TestSearchUsersEndpoint:
    def test_search_users_success(self, client, mock_atlassian_service):
        response = client.get(PATH_SEARCH_USERS, params={"q": STR_JOHN})
        assert response.status_code == HTTP_200
        data = response.json()
        assert len(data) == 1
        assert data[0]["displayName"] == STR_JOHN_DOE

    def test_search_users_with_project_key(self, client, mock_atlassian_service):
        response = client.get(PATH_SEARCH_USERS, params={"project_key": STR_TEST, "q": STR_JOHN})
        assert response.status_code == HTTP_200
        mock_atlassian_service.search_users.assert_called_once_with(
            query=STR_JOHN, max_results=INT_DEFAULT_MAX
        )

    def test_search_users_no_params(self, client):
        response = client.get(PATH_SEARCH_USERS)
        assert response.status_code == HTTP_200

    def test_search_users_service_disabled(self, mock_current_user):
        test_client = _make_disabled_client(mock_current_user)
        response = test_client.get(PATH_SEARCH_USERS)
        assert response.status_code == HTTP_503

    def test_search_users_custom_max_results(self, client, mock_atlassian_service):
        response = client.get(PATH_SEARCH_USERS, params={"q": STR_JOHN, "max_results": 10})
        assert response.status_code == HTTP_200
        mock_atlassian_service.search_users.assert_called_once_with(
            query=STR_JOHN, max_results=10
        )
