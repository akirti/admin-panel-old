"""Async User Management Service"""
from typing import Dict, Any, List, Optional
from werkzeug.security import generate_password_hash, check_password_hash
from bson import ObjectId
from datetime import datetime, timezone
import hashlib
import secrets

from ..db.db_manager import DatabaseManager
from .token_manager import TokenManager
from ..errors.auth_error import AuthError


def verify_scrypt_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against a scrypt hash (Werkzeug format).
    Format: scrypt:32768:8:1$salt$hash
    """
    try:
        parts = hashed_password.split("$")
        if len(parts) != 3:
            return False

        method_params = parts[0]  # scrypt:32768:8:1
        salt = parts[1]
        stored_hash = parts[2]

        # Parse scrypt parameters
        method_parts = method_params.split(":")
        if method_parts[0] != "scrypt":
            return False

        n = int(method_parts[1])  # CPU/memory cost parameter (32768)
        r = int(method_parts[2])  # Block size (8)
        p = int(method_parts[3])  # Parallelization parameter (1)

        # Calculate key length from stored hash (hex encoded, so divide by 2)
        dklen = len(stored_hash) // 2

        # Derive key using scrypt with maxmem parameter to allow higher memory usage
        maxmem = 128 * n * r * p + 1024 * 1024  # Add 1MB overhead

        derived_key = hashlib.scrypt(
            plain_password.encode('utf-8'),
            salt=salt.encode('utf-8'),
            n=n,
            r=r,
            p=p,
            dklen=dklen,
            maxmem=maxmem
        )

        # Compare hashes
        computed_hash = derived_key.hex()
        return secrets.compare_digest(computed_hash, stored_hash)
    except Exception as e:
        print(f"Scrypt verification error: {e}")
        return False


def verify_bcrypt_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a bcrypt hash."""
    try:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        print(f"Bcrypt verification error: {e}")
        return False


def verify_password_multi(plain_password: str, hashed_password: str) -> bool:
    """
    Verify password supporting multiple hash formats:
    - pbkdf2 (werkzeug default)
    - scrypt (werkzeug alternative)
    - bcrypt (passlib)
    """
    if not hashed_password:
        return False

    # pbkdf2 format (werkzeug default): pbkdf2:sha256:...
    if hashed_password.startswith("pbkdf2:"):
        return check_password_hash(hashed_password, plain_password)

    # scrypt format (werkzeug): scrypt:32768:8:1$salt$hash
    if hashed_password.startswith("scrypt:"):
        return verify_scrypt_password(plain_password, hashed_password)

    # bcrypt format: $2b$... or $2a$... or $2y$...
    if hashed_password.startswith("$2"):
        return verify_bcrypt_password(plain_password, hashed_password)

    # Fallback: try werkzeug check_password_hash
    try:
        return check_password_hash(hashed_password, plain_password)
    except Exception as e:
        print(f"Password verification fallback error: {e}")
        return False


class UserService:
    """Async User Management Service"""

    def __init__(self, db: DatabaseManager, token_manager: TokenManager):
        self.db = db
        self.token_manager = token_manager

    async def resolve_user_domains(self, user: Dict[str, Any]) -> List[str]:
        """
        Resolve all domains a user has access to based on:
        1. Direct user domains
        2. Domains from user's roles
        3. Domains from user's groups
        """
        all_domains = set(user.get("domains", []))

        # Get domains from roles
        user_roles = user.get("roles", [])
        if user_roles:
            roles_cursor = self.db.roles.find({
                "$or": [
                    {"roleId": {"$in": user_roles}},
                    {"_id": {"$in": [ObjectId(r) if ObjectId.is_valid(r) else None for r in user_roles]}}
                ],
                "status": "active"
            })
            async for role in roles_cursor:
                role_domains = role.get("domains", [])
                all_domains.update(role_domains)

        # Get domains from groups
        user_groups = user.get("groups", [])
        if user_groups:
            groups_cursor = self.db.groups.find({
                "$or": [
                    {"groupId": {"$in": user_groups}},
                    {"_id": {"$in": [ObjectId(g) if ObjectId.is_valid(g) else None for g in user_groups]}}
                ],
                "status": "active"
            })
            async for group in groups_cursor:
                group_domains = group.get("domains", [])
                all_domains.update(group_domains)

        return list(all_domains)

    async def resolve_user_permissions(self, user: Dict[str, Any]) -> List[str]:
        """
        Resolve all permissions a user has based on:
        1. Permissions from user's roles
        2. Permissions from user's groups
        """
        all_permissions = set()

        # Get permissions from roles
        user_roles = user.get("roles", [])
        if user_roles:
            roles_cursor = self.db.roles.find({
                "$or": [
                    {"roleId": {"$in": user_roles}},
                    {"_id": {"$in": [ObjectId(r) if ObjectId.is_valid(r) else None for r in user_roles]}}
                ],
                "status": "active"
            })
            async for role in roles_cursor:
                role_permissions = role.get("permissions", [])
                all_permissions.update(role_permissions)

        # Get permissions from groups
        user_groups = user.get("groups", [])
        if user_groups:
            groups_cursor = self.db.groups.find({
                "$or": [
                    {"groupId": {"$in": user_groups}},
                    {"_id": {"$in": [ObjectId(g) if ObjectId.is_valid(g) else None for g in user_groups]}}
                ],
                "status": "active"
            })
            async for group in groups_cursor:
                group_permissions = group.get("permissions", [])
                all_permissions.update(group_permissions)

        return list(all_permissions)

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

        # Check password (supports bcrypt, pbkdf2, scrypt)
        if not verify_password_multi(password, user["password_hash"]):
            raise AuthError("Invalid email or password", 401)

        await self.db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login": datetime.now(timezone.utc)}}
        )

        # Resolve all domains from roles and groups
        resolved_domains = await self.resolve_user_domains(user)
        # Resolve all permissions from roles and groups
        resolved_permissions = await self.resolve_user_permissions(user)

        tokens = await self.token_manager.generate_tokens(
            user_id=str(user["_id"]),
            email=user["email"],
            roles=user.get("roles", []),
            groups=user.get("groups", []),
            domains=resolved_domains
        )

        return {
            "user_id": str(user["_id"]),
            "email": str(user["email"]),
            "username": str(user.get("username", "")),
            "full_name": str(user.get("full_name", "")),
            "roles": user.get("roles", []),
            "groups": user.get("groups", []),
            "customers": user.get("customers", []),
            "domains": resolved_domains,
            "permissions": resolved_permissions,
            **tokens
        }

    async def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by user id"""
        try:
            user = await self.db.users.find_one({"_id": ObjectId(user_id)})
            if user:
                # Resolve domains and permissions from roles/groups
                resolved_domains = await self.resolve_user_domains(user)
                resolved_permissions = await self.resolve_user_permissions(user)

                # Convert to proper format
                return {
                    "user_id": str(user["_id"]),
                    "email": user.get("email", ""),
                    "username": user.get("username", ""),
                    "full_name": user.get("full_name", ""),
                    "roles": user.get("roles", []),
                    "groups": user.get("groups", []),
                    "customers": user.get("customers", []),
                    "domains": resolved_domains,
                    "permissions": resolved_permissions,
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
