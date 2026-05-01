"""Tests for EasyWeaver adapter (routing + async execution)."""
import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.fixture
def mock_ew_client():
    client = AsyncMock()
    client.run_process.return_value = {"run_id": "run-xyz-789", "status": "queued"}
    client.get_run_status.return_value = {"state": "complete", "progress": 100}
    client.get_run_results.return_value = {
        "data": [{"col": "val"}],
        "pagination": {"total_count": 1, "current_count": 1, "end": True},
    }
    return client


@pytest.fixture
def mock_cache():
    cache = AsyncMock()
    cache.get.return_value = None
    cache.build_cache_key.return_value = "ew:cache:proc-001:abc123"
    return cache


@pytest.fixture
def adapter(mock_ew_client, mock_cache):
    from easylifeauth.services.easyweaver_adapter import EasyWeaverAdapter
    return EasyWeaverAdapter(mock_ew_client, mock_cache)


@pytest.mark.asyncio
async def test_execute_cache_hit_returns_immediately(adapter, mock_cache):
    mock_cache.get.return_value = {
        "data": [{"col": "cached"}],
        "pagination": {"total_count": 1},
        "cached_at": "2026-05-01T00:00:00Z",
    }
    playboard = {"data": {"ew_process_id": "proc-001"}}
    payload = {"logic_args": {}, "pagination": {"limit": 10, "skip": 0}}

    result = await adapter.execute(playboard, payload, token="Bearer jwt")

    assert result["source"] == "cache"
    assert result["data"] == [{"col": "cached"}]
    adapter.ew_client.run_process.assert_not_called()


@pytest.mark.asyncio
async def test_execute_cache_miss_submits_to_ew(adapter, mock_cache):
    playboard = {"data": {"ew_process_id": "proc-001"}}
    payload = {"logic_args": {"0": {"query_params": {"customer": "123"}}},
               "pagination": {"limit": 10, "skip": 0}}

    result = await adapter.execute(playboard, payload, token="Bearer jwt")

    assert result["status"] == "processing"
    assert result["run_id"] == "run-xyz-789"
    assert "/stream/run-xyz-789" in result["sse_url"]
    assert "/results/run-xyz-789" in result["results_url"]


@pytest.mark.asyncio
async def test_execute_force_refresh_skips_cache(adapter, mock_cache):
    mock_cache.get.return_value = {"data": [{"old": True}], "pagination": {}}
    playboard = {"data": {"ew_process_id": "proc-001"}}
    payload = {"logic_args": {}, "pagination": {"limit": 10, "skip": 0},
               "force_refresh": True}

    result = await adapter.execute(playboard, payload, token="Bearer jwt")

    mock_cache.get.assert_not_called()
    assert result["status"] == "processing"


@pytest.mark.asyncio
async def test_extract_params_from_logic_args(adapter):
    logic_args = {
        "0": {"query_params": {"customer": "123", "region": "US"}},
        "1": {"query_params": {"date_from": "20260101"}},
    }
    params = adapter._extract_params(logic_args)
    assert params == {"customer": "123", "region": "US", "date_from": "20260101"}


@pytest.mark.asyncio
async def test_get_results(adapter, mock_cache):
    result = await adapter.get_results(
        run_id="run-xyz", process_id="proc-001",
        filters={}, pagination={},
        page=1, page_size=10, token="Bearer jwt",
    )

    assert result["data"] == [{"col": "val"}]
    assert result["source"] == "live"
    assert result["pagination"]["count_evaluated"] is True
    mock_cache.set.assert_called_once()
