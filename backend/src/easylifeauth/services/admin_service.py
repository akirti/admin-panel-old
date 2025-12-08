"""Async Admin Management Service"""
from typing import Dict, List, Any, Optional
from bson import ObjectId
from datetime import datetime, timezone

from ..db.constants import ROLES, ADMIN_ROLES, GROUP_ADMIN_ROLES
from ..db.db_manager import DatabaseManager, distribute_limit
from ..errors.auth_error import AuthError


class AdminService:
    """Async Admin Management Service"""

    def __init__(self, db: DatabaseManager):
        self.db = db

    async def get_all_users(
        self,
        current_user: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Get all users with pagination and role-based filtering"""
        limit = 25
        skip = 0
        page = 0
        total = None
        pagination = kwargs.get("pagination", {})
        
        if "limit" in pagination:
            limit = int(pagination["limit"]) if isinstance(pagination["limit"], str) else pagination["limit"]
        if "skip" in pagination:
            skip = int(pagination["skip"]) if isinstance(pagination["skip"], str) else pagination["skip"]
        if "page" in pagination:
            page = int(pagination["page"]) if isinstance(pagination["page"], str) else pagination["page"]
            skip = page * limit
        if "total" in pagination:
            total = int(pagination["total"]) if isinstance(pagination["total"], str) else pagination["total"]

        # Build query based on user role
        query = {}
        if current_user:
            user_roles = current_user.get("roles", [])
            
            # Super admin sees everyone
            if "super-administrator" in user_roles:
                query = {}
            # Regular admin sees all except super-admin
            elif "administrator" in user_roles:
                query = {"roles": {"$nin": ["super-administrator"]}}
            # Group admin sees users in their groups/domains
            elif any(r in GROUP_ADMIN_ROLES for r in user_roles):
                user_groups = current_user.get("groups", [])
                user_domains = current_user.get("domains", [])
                query = {
                    "$or": [
                        {"groups": {"$in": user_groups}},
                        {"domains": {"$in": user_domains}}
                    ],
                    "roles": {"$nin": ADMIN_ROLES}
                }
            else:
                # Regular users can't see other users
                raise AuthError("Unauthorized access", 403)

        if total is None:
            total = await self.db.users.count_documents(query)
        
        pages = distribute_limit(limit=limit, size=total)
        next_pagination = {
            "page": page + 1,
            "skip": skip,
            "limit": limit,
            "total": total,
            "current": page,
            "pages": pages
        }

        users_cursor = self.db.users.find(
            query,
            {"password_hash": 0}
        ).skip(skip).limit(limit)
        
        users = await users_cursor.to_list(length=limit)
        for u in users:
            u["_id"] = str(u["_id"])
        
        return {"data": users, "pagination": next_pagination}

    async def update_user_status(
        self,
        user_id: str,
        is_active: bool,
        current_user: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Activate / Deactivate user"""
        # Get target user
        target_user = await self.db.users.find_one({"_id": ObjectId(user_id)})
        if not target_user:
            raise AuthError("User not found", 404)
        
        # Check permissions
        if current_user:
            self._check_user_management_permission(current_user, target_user)
        
        result = await self.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "is_active": is_active,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        if result.matched_count == 0:
            raise AuthError("User not found", 404)
        
        return {"message": f'User {"activated" if is_active else "deactivated"}'}

    async def update_user_role(
        self,
        user_id: str,
        roles: List[str],
        current_user: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Update user role"""
        invalid_roles = [r for r in roles if r not in ROLES]
        if invalid_roles:
            raise AuthError(f"Invalid roles: {invalid_roles}. Must be one of {ROLES}", 400)
        
        # Get target user
        target_user = await self.db.users.find_one({"_id": ObjectId(user_id)})
        if not target_user:
            raise AuthError("User not found", 404)
        
        # Check permissions
        if current_user:
            self._check_role_assignment_permission(current_user, target_user, roles)
        
        result = await self.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "roles": [r for r in roles if r in ROLES],
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        if result.matched_count == 0:
            raise AuthError("User not found", 404)
        
        return {"message": "User role updated successfully"}

    async def update_user_groups(
        self,
        user_id: str,
        groups: List[str],
        current_user: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Update user groups"""
        # Get target user
        target_user = await self.db.users.find_one({"_id": ObjectId(user_id)})
        if not target_user:
            raise AuthError("User not found", 404)
        
        # Check permissions
        if current_user:
            self._check_user_management_permission(current_user, target_user)
        
        result = await self.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "groups": groups,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        if result.matched_count == 0:
            raise AuthError("User not found", 404)
        
        return {"message": "User groups updated successfully"}

    async def update_user_domains(
        self,
        user_id: str,
        domains: List[str],
        current_user: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Update user domains"""
        # Get target user
        target_user = await self.db.users.find_one({"_id": ObjectId(user_id)})
        if not target_user:
            raise AuthError("User not found", 404)
        
        # Check permissions
        if current_user:
            self._check_user_management_permission(current_user, target_user)
            
            # Group admins can only assign their own domains
            user_roles = current_user.get("roles", [])
            if any(r in GROUP_ADMIN_ROLES for r in user_roles) and "administrator" not in user_roles:
                allowed_domains = current_user.get("domains", [])
                invalid_domains = [d for d in domains if d not in allowed_domains]
                if invalid_domains:
                    raise AuthError(f"Cannot assign domains: {invalid_domains}", 403)
        
        result = await self.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {
                "domains": domains,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        if result.matched_count == 0:
            raise AuthError("User not found", 404)
        
        return {"message": "User domains updated successfully"}

    def _check_user_management_permission(
        self,
        current_user: Dict[str, Any],
        target_user: Dict[str, Any]
    ) -> None:
        """Check if current user can manage target user"""
        user_roles = current_user.get("roles", [])
        target_roles = target_user.get("roles", [])
        
        # Super admin can manage anyone
        if "super-administrator" in user_roles:
            return
        
        # Admin can manage anyone except super-admin
        if "administrator" in user_roles:
            if "super-administrator" in target_roles:
                raise AuthError("Cannot manage super-administrator", 403)
            return
        
        # Group admin can only manage users in their groups/domains
        if any(r in GROUP_ADMIN_ROLES for r in user_roles):
            # Cannot manage admins
            if any(r in ADMIN_ROLES for r in target_roles):
                raise AuthError("Cannot manage administrators", 403)
            
            # Must share group or domain
            user_groups = set(current_user.get("groups", []))
            user_domains = set(current_user.get("domains", []))
            target_groups = set(target_user.get("groups", []))
            target_domains = set(target_user.get("domains", []))
            
            if not (user_groups & target_groups) and not (user_domains & target_domains):
                raise AuthError("Cannot manage users outside your groups/domains", 403)
            return
        
        raise AuthError("Unauthorized", 403)

    def _check_role_assignment_permission(
        self,
        current_user: Dict[str, Any],
        target_user: Dict[str, Any],
        new_roles: List[str]
    ) -> None:
        """Check if current user can assign these roles"""
        user_roles = current_user.get("roles", [])
        
        # Super admin can assign any role
        if "super-administrator" in user_roles:
            return
        
        # Admin can assign any role except super-admin
        if "administrator" in user_roles:
            if "super-administrator" in new_roles:
                raise AuthError("Cannot assign super-administrator role", 403)
            return
        
        # Group admin can only assign viewer, user, editor roles
        if any(r in GROUP_ADMIN_ROLES for r in user_roles):
            allowed_roles = ["viewer", "user", "editor"]
            invalid_roles = [r for r in new_roles if r not in allowed_roles]
            if invalid_roles:
                raise AuthError(f"Cannot assign roles: {invalid_roles}", 403)
            return
        
        raise AuthError("Unauthorized", 403)

    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID"""
        try:
            user = await self.db.users.find_one({"_id": ObjectId(user_id)})
            if user:
                user["_id"] = str(user["_id"])
                user.pop("password_hash", None)
                return user
            return None
        except Exception:
            return None

    async def delete_user(
        self,
        user_id: str,
        current_user: Optional[Dict[str, Any]] = None
    ) -> Dict[str, str]:
        """Delete user (super-admin only)"""
        if current_user:
            user_roles = current_user.get("roles", [])
            if "super-administrator" not in user_roles:
                raise AuthError("Only super-administrator can delete users", 403)
        
        # Get target user
        target_user = await self.db.users.find_one({"_id": ObjectId(user_id)})
        if not target_user:
            raise AuthError("User not found", 404)
        
        # Can't delete yourself
        if current_user and str(target_user["_id"]) == current_user.get("user_id"):
            raise AuthError("Cannot delete yourself", 400)
        
        result = await self.db.users.delete_one({"_id": ObjectId(user_id)})
        
        if result.deleted_count == 0:
            raise AuthError("User not found", 404)
        
        # Also delete user's tokens
        await self.db.tokens.delete_many({"user_id": user_id})
        
        return {"message": "User deleted successfully"}
