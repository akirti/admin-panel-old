"""
Distribution List management API routes for managing email distribution lists.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
import math

from easylifeauth.api.models import (
    DistributionListCreate,
    DistributionListUpdate,
    DistributionListInDB,
    DistributionListAddEmail,
    DistributionListRemoveEmail,
    PaginationMeta
)
from easylifeauth.db.db_manager import DatabaseManager
from easylifeauth.api.dependencies import get_db
from easylifeauth.security.access_control import CurrentUser, require_super_admin, require_group_admin, get_current_user
from easylifeauth.services.distribution_list_service import DistributionListService

router = APIRouter(prefix="/distribution-lists", tags=["Distribution Lists"])


def get_distribution_list_service(db: DatabaseManager = Depends(get_db)) -> DistributionListService:
    """Get distribution list service instance."""
    return DistributionListService(db)


def create_pagination_meta(total: int, page: int, limit: int) -> PaginationMeta:
    """Create pagination metadata."""
    pages = math.ceil(total / limit) if limit > 0 else 0
    return PaginationMeta(
        total=total,
        page=page,
        limit=limit,
        pages=pages,
        has_next=page < pages - 1,
        has_prev=page > 0
    )


@router.get("")
async def list_distribution_lists(
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    list_type: Optional[str] = Query(None, alias="type", description="Filter by type"),
    include_inactive: bool = Query(False, description="Include inactive lists"),
    search: Optional[str] = Query(None, description="Search by name or key"),
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """
    List distribution lists with pagination and filtering.

    - **page**: Page number (0-indexed)
    - **limit**: Maximum number of records to return
    - **type**: Filter by list type (scenario_request, feedback, system_alert, custom)
    - **include_inactive**: Include inactive distribution lists
    - **search**: Search by name or key
    """
    query = {}

    if not include_inactive:
        query["is_active"] = True

    if list_type:
        query["type"] = list_type

    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"key": {"$regex": search, "$options": "i"}}
        ]

    # Get total count
    total = await db.distribution_lists.count_documents(query)

    # Get paginated data
    skip = page * limit
    cursor = db.distribution_lists.find(query).skip(skip).limit(limit).sort("name", 1)

    lists = []
    async for item in cursor:
        item["_id"] = str(item["_id"])
        lists.append(DistributionListInDB(**item))

    return {
        "data": lists,
        "pagination": create_pagination_meta(total, page, limit)
    }


@router.get("/types")
async def get_distribution_list_types(
    current_user: CurrentUser = Depends(require_group_admin)
):
    """Get available distribution list types."""
    return {
        "types": [
            {"value": "scenario_request", "label": "Scenario Request"},
            {"value": "feedback", "label": "Feedback"},
            {"value": "system_alert", "label": "System Alert"},
            {"value": "system_notification", "label": "System Notification"},
            {"value": "configuration_update", "label": "Configuration Update"},
            {"value": "no_reply", "label": "No Reply"},
            {"value": "support", "label": "Support"},
            {"value": "custom", "label": "Custom"}
        ]
    }


@router.get("/by-key/{key}")
async def get_distribution_list_by_key(
    key: str,
    current_user: CurrentUser = Depends(require_group_admin),
    service: DistributionListService = Depends(get_distribution_list_service)
):
    """Get a distribution list by its key."""
    dist_list = await service.get_by_key(key)
    if not dist_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Distribution list with key '{key}' not found"
        )
    return DistributionListInDB(**dist_list)


@router.get("/by-type/{list_type}")
async def get_distribution_lists_by_type(
    list_type: str,
    current_user: CurrentUser = Depends(require_group_admin),
    service: DistributionListService = Depends(get_distribution_list_service)
):
    """Get all distribution lists of a specific type."""
    lists = await service.get_by_type(list_type)
    return {"data": [DistributionListInDB(**item) for item in lists]}


@router.get("/emails/{key}")
async def get_emails_by_key(
    key: str,
    current_user: CurrentUser = Depends(require_group_admin),
    service: DistributionListService = Depends(get_distribution_list_service)
):
    """Get email addresses from a distribution list by key."""
    emails = await service.get_emails_by_key(key)
    return {"emails": emails}


@router.get("/{list_id}", response_model=DistributionListInDB)
async def get_distribution_list(
    list_id: str,
    current_user: CurrentUser = Depends(require_group_admin),
    service: DistributionListService = Depends(get_distribution_list_service)
):
    """Get a specific distribution list by ID."""
    dist_list = await service.get_by_id(list_id)
    if not dist_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Distribution list not found"
        )
    return DistributionListInDB(**dist_list)


@router.post("", response_model=DistributionListInDB, status_code=status.HTTP_201_CREATED)
async def create_distribution_list(
    list_data: DistributionListCreate,
    current_user: CurrentUser = Depends(require_super_admin),
    service: DistributionListService = Depends(get_distribution_list_service)
):
    """
    Create a new distribution list.

    - **key**: Unique identifier for the list
    - **name**: Display name
    - **description**: Optional description
    - **type**: Type of list (scenario_request, feedback, system_alert, custom)
    - **emails**: List of email addresses
    - **is_active**: Whether the list is active
    """
    try:
        result = await service.create(
            data=list_data.model_dump(),
            user_id=current_user.email
        )
        return DistributionListInDB(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{list_id}", response_model=DistributionListInDB)
async def update_distribution_list(
    list_id: str,
    list_data: DistributionListUpdate,
    current_user: CurrentUser = Depends(require_super_admin),
    service: DistributionListService = Depends(get_distribution_list_service)
):
    """Update a distribution list."""
    try:
        result = await service.update(
            list_id=list_id,
            data=list_data.model_dump(exclude_unset=True),
            user_id=current_user.email
        )
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Distribution list not found"
            )
        return DistributionListInDB(**result)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{list_id}/emails", response_model=DistributionListInDB)
async def add_email_to_list(
    list_id: str,
    email_data: DistributionListAddEmail,
    current_user: CurrentUser = Depends(require_super_admin),
    service: DistributionListService = Depends(get_distribution_list_service)
):
    """Add an email address to a distribution list."""
    result = await service.add_email(
        list_id=list_id,
        email=email_data.email,
        user_id=current_user.email
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Distribution list not found"
        )
    return DistributionListInDB(**result)


@router.delete("/{list_id}/emails", response_model=DistributionListInDB)
async def remove_email_from_list(
    list_id: str,
    email_data: DistributionListRemoveEmail,
    current_user: CurrentUser = Depends(require_super_admin),
    service: DistributionListService = Depends(get_distribution_list_service)
):
    """Remove an email address from a distribution list."""
    result = await service.remove_email(
        list_id=list_id,
        email=email_data.email,
        user_id=current_user.email
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Distribution list not found"
        )
    return DistributionListInDB(**result)


@router.delete("/{list_id}")
async def delete_distribution_list(
    list_id: str,
    hard_delete: bool = Query(False, description="Permanently delete instead of soft delete"),
    current_user: CurrentUser = Depends(require_super_admin),
    service: DistributionListService = Depends(get_distribution_list_service)
):
    """Delete a distribution list (soft delete by default)."""
    if hard_delete:
        success = await service.hard_delete(list_id)
    else:
        success = await service.delete(list_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Distribution list not found"
        )

    return {"message": "Distribution list deleted successfully"}


@router.post("/{list_id}/toggle-status")
async def toggle_distribution_list_status(
    list_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    service: DistributionListService = Depends(get_distribution_list_service)
):
    """Enable or disable a distribution list."""
    dist_list = await service.get_by_id(list_id)
    if not dist_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Distribution list not found"
        )

    new_status = not dist_list.get("is_active", True)
    result = await service.update(
        list_id=list_id,
        data={"is_active": new_status},
        user_id=current_user.email
    )

    return {
        "message": f"Distribution list {'activated' if new_status else 'deactivated'} successfully",
        "is_active": new_status
    }
