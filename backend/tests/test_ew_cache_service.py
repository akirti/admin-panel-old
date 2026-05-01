"""Tests for EasyWeaver Redis cache service."""
import pytest
import json
from unittest.mock import AsyncMock


@pytest.fixture
def cache_service():
    from easylifeauth.services.ew_cache_service import EWCacheService
    mock_redis = AsyncMock()
    svc = EWCacheService.__new__(EWCacheService)
    svc.redis = mock_redis
    svc.ttl = 300
    svc.max_rows = 50000
    svc.enabled = True
    return svc


@pytest.mark.asyncio
async def test_build_cache_key(cache_service):
    key1 = cache_service.build_cache_key("proc-001", {"customer": "123"}, {"page": 1})
    key2 = cache_service.build_cache_key("proc-001", {"customer": "123"}, {"page": 1})
    key3 = cache_service.build_cache_key("proc-001", {"customer": "456"}, {"page": 1})
    assert key1 == key2
    assert key1 != key3
    assert key1.startswith("ew:cache:proc-001:")


@pytest.mark.asyncio
async def test_get_cached_hit(cache_service):
    cached_data = json.dumps({
        "data": [{"col": "val"}],
        "pagination": {"total_count": 1},
        "cached_at": "2026-05-01T00:00:00Z",
    })
    cache_service.redis.get.return_value = cached_data
    result = await cache_service.get("ew:cache:proc-001:abc123")
    assert result is not None
    assert result["data"] == [{"col": "val"}]


@pytest.mark.asyncio
async def test_get_cached_miss(cache_service):
    cache_service.redis.get.return_value = None
    result = await cache_service.get("ew:cache:proc-001:abc123")
    assert result is None


@pytest.mark.asyncio
async def test_set_cache(cache_service):
    data = {"data": [{"col": "val"}], "pagination": {"total_count": 1}}
    await cache_service.set("ew:cache:proc-001:abc123", data)
    cache_service.redis.setex.assert_called_once()
    args = cache_service.redis.setex.call_args
    assert args[0][0] == "ew:cache:proc-001:abc123"
    assert args[0][1] == 300


@pytest.mark.asyncio
async def test_invalidate_process(cache_service):
    cache_service.redis.keys.return_value = ["ew:cache:proc-001:aaa", "ew:cache:proc-001:bbb"]
    await cache_service.invalidate_process("proc-001")
    cache_service.redis.delete.assert_called_once_with("ew:cache:proc-001:aaa", "ew:cache:proc-001:bbb")


@pytest.mark.asyncio
async def test_disabled_cache_returns_none(cache_service):
    cache_service.enabled = False
    result = await cache_service.get("ew:cache:proc-001:abc123")
    assert result is None
    cache_service.redis.get.assert_not_called()


@pytest.mark.asyncio
async def test_redis_error_returns_none(cache_service):
    cache_service.redis.get.side_effect = Exception("Connection refused")
    result = await cache_service.get("ew:cache:proc-001:abc123")
    assert result is None
