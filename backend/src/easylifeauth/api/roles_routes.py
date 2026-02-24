"""
Role management API routes - Full CRUD from admin-panel-scratch-3.
"""
import re
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import math

from easylifeauth.api.models import RoleCreate, RoleUpdate, RoleInDB, PaginationMeta
from easylifeauth.db.db_manager import DatabaseManager
from easylifeauth.api.dependencies import get_db, get_email_service
from easylifeauth.security.access_control import CurrentUser, require_super_admin, require_group_admin
from easylifeauth.services.email_service import EmailService

router = APIRouter(prefix="/roles", tags=["Roles"])


async def resolve_permissions(db: DatabaseManager, permission_refs: List[str]) -> List[str]:
    """
    Resolve permission references (IDs or keys) to permission keys.
    Accepts either ObjectId strings or permissionId keys.
    Returns list of valid permissionId keys.
    """
    if not permission_refs:
        return []

    resolved_keys = []
    for ref in permission_refs:
        # Try as ObjectId first
        if ObjectId.is_valid(ref):
            permission = await db.permissions.find_one({"_id": ObjectId(ref)})
            if permission:
                resolved_keys.append(permission.get("permissionId", ref))
                continue

        # Try as permissionId key
        permission = await db.permissions.find_one({"permissionId": ref})
        if permission:
            resolved_keys.append(permission.get("permissionId", ref))
        else:
            # Keep the original value if not found (allows for flexibility)
            resolved_keys.append(ref)

    return resolved_keys


async def resolve_domains(db: DatabaseManager, domain_refs: List[str]) -> List[str]:
    """
    Resolve domain references (IDs or keys) to domain keys.
    Accepts either ObjectId strings or domainId keys.
    Returns list of valid domainId keys.
    """
    if not domain_refs:
        return []

    resolved_keys = []
    for ref in domain_refs:
        # Try as ObjectId first
        if ObjectId.is_valid(ref):
            domain = await db.data_domains.find_one({"_id": ObjectId(ref)})
            if domain:
                resolved_keys.append(domain.get("domainId", ref))
                continue

        # Try as domainId key
        domain = await db.data_domains.find_one({"domainId": ref})
        if domain:
            resolved_keys.append(domain.get("domainId", ref))
        else:
            # Keep the original value if not found (allows for flexibility)
            resolved_keys.append(ref)

    return resolved_keys


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


async def notify_users_of_role_change(db: DatabaseManager, role_id: str, changes: dict, email_service: Optional[EmailService] = None):
    """Notify all users with this role about changes."""
    if not email_service:
        return
    cursor = db.users.find({"roles": role_id})
    async for user in cursor:
        try:
            await email_service.send_role_change_notification(
                user["email"],
                user.get("full_name", user["email"]),
                "role",
                changes
            )
        except Exception:
            pass


