"""Async JWT Token Management Service"""
import os
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta, timezone
import jwt
from bson import ObjectId

from ..errors.auth_error import AuthError
from ..db.db_manager import DatabaseManager


class TokenManager:
    """Async JWT Token Management"""
    
    def __init__(
        self, 
        secret_key: str, 
        algorithm: str = 'HS256', 
        db: Optional[DatabaseManager] = None
    ):
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.db = db
        
        timeout = int(os.environ.get("EASYLIFE.SPECS.AUTH.TOKEN_TIMEOUT", 15))
        self.access_token_expires = timedelta(minutes=timeout)
        self.refresh_token_expires = timedelta(minutes=timeout * 4)

    async def sync_access_token(
        self,
        user_id: str,
        email: str,
        access_token: str,
        refresh_token: str,
        db: Optional[DatabaseManager] = None
    ) -> Any:
        """Sync Token in DB"""
        if db is None:
            db = self.db
        
        result = await db.tokens.find_one({"user_id": user_id, "email": email})
        now = datetime.now(timezone.utc)
        
        if result is None:
            out = await db.tokens.insert_one({
                "user_id": user_id,
                "email": email,
                "token_hash": access_token,
                "refresh_token_hash": refresh_token,
                "initated_at": now,
                "expires_at": now + self.refresh_token_expires,
                "type": 'access',
                "expires_in": int(self.access_token_expires.total_seconds()),
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "active": "Y"
            })
        else:
            out = await db.tokens.update_one(
                {"user_id": user_id, "email": email},
                {"$set": {
                    "token_hash": access_token,
                    "refresh_token_hash": refresh_token,
                    "initated_at": now,
                    "expires_at": now + self.refresh_token_expires,
                    "type": 'refresh',
                    "expires_in": int(self.access_token_expires.total_seconds()),
                    "updated_at": datetime.now(timezone.utc),
                    "active": "Y"
                }}
            )
        return out

    async def validate_backend_token(
        self,
        user_id: str,
        email: str,
        token: str,
        token_type: str = "access",
        db: Optional[DatabaseManager] = None
    ) -> Optional[Dict[str, Any]]:
        """Validate token sanity from backend"""
        query = {}
        if db is None:
            db = self.db
        
        if user_id is not None:
            query["user_id"] = user_id
        if email is not None:
            query["email"] = email
        
        token_key = "refresh_token_hash" if token_type == "refresh" else "token_hash"
        query[token_key] = token
        
        valid_keys = ["_id", "user_id", "email", "refresh_token_hash", "token_hash"]
        if len([k for k in query.keys() if k in valid_keys]) >= 3:
            query["expires_at"] = {"$gt": datetime.now(timezone.utc)}
            result = await db.tokens.find_one(query)
            return result
        return None

    async def generate_tokens(
        self,
        user_id: str,
        email: str,
        roles: Optional[List[str]] = None,
        groups: Optional[List[str]] = None,
        domains: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Generate access and refresh tokens"""
        now = datetime.now(timezone.utc)
        
        # Access token payload
        access_payload = {
            "user_id": user_id,
            "email": email,
            "roles": roles or [],
            "groups": groups or [],
            "domains": domains or [],
            "iat": now,
            "exp": now + self.access_token_expires,
            "type": 'access'
        }

        # Refresh token payload
        refresh_payload = {
            "user_id": user_id,
            "email": email,
            "roles": roles or [],
            "groups": groups or [],
            "domains": domains or [],
            "iat": now,
            "exp": now + self.refresh_token_expires,
            "type": 'refresh'
        }

        access_token = jwt.encode(access_payload, self.secret_key, algorithm=self.algorithm)
        refresh_token = jwt.encode(refresh_payload, self.secret_key, algorithm=self.algorithm)

        await self.sync_access_token(user_id, email, access_token, refresh_token, self.db)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": int(self.access_token_expires.total_seconds())
        }

    async def verify_token(self, token: str, token_type: str = "access") -> Dict[str, Any]:
        """Verify and decode token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            if payload.get("type") != token_type:
                raise AuthError("Invalid token type", 401)
            
            backend_payload = await self.validate_backend_token(
                user_id=payload.get("user_id"),
                email=payload.get("email"),
                token=token,
                token_type=payload.get("type"),
                db=self.db
            )
            
            if backend_payload is None:
                raise AuthError("Backend payload is None - Invalid token", 401)
            
            valid = False
            if payload["user_id"] == backend_payload["user_id"] and payload["email"] == backend_payload["email"]:
                # Match token hash based on type (PyJWT already validates expiry)
                if token_type == "access" and token == backend_payload["token_hash"] and payload.get("type") == token_type:
                    valid = True
                elif token_type == "refresh" and token == backend_payload["refresh_token_hash"] and payload.get("type") == token_type:
                    valid = True
            
            if valid:
                return payload
            else:
                raise AuthError("Invalid token type", 401)
                
        except jwt.ExpiredSignatureError as ese:
            raise AuthError(f"Token has expired ({str(ese.__cause__)})", 401) from ese
        except jwt.InvalidTokenError as ite:
            raise AuthError(f"Invalid token ({str(ite.__cause__)})", 401) from ite

    async def refresh_access_token(self, refresh_token: str, db: DatabaseManager) -> Dict[str, Any]:
        """Generate new access token using refresh token"""
        payload = await self.verify_token(refresh_token, token_type="refresh")
        
        # Get user from DB
        user = await db.users.find_one({"_id": ObjectId(payload["user_id"])})
        
        if not user:
            raise AuthError("User not found", 404)
        
        return await self.generate_tokens(
            str(user["_id"]),
            user["email"],
            user.get("roles", []),
            user.get("groups", []),
            user.get("domains", [])
        )

    def decode_token(self, token: str) -> Dict[str, Any]:
        """Decode token without verification (for getting user info)"""
        try:
            return jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
        except jwt.InvalidTokenError:
            return {}
