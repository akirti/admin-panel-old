"""
API Configuration Management Routes.
CRUD endpoints for managing external API configurations with SSL certificate support.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from typing import List, Optional
import math

from easylifeauth.api.models import (
    ApiConfigCreate,
    ApiConfigUpdate,
    ApiConfigInDB,
    ApiConfigTestRequest,
    ApiConfigTestResponse,
    ApiConfigCertUploadResponse,
    PaginationMeta,
    MessageResponse
)
from easylifeauth.api.dependencies import get_db, get_gcs_service
from easylifeauth.security.access_control import get_current_user, require_super_admin, CurrentUser
from easylifeauth.services.api_config_service import ApiConfigService

router = APIRouter(prefix="/api-configs", tags=["API Configurations"])


def get_api_config_service(db=Depends(get_db), gcs_service=Depends(get_gcs_service)):
    """Dependency to get API config service."""
    return ApiConfigService(db, gcs_service)


@router.get("")
async def list_api_configs(
    page: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    status: Optional[str] = Query(None),
    tags: Optional[str] = Query(None, description="Comma-separated list of tags"),
    search: Optional[str] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    service: ApiConfigService = Depends(get_api_config_service)
):
    """List all API configurations with pagination and filtering."""
    tag_list = [t.strip() for t in tags.split(",")] if tags else None

    configs, total = await service.list_configs(
        page=page,
        limit=limit,
        status=status,
        tags=tag_list,
        search=search
    )

    pages = math.ceil(total / limit) if limit > 0 else 0

    return {
        "data": configs,
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
            "has_next": page < pages - 1,
            "has_prev": page > 0
        }
    }


@router.get("/count")
async def get_api_configs_count(
    status: Optional[str] = Query(None),
    current_user: CurrentUser = Depends(get_current_user),
    service: ApiConfigService = Depends(get_api_config_service)
):
    """Get count of API configurations."""
    count = await service.get_count(status=status)
    return {"count": count}


@router.get("/tags")
async def get_api_config_tags(
    current_user: CurrentUser = Depends(get_current_user),
    service: ApiConfigService = Depends(get_api_config_service)
):
    """Get all unique tags used across API configurations."""
    tags = await service.get_tags()
    return {"tags": tags}


@router.get("/{config_id}", response_model=ApiConfigInDB)
async def get_api_config(
    config_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    service: ApiConfigService = Depends(get_api_config_service)
):
    """Get API configuration by ID."""
    config = await service.get_config_by_id(config_id)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API configuration not found"
        )
    return config


@router.get("/key/{key}", response_model=ApiConfigInDB)
async def get_api_config_by_key(
    key: str,
    current_user: CurrentUser = Depends(get_current_user),
    service: ApiConfigService = Depends(get_api_config_service)
):
    """Get API configuration by key."""
    config = await service.get_config_by_key(key)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"API configuration with key '{key}' not found"
        )
    return config


@router.post("", response_model=ApiConfigInDB, status_code=status.HTTP_201_CREATED)
async def create_api_config(
    config: ApiConfigCreate,
    current_user: CurrentUser = Depends(require_super_admin),
    service: ApiConfigService = Depends(get_api_config_service)
):
    """Create a new API configuration."""
    try:
        config_data = config.model_dump()
        result = await service.create_config(config_data, current_user.email)
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{config_id}", response_model=ApiConfigInDB)
async def update_api_config(
    config_id: str,
    update: ApiConfigUpdate,
    current_user: CurrentUser = Depends(require_super_admin),
    service: ApiConfigService = Depends(get_api_config_service)
):
    """Update an existing API configuration."""
    update_data = update.model_dump(exclude_unset=True)
    result = await service.update_config(config_id, update_data, current_user.email)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API configuration not found"
        )

    return result


@router.delete("/{config_id}")
async def delete_api_config(
    config_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    service: ApiConfigService = Depends(get_api_config_service)
):
    """Delete an API configuration."""
    deleted = await service.delete_config(config_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API configuration not found"
        )

    return {"message": "API configuration deleted successfully"}


@router.post("/{config_id}/toggle-status", response_model=ApiConfigInDB)
async def toggle_api_config_status(
    config_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    service: ApiConfigService = Depends(get_api_config_service)
):
    """Toggle the status of an API configuration."""
    result = await service.toggle_status(config_id, current_user.email)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API configuration not found"
        )

    return result


@router.post("/test", response_model=ApiConfigTestResponse)
async def test_api_config(
    request: ApiConfigTestRequest,
    current_user: CurrentUser = Depends(get_current_user),
    service: ApiConfigService = Depends(get_api_config_service)
):
    """
    Test an API configuration.

    Either provide config_id to test an existing config,
    or provide config inline to test before saving.
    """
    config_dict = None

    if request.config_id:
        # Test existing config
        config = await service.get_config_by_id(request.config_id)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API configuration not found"
            )
        config_dict = config
    elif request.config:
        # Test inline config
        config_dict = request.config.model_dump()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either config_id or config must be provided"
        )

    result = await service.test_api(
        config=config_dict,
        test_params=request.test_params,
        test_body=request.test_body
    )

    return ApiConfigTestResponse(**result)


@router.post("/{config_id}/test", response_model=ApiConfigTestResponse)
async def test_api_config_by_id(
    config_id: str,
    test_params: Optional[dict] = None,
    test_body: Optional[dict] = None,
    current_user: CurrentUser = Depends(get_current_user),
    service: ApiConfigService = Depends(get_api_config_service)
):
    """Test a specific API configuration by ID."""
    config = await service.get_config_by_id(config_id)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API configuration not found"
        )

    result = await service.test_api(
        config=config,
        test_params=test_params,
        test_body=test_body
    )

    return ApiConfigTestResponse(**result)


@router.post("/{config_id}/upload-cert", response_model=ApiConfigCertUploadResponse)
async def upload_certificate(
    config_id: str,
    cert_type: str = Form(..., description="Type: cert, key, or ca"),
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(require_super_admin),
    service: ApiConfigService = Depends(get_api_config_service)
):
    """
    Upload a certificate file for an API configuration.

    cert_type must be one of: cert (client certificate), key (client key), ca (CA certificate)
    """
    # Validate config exists
    config = await service.get_config_by_id(config_id)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API configuration not found"
        )

    # Read file content
    content = await file.read()

    try:
        result = await service.upload_certificate(
            config_key=config["key"],
            cert_type=cert_type,
            file_content=content,
            file_name=file.filename,
            user_email=current_user.email
        )

        # Update config with GCS path
        field_map = {
            "cert": "ssl_cert_gcs_path",
            "key": "ssl_key_gcs_path",
            "ca": "ssl_ca_gcs_path"
        }
        update_field = field_map.get(cert_type)
        if update_field:
            await service.update_config(
                config_id,
                {update_field: result["gcs_path"]},
                current_user.email
            )

        return ApiConfigCertUploadResponse(**result)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/gcs/status")
async def get_gcs_status(
    current_user: CurrentUser = Depends(get_current_user),
    gcs_service=Depends(get_gcs_service)
):
    """Check if GCS is configured for certificate storage."""
    if not gcs_service:
        return {
            "configured": False,
            "error": "GCS service not initialized"
        }

    return {
        "configured": gcs_service.is_configured(),
        "bucket": gcs_service.bucket_name if gcs_service.is_configured() else None,
        "error": gcs_service.get_init_error() if not gcs_service.is_configured() else None
    }