@router.get("")
async def list_roles(
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    domain: Optional[str] = None,
    permission: Optional[str] = None,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """List all roles with pagination and filtering. Accessible by super-admins and administrators."""
    query = {}
    if status_filter:
        query["status"] = status_filter
    if search:
        safe_search = re.escape(search)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"roleId": {"$regex": safe_search, "$options": "i"}}
        ]
    if domain:
        query["domains"] = domain
    if permission:
        query["permissions"] = permission

    # Get total count
    total = await db.roles.count_documents(query)

    # Get paginated data
    skip = page * limit
    cursor = db.roles.find(query).skip(skip).limit(limit).sort("priority", 1)
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
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get total count of roles. Accessible by super-admins and administrators."""
    query = {}
    if status_filter:
        query["status"] = status_filter
    count = await db.roles.count_documents(query)
    return {"count": count}


@router.get("/{role_id}", response_model=RoleInDB)
async def get_role(
    role_id: str,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get a specific role by ID or roleId."""
    try:
        role = await db.roles.find_one({"_id": ObjectId(role_id)})
    except:
        role = await db.roles.find_one({"roleId": role_id})

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
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Create a new role."""
    # Check if roleId already exists
    existing = await db.roles.find_one({"roleId": role_data.roleId})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role ID already exists"
        )

    role_dict = role_data.model_dump()

    # Resolve permission and domain references (IDs or keys) to keys
    if role_dict.get("permissions"):
        role_dict["permissions"] = await resolve_permissions(db, role_dict["permissions"])
    if role_dict.get("domains"):
        role_dict["domains"] = await resolve_domains(db, role_dict["domains"])

    role_dict["created_at"] = datetime.utcnow()
    role_dict["updated_at"] = datetime.utcnow()

    result = await db.roles.insert_one(role_dict)
    role_dict["_id"] = str(result.inserted_id)

    return RoleInDB(**role_dict)


@router.put("/{role_id}", response_model=RoleInDB)
async def update_role(
    role_id: str,
    role_data: RoleUpdate,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db),
    email_service: Optional[EmailService] = Depends(get_email_service)
):
    """Update a role."""
    try:
        existing = await db.roles.find_one({"_id": ObjectId(role_id)})
    except:
        existing = await db.roles.find_one({"roleId": role_id})

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    # Track changes
    changes = {}
    update_data = role_data.model_dump(exclude_unset=True)

    # Resolve permission and domain references (IDs or keys) to keys
    if "permissions" in update_data and update_data["permissions"] is not None:
        update_data["permissions"] = await resolve_permissions(db, update_data["permissions"])
    if "domains" in update_data and update_data["domains"] is not None:
        update_data["domains"] = await resolve_domains(db, update_data["domains"])

    update_data["updated_at"] = datetime.utcnow()

    for key, value in update_data.items():
        if key != "updated_at" and existing.get(key) != value:
            changes[key] = {"old": existing.get(key), "new": value}

    await db.roles.update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )

    # Notify users if there were significant changes
    if changes and ("permissions" in changes or "domains" in changes or "status" in changes):
        await notify_users_of_role_change(db, existing["roleId"], changes, email_service)

    updated = await db.roles.find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return RoleInDB(**updated)


@router.delete("/{role_id}")
async def delete_role(
    role_id: str,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Delete a role."""
    try:
        result = await db.roles.delete_one({"_id": ObjectId(role_id)})
        role_id_str = role_id
    except:
        role = await db.roles.find_one({"roleId": role_id})
        if role:
            result = await db.roles.delete_one({"_id": role["_id"]})
            role_id_str = role["roleId"]
        else:
            result = type('obj', (object,), {'deleted_count': 0})()
            role_id_str = role_id

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    # Remove role from all users
    await db.users.update_many(
        {"roles": role_id_str},
        {"$pull": {"roles": role_id_str}}
    )

    return {"message": "Role deleted successfully"}


@router.post("/{role_id}/toggle-status")
async def toggle_role_status(
    role_id: str,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db),
    email_service: Optional[EmailService] = Depends(get_email_service)
):
    """Enable or disable a role."""
    try:
        role = await db.roles.find_one({"_id": ObjectId(role_id)})
    except:
        role = await db.roles.find_one({"roleId": role_id})

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    new_status = "inactive" if role.get("status") == "active" else "active"
    await db.roles.update_one(
        {"_id": role["_id"]},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )

    # Notify users
    await notify_users_of_role_change(
        db,
        role["roleId"],
        {"status": {"old": role.get("status"), "new": new_status}},
        email_service
    )

    return {"message": f"Role status changed to {new_status}", "status": new_status}


@router.get("/{role_id}/users", response_model=List[dict])
async def get_role_users(
    role_id: str,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get all users with a specific role."""
    # Verify role exists
    try:
        role = await db.roles.find_one({"_id": ObjectId(role_id)})
    except:
        role = await db.roles.find_one({"roleId": role_id})

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    cursor = db.users.find(
        {"roles": role["roleId"]},
        {"password_hash": 0}
    )

    users = []
    async for user in cursor:
        user["_id"] = str(user["_id"])
        users.append(user)

    return users
