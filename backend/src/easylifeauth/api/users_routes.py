"""
User management API routes - Full CRUD from admin-panel-scratch-3.
"""
import re
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import math

from easylifeauth.api.models import (
    UserCreate, UserUpdate, UserResponseFull, PaginationMeta
)
from easylifeauth.db.db_manager import DatabaseManager
from werkzeug.security import generate_password_hash
import secrets
import string

def get_password_hash(password: str) -> str:
    """Hash a password using werkzeug."""
    return generate_password_hash(password)

def generate_temp_password(length: int = 12) -> str:
    """Generate a temporary password."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def create_password_reset_token(email: str) -> str:
    """Create a password reset token."""
    return secrets.token_urlsafe(32)
from easylifeauth.api.dependencies import get_db, get_email_service, get_activity_log_service
from easylifeauth.security.access_control import CurrentUser, get_current_user, require_super_admin, require_group_admin
from easylifeauth.services.email_service import EmailService
from easylifeauth.services.activity_log_service import ActivityLogService

router = APIRouter(prefix="/users", tags=["Users"])


async def resolve_roles(db: DatabaseManager, role_refs: List[str]) -> List[str]:
    """
    Resolve role references (IDs or keys) to role keys.
    Accepts either ObjectId strings or roleId keys.
    Returns list of valid roleId keys.
    """
    if not role_refs:
        return []

    resolved_keys = []
    for ref in role_refs:
        # Try as ObjectId first
        if ObjectId.is_valid(ref):
            role = await db.roles.find_one({"_id": ObjectId(ref)})
            if role:
                resolved_keys.append(role.get("roleId", ref))
                continue

        # Try as roleId key
        role = await db.roles.find_one({"roleId": ref})
        if role:
            resolved_keys.append(role.get("roleId", ref))
        else:
            # Keep the original value if not found (allows for flexibility)
            resolved_keys.append(ref)

    return resolved_keys


async def resolve_groups(db: DatabaseManager, group_refs: List[str]) -> List[str]:
    """
    Resolve group references (IDs or keys) to group keys.
    Accepts either ObjectId strings or groupId keys.
    Returns list of valid groupId keys.
    """
    if not group_refs:
        return []

    resolved_keys = []
    for ref in group_refs:
        # Try as ObjectId first
        if ObjectId.is_valid(ref):
            group = await db.groups.find_one({"_id": ObjectId(ref)})
            if group:
                resolved_keys.append(group.get("groupId", ref))
                continue

        # Try as groupId key
        group = await db.groups.find_one({"groupId": ref})
        if group:
            resolved_keys.append(group.get("groupId", ref))
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


@router.get("")
async def list_users(
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=1000, description="Items per page"),
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    role: Optional[str] = None,
    group: Optional[str] = None,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """
    List all users with pagination and filtering.
    Accessible by super-admins and administrators.
    """
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    if search:
        safe_search = re.escape(search)
        query["$or"] = [
            {"email": {"$regex": safe_search, "$options": "i"}},
            {"username": {"$regex": safe_search, "$options": "i"}},
            {"full_name": {"$regex": safe_search, "$options": "i"}}
        ]
    if role:
        query["roles"] = role
    if group:
        query["groups"] = group

    # Get total count
    total = await db.users.count_documents(query)

    # Get paginated data
    skip = page * limit
    cursor = db.users.find(query).skip(skip).limit(limit).sort("created_at", -1)
    users = []
    async for user in cursor:
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        users.append(UserResponseFull(**user))

    return {
        "data": users,
        "pagination": create_pagination_meta(total, page, limit)
    }


@router.get("/count")
async def count_users(
    is_active: Optional[bool] = None,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get total count of users. Accessible by super-admins and administrators."""
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    count = await db.users.count_documents(query)
    return {"count": count}


