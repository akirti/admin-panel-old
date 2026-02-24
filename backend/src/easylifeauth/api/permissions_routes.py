"""
Permission management API routes - Full CRUD from admin-panel-scratch-3.
"""
import re
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import math

from easylifeauth.api.models import PermissionCreate, PermissionUpdate, PermissionInDB, PaginationMeta
from easylifeauth.db.db_manager import DatabaseManager
from easylifeauth.api.dependencies import get_db
from easylifeauth.security.access_control import CurrentUser, require_super_admin

router = APIRouter(prefix="/permissions", tags=["Permissions"])


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
async def list_permissions(
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=1000, description="Items per page"),
    module: Optional[str] = None,
    search: Optional[str] = None,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """List all permissions with pagination and filtering."""
    query = {}
    if module:
        query["module"] = module
    if search:
        safe_search = re.escape(search)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"key": {"$regex": safe_search, "$options": "i"}}
        ]

    # Get total count
    total = await db.permissions.count_documents(query)

    # Get paginated data
    skip = page * limit
    cursor = db.permissions.find(query).skip(skip).limit(limit).sort("module", 1)
    permissions = []
    async for perm in cursor:
        perm["_id"] = str(perm["_id"])
        permissions.append(PermissionInDB(**perm))

    return {
        "data": permissions,
        "pagination": create_pagination_meta(total, page, limit)
    }


@router.get("/modules")
async def list_modules(
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get list of all unique modules."""
    modules = await db.permissions.distinct("module")
    return {"modules": modules}


@router.get("/count")
async def count_permissions(
    module: Optional[str] = None,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get total count of permissions."""
    query = {}
    if module:
        query["module"] = module
    count = await db.permissions.count_documents(query)
    return {"count": count}


@router.get("/{permission_id}", response_model=PermissionInDB)
async def get_permission(
    permission_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get a specific permission by ID or key."""
    try:
        perm = await db.permissions.find_one({"_id": ObjectId(permission_id)})
    except:
        perm = await db.permissions.find_one({"key": permission_id})

    if not perm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )

    perm["_id"] = str(perm["_id"])
    return PermissionInDB(**perm)


@router.post("", response_model=PermissionInDB, status_code=status.HTTP_201_CREATED)
async def create_permission(
    perm_data: PermissionCreate,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Create a new permission."""
    # Check if key already exists
    existing = await db.permissions.find_one({"key": perm_data.key})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Permission key already exists"
        )

    perm_dict = perm_data.model_dump()
    perm_dict["created_at"] = datetime.utcnow()
    perm_dict["updated_at"] = datetime.utcnow()

    result = await db.permissions.insert_one(perm_dict)
    perm_dict["_id"] = str(result.inserted_id)

    return PermissionInDB(**perm_dict)


@router.put("/{permission_id}", response_model=PermissionInDB)
async def update_permission(
    permission_id: str,
    perm_data: PermissionUpdate,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Update a permission."""
    try:
        existing = await db.permissions.find_one({"_id": ObjectId(permission_id)})
    except:
        existing = await db.permissions.find_one({"key": permission_id})

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )

    update_data = perm_data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()

    await db.permissions.update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )

    updated = await db.permissions.find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return PermissionInDB(**updated)


@router.delete("/{permission_id}")
async def delete_permission(
    permission_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Delete a permission."""
    try:
        perm = await db.permissions.find_one({"_id": ObjectId(permission_id)})
    except:
        perm = await db.permissions.find_one({"key": permission_id})

    if not perm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )

    perm_key = perm["key"]

    await db.permissions.delete_one({"_id": perm["_id"]})

    # Remove permission from all roles
    await db.roles.update_many(
        {"permissions": perm_key},
        {"$pull": {"permissions": perm_key}}
    )

    # Remove permission from all groups
    await db.groups.update_many(
        {"permissions": perm_key},
        {"$pull": {"permissions": perm_key}}
    )

    return {"message": "Permission deleted successfully"}


@router.get("/{permission_id}/roles", response_model=List[dict])
async def get_permission_roles(
    permission_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get all roles that have a specific permission."""
    try:
        perm = await db.permissions.find_one({"_id": ObjectId(permission_id)})
    except:
        perm = await db.permissions.find_one({"key": permission_id})

    if not perm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )

    cursor = db.roles.find({"permissions": perm["key"]})

    roles = []
    async for role in cursor:
        role["_id"] = str(role["_id"])
        roles.append(role)

    return roles


@router.get("/{permission_id}/groups", response_model=List[dict])
async def get_permission_groups(
    permission_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get all groups that have a specific permission."""
    try:
        perm = await db.permissions.find_one({"_id": ObjectId(permission_id)})
    except:
        perm = await db.permissions.find_one({"key": permission_id})

    if not perm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )

    cursor = db.groups.find({"permissions": perm["key"]})

    groups = []
    async for group in cursor:
        group["_id"] = str(group["_id"])
        groups.append(group)

    return groups
