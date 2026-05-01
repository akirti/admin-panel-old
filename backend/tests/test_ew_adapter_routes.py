"""Tests for EasyWeaver adapter routes (results, cancel)."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture
def mock_adapter():
    adapter = AsyncMock()
    adapter.get_results.return_value = {
        "data": [{"col": "val"}],
        "pagination": {"count_evaluated": True, "current_count": 1, "total_count": 50, "end": False},
        "run_id": "run-xyz", "source": "live",
    }
    return adapter


@pytest.fixture
def mock_ew_client():
    client = AsyncMock()
    client.cancel_run.return_value = {"status": "cancelled", "run_id": "run-xyz"}
    return client


@pytest.fixture
def client(mock_adapter, mock_ew_client):
    from easylifeauth.api.ew_adapter_routes import router, get_adapter, get_ew_client
    from easylifeauth.security.access_control import get_current_user

    app = FastAPI()
    app.include_router(router, prefix="/api/v1/prevail")
    app.dependency_overrides[get_adapter] = lambda: mock_adapter
    app.dependency_overrides[get_ew_client] = lambda: mock_ew_client
    app.dependency_overrides[get_current_user] = lambda: MagicMock(
        user_id="user-001", email="test@test.com", roles=["user"],
    )
    return TestClient(app)


def test_get_results(client, mock_adapter):
    response = client.get("/api/v1/prevail/results/run-xyz?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert data["data"] == [{"col": "val"}]
    assert data["pagination"]["total_count"] == 50


def test_cancel_run(client, mock_ew_client):
    response = client.post("/api/v1/prevail/cancel/run-xyz")
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"
    mock_ew_client.cancel_run.assert_called_once()