@router.get("/me/assigned-customers")
async def get_assigned_customers(
    search: Optional[str] = Query(None, description="Search by customerId or name"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """Get all customers assigned to the current user (direct + via groups)."""
    import re

    # Collect all assigned customerIds with their source
    customer_source_map = {}  # customerId -> source label

    # 1. Direct assignments
    user = await db.users.find_one({"_id": ObjectId(current_user.user_id)})
    direct_customer_ids = user.get("customers", []) if user else []
    for cid in direct_customer_ids:
        customer_source_map[cid] = "direct"

    # 2. Group assignments - find groups of type "customers" that user belongs to
    user_groups = user.get("groups", []) if user else []
    if user_groups:
        cursor = db.groups.find({
            "groupId": {"$in": user_groups},
            "type": "customers",
            "status": "active"
        })
        async for group in cursor:
            group_name = group.get("name", group.get("groupId", "Group"))
            for cid in group.get("customers", []):
                if cid not in customer_source_map:
                    customer_source_map[cid] = group_name

    if not customer_source_map:
        return {"customers": [], "total": 0}

    # Build query to fetch customer details
    customer_ids = list(customer_source_map.keys())
    base_filter = {"customerId": {"$in": customer_ids}, "status": "active"}

    if search:
        search_regex = {"$regex": re.escape(search), "$options": "i"}
        # Must match assigned customer ids AND search term
        base_filter = {
            "$and": [
                {"customerId": {"$in": customer_ids}},
                {"status": "active"},
                {"$or": [
                    {"customerId": search_regex},
                    {"name": search_regex}
                ]}
            ]
        }

    if tag:
        base_filter["tags"] = tag

    query = base_filter

    cursor = db.customers.find(query).sort("customerId", 1)
    customers = []
    async for cust in cursor:
        customers.append({
            "customerId": cust.get("customerId"),
            "name": cust.get("name", ""),
            "tags": cust.get("tags", []),
            "unit": cust.get("unit"),
            "source": customer_source_map.get(cust.get("customerId"), "direct")
        })

    return {"customers": customers, "total": len(customers)}


@router.get("/me/customer-tags")
async def get_customer_tags(
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db)
):
    """Get distinct tags from all customers assigned to the current user."""
    # Collect all assigned customerIds
    user = await db.users.find_one({"_id": ObjectId(current_user.user_id)})
    customer_ids = list(user.get("customers", [])) if user else []

    user_groups = user.get("groups", []) if user else []
    if user_groups:
        cursor = db.groups.find({
            "groupId": {"$in": user_groups},
            "type": "customers",
            "status": "active"
        })
        async for group in cursor:
            for cid in group.get("customers", []):
                if cid not in customer_ids:
                    customer_ids.append(cid)

    if not customer_ids:
        return {"tags": []}

    # Get distinct tags from these customers
    pipeline = [
        {"$match": {"customerId": {"$in": customer_ids}, "status": "active"}},
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags"}},
        {"$sort": {"_id": 1}}
    ]
    tags = []
    async for doc in db.customers.aggregate(pipeline):
        tags.append(doc["_id"])

    return {"tags": tags}


@router.get("/{user_id}", response_model=UserResponseFull)
async def get_user(
    user_id: str,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get a specific user by ID. Accessible by super-admins and administrators."""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        user = await db.users.find_one({"email": user_id})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user["_id"] = str(user["_id"])
    user.pop("password_hash", None)
    return UserResponseFull(**user)


@router.post("", response_model=UserResponseFull, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db),
    email_service: Optional[EmailService] = Depends(get_email_service),
    activity_log: Optional[ActivityLogService] = Depends(get_activity_log_service)
):
    """Create a new user. Accessible by super-admins and administrators."""
    # Check if email already exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Check if username already exists
    existing = await db.users.find_one({"username": user_data.username})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )

    # Create user document
    user_dict = user_data.model_dump(exclude={"password", "send_password_email"})

    # Resolve role and group references (IDs or keys) to keys
    if user_dict.get("roles"):
        user_dict["roles"] = await resolve_roles(db, user_dict["roles"])
    if user_dict.get("groups"):
        user_dict["groups"] = await resolve_groups(db, user_dict["groups"])

    user_dict["password_hash"] = get_password_hash(user_data.password)
    user_dict["created_at"] = datetime.utcnow()
    user_dict["updated_at"] = datetime.utcnow()
    user_dict["last_login"] = None
    user_dict["is_super_admin"] = False

    result = await db.users.insert_one(user_dict)
    user_dict["_id"] = str(result.inserted_id)

    # Send welcome email if requested
    if user_data.send_password_email and email_service:
        try:
            await email_service.send_welcome_email(
                user_data.email, user_data.full_name, user_data.password
            )
            print(f"Welcome email sent to {user_data.email}")
        except Exception as e:
            print(f"Failed to send welcome email to {user_data.email}: {e}")
            # Don't fail if email fails

    # Log activity
    if activity_log:
        await activity_log.log(
            action="create",
            entity_type="user",
            entity_id=user_dict["_id"],
            user_email=current_user.email,
            details={"created_email": user_data.email}
        )

    user_dict.pop("password_hash", None)
    return UserResponseFull(**user_dict)


@router.put("/{user_id}", response_model=UserResponseFull)
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db),
    activity_log: Optional[ActivityLogService] = Depends(get_activity_log_service)
):
    """Update a user. Accessible by super-admins and administrators."""
    try:
        existing = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        existing = await db.users.find_one({"email": user_id})

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    update_data = user_data.model_dump(exclude_unset=True)

    # Resolve role and group references (IDs or keys) to keys
    if "roles" in update_data and update_data["roles"] is not None:
        update_data["roles"] = await resolve_roles(db, update_data["roles"])
        # Prevent privilege escalation: non-super-admins cannot assign admin/super-admin roles
        admin_roles = {"super-administrator", "administrator"}
        if "super-administrator" not in current_user.roles:
            requested_admin = admin_roles.intersection(set(update_data["roles"]))
            if requested_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions to assign roles: {requested_admin}"
                )
    if "groups" in update_data and update_data["groups"] is not None:
        update_data["groups"] = await resolve_groups(db, update_data["groups"])

    update_data["updated_at"] = datetime.utcnow()

    # Update user
    await db.users.update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )

    updated = await db.users.find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    updated.pop("password_hash", None)

    # Log activity
    if activity_log:
        await activity_log.log(
            action="update",
            entity_type="user",
            entity_id=updated["_id"],
            user_email=current_user.email,
            details={"updated_fields": list(update_data.keys())}
        )

    return UserResponseFull(**updated)


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db),
    activity_log: Optional[ActivityLogService] = Depends(get_activity_log_service)
):
    """Delete a user. Accessible by super-admins and administrators."""
    # Get user info before deleting for logging
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        user = await db.users.find_one({"email": user_id})

    deleted_email = user.get("email") if user else user_id

    try:
        result = await db.users.delete_one({"_id": ObjectId(user_id)})
    except:
        result = await db.users.delete_one({"email": user_id})

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Log activity
    if activity_log:
        await activity_log.log(
            action="delete",
            entity_type="user",
            entity_id=user_id,
            user_email=current_user.email,
            details={"deleted_email": deleted_email}
        )

    return {"message": "User deleted successfully"}


@router.post("/{user_id}/toggle-status")
async def toggle_user_status(
    user_id: str,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db),
    activity_log: Optional[ActivityLogService] = Depends(get_activity_log_service)
):
    """Enable or disable a user. Accessible by super-admins and administrators."""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        user = await db.users.find_one({"email": user_id})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    new_status = not user.get("is_active", True)
    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"is_active": new_status, "updated_at": datetime.utcnow()}}
    )

    # Log activity
    if activity_log:
        await activity_log.log(
            action="toggle_status",
            entity_type="user",
            entity_id=str(user["_id"]),
            user_email=current_user.email,
            details={"user_email": user.get("email"), "new_status": "active" if new_status else "inactive"}
        )

    return {"message": f"User {'enabled' if new_status else 'disabled'} successfully", "is_active": new_status}


@router.post("/{user_id}/send-password-reset")
async def send_password_reset_email(
    user_id: str,
    send_email: bool = Query(True, description="Whether to send the reset email"),
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db),
    email_service: Optional[EmailService] = Depends(get_email_service)
):
    """Send password reset email to a user. Accessible by super-admins and administrators."""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        user = await db.users.find_one({"email": user_id})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    reset_token = create_password_reset_token(user["email"])

    if send_email and email_service:
        try:
            await email_service.send_password_reset_email(
                user["email"],
                user.get("full_name", user["email"]),
                reset_token
            )
            print(f"Password reset email sent to {user['email']}")
        except Exception as e:
            print(f"Failed to send password reset email to {user['email']}: {e}")
        return {"message": "Password reset email sent"}
    else:
        return {"message": "Password reset token generated", "token": reset_token}


@router.post("/{user_id}/reset-password")
async def admin_reset_password(
    user_id: str,
    send_email: bool = Query(True, description="Whether to send email with new password"),
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db),
    email_service: Optional[EmailService] = Depends(get_email_service)
):
    """Admin reset user's password. Accessible by super-admins and administrators."""
    try:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
    except:
        user = await db.users.find_one({"email": user_id})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    temp_password = generate_temp_password()
    new_hash = get_password_hash(temp_password)

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.utcnow()}}
    )

    if email_service:
        try:
            await email_service.send_welcome_email(
                user["email"],
                user.get("full_name", user["email"]),
                temp_password
            )
            print(f"Password reset email with temp password sent to {user['email']}")
            return {"message": "Password reset and email sent"}
        except Exception as e:
            print(f"Failed to send password reset email to {user['email']}: {e}")
            return {"message": "Password reset but email delivery failed"}
    else:
        return {"message": "Password reset. Email service not configured."}
