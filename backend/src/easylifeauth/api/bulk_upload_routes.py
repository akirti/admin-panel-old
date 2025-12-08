"""
Bulk upload and GCS file operations API routes - from admin-panel-scratch-3.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from io import BytesIO
from pydantic import BaseModel
import pandas as pd

from easylifeauth.db.db_manager import DatabaseManager
from easylifeauth.api.dependencies import get_db
from easylifeauth.security.access_control import CurrentUser, require_super_admin
from easylifeauth.services.bulk_upload_service import BulkUploadService, BulkUploadResult
from easylifeauth.services.gcs_service import GCSService

router = APIRouter(prefix="/bulk", tags=["Bulk Operations"])

# Service instances
_bulk_upload_service: Optional[BulkUploadService] = None
_gcs_service: Optional[GCSService] = None


class GCSUploadRequest(BaseModel):
    """Request model for GCS upload."""
    file_path: str
    bucket_name: Optional[str] = None


def get_bulk_upload_service(db: DatabaseManager = Depends(get_db)) -> BulkUploadService:
    """Get bulk upload service instance."""
    global _bulk_upload_service
    if _bulk_upload_service is None:
        _bulk_upload_service = BulkUploadService(db)
    return _bulk_upload_service


def get_gcs_service() -> Optional[GCSService]:
    """Get GCS service instance."""
    return _gcs_service


def init_bulk_services(db: DatabaseManager, gcs_config: Optional[Dict[str, Any]] = None):
    """Initialize bulk upload services."""
    global _bulk_upload_service, _gcs_service
    _bulk_upload_service = BulkUploadService(db)
    if gcs_config:
        _gcs_service = GCSService(gcs_config)


@router.post("/upload/{entity_type}")
async def bulk_upload(
    entity_type: str,
    file: UploadFile = File(...),
    send_password_emails: bool = Query(True, description="Send password emails for new users"),
    current_user: CurrentUser = Depends(require_super_admin),
    bulk_service: BulkUploadService = Depends(get_bulk_upload_service)
) -> Dict[str, Any]:
    """
    Bulk upload entities from CSV/Excel file.

    Supported entity types:
    - users
    - roles
    - groups
    - permissions
    - customers
    - domains
    - domain_scenarios

    File should be CSV, XLS, or XLSX format with appropriate columns.
    """
    valid_types = ["users", "roles", "groups", "permissions", "customers", "domains", "domain_scenarios"]
    if entity_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid entity type. Must be one of: {', '.join(valid_types)}"
        )

    # Validate file extension
    filename = file.filename.lower()
    if not any(filename.endswith(ext) for ext in ['.csv', '.xlsx', '.xls']):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be CSV, XLS, or XLSX format"
        )

    try:
        content = await file.read()
        result = await bulk_service.process_entity(
            entity_type,
            content,
            file.filename,
            send_password_emails
        )
        return result.to_dict() if hasattr(result, 'to_dict') else result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}"
        )


@router.get("/template/{entity_type}")
async def get_template(
    entity_type: str,
    format: str = Query("xlsx", description="File format: csv or xlsx"),
    current_user: CurrentUser = Depends(require_super_admin),
    bulk_service: BulkUploadService = Depends(get_bulk_upload_service)
):
    """
    Download a template file for bulk upload.

    Supported entity types:
    - users
    - roles
    - groups
    - permissions
    - customers
    - domains
    - domain_scenarios
    """
    valid_types = ["users", "roles", "groups", "permissions", "customers", "domains", "domain_scenarios"]
    if entity_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid entity type. Must be one of: {', '.join(valid_types)}"
        )

    if format not in ["csv", "xlsx"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Format must be 'csv' or 'xlsx'"
        )

    try:
        df = bulk_service.get_template(entity_type)

        output = BytesIO()
        if format == "csv":
            df.to_csv(output, index=False)
            media_type = "text/csv"
            filename = f"{entity_type}_template.csv"
        else:
            df.to_excel(output, index=False)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = f"{entity_type}_template.xlsx"

        output.seek(0)

        return StreamingResponse(
            output,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/gcs/upload/{entity_type}")
async def bulk_upload_from_gcs(
    entity_type: str,
    request: GCSUploadRequest,
    send_password_emails: bool = Query(True, description="Send password emails for new users"),
    current_user: CurrentUser = Depends(require_super_admin),
    bulk_service: BulkUploadService = Depends(get_bulk_upload_service),
    gcs_service: Optional[GCSService] = Depends(get_gcs_service)
) -> Dict[str, Any]:
    """
    Bulk upload entities from a file in GCS bucket.

    - **file_path**: Path to the file in GCS bucket
    - **bucket_name**: Optional bucket name (uses default if not specified)
    - **entity_type**: Type of entity to upload
    """
    valid_types = ["users", "roles", "groups", "permissions", "customers", "domains", "domain_scenarios"]
    if entity_type not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid entity type. Must be one of: {', '.join(valid_types)}"
        )

    if gcs_service is None or not gcs_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GCS service not configured. Please set GCS_CREDENTIALS_JSON environment variable."
        )

    # Download file from GCS
    content = await gcs_service.download_file(request.file_path, request.bucket_name)
    if content is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found in GCS: {request.file_path}"
        )

    try:
        result = await bulk_service.process_entity(
            entity_type,
            content,
            request.file_path,
            send_password_emails
        )
        return result.to_dict() if hasattr(result, 'to_dict') else result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing file: {str(e)}"
        )


@router.get("/gcs/list")
async def list_gcs_files(
    prefix: str = Query("", description="File path prefix to filter"),
    bucket_name: Optional[str] = Query(None, description="Optional bucket name"),
    current_user: CurrentUser = Depends(require_super_admin),
    gcs_service: Optional[GCSService] = Depends(get_gcs_service)
) -> Dict[str, Any]:
    """
    List files in GCS bucket.

    - **prefix**: Optional prefix to filter files
    - **bucket_name**: Optional bucket name (uses default if not specified)
    """
    if gcs_service is None or not gcs_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GCS service not configured. Please set GCS_CREDENTIALS_JSON environment variable."
        )

    files = await gcs_service.list_files(prefix, bucket_name)
    return {"files": files}


@router.get("/gcs/status")
async def get_gcs_status(
    current_user: CurrentUser = Depends(require_super_admin),
    gcs_service: Optional[GCSService] = Depends(get_gcs_service)
) -> Dict[str, Any]:
    """Check GCS service configuration status."""
    if gcs_service is None:
        return {"configured": False, "bucket_name": None, "error": "GCS service not initialized"}
    return {
        "configured": gcs_service.is_configured(),
        "bucket_name": gcs_service.bucket_name if gcs_service.is_configured() else None,
        "error": gcs_service.get_init_error()
    }
