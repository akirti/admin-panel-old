"""
Error Logs API routes.
Admin-viewable error logging with file storage and GCS archival.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import math

from .dependencies import get_error_log_service
from ..services.error_log_service import ErrorLogService
from ..security.access_control import CurrentUser, require_super_admin

router = APIRouter(prefix="/error-logs", tags=["Error Logs"])


def create_pagination_meta(total: int, page: int, limit: int) -> Dict[str, Any]:
    """Create pagination metadata."""
    pages = math.ceil(total / limit) if limit > 0 else 0
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
        "has_next": page < pages - 1,
        "has_prev": page > 0
    }


@router.get("")
async def list_error_logs(
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    level: Optional[str] = Query(None, description="Filter by log level (ERROR, WARNING, CRITICAL)"),
    error_type: Optional[str] = Query(None, description="Filter by error type"),
    search: Optional[str] = Query(None, description="Search in message and stack trace"),
    days: Optional[int] = Query(None, ge=1, le=365, description="Filter logs from last N days"),
    current_user: CurrentUser = Depends(require_super_admin),
    error_log_service: ErrorLogService = Depends(get_error_log_service)
) -> Dict[str, Any]:
    """
    List error logs with pagination and filtering.

    - **page**: Page number (0-indexed)
    - **limit**: Maximum number of records to return
    - **level**: Filter by log level (ERROR, WARNING, CRITICAL)
    - **error_type**: Filter by exception type
    - **search**: Search in message and stack trace
    - **days**: Filter logs from last N days
    """
    if error_log_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Error log service not initialized"
        )

    filters = {}
    if level:
        filters["level"] = level
    if error_type:
        filters["error_type"] = error_type
    if search:
        filters["search"] = search
    if days:
        filters["days"] = days

    offset = page * limit
    result = await error_log_service.get_current_logs(
        limit=limit,
        offset=offset,
        filters=filters
    )

    return {
        "data": result.get("logs", []),
        "pagination": create_pagination_meta(result.get("total", 0), page, limit)
    }


@router.get("/stats")
async def get_error_stats(
    days: int = Query(7, ge=1, le=365, description="Get stats for last N days"),
    current_user: CurrentUser = Depends(require_super_admin),
    error_log_service: ErrorLogService = Depends(get_error_log_service)
) -> Dict[str, Any]:
    """Get error statistics for the specified period."""
    if error_log_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Error log service not initialized"
        )

    return await error_log_service.get_stats(days=days)


@router.get("/levels")
async def get_available_levels(
    current_user: CurrentUser = Depends(require_super_admin),
    error_log_service: ErrorLogService = Depends(get_error_log_service)
) -> Dict[str, List[str]]:
    """Get list of available log levels."""
    if error_log_service is None:
        return {"levels": ["ERROR", "WARNING", "CRITICAL"]}

    levels = await error_log_service.get_levels()
    return {"levels": levels}


@router.get("/types")
async def get_available_types(
    current_user: CurrentUser = Depends(require_super_admin),
    error_log_service: ErrorLogService = Depends(get_error_log_service)
) -> Dict[str, List[str]]:
    """Get list of distinct error types."""
    if error_log_service is None:
        return {"types": []}

    types = await error_log_service.get_error_types()
    return {"types": types}


@router.get("/current-file")
async def get_current_file_content(
    lines: int = Query(100, ge=1, le=1000, description="Number of recent lines to return"),
    current_user: CurrentUser = Depends(require_super_admin),
    error_log_service: ErrorLogService = Depends(get_error_log_service)
) -> Dict[str, Any]:
    """
    Get content from current log file.

    Returns the most recent entries from the current log file,
    along with file size information.
    """
    if error_log_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Error log service not initialized"
        )

    return await error_log_service.get_current_file_content(lines=lines)


@router.get("/archives")
async def list_archives(
    current_user: CurrentUser = Depends(require_super_admin),
    error_log_service: ErrorLogService = Depends(get_error_log_service)
) -> Dict[str, Any]:
    """
    List all archived error log files.

    Returns metadata about each archive including file size,
    error count, and date range.
    """
    if error_log_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Error log service not initialized"
        )

    archives = await error_log_service.get_archived_files()
    return {"archives": archives, "total": len(archives)}


@router.get("/archives/{archive_id}/download")
async def get_archive_download_url(
    archive_id: str,
    expiration_minutes: int = Query(60, ge=5, le=1440, description="URL expiration time in minutes"),
    current_user: CurrentUser = Depends(require_super_admin),
    error_log_service: ErrorLogService = Depends(get_error_log_service)
) -> Dict[str, Any]:
    """
    Get a signed download URL for an archived log file.

    The URL is time-limited for security.
    """
    if error_log_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Error log service not initialized"
        )

    url = await error_log_service.get_archive_download_url(
        archive_id=archive_id,
        expiration_minutes=expiration_minutes
    )

    if url is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archive not found or GCS not configured"
        )

    return {
        "download_url": url,
        "expires_in_minutes": expiration_minutes,
        "archive_id": archive_id
    }


@router.delete("/archives/{archive_id}")
async def delete_archive(
    archive_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    error_log_service: ErrorLogService = Depends(get_error_log_service)
) -> Dict[str, Any]:
    """
    Delete an archived log file.

    Removes the file from GCS and the metadata from MongoDB.
    """
    if error_log_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Error log service not initialized"
        )

    success = await error_log_service.delete_archive(archive_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archive not found or deletion failed"
        )

    return {
        "message": "Archive deleted successfully",
        "archive_id": archive_id
    }


@router.post("/force-archive")
async def force_archive(
    current_user: CurrentUser = Depends(require_super_admin),
    error_log_service: ErrorLogService = Depends(get_error_log_service)
) -> Dict[str, Any]:
    """
    Force archive the current log file to GCS.

    Manually triggers archival regardless of file size.
    Useful before maintenance or to free up disk space.
    """
    if error_log_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Error log service not initialized"
        )

    result = await error_log_service.force_archive()

    if result is None:
        return {
            "message": "No logs to archive or GCS not configured",
            "archived": False
        }

    return {
        "message": "Log file archived successfully",
        "archived": True,
        "archive": {
            "archive_id": result.get("archive_id"),
            "file_name": result.get("file_name"),
            "original_size": result.get("original_size"),
            "compressed_size": result.get("compressed_size"),
            "error_count": result.get("error_count")
        }
    }


@router.delete("/cleanup")
async def cleanup_old_archives(
    days: int = Query(90, ge=1, description="Delete archives older than N days"),
    current_user: CurrentUser = Depends(require_super_admin),
    error_log_service: ErrorLogService = Depends(get_error_log_service)
) -> Dict[str, Any]:
    """
    Delete archived error logs older than specified days.

    Removes both the GCS files and MongoDB metadata.
    """
    if error_log_service is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Error log service not initialized"
        )

    result = await error_log_service.cleanup_old_archives(days=days)

    return {
        "message": f"Cleanup completed. Deleted {result.get('deleted', 0)} archives older than {days} days",
        "deleted_count": result.get("deleted", 0),
        "errors": result.get("errors")
    }
