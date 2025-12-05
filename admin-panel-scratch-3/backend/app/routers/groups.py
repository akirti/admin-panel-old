"""
Group management API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import math
from app.models import GroupCreate, GroupUpdate, GroupInDB, UserInDB, PaginationMeta
from app.auth import get_super_admin_user
from app.database import get_database, COLLECTIONS
from app.services.email_service import email_service

router = APIRouter(prefix="/groups", tags=["Groups"])


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


async def notify_users_of_group_change(group_id: str, changes: dict):
    """Notify all users with this group about changes."""
    db = get_database()
    cursor = db[COLLECTIONS["users"]].find({"groups": group_id})
    async for user in cursor:
        await email_service.send_role_change_notification(
            user["email"],
            user["full_name"],
            "group",
            changes
        )


@router.get("")
async def list_groups(
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """
    List all groups with pagination and filtering.
    
    - **page**: Page number (0-indexed)
    - **limit**: Maximum number of records to return
    - **status**: Filter by status (active/inactive)
    - **search**: Search by name or groupId
    """
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"groupId": {"$regex": search, "$options": "i"}}
        ]
    
    # Get total count
    total = await db[COLLECTIONS["groups"]].count_documents(query)
    
    # Get paginated data
    skip = page * limit
    cursor = db[COLLECTIONS["groups"]].find(query).skip(skip).limit(limit).sort("priority", 1)
    groups = []
    async for group in cursor:
        group["_id"] = str(group["_id"])
        groups.append(GroupInDB(**group))
    
    return {
        "data": groups,
        "pagination": create_pagination_meta(total, page, limit)
    }


@router.get("/count")
async def count_groups(
    status: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get total count of groups."""
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    count = await db[COLLECTIONS["groups"]].count_documents(query)
    return {"count": count}


@router.get("/{group_id}", response_model=GroupInDB)
async def get_group(
    group_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get a specific group by ID or groupId."""
    db = get_database()
    
    try:
        group = await db[COLLECTIONS["groups"]].find_one({"_id": ObjectId(group_id)})
    except:
        group = await db[COLLECTIONS["groups"]].find_one({"groupId": group_id})
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    group["_id"] = str(group["_id"])
    return GroupInDB(**group)


@router.post("", response_model=GroupInDB, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_data: GroupCreate,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Create a new group."""
    db = get_database()
    
    # Check if groupId already exists
    existing = await db[COLLECTIONS["groups"]].find_one({"groupId": group_data.groupId})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group ID already exists"
        )
    
    group_dict = group_data.model_dump()
    group_dict["created_at"] = datetime.utcnow()
    group_dict["updated_at"] = datetime.utcnow()
    
    result = await db[COLLECTIONS["groups"]].insert_one(group_dict)
    group_dict["_id"] = str(result.inserted_id)
    
    return GroupInDB(**group_dict)


@router.put("/{group_id}", response_model=GroupInDB)
async def update_group(
    group_id: str,
    group_data: GroupUpdate,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Update a group."""
    db = get_database()
    
    try:
        existing = await db[COLLECTIONS["groups"]].find_one({"_id": ObjectId(group_id)})
    except:
        existing = await db[COLLECTIONS["groups"]].find_one({"groupId": group_id})
    
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    # Track changes
    changes = {}
    update_data = group_data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    
    for key, value in update_data.items():
        if key != "updated_at" and existing.get(key) != value:
            changes[key] = {"old": existing.get(key), "new": value}
    
    await db[COLLECTIONS["groups"]].update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )
    
    # Notify users if there were significant changes
    if changes and ("permissions" in changes or "domains" in changes or "status" in changes):
        await notify_users_of_group_change(existing["groupId"], changes)
    
    updated = await db[COLLECTIONS["groups"]].find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return GroupInDB(**updated)


@router.delete("/{group_id}")
async def delete_group(
    group_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Delete a group."""
    db = get_database()
    
    try:
        result = await db[COLLECTIONS["groups"]].delete_one({"_id": ObjectId(group_id)})
    except:
        result = await db[COLLECTIONS["groups"]].delete_one({"groupId": group_id})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    # Remove group from all users
    await db[COLLECTIONS["users"]].update_many(
        {"groups": group_id},
        {"$pull": {"groups": group_id}}
    )
    
    return {"message": "Group deleted successfully"}


@router.post("/{group_id}/toggle-status")
async def toggle_group_status(
    group_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Enable or disable a group."""
    db = get_database()
    
    try:
        group = await db[COLLECTIONS["groups"]].find_one({"_id": ObjectId(group_id)})
    except:
        group = await db[COLLECTIONS["groups"]].find_one({"groupId": group_id})
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    new_status = "inactive" if group.get("status") == "active" else "active"
    await db[COLLECTIONS["groups"]].update_one(
        {"_id": group["_id"]},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )
    
    # Notify users
    await notify_users_of_group_change(
        group["groupId"],
        {"status": {"old": group.get("status"), "new": new_status}}
    )
    
    return {"message": f"Group status changed to {new_status}", "status": new_status}


@router.get("/{group_id}/users", response_model=List[dict])
async def get_group_users(
    group_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get all users in a specific group."""
    db = get_database()
    
    # Verify group exists
    try:
        group = await db[COLLECTIONS["groups"]].find_one({"_id": ObjectId(group_id)})
    except:
        group = await db[COLLECTIONS["groups"]].find_one({"groupId": group_id})
    
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    cursor = db[COLLECTIONS["users"]].find(
        {"groups": group["groupId"]},
        {"password_hash": 0}
    )
    
    users = []
    async for user in cursor:
        user["_id"] = str(user["_id"])
        users.append(user)
    
    return users
