"""Async Admin Management Routes"""
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query

from .models import (
    UserResponse, MessageResponse, UserStatusUpdate,
    UserRoleUpdate, UserGroupUpdate, UserDomainUpdate,
    PaginatedUsersResponse
)
from .dependencies import get_current_user, get_admin_service
from ..services.admin_service import AdminService
from ..security.access_control import (
    CurrentUser, require_admin, require_super_admin, require_group_admin
)
from ..errors.auth_error import AuthError

router = APIRouter(prefix="/admin/management", tags=["Admin Management"])


@router.get("/users")
async def get_all_users(
    page: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    current_user: CurrentUser = Depends(require_group_admin),
    admin_service: AdminService = Depends(get_admin_service)
) -> Dict[str, Any]:
    """Get all users (with role-based filtering)"""
    try:
        result = await admin_service.get_all_users(
            current_user=current_user.model_dump(),
            pagination={"page": page, "limit": limit}
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: CurrentUser = Depends(require_group_admin),
    admin_service: AdminService = Depends(get_admin_service)
):
    """Get user by ID"""
    try:
        result = await admin_service.get_user_by_id(user_id)
        if not result:
            raise HTTPException(status_code=404, detail="User not found")
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put("/users/{user_id}/status", response_model=MessageResponse)
async def update_user_status(
    user_id: str,
    data: UserStatusUpdate,
    current_user: CurrentUser = Depends(require_group_admin),
    admin_service: AdminService = Depends(get_admin_service)
):
    """Activate/Deactivate user"""
    try:
        result = await admin_service.update_user_status(
            user_id=user_id,
            is_active=data.is_active,
            current_user=current_user.model_dump()
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put("/users/{user_id}/roles", response_model=MessageResponse)
async def update_user_roles(
    user_id: str,
    data: UserRoleUpdate,
    current_user: CurrentUser = Depends(require_group_admin),
    admin_service: AdminService = Depends(get_admin_service)
):
    """Update user roles"""
    try:
        result = await admin_service.update_user_role(
            user_id=user_id,
            roles=data.roles,
            current_user=current_user.model_dump()
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put("/users/{user_id}/groups", response_model=MessageResponse)
async def update_user_groups(
    user_id: str,
    data: UserGroupUpdate,
    current_user: CurrentUser = Depends(require_group_admin),
    admin_service: AdminService = Depends(get_admin_service)
):
    """Update user groups"""
    try:
        result = await admin_service.update_user_groups(
            user_id=user_id,
            groups=data.groups,
            current_user=current_user.model_dump()
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put("/users/{user_id}/domains", response_model=MessageResponse)
async def update_user_domains(
    user_id: str,
    data: UserDomainUpdate,
    current_user: CurrentUser = Depends(require_group_admin),
    admin_service: AdminService = Depends(get_admin_service)
):
    """Update user domains"""
    try:
        result = await admin_service.update_user_domains(
            user_id=user_id,
            domains=data.domains,
            current_user=current_user.model_dump()
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.delete("/users/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    admin_service: AdminService = Depends(get_admin_service)
):
    """Delete user (super-admin only)"""
    try:
        result = await admin_service.delete_user(
            user_id=user_id,
            current_user=current_user.model_dump()
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
