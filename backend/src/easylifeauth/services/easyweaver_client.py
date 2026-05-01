"""HTTP client for EasyWeaver API calls."""
from __future__ import annotations

import httpx
import os
import logging

logger = logging.getLogger(__name__)

EW_BASE_URL = os.getenv("EW_API_BASE_URL", "http://easyweaver-api:8001/api/v1")
EW_TIMEOUT = int(os.getenv("EW_API_TIMEOUT", "30"))


class EasyWeaverError(Exception):
    def __init__(self, code: str, message: str, stage: str = "system",
                 technical: dict = None, suggestions: list = None):
        self.code = code
        self.message = message
        self.stage = stage
        self.technical = technical or {}
        self.suggestions = suggestions or []
        super().__init__(message)

    def to_dict(self):
        return {
            "code": self.code, "message": self.message, "stage": self.stage,
            "technical": self.technical, "suggestions": self.suggestions,
        }


class EasyWeaverClient:
    def __init__(self, base_url: str = None):
        self.base_url = (base_url or EW_BASE_URL).rstrip("/")
        self.timeout = EW_TIMEOUT

    def _headers(self, token: str) -> dict:
        headers = {"Content-Type": "application/json"}
        if token:
            auth = token if token.startswith("Bearer ") else f"Bearer {token}"
            headers["Authorization"] = auth
        return headers

    async def _request(self, method: str, path: str, token: str,
                       json: dict = None, params: dict = None) -> httpx.Response:
        url = f"{self.base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.request(method=method, url=url,
                    headers=self._headers(token), json=json, params=params)
            return response
        except httpx.ConnectError as e:
            raise EasyWeaverError(code="EW-SYS-001", message="EasyWeaver service unavailable",
                stage="system", technical={"url": url, "detail": str(e)},
                suggestions=["Check if easyweaver-api is running"])
        except httpx.TimeoutException as e:
            raise EasyWeaverError(code="EW-SYS-001", message="EasyWeaver service timed out",
                stage="system", technical={"url": url, "detail": str(e)})

    async def get_process(self, process_id: str, token: str) -> dict | None:
        response = await self._request("GET", f"/processes/{process_id}", token)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()

    async def run_process(self, process_id: str, parameters: dict,
                          pagination: dict, token: str) -> dict:
        response = await self._request("POST", f"/processes/{process_id}/run", token,
            json={"parameters": parameters, "pagination": pagination})
        if response.status_code == 404:
            raise EasyWeaverError(code="EW-PROC-001", message="Process not found",
                stage="process", technical={"process_id": process_id})
        response.raise_for_status()
        return response.json()

    async def get_run_status(self, run_id: str, token: str) -> dict:
        response = await self._request("GET", f"/queries/runs/{run_id}", token)
        response.raise_for_status()
        return response.json()

    async def get_run_results(self, run_id: str, limit: int, offset: int, token: str) -> dict:
        response = await self._request("GET", f"/queries/runs/{run_id}/results", token,
            params={"limit": limit, "offset": offset})
        if response.status_code == 404:
            raise EasyWeaverError(code="EW-RSLT-001", message="Results expired",
                stage="results", technical={"run_id": run_id})
        response.raise_for_status()
        return response.json()

    async def cancel_run(self, run_id: str, token: str) -> dict:
        response = await self._request("POST", f"/queries/runs/{run_id}/cancel", token)
        response.raise_for_status()
        return response.json()
