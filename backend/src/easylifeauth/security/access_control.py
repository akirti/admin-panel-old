"""Async Access Control for FastAPI"""
from typing import Optional, List, Dict, Any
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from ..services.token_manager import TokenManager
from ..db.constants import EDITORS, ADMIN_ROLES, GROUP_ADMIN_ROLES
from ..errors.auth_error import AuthError


security = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    """Current user model"""
    user_id: str
    email: str
    roles: List[str] = []
    groups: List[str] = []
    domains: List[str] = []


class AccessControl:
    """Access control class for dependency injection"""
    
    def __init__(self, token_manager: TokenManager):
        self.token_manager = token_manager

    async def get_current_user(
        self,
        request: Request,
        credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
    ) -> CurrentUser:
        """Get current user from httpOnly cookie or JWT token"""
        token = request.cookies.get("access_token")
        if not token and credentials:
            token = credentials.credentials

        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"}
            )

        try:
            payload = await self.token_manager.verify_token(token)
            return CurrentUser(
                user_id=payload.get("user_id", ""),
                email=payload.get("email", ""),
                roles=payload.get("roles", []),
                groups=payload.get("groups", []),
                domains=payload.get("domains", [])
            )
        except AuthError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=e.message,
                headers={"WWW-Authenticate": "Bearer"}
            )

    def require_admin(self, current_user: CurrentUser) -> CurrentUser:
        """Require admin role"""
        if not any(r in ADMIN_ROLES for r in current_user.roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrator access required"
            )
        return current_user

    def require_super_admin(self, current_user: CurrentUser) -> CurrentUser:
        """Require super admin role"""
        if "super-administrator" not in current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Super Administrator access required"
            )
        return current_user

    def require_admin_or_editor(self, current_user: CurrentUser) -> CurrentUser:
        """Require admin or editor role"""
        if not any(r in EDITORS for r in current_user.roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrator/Editor access required"
            )
        return current_user

    def require_group_admin(self, current_user: CurrentUser) -> CurrentUser:
        """Require group admin role"""
        allowed_roles = ADMIN_ROLES + GROUP_ADMIN_ROLES
        if not any(r in allowed_roles for r in current_user.roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Group Administrator access required"
            )
        return current_user


# Global token_manager reference (set during app initialization)
_token_manager: Optional[TokenManager] = None


def set_token_manager(token_manager: TokenManager):
    """Set the global token manager"""
    global _token_manager
    _token_manager = token_manager


def get_token_manager() -> TokenManager:
    """Get the global token manager"""
    if _token_manager is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token manager not initialized"
        )
    return _token_manager


# Async dependency functions for FastAPI routes
async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> CurrentUser:
    """Dependency to get current user from httpOnly cookie or Authorization header"""
    # Try httpOnly cookie first, then fall back to Authorization header
    token = request.cookies.get("access_token")
    if not token and credentials:
        token = credentials.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token_manager = get_token_manager()

    try:
        payload = await token_manager.verify_token(token)
        return CurrentUser(
            user_id=payload.get("user_id", ""),
            email=payload.get("email", ""),
            roles=payload.get("roles", []),
            groups=payload.get("groups", []),
            domains=payload.get("domains", [])
        )
    except AuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=e.message,
            headers={"WWW-Authenticate": "Bearer"}
        )


def require_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Check if user has admin role"""
    if not any(r in ADMIN_ROLES for r in current_user.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required"
        )
    return current_user


def require_super_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Check if user has super admin role"""
    if "super-administrator" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super Administrator access required"
        )
    return current_user


def require_admin_or_editor(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Check if user has admin or editor role"""
    if not any(r in EDITORS for r in current_user.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator/Editor access required"
        )
    return current_user


def require_group_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Check if user has group admin role"""
    allowed_roles = ADMIN_ROLES + GROUP_ADMIN_ROLES
    if not any(r in allowed_roles for r in current_user.roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Group Administrator access required"
        )
    return current_user
