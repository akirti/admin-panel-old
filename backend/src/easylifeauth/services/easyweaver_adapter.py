"""EasyWeaver adapter for routing playboard submits to easyweaver-api."""
from __future__ import annotations
import logging
from easylifeauth.services.easyweaver_client import EasyWeaverError

logger = logging.getLogger(__name__)


class EasyWeaverAdapter:
    def __init__(self, ew_client, cache_service):
        self.ew_client = ew_client
        self.cache = cache_service

    def _extract_params(self, logic_args: dict) -> dict:
        params = {}
        for step_key in sorted(logic_args.keys()):
            step = logic_args[step_key]
            if isinstance(step, dict):
                params.update(step.get("query_params", {}))
        return params

    async def execute(self, playboard: dict, payload: dict, token: str = None) -> dict:
        process_id = playboard["data"]["ew_process_id"]
        logic_args = payload.get("logic_args", {})
        pagination = payload.get("pagination", {})
        force_refresh = payload.get("force_refresh", False)

        filters = self._extract_params(logic_args)

        if not force_refresh:
            cache_key = self.cache.build_cache_key(process_id, filters, pagination)
            cached = await self.cache.get(cache_key)
            if cached:
                logger.info(f"EW cache hit for process {process_id}")
                return {
                    "data": cached["data"],
                    "pagination": cached.get("pagination", {}),
                    "source": "cache",
                    "cached_at": cached.get("cached_at"),
                }

        try:
            run = await self.ew_client.run_process(
                process_id=process_id, parameters=filters,
                pagination={
                    "limit": pagination.get("limit", pagination.get("size", 10)),
                    "offset": pagination.get("skip", 0),
                },
                token=token,
            )
        except EasyWeaverError:
            raise
        except Exception as e:
            raise EasyWeaverError(
                code="EW-SYS-002", message="Failed to submit query to EasyWeaver",
                stage="system", technical={"process_id": process_id, "detail": str(e)},
            )

        run_id = run["run_id"]
        return {
            "status": "processing", "run_id": run_id,
            "sse_url": f"/api/v1/prevail/stream/{run_id}",
            "results_url": f"/api/v1/prevail/results/{run_id}",
            "message": "Query submitted. Connect to SSE for progress.",
        }

    async def get_results(self, run_id: str, process_id: str,
                          filters: dict, pagination: dict,
                          page: int, page_size: int, token: str) -> dict:
        results = await self.ew_client.get_run_results(
            run_id, limit=page_size, offset=(page - 1) * page_size, token=token,
        )
        cache_key = self.cache.build_cache_key(process_id, filters, pagination)
        await self.cache.set(cache_key, results)
        return {
            "data": results.get("data", []),
            "pagination": {
                "count_evaluated": True,
                "current_count": len(results.get("data", [])),
                "total_count": results.get("pagination", {}).get("total_count", 0),
                "end": results.get("pagination", {}).get("end", True),
            },
            "run_id": run_id, "source": "live", "cached_at": None,
        }
