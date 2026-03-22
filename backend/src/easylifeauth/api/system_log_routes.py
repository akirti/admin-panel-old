"""
System Log API routes — file-based system log viewer for admin panel.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from typing import Annotated, Optional, Dict, Any, List

from .dependencies import get_system_log_service
from ..services.system_log_service import SystemLogService
from ..security.access_control import CurrentUser, require_super_admin

router = APIRouter(prefix="/system-logs", tags=["System Logs"])

_SERVICE_UNAVAILABLE_MSG = "System log service not initialized"


@router.get("")
async def list_system_logs(
    filename: Optional[str] = Query(None, description="Log file to read (default: current)"),
    lines: int = Query(200, ge=1, le=5000, description="Number of recent lines"),
    level: Optional[str] = Query(None, description="Filter by level (DEBUG, INFO, WARNING, ERROR)"),
    search: Optional[str] = Query(None, description="Search text in log entries"),
    current_user: Annotated[CurrentUser, Depends(require_super_admin)] = ...,
    service: Annotated[SystemLogService, Depends(get_system_log_service)] = ...,
) -> Dict[str, Any]:
    """Read system log entries with optional filtering."""
    if service is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail=_SERVICE_UNAVAILABLE_MSG)
    target = filename or service.config["log_filename"]
    return await service.read_log(target, tail_lines=lines, level_filter=level, search=search)


@router.get("/files")
async def list_log_files(
    current_user: Annotated[CurrentUser, Depends(require_super_admin)],
    service: Annotated[SystemLogService, Depends(get_system_log_service)],
) -> Dict[str, Any]:
    """List all system log files (current + rotated backups)."""
    if service is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail=_SERVICE_UNAVAILABLE_MSG)
    files = await service.list_log_files()
    return {"files": files, "total": len(files)}


@router.get("/config")
async def get_log_config(
    current_user: Annotated[CurrentUser, Depends(require_super_admin)],
    service: Annotated[SystemLogService, Depends(get_system_log_service)],
) -> Dict[str, Any]:
    """Get current logging configuration."""
    if service is None:
        return {"error": _SERVICE_UNAVAILABLE_MSG}
    return service.get_config_info()


@router.get("/download/{filename}")
async def download_log_file(
    filename: str,
    current_user: Annotated[CurrentUser, Depends(require_super_admin)],
    service: Annotated[SystemLogService, Depends(get_system_log_service)],
):
    """Download a raw log file."""
    if service is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail=_SERVICE_UNAVAILABLE_MSG)
    content = await service.download_log(filename)
    if content is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log file not found")
    return Response(
        content=content,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/push-gcs")
async def push_log_to_gcs(
    filename: Optional[str] = Query(None, description="File to push (default: current)"),
    current_user: Annotated[CurrentUser, Depends(require_super_admin)] = ...,
    service: Annotated[SystemLogService, Depends(get_system_log_service)] = ...,
) -> Dict[str, Any]:
    """Compress and push a log file to GCS errors/ folder."""
    if service is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail=_SERVICE_UNAVAILABLE_MSG)
    result = await service.push_to_gcs(filename)
    if result is None:
        return {"pushed": False, "message": "GCS not configured or file not found"}
    return {"pushed": True, **result}
