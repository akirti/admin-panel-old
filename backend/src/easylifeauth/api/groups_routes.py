"""
Group management API routes - Full CRUD from admin-panel-scratch-3.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import math

from easylifeauth.api.models import GroupCreate, GroupUpdate, GroupInDB, PaginationMeta
from easylifeauth.db.db_manager import DatabaseManager
from easylifeauth.db.lookup import GroupTypes
from easylifeauth.api.dependencies import get_db, get_email_service
from easylifeauth.security.access_control import CurrentUser, require_super_admin, require_group_admin
from easylifeauth.services.email_service import EmailService

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


async def notify_users_of_group_change(db: DatabaseManager, group_id: str, changes: dict, email_service: Optional[EmailService] = None):
    """Notify all users with this group about changes."""
    if not email_service:
        return
    cursor = db.users.find({"groups": group_id})
    async for user in cursor:
        try:
            await email_service.send_role_change_notification(
                user["email"],
                user.get("full_name", user["email"]),
                "group",
                changes
            )
        except Exception:
            pass


@router.get("")
async def list_groups(
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """List all groups with pagination and filtering."""
    query = {}
    if status_filter:
        query["status"] = status_filter
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"groupId": {"$regex": search, "$options": "i"}}
        ]

    # Get total count
    total = await db.groups.count_documents(query)

    # Get paginated data
    skip = page * limit
    cursor = db.groups.find(query).skip(skip).limit(limit).sort("priority", 1)
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
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get total count of groups."""
    query = {}
    if status_filter:
        query["status"] = status_filter
    count = await db.groups.count_documents(query)
    return {"count": count}


@router.get("/types")
async def get_group_types(
    current_user: CurrentUser = Depends(require_group_admin)
):
    """Get available group types from GroupTypes enum."""
    return [{"value": t.value, "label": t.value.title()} for t in GroupTypes]


@router.get("/{group_id}", response_model=GroupInDB)
async def get_group(
    group_id: str,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get a specific group by ID or groupId."""
    try:
        group = await db.groups.find_one({"_id": ObjectId(group_id)})
    except:
        group = await db.groups.find_one({"groupId": group_id})

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
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Create a new group."""
    # Check if groupId already exists
    existing = await db.groups.find_one({"groupId": group_data.groupId})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group ID already exists"
        )

    group_dict = group_data.model_dump()
    group_dict["created_at"] = datetime.utcnow()
    group_dict["updated_at"] = datetime.utcnow()

    result = await db.groups.insert_one(group_dict)
    group_dict["_id"] = str(result.inserted_id)

    return GroupInDB(**group_dict)


@router.put("/{group_id}", response_model=GroupInDB)
async def update_group(
    group_id: str,
    group_data: GroupUpdate,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db),
    email_service: Optional[EmailService] = Depends(get_email_service)
):
    """Update a group."""
    try:
        existing = await db.groups.find_one({"_id": ObjectId(group_id)})
    except:
        existing = await db.groups.find_one({"groupId": group_id})

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

    await db.groups.update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )

    # Notify users if there were significant changes
    if changes and ("permissions" in changes or "domains" in changes or "status" in changes):
        await notify_users_of_group_change(db, existing["groupId"], changes, email_service)

    updated = await db.groups.find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return GroupInDB(**updated)


@router.delete("/{group_id}")
async def delete_group(
    group_id: str,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Delete a group."""
    try:
        group = await db.groups.find_one({"_id": ObjectId(group_id)})
        if group:
            group_id_str = group["groupId"]
            result = await db.groups.delete_one({"_id": group["_id"]})
        else:
            result = type('obj', (object,), {'deleted_count': 0})()
            group_id_str = group_id
    except:
        group = await db.groups.find_one({"groupId": group_id})
        if group:
            group_id_str = group["groupId"]
            result = await db.groups.delete_one({"_id": group["_id"]})
        else:
            result = type('obj', (object,), {'deleted_count': 0})()
            group_id_str = group_id

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    # Remove group from all users
    await db.users.update_many(
        {"groups": group_id_str},
        {"$pull": {"groups": group_id_str}}
    )

    return {"message": "Group deleted successfully"}


@router.post("/{group_id}/toggle-status")
async def toggle_group_status(
    group_id: str,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db),
    email_service: Optional[EmailService] = Depends(get_email_service)
):
    """Enable or disable a group."""
    try:
        group = await db.groups.find_one({"_id": ObjectId(group_id)})
    except:
        group = await db.groups.find_one({"groupId": group_id})

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    new_status = "inactive" if group.get("status") == "active" else "active"
    await db.groups.update_one(
        {"_id": group["_id"]},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )

    # Notify users
    await notify_users_of_group_change(
        db,
        group["groupId"],
        {"status": {"old": group.get("status"), "new": new_status}},
        email_service
    )

    return {"message": f"Group status changed to {new_status}", "status": new_status}


@router.get("/{group_id}/users", response_model=List[dict])
async def get_group_users(
    group_id: str,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get all users in a specific group."""
    # Verify group exists
    try:
        group = await db.groups.find_one({"_id": ObjectId(group_id)})
    except:
        group = await db.groups.find_one({"groupId": group_id})

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )

    cursor = db.users.find(
        {"groups": group["groupId"]},
        {"password_hash": 0}
    )

    users = []
    async for user in cursor:
        user["_id"] = str(user["_id"])
        users.append(user)

    return users
