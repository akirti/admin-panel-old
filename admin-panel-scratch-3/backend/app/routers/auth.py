"""
Authentication API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import timedelta
from app.models import (
    LoginRequest, Token, UserResponse, UserPasswordChange, 
    UserPasswordReset, UserInDB
)
from app.auth import (
    authenticate_user, create_access_token, get_current_active_user,
    verify_password, get_password_hash, create_password_reset_token,
    verify_password_reset_token
)
from app.config import settings
from app.database import get_database, COLLECTIONS
from app.services.email_service import email_service
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
async def login(request: LoginRequest):
    """
    Authenticate user and return JWT token.
    
    - **email**: User's email address
    - **password**: User's password
    """
    user = await authenticate_user(request.email, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled",
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "is_super_admin": user.is_super_admin},
        expires_delta=access_token_expires
    )
    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Get current authenticated user's information."""
    return UserResponse(
        _id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        full_name=current_user.full_name,
        roles=current_user.roles,
        groups=current_user.groups,
        customers=current_user.customers,
        is_active=current_user.is_active,
        is_super_admin=current_user.is_super_admin,
        last_login=current_user.last_login,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at
    )


@router.post("/change-password")
async def change_password(
    request: UserPasswordChange,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Change current user's password."""
    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    db = get_database()
    new_hash = get_password_hash(request.new_password)
    await db[COLLECTIONS["users"]].update_one(
        {"email": current_user.email},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Password changed successfully"}


@router.post("/request-password-reset")
async def request_password_reset(request: UserPasswordReset):
    """
    Request a password reset link.
    
    - **email**: Email address to send reset link
    - **send_email**: Whether to send the reset email (default: true)
    """
    db = get_database()
    user = await db[COLLECTIONS["users"]].find_one({"email": request.email})
    
    if not user:
        # Don't reveal if user exists
        return {"message": "If the email exists, a password reset link will be sent"}
    
    if request.send_email:
        reset_token = create_password_reset_token(request.email)
        await email_service.send_password_reset_email(
            request.email,
            user.get("full_name", "User"),
            reset_token
        )
    
    return {"message": "If the email exists, a password reset link will be sent"}


@router.post("/reset-password")
async def reset_password(token: str, new_password: str):
    """
    Reset password using reset token.

    - **token**: Password reset token from email
    - **new_password**: New password (min 8 characters)
    """
    email = verify_password_reset_token(token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters"
        )

    db = get_database()
    new_hash = get_password_hash(new_password)
    result = await db[COLLECTIONS["users"]].update_one(
        {"email": email},
        {"$set": {"password_hash": new_hash, "updated_at": datetime.utcnow()}}
    )

    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return {"message": "Password reset successfully"}


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    username: str = None,
    full_name: str = None,
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    Update current user's profile information.

    - **username**: New username (optional)
    - **full_name**: New full name (optional)
    """
    db = get_database()
    update_data = {"updated_at": datetime.utcnow()}

    if username is not None:
        # Check if username is already taken by another user
        existing = await db[COLLECTIONS["users"]].find_one({
            "username": username,
            "email": {"$ne": current_user.email}
        })
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        update_data["username"] = username

    if full_name is not None:
        update_data["full_name"] = full_name

    await db[COLLECTIONS["users"]].update_one(
        {"email": current_user.email},
        {"$set": update_data}
    )

    # Get updated user
    updated_user = await db[COLLECTIONS["users"]].find_one({"email": current_user.email})

    return UserResponse(
        _id=str(updated_user["_id"]),
        email=updated_user["email"],
        username=updated_user["username"],
        full_name=updated_user["full_name"],
        roles=updated_user.get("roles", []),
        groups=updated_user.get("groups", []),
        customers=updated_user.get("customers", []),
        is_active=updated_user.get("is_active", True),
        is_super_admin=updated_user.get("is_super_admin", False),
        last_login=updated_user.get("last_login"),
        created_at=updated_user.get("created_at"),
        updated_at=updated_user.get("updated_at")
    )
