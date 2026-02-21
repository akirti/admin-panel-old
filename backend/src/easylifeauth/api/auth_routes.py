"""Async Authentication Routes"""
import os
from typing import Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response

from .models import (
    UserRegister, UserLogin, UserProfileUpdate,
    PasswordUpdate, PasswordReset, ForgotPassword, RefreshToken,
    AuthResponse, UserResponse, MessageResponse
)
from .dependencies import (
    get_current_user, get_user_service, get_password_service,
    get_token_manager, get_db, get_activity_log_service
)
from ..services.user_service import UserService
from ..services.password_service import PasswordResetService
from ..services.token_manager import TokenManager
from ..services.activity_log_service import ActivityLogService
from ..security.access_control import CurrentUser
from ..errors.auth_error import AuthError
from ..middleware.csrf import get_csrf_token

_is_dev = os.environ.get("ENV", "development").lower() in ("development", "dev")

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set httpOnly auth cookies on the response."""
    secure = not _is_dev
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=900,  # 15 minutes
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=86400,  # 24 hours
        path="/api/v1/auth/refresh",
    )


def _clear_auth_cookies(response: Response) -> None:
    """Clear httpOnly auth cookies."""
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/api/v1/auth/refresh")


@router.get("/csrf-token")
async def csrf_token(request: Request) -> Dict[str, str]:
    """Get CSRF token for the current session

    The CSRF middleware automatically sets a cookie on GET requests.
    This endpoint returns the token value so the frontend can include it in
    X-CSRF-Token headers for POST/PUT/DELETE requests.

    On first call, the cookie may not be in the request yet, but it will be
    set in the response. Subsequent calls will have the cookie available.
    """
    token = get_csrf_token(request)
    if token:
        return {"csrf_token": token}

    # If no token in request yet, it means this is the first call
    # The middleware will set the cookie in the response
    # Return a message indicating the client should retry
    return {
        "csrf_token": "",
        "message": "CSRF cookie set, please retry to get token"
    }


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserRegister,
    response: Response,
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

        # Set httpOnly cookies
        _set_auth_cookies(response, result["access_token"], result["refresh_token"])

        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/login", response_model=AuthResponse)
async def login(
    credentials: UserLogin,
    response: Response,
    user_service: UserService = Depends(get_user_service),
    activity_log: Optional[ActivityLogService] = Depends(get_activity_log_service)
):
    """Login user"""
    try:
        result = await user_service.login_user(
            email=credentials.email,
            password=credentials.password
        )

        # Set httpOnly cookies
        _set_auth_cookies(response, result["access_token"], result["refresh_token"])

        # Log successful login
        if activity_log and result.get("user"):
            await activity_log.log(
                action="login",
                entity_type="auth",
                entity_id=str(result["user"].get("_id", credentials.email)),
                user_email=credentials.email,
                details={"success": True}
            )

        return result
    except AuthError as e:
        # Log failed login attempt
        if activity_log:
            await activity_log.log(
                action="login_failed",
                entity_type="auth",
                entity_id=credentials.email,
                user_email=credentials.email,
                details={"error": e.message}
            )
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(
    request: Request,
    response: Response,
    data: Optional[RefreshToken] = None,
    token_manager: TokenManager = Depends(get_token_manager)
):
    """Refresh JWT Token using refresh_token from cookie or body (no auth required)"""
    try:
        # Try cookie first, then request body
        refresh = request.cookies.get("refresh_token")
        if not refresh and data:
            refresh = data.refresh_token

        if not refresh:
            raise AuthError("No refresh token provided", 401)

        db = get_db()
        result = await token_manager.refresh_access_token(refresh, db)

        # Set new httpOnly cookies
        _set_auth_cookies(response, result["access_token"], result["refresh_token"])

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
    response: Response,
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

        # Set new httpOnly cookies with updated tokens
        if result.get("access_token") and result.get("refresh_token"):
            _set_auth_cookies(response, result["access_token"], result["refresh_token"])

        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    response: Response,
    current_user: CurrentUser = Depends(get_current_user),
    user_service: UserService = Depends(get_user_service)
):
    """Logout user"""
    try:
        result = await user_service.logout_user(current_user.user_id, current_user.email)
        # Clear httpOnly auth cookies
        _clear_auth_cookies(response)
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
