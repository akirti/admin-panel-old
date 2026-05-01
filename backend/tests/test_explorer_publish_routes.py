"""Tests for Explorer publish API routes."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture
def mock_publish_service():
    svc = AsyncMock()
    svc.publish.return_value = {
        "scenario_key": "sales-report-proc01",
        "playboard_key": "sales-report-proc01",
        "message": "Published to Explorer under Sales domain",
    }
    return svc


@pytest.fixture
def mock_current_user():
    return MagicMock(
        user_id="user-001", email="admin@test.com",
        roles=["editor"], groups=[], domains=["sales"],
    )


@pytest.fixture
def client(mock_publish_service, mock_current_user):
    from easylifeauth.api.explorer_publish_routes import router, get_publish_service
    from easylifeauth.security.access_control import get_current_user

    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_publish_service] = lambda: mock_publish_service
    app.dependency_overrides[get_current_user] = lambda: mock_current_user
    return TestClient(app)


def test_publish_success(client, mock_publish_service):
    response = client.post("/api/v1/explorer/publish", json={
        "process_id": "proc-001", "name": "Sales Report",
        "description": "Monthly sales", "domain_key": "sales",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["scenario_key"] == "sales-report-proc01"
    mock_publish_service.publish.assert_called_once()


def test_publish_missing_fields(client):
    response = client.post("/api/v1/explorer/publish", json={"process_id": "proc-001"})
    assert response.status_code == 422


def test_publish_invalid_domain(mock_publish_service):
    """User with 'all' domains passes access check, but service raises ValueError."""
    from easylifeauth.api.explorer_publish_routes import router, get_publish_service
    from easylifeauth.security.access_control import get_current_user

    all_domains_user = MagicMock(
        user_id="user-001", email="admin@test.com",
        roles=["editor"], groups=[], domains=["all"],
    )
    mock_publish_service.publish.side_effect = ValueError("Domain 'bad' not found")

    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_publish_service] = lambda: mock_publish_service
    app.dependency_overrides[get_current_user] = lambda: all_domains_user
    test_client = TestClient(app)

    response = test_client.post("/api/v1/explorer/publish", json={
        "process_id": "proc-001", "name": "Test",
        "description": "Test", "domain_key": "bad",
    })
    assert response.status_code == 400


def test_republish(client, mock_publish_service):
    response = client.post("/api/v1/explorer/publish", json={
        "process_id": "proc-001", "name": "Sales Report",
        "description": "Updated", "domain_key": "sales", "republish": True,
    })
    assert response.status_code == 201
    call_kwargs = mock_publish_service.publish.call_args[1]
    assert call_kwargs["republish"] is True
