"""Async User Management Service"""
from typing import Dict, Any, List, Optional
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
from datetime import datetime, timezone

from ..db.db_manager import DatabaseManager
from .token_manager import TokenManager
from ..errors.auth_error import AuthError


class UserService:
    """Async User Management Service"""
    
    def __init__(self, db: DatabaseManager, token_manager: TokenManager):
        self.db = db
        self.token_manager = token_manager

    async def register_user(
        self,
        email: str,
        username: str,
        password: str,
        full_name: Optional[str] = None,
        roles: List[str] = None,
        groups: List[str] = None,
        domains: List[str] = None
    ) -> Dict[str, Any]:
        """Register new user"""
        if roles is None:
            roles = ["user"]
        if groups is None:
            groups = ["viewer"]
        if domains is None:
            domains = []
            
        # Validate data
        if not email or not username or not password:
            raise AuthError("Email, Username, Password are required", 400)
        
        if len(password) < 8:
            raise AuthError("Password must be at least 8 characters long", 400)
        
        # Validate if user already exists
        existing_user = await self.db.users.find_one({"email": email.lower()})
        if existing_user:
            raise AuthError("Email already exists", 409)
        
        user_data = {
            "email": email.lower(),
            "username": username,
            "password_hash": generate_password_hash(password),
            "full_name": full_name,
            "roles": roles,
            "groups": groups,
            "domains": domains,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "last_login": None
        }

        result = await self.db.users.insert_one(user_data)
        user_id = str(result.inserted_id)

        # Generate Token
        tokens = await self.token_manager.generate_tokens(
            user_id=user_id,
            email=email,
            roles=roles,
            groups=groups,
            domains=domains
        )

        return {
            "user_id": user_id,
            "email": email,
            "username": username,
            "full_name": full_name,
            "roles": roles,
            "groups": groups,
            "domains": domains,
            **tokens
        }

    async def login_user(self, email: str, password: str) -> Dict[str, Any]:
        """Login user"""
        if not email or not password:
            raise AuthError("Email and password are required", 400)
        
        # Find user
        user = await self.db.users.find_one({"email": email.lower()})
        if not user:
            raise AuthError("Invalid email or password", 401)
        
        if not user.get("is_active", False):
            raise AuthError("Account is Deactivated", 403)
        
        # Check password
        if not check_password_hash(user["password_hash"], password):
            raise AuthError("Invalid email or password", 401)
        
        await self.db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login": datetime.now(timezone.utc)}}
        )

        tokens = await self.token_manager.generate_tokens(
            user_id=str(user["_id"]),
            email=user["email"],
            roles=user.get("roles", []),
            groups=user.get("groups", []),
            domains=user.get("domains", [])
        )

        return {
            "user_id": str(user["_id"]),
            "email": str(user["email"]),
            "username": str(user.get("username", "")),
            "full_name": str(user.get("full_name", "")),
            "roles": user.get("roles", []),
            "groups": user.get("groups", []),
            "domains": user.get("domains", []),
            **tokens
        }

    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by user id"""
        try:
            user = await self.db.users.find_one({"_id": ObjectId(user_id)})
            if user:
                # Convert to proper format
                return {
                    "user_id": str(user["_id"]),
                    "email": user.get("email", ""),
                    "username": user.get("username", ""),
                    "full_name": user.get("full_name", ""),
                    "roles": user.get("roles", []),
                    "groups": user.get("groups", []),
                    "domains": user.get("domains", []),
                    "is_active": user.get("is_active", True),
                    "created_at": user.get("created_at"),
                    "updated_at": user.get("updated_at"),
                    "last_login": user.get("last_login")
                }
            return None
        except Exception:
            return None

    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email"""
        try:
            user = await self.db.users.find_one({"email": email.lower()})
            if user:
                user["_id"] = str(user["_id"])
                user.pop("password_hash", None)
                return user
            return None
        except Exception:
            return None

    async def update_user_data(self, user_id: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update user profile data"""
        allowed_attributes = ["full_name", "username"]
        updated_attributes = {k: v for k, v in update_data.items() if k in allowed_attributes}

        if not updated_attributes:
            raise AuthError("No valid attributes to update", 400)
        
        if "username" in updated_attributes:
            existing = await self.db.users.find_one({
                "username": updated_attributes["username"],
                "_id": {"$ne": ObjectId(user_id)}
            })
            if existing:
                raise AuthError("Username already taken", 409)
            
        updated_attributes["updated_at"] = datetime.now(timezone.utc)

        result = await self.db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": updated_attributes}
        )

        if result.matched_count == 0:
            raise AuthError("User not found", 404)
        
        user_data = await self.get_user_by_id(user_id)
        if not user_data:
            raise AuthError("User not found", 404)
        return user_data

    async def logout_user(self, user_id: str, email: str) -> Dict[str, str]:
        """Logout user by invalidating tokens"""
        await self.db.tokens.delete_many({"user_id": user_id, "email": email})
        return {"message": "Logged out successfully"}
