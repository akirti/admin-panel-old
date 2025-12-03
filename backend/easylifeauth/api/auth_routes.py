"""Async Authentication Routes"""
from fastapi import APIRouter, Depends, HTTPException, status, Request

from .models import (
    UserRegister, UserLogin, UserProfileUpdate,
    PasswordUpdate, PasswordReset, ForgotPassword, RefreshToken,
    AuthResponse, UserResponse, MessageResponse
)
from .dependencies import (
    get_current_user, get_user_service, get_password_service,
    get_token_manager, get_db
)
from ..services.user_service import UserService
from ..services.password_service import PasswordResetService
from ..services.token_manager import TokenManager
from ..security.access_control import CurrentUser
from ..errors.auth_error import AuthError

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserRegister,
    user_service: UserService = Depends(get_user_service)
):
    """Register a new user"""
    try:
        result = await user_service.register_user(
            email=user_data.email,
            username=user_data.username,
            password=user_data.password,
            full_name=user_data.full_name,
            roles=user_data.roles,
            groups=user_data.groups,
            domains=user_data.domains
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/login", response_model=AuthResponse)
async def login(
    credentials: UserLogin,
    user_service: UserService = Depends(get_user_service)
):
    """Login user"""
    try:
        result = await user_service.login_user(
            email=credentials.email,
            password=credentials.password
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(
    data: RefreshToken,
    token_manager: TokenManager = Depends(get_token_manager)
):
    """Refresh JWT Token using refresh_token (no auth required - access token may be expired)"""
    try:
        db = get_db()
        result = await token_manager.refresh_access_token(data.refresh_token, db)
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/profile", response_model=UserResponse)
async def get_profile(
    current_user: CurrentUser = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service)
):
    """Get current user profile"""
    try:
        result = await user_service.get_user_by_id(current_user.user_id)
        if not result:
            raise HTTPException(status_code=404, detail="User not found")
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    update_data: UserProfileUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service)
):
    """Update user profile"""
    try:
        result = await user_service.update_user_data(
            current_user.user_id,
            update_data.model_dump(exclude_unset=True)
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/forgot_password", response_model=MessageResponse)
async def forgot_password(
    data: ForgotPassword,
    request: Request,
    password_service: PasswordResetService = Depends(get_password_service)
):
    """Request password reset"""
    try:
        reset_url = data.reset_url or f"{request.base_url}reset-password"
        result = await password_service.request_password_reset(data.email, reset_url)
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/reset_password", response_model=MessageResponse)
async def reset_password(
    data: PasswordReset,
    password_service: PasswordResetService = Depends(get_password_service)
):
    """Reset password using token"""
    try:
        result = await password_service.reset_password(data.token, data.new_password)
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/update_password", response_model=AuthResponse)
async def update_password(
    data: PasswordUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    password_service: PasswordResetService = Depends(get_password_service)
):
    """Update password when logged in"""
    try:
        result = await password_service.update_user_password(
            email=current_user.email,
            password=data.password,
            new_password=data.new_password
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    current_user: CurrentUser = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service)
):
    """Logout user"""
    try:
        result = await user_service.logout_user(current_user.user_id, current_user.email)
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
