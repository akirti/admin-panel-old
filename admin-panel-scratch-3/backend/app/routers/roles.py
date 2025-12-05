"""
Role management API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import math
from app.models import RoleCreate, RoleUpdate, RoleInDB, UserInDB, PaginationMeta
from app.auth import get_super_admin_user
from app.database import get_database, COLLECTIONS
from app.services.email_service import email_service

router = APIRouter(prefix="/roles", tags=["Roles"])


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


async def notify_users_of_role_change(role_id: str, changes: dict):
    """Notify all users with this role about changes."""
    db = get_database()
    cursor = db[COLLECTIONS["users"]].find({"roles": role_id})
    async for user in cursor:
        await email_service.send_role_change_notification(
            user["email"],
            user["full_name"],
            "role",
            changes
        )


@router.get("")
async def list_roles(
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """
    List all roles with pagination and filtering.
    
    - **page**: Page number (0-indexed)
    - **limit**: Maximum number of records to return
    - **status**: Filter by status (active/inactive)
    - **search**: Search by name or roleId
    """
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"roleId": {"$regex": search, "$options": "i"}}
        ]
    
    # Get total count
    total = await db[COLLECTIONS["roles"]].count_documents(query)
    
    # Get paginated data
    skip = page * limit
    cursor = db[COLLECTIONS["roles"]].find(query).skip(skip).limit(limit).sort("priority", 1)
    roles = []
    async for role in cursor:
        role["_id"] = str(role["_id"])
        roles.append(RoleInDB(**role))
    
    return {
        "data": roles,
        "pagination": create_pagination_meta(total, page, limit)
    }


@router.get("/count")
async def count_roles(
    status: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get total count of roles."""
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    count = await db[COLLECTIONS["roles"]].count_documents(query)
    return {"count": count}


@router.get("/{role_id}", response_model=RoleInDB)
async def get_role(
    role_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get a specific role by ID or roleId."""
    db = get_database()
    
    try:
        role = await db[COLLECTIONS["roles"]].find_one({"_id": ObjectId(role_id)})
    except:
        role = await db[COLLECTIONS["roles"]].find_one({"roleId": role_id})
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    role["_id"] = str(role["_id"])
    return RoleInDB(**role)


@router.post("", response_model=RoleInDB, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_data: RoleCreate,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Create a new role."""
    db = get_database()
    
    # Check if roleId already exists
    existing = await db[COLLECTIONS["roles"]].find_one({"roleId": role_data.roleId})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role ID already exists"
        )
    
    role_dict = role_data.model_dump()
    role_dict["created_at"] = datetime.utcnow()
    role_dict["updated_at"] = datetime.utcnow()
    
    result = await db[COLLECTIONS["roles"]].insert_one(role_dict)
    role_dict["_id"] = str(result.inserted_id)
    
    return RoleInDB(**role_dict)


@router.put("/{role_id}", response_model=RoleInDB)
async def update_role(
    role_id: str,
    role_data: RoleUpdate,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Update a role."""
    db = get_database()
    
    try:
        existing = await db[COLLECTIONS["roles"]].find_one({"_id": ObjectId(role_id)})
    except:
        existing = await db[COLLECTIONS["roles"]].find_one({"roleId": role_id})
    
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Track changes
    changes = {}
    update_data = role_data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    
    for key, value in update_data.items():
        if key != "updated_at" and existing.get(key) != value:
            changes[key] = {"old": existing.get(key), "new": value}
    
    await db[COLLECTIONS["roles"]].update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )
    
    # Notify users if there were significant changes
    if changes and ("permissions" in changes or "domains" in changes or "status" in changes):
        await notify_users_of_role_change(existing["roleId"], changes)
    
    updated = await db[COLLECTIONS["roles"]].find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return RoleInDB(**updated)


@router.delete("/{role_id}")
async def delete_role(
    role_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Delete a role."""
    db = get_database()
    
    try:
        result = await db[COLLECTIONS["roles"]].delete_one({"_id": ObjectId(role_id)})
    except:
        result = await db[COLLECTIONS["roles"]].delete_one({"roleId": role_id})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Remove role from all users
    await db[COLLECTIONS["users"]].update_many(
        {"roles": role_id},
        {"$pull": {"roles": role_id}}
    )
    
    return {"message": "Role deleted successfully"}


@router.post("/{role_id}/toggle-status")
async def toggle_role_status(
    role_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Enable or disable a role."""
    db = get_database()
    
    try:
        role = await db[COLLECTIONS["roles"]].find_one({"_id": ObjectId(role_id)})
    except:
        role = await db[COLLECTIONS["roles"]].find_one({"roleId": role_id})
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    new_status = "inactive" if role.get("status") == "active" else "active"
    await db[COLLECTIONS["roles"]].update_one(
        {"_id": role["_id"]},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )
    
    # Notify users
    await notify_users_of_role_change(
        role["roleId"],
        {"status": {"old": role.get("status"), "new": new_status}}
    )
    
    return {"message": f"Role status changed to {new_status}", "status": new_status}


@router.get("/{role_id}/users", response_model=List[dict])
async def get_role_users(
    role_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get all users with a specific role."""
    db = get_database()
    
    # Verify role exists
    try:
        role = await db[COLLECTIONS["roles"]].find_one({"_id": ObjectId(role_id)})
    except:
        role = await db[COLLECTIONS["roles"]].find_one({"roleId": role_id})
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    cursor = db[COLLECTIONS["users"]].find(
        {"roles": role["roleId"]},
        {"password_hash": 0}
    )
    
    users = []
    async for user in cursor:
        user["_id"] = str(user["_id"])
        users.append(user)
    
    return users
