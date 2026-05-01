"""Redis cache service for EasyWeaver query results."""
from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


class EWCacheService:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.ttl = int(os.getenv("EW_CACHE_TTL", "300"))
        self.max_rows = int(os.getenv("EW_CACHE_MAX_ROWS", "50000"))
        self.enabled = os.getenv("EW_CACHE_ENABLED", "true").lower() == "true"

    def build_cache_key(self, process_id: str, filters: dict, pagination: dict) -> str:
        raw = json.dumps({"f": filters, "p": pagination}, sort_keys=True)
        hash_val = hashlib.sha256(raw.encode()).hexdigest()[:16]
        return f"ew:cache:{process_id}:{hash_val}"

    async def get(self, cache_key: str) -> Optional[dict]:
        if not self.enabled:
            return None
        try:
            data = await self.redis.get(cache_key)
            if data is None:
                return None
            return json.loads(data)
        except Exception as e:
            logger.warning(f"EW cache read error (key={cache_key}): {e}")
            return None

    async def set(self, cache_key: str, data: dict) -> None:
        if not self.enabled:
            return
        try:
            row_count = len(data.get("data", []))
            if row_count > self.max_rows:
                logger.warning(f"EW cache skip: {row_count} rows exceeds max {self.max_rows}")
                return
            payload = {**data, "cached_at": datetime.now(timezone.utc).isoformat()}
            await self.redis.setex(cache_key, self.ttl, json.dumps(payload, default=str))
        except Exception as e:
            logger.warning(f"EW cache write error (key={cache_key}): {e}")

    async def invalidate_process(self, process_id: str) -> None:
        try:
            keys = await self.redis.keys(f"ew:cache:{process_id}:*")
            if keys:
                await self.redis.delete(*keys)
                logger.info(f"EW cache invalidated {len(keys)} keys for process {process_id}")
        except Exception as e:
            logger.warning(f"EW cache invalidation error: {e}")
