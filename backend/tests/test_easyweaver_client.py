"""Tests for EasyWeaver API HTTP client."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx


@pytest.fixture
def ew_client():
    from easylifeauth.services.easyweaver_client import EasyWeaverClient
    return EasyWeaverClient(base_url="http://easyweaver-api:8001/api/v1")


@pytest.mark.asyncio
async def test_get_process(ew_client):
    mock_response = httpx.Response(200, json={
        "id": "proc-001", "name": "Sales Report",
        "params": {
            "customer": {"type": "string", "label": "Customer", "default": ""},
            "region": {"type": "select", "label": "Region", "options": ["US", "EU"]},
        }, "config": {}, "tags": ["sales"],
    }, request=httpx.Request("GET", "http://test/api/v1/processes/proc-001"))
    with patch("httpx.AsyncClient.request", return_value=mock_response):
        result = await ew_client.get_process("proc-001", token="Bearer test-jwt")
    assert result["id"] == "proc-001"
    assert "customer" in result["params"]


@pytest.mark.asyncio
async def test_run_process(ew_client):
    mock_response = httpx.Response(202, json={"run_id": "run-xyz-789", "status": "queued"},
        request=httpx.Request("POST", "http://test/api/v1/processes/proc-001/run"))
    with patch("httpx.AsyncClient.request", return_value=mock_response):
        result = await ew_client.run_process(
            process_id="proc-001", parameters={"customer": "1234567890"},
            pagination={"limit": 10, "offset": 0}, token="Bearer test-jwt")
    assert result["run_id"] == "run-xyz-789"


@pytest.mark.asyncio
async def test_get_run_status(ew_client):
    mock_response = httpx.Response(200, json={"state": "running", "progress": 40, "stage": "2/4", "message": "Executing query..."},
        request=httpx.Request("GET", "http://test/api/v1/queries/runs/run-xyz"))
    with patch("httpx.AsyncClient.request", return_value=mock_response):
        result = await ew_client.get_run_status("run-xyz", token="Bearer test-jwt")
    assert result["state"] == "running"
    assert result["progress"] == 40


@pytest.mark.asyncio
async def test_get_run_results(ew_client):
    mock_response = httpx.Response(200, json={
        "data": [{"col1": "val1"}, {"col1": "val2"}],
        "pagination": {"total_count": 100, "current_count": 2, "end": False},
    }, request=httpx.Request("GET", "http://test/api/v1/queries/runs/run-xyz/results"))
    with patch("httpx.AsyncClient.request", return_value=mock_response):
        result = await ew_client.get_run_results("run-xyz", limit=10, offset=0, token="Bearer test-jwt")
    assert len(result["data"]) == 2
    assert result["pagination"]["total_count"] == 100


@pytest.mark.asyncio
async def test_cancel_run(ew_client):
    mock_response = httpx.Response(200, json={"status": "cancelled", "run_id": "run-xyz"},
        request=httpx.Request("POST", "http://test/api/v1/queries/runs/run-xyz/cancel"))
    with patch("httpx.AsyncClient.request", return_value=mock_response):
        result = await ew_client.cancel_run("run-xyz", token="Bearer test-jwt")
    assert result["status"] == "cancelled"


@pytest.mark.asyncio
async def test_get_process_not_found(ew_client):
    mock_response = httpx.Response(404, json={"detail": "Not found"},
        request=httpx.Request("GET", "http://test/api/v1/processes/bad-id"))
    with patch("httpx.AsyncClient.request", return_value=mock_response):
        result = await ew_client.get_process("bad-id", token="Bearer test-jwt")
    assert result is None


@pytest.mark.asyncio
async def test_connection_error_raises(ew_client):
    with patch("httpx.AsyncClient.request", side_effect=httpx.ConnectError("refused")):
        with pytest.raises(Exception) as exc_info:
            await ew_client.get_process("proc-001", token="Bearer test-jwt")
        assert "EW-SYS-001" in str(exc_info.value) or "unavailable" in str(exc_info.value).lower()
