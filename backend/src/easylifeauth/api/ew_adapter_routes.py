"""Routes for EasyWeaver adapter: SSE stream, results, cancel."""
from __future__ import annotations
import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from easylifeauth.security.access_control import get_current_user, CurrentUser
from easylifeauth.services.easyweaver_client import EasyWeaverError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["EasyWeaver Adapter"])

_adapter = None
_ew_client = None

def get_adapter():
    return _adapter

def set_adapter(adapter):
    global _adapter
    _adapter = adapter

def get_ew_client():
    return _ew_client

def set_ew_client(client):
    global _ew_client
    _ew_client = client


@router.get("/stream/{run_id}")
async def stream_progress(
    run_id: str,
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    ew_client=Depends(get_ew_client),
):
    token = request.headers.get("Authorization", "")

    async def event_generator():
        max_polls = 300
        for _ in range(max_polls):
            if await request.is_disconnected():
                break
            try:
                status = await ew_client.get_run_status(run_id, token=token)
                event_data = json.dumps({
                    "status": status.get("state", "unknown"),
                    "message": status.get("message", ""),
                    "progress": status.get("progress", 0),
                    "stage": status.get("stage", ""),
                    "total_rows": status.get("total_rows"),
                })
                yield f"event: progress\ndata: {event_data}\n\n"
                if status.get("state") in ("complete", "error", "cancelled"):
                    break
            except EasyWeaverError as e:
                error_data = json.dumps({"status": "error", **e.to_dict()})
                yield f"event: progress\ndata: {error_data}\n\n"
                break
            except Exception as e:
                error_data = json.dumps({
                    "status": "error", "code": "EW-SYS-002",
                    "message": "Failed to get progress",
                    "technical": {"detail": str(e)},
                })
                yield f"event: progress\ndata: {error_data}\n\n"
                break
            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.get("/results/{run_id}")
async def get_results(
    run_id: str,
    page: int = 1,
    page_size: int = 10,
    process_id: str = "",
    current_user: CurrentUser = Depends(get_current_user),
    adapter=Depends(get_adapter),
    request: Request = None,
):
    token = request.headers.get("Authorization", "") if request else ""
    try:
        return await adapter.get_results(
            run_id=run_id, process_id=process_id,
            filters={}, pagination={},
            page=page, page_size=page_size, token=token,
        )
    except EasyWeaverError as e:
        raise HTTPException(status_code=502, detail=e.to_dict())


@router.post("/cancel/{run_id}")
async def cancel_run(
    run_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    ew_client=Depends(get_ew_client),
    request: Request = None,
):
    token = request.headers.get("Authorization", "") if request else ""
    try:
        return await ew_client.cancel_run(run_id, token=token)
    except EasyWeaverError as e:
        raise HTTPException(status_code=502, detail=e.to_dict())
