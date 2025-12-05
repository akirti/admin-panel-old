"""
User management API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
from app.models import (
    UserCreate, UserUpdate, UserResponse, UserInDB, 
    UserPasswordReset, BulkUploadResult, PaginationMeta
)
from app.auth import (
    get_super_admin_user, get_password_hash, 
    generate_temp_password, create_password_reset_token
)
from app.database import get_database, COLLECTIONS
from app.services.email_service import email_service
import math

router = APIRouter(prefix="/users", tags=["Users"])


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
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """
    List all users with pagination and filtering.
    
    - **page**: Page number (0-indexed)
    - **limit**: Maximum number of records to return
    - **is_active**: Filter by active status
    - **search**: Search by email, username, or full_name
    """
    db = get_database()
    
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"username": {"$regex": search, "$options": "i"}},
            {"full_name": {"$regex": search, "$options": "i"}}
        ]
    
    # Get total count
    total = await db[COLLECTIONS["users"]].count_documents(query)
    
    # Get paginated data
    skip = page * limit
    cursor = db[COLLECTIONS["users"]].find(query).skip(skip).limit(limit).sort("created_at", -1)
    users = []
    async for user in cursor:
        user["_id"] = str(user["_id"])
        users.append(UserResponse(**user))
    
    return {
        "data": users,
        "pagination": create_pagination_meta(total, page, limit)
    }


@router.get("/count")
async def count_users(
    is_active: Optional[bool] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get total count of users."""
    db = get_database()
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    count = await db[COLLECTIONS["users"]].count_documents(query)
    return {"count": count}


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get a specific user by ID."""
    db = get_database()
    
    try:
        user = await db[COLLECTIONS["users"]].find_one({"_id": ObjectId(user_id)})
    except:
        user = await db[COLLECTIONS["users"]].find_one({"email": user_id})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user["_id"] = str(user["_id"])
    return UserResponse(**user)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """
    Create a new user.
    
    - **send_password_email**: If true, sends welcome email with password
    """
    db = get_database()
    
    # Check if email already exists
    existing = await db[COLLECTIONS["users"]].find_one({"email": user_data.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if username already exists
    existing = await db[COLLECTIONS["users"]].find_one({"username": user_data.username})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create user document
    user_dict = user_data.model_dump(exclude={"password", "send_password_email"})
    user_dict["password_hash"] = get_password_hash(user_data.password)
    user_dict["created_at"] = datetime.utcnow()
    user_dict["updated_at"] = datetime.utcnow()
    user_dict["last_login"] = None
    user_dict["is_super_admin"] = False
    
    result = await db[COLLECTIONS["users"]].insert_one(user_dict)
    user_dict["_id"] = str(result.inserted_id)
    
    # Send welcome email if requested
    if user_data.send_password_email:
        await email_service.send_welcome_email(
            user_data.email, user_data.full_name, user_data.password
        )
    
    return UserResponse(**user_dict)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_data: UserUpdate,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Update a user."""
    db = get_database()
    
    try:
        existing = await db[COLLECTIONS["users"]].find_one({"_id": ObjectId(user_id)})
    except:
        existing = await db[COLLECTIONS["users"]].find_one({"email": user_id})
    
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Track changes for notification
    changes = {}
    update_data = user_data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    
    # Check for role changes
    if "roles" in update_data and update_data["roles"] != existing.get("roles", []):
        changes["roles"] = {
            "old": existing.get("roles", []),
            "new": update_data["roles"]
        }
    
    # Check for group changes
    if "groups" in update_data and update_data["groups"] != existing.get("groups", []):
        changes["groups"] = {
            "old": existing.get("groups", []),
            "new": update_data["groups"]
        }
    
    # Check for customer changes
    if "customers" in update_data:
        old_customers = set(existing.get("customers", []))
        new_customers = set(update_data["customers"])
        customers_added = list(new_customers - old_customers)
        customers_removed = list(old_customers - new_customers)
        
        if customers_added or customers_removed:
            # Send customer notification
            await email_service.send_customer_association_notification(
                existing["email"],
                existing["full_name"],
                customers_added,
                customers_removed
            )
    
    # Check for active status change
    if "is_active" in update_data and update_data["is_active"] != existing.get("is_active"):
        changes["is_active"] = {
            "old": existing.get("is_active"),
            "new": update_data["is_active"]
        }
    
    # Update user
    await db[COLLECTIONS["users"]].update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )
    
    # Send notification if there were role/group/permission changes
    if changes:
        await email_service.send_role_change_notification(
            existing["email"],
            existing["full_name"],
            "account settings",
            changes
        )
    
    updated = await db[COLLECTIONS["users"]].find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return UserResponse(**updated)


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Delete a user."""
    db = get_database()
    
    try:
        result = await db[COLLECTIONS["users"]].delete_one({"_id": ObjectId(user_id)})
    except:
        result = await db[COLLECTIONS["users"]].delete_one({"email": user_id})
    
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {"message": "User deleted successfully"}


@router.post("/{user_id}/toggle-status")
async def toggle_user_status(
    user_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Enable or disable a user."""
    db = get_database()
    
    try:
        user = await db[COLLECTIONS["users"]].find_one({"_id": ObjectId(user_id)})
    except:
        user = await db[COLLECTIONS["users"]].find_one({"email": user_id})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    new_status = not user.get("is_active", True)
    await db[COLLECTIONS["users"]].update_one(
        {"_id": user["_id"]},
        {"$set": {"is_active": new_status, "updated_at": datetime.utcnow()}}
    )
    
    # Send notification
    await email_service.send_role_change_notification(
        user["email"],
        user["full_name"],
        "account status",
        {"is_active": {"old": user.get("is_active"), "new": new_status}}
    )
    
    return {"message": f"User {'enabled' if new_status else 'disabled'} successfully", "is_active": new_status}


@router.post("/{user_id}/send-password-reset")
async def send_password_reset_email(
    user_id: str,
    send_email: bool = Query(True, description="Whether to send the reset email"),
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """
    Send password reset email to a user.
    
    - **send_email**: If false, returns reset token without sending email
    """
    db = get_database()
    
    try:
        user = await db[COLLECTIONS["users"]].find_one({"_id": ObjectId(user_id)})
    except:
        user = await db[COLLECTIONS["users"]].find_one({"email": user_id})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    reset_token = create_password_reset_token(user["email"])
    
    if send_email:
        await email_service.send_password_reset_email(
            user["email"],
            user["full_name"],
            reset_token
        )
        return {"message": "Password reset email sent"}
    else:
        return {"message": "Password reset token generated", "token": reset_token}


@router.post("/{user_id}/reset-password")
async def admin_reset_password(
    user_id: str,
    send_email: bool = Query(True, description="Whether to send email with new password"),
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """
    Admin reset user's password.
    
    - **send_email**: If true, sends new password via email
    """
    db = get_database()
    
    try:
        user = await db[COLLECTIONS["users"]].find_one({"_id": ObjectId(user_id)})
    except:
        user = await db[COLLECTIONS["users"]].find_one({"email": user_id})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    temp_password = generate_temp_password()
    new_hash = get_password_hash(temp_password)
    
    await db[COLLECTIONS["users"]].update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.utcnow()}}
    )
    
    if send_email:
        await email_service.send_welcome_email(
            user["email"],
            user["full_name"],
            temp_password
        )
        return {"message": "Password reset and email sent"}
    else:
        return {"message": "Password reset", "temp_password": temp_password}
