"""
Permission management API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import math
from app.models import PermissionCreate, PermissionUpdate, PermissionInDB, UserInDB, PaginationMeta
from app.auth import get_super_admin_user
from app.database import get_database, COLLECTIONS
from app.services.email_service import email_service

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
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    module: Optional[str] = None,
    search: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """
    List all permissions with pagination and filtering.
    
    - **page**: Page number (0-indexed)
    - **limit**: Maximum number of records to return
    - **module**: Filter by module name
    - **search**: Search by name or key
    """
    db = get_database()
    
    query = {}
    if module:
        query["module"] = module
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"key": {"$regex": search, "$options": "i"}}
        ]
    
    # Get total count
    total = await db[COLLECTIONS["permissions"]].count_documents(query)
    
    # Get paginated data
    skip = page * limit
    cursor = db[COLLECTIONS["permissions"]].find(query).skip(skip).limit(limit).sort("module", 1)
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
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get list of all unique modules."""
    db = get_database()
    modules = await db[COLLECTIONS["permissions"]].distinct("module")
    return {"modules": modules}


@router.get("/count")
async def count_permissions(
    module: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get total count of permissions."""
    db = get_database()
    query = {}
    if module:
        query["module"] = module
    count = await db[COLLECTIONS["permissions"]].count_documents(query)
    return {"count": count}


@router.get("/{permission_id}", response_model=PermissionInDB)
async def get_permission(
    permission_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get a specific permission by ID or key."""
    db = get_database()
    
    try:
        perm = await db[COLLECTIONS["permissions"]].find_one({"_id": ObjectId(permission_id)})
    except:
        perm = await db[COLLECTIONS["permissions"]].find_one({"key": permission_id})
    
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
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Create a new permission."""
    db = get_database()
    
    # Check if key already exists
    existing = await db[COLLECTIONS["permissions"]].find_one({"key": perm_data.key})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Permission key already exists"
        )
    
    perm_dict = perm_data.model_dump()
    perm_dict["created_at"] = datetime.utcnow()
    perm_dict["updated_at"] = datetime.utcnow()
    
    result = await db[COLLECTIONS["permissions"]].insert_one(perm_dict)
    perm_dict["_id"] = str(result.inserted_id)
    
    return PermissionInDB(**perm_dict)


@router.put("/{permission_id}", response_model=PermissionInDB)
async def update_permission(
    permission_id: str,
    perm_data: PermissionUpdate,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Update a permission."""
    db = get_database()
    
    try:
        existing = await db[COLLECTIONS["permissions"]].find_one({"_id": ObjectId(permission_id)})
    except:
        existing = await db[COLLECTIONS["permissions"]].find_one({"key": permission_id})
    
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    update_data = perm_data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    
    await db[COLLECTIONS["permissions"]].update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )
    
    updated = await db[COLLECTIONS["permissions"]].find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return PermissionInDB(**updated)


@router.delete("/{permission_id}")
async def delete_permission(
    permission_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Delete a permission."""
    db = get_database()
    
    try:
        perm = await db[COLLECTIONS["permissions"]].find_one({"_id": ObjectId(permission_id)})
    except:
        perm = await db[COLLECTIONS["permissions"]].find_one({"key": permission_id})
    
    if not perm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    perm_key = perm["key"]
    
    await db[COLLECTIONS["permissions"]].delete_one({"_id": perm["_id"]})
    
    # Remove permission from all roles
    await db[COLLECTIONS["roles"]].update_many(
        {"permissions": perm_key},
        {"$pull": {"permissions": perm_key}}
    )
    
    # Remove permission from all groups
    await db[COLLECTIONS["groups"]].update_many(
        {"permissions": perm_key},
        {"$pull": {"permissions": perm_key}}
    )
    
    return {"message": "Permission deleted successfully"}


@router.get("/{permission_id}/roles", response_model=List[dict])
async def get_permission_roles(
    permission_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get all roles that have a specific permission."""
    db = get_database()
    
    try:
        perm = await db[COLLECTIONS["permissions"]].find_one({"_id": ObjectId(permission_id)})
    except:
        perm = await db[COLLECTIONS["permissions"]].find_one({"key": permission_id})
    
    if not perm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    cursor = db[COLLECTIONS["roles"]].find({"permissions": perm["key"]})
    
    roles = []
    async for role in cursor:
        role["_id"] = str(role["_id"])
        roles.append(role)
    
    return roles


@router.get("/{permission_id}/groups", response_model=List[dict])
async def get_permission_groups(
    permission_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get all groups that have a specific permission."""
    db = get_database()
    
    try:
        perm = await db[COLLECTIONS["permissions"]].find_one({"_id": ObjectId(permission_id)})
    except:
        perm = await db[COLLECTIONS["permissions"]].find_one({"key": permission_id})
    
    if not perm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    
    cursor = db[COLLECTIONS["groups"]].find({"permissions": perm["key"]})
    
    groups = []
    async for group in cursor:
        group["_id"] = str(group["_id"])
        groups.append(group)
    
    return groups
