"""Async Password Reset Service"""
from typing import Dict, Any, Optional
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from werkzeug.security import generate_password_hash, check_password_hash

from ..db.db_manager import DatabaseManager
from .token_manager import TokenManager
from .email_service import EmailService
from ..errors.auth_error import AuthError


class PasswordResetService:
    """Async Password Reset Service"""

    def __init__(
        self,
        db: DatabaseManager,
        token_manager: TokenManager,
        email_service: Optional[EmailService] = None
    ):
        self.db = db
        self.token_manager = token_manager
        self.email_service = email_service

    async def request_password_reset(
        self,
        email: str,
        reset_url: str
    ) -> Dict[str, str]:
        """Request password reset"""
        user = await self.db.users.find_one({"email": email.lower()})

        if not user:
            # Return same message to prevent email enumeration
            return {"message": "If email exists, reset link has been sent"}
        
        reset_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(reset_token.encode()).hexdigest()

        reset_data = {
            "user_id": user["_id"],
            "token_hash": token_hash,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1)
        }

        await self.db.reset_tokens.insert_one(reset_data)
        
        # Send email
        if self.email_service:
            try:
                await self.email_service.send_reset_email(email, reset_token, reset_url)
            except Exception as e:
                print(f"Failed to send email: {e}")

        return {"message": "If email exists, reset link has been sent"}

    async def reset_password(
        self,
        token: str,
        new_password: str
    ) -> Dict[str, str]:
        """Reset password using token"""
        if len(new_password) < 8:
            raise AuthError("Password must be at least 8 characters long", 400)
        
        # Hash token
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        # Find reset token
        exp_at = datetime.now(timezone.utc)
        
        reset_record = await self.db.reset_tokens.find_one({
            "token_hash": token_hash,
            "expires_at": {"$gt": exp_at}
        })
        
        if not reset_record:
            raise AuthError("Invalid or expired token", 400)
        
        # Update password
        password_hash = generate_password_hash(new_password)

        result = await self.db.users.update_one(
            {"_id": reset_record["user_id"]},
            {"$set": {
                "password_hash": password_hash,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        
        if result.matched_count == 0:
            raise AuthError("User not found", 400)
        
        # Delete all reset tokens for this user (invalidate any outstanding tokens)
        await self.db.reset_tokens.delete_many({"user_id": reset_record["user_id"]})
        
        return {"message": "Password reset successfully"}

    async def update_user_password(
        self,
        email: str,
        password: str,
        new_password: str
    ) -> Dict[str, Any]:
        """Update user password (authenticated)"""
        if not email or not password or not new_password:
            raise AuthError("Email and passwords are required", 400)
        
        if len(new_password) < 8:
            raise AuthError("New password must be at least 8 characters long", 400)
        
        # Find user
        user = await self.db.users.find_one({"email": email.lower()})
        if not user:
            raise AuthError("Invalid email or password", 401)
        
        # Check current password
        if not check_password_hash(user["password_hash"], password):
            raise AuthError("Invalid email or password", 401)
        
        # Update password
        await self.db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "last_login": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
                "password_hash": generate_password_hash(new_password)
            }}
        )

        # Generate new tokens
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
            **tokens
        }
