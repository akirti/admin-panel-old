"""
Authentication and authorization utilities.
"""
from datetime import datetime, timedelta
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from app.database import get_database, COLLECTIONS
from app.models import TokenData, UserInDB
import secrets
import hashlib
import base64

# Password hashing context - supports bcrypt (new) and scrypt (legacy)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer security scheme
security = HTTPBearer()


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
        # maxmem = 128 * n * r * p + overhead
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


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password (supports bcrypt and scrypt)."""
    # Check if it's a scrypt hash (Werkzeug format)
    if hashed_password.startswith("scrypt:"):
        return verify_scrypt_password(plain_password, hashed_password)
    
    # Otherwise, use bcrypt
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        print(f"Password verification error: {e}")
        return False


def get_password_hash(password: str) -> str:
    """Generate password hash (always uses bcrypt for new passwords)."""
    return pwd_context.hash(password)


def generate_temp_password() -> str:
    """Generate a temporary password."""
    return secrets.token_urlsafe(12)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_password_reset_token(email: str) -> str:
    """Create a password reset token."""
    expires = datetime.utcnow() + timedelta(hours=24)
    data = {"email": email, "exp": expires, "type": "password_reset"}
    return jwt.encode(data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_password_reset_token(token: str) -> Optional[str]:
    """Verify a password reset token and return the email."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "password_reset":
            return None
        return payload.get("email")
    except JWTError:
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> UserInDB:
    """Get the current authenticated user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = TokenData(user_id=user_id, email=payload.get("email"))
    except JWTError:
        raise credentials_exception
    
    db = get_database()
    user = await db[COLLECTIONS["users"]].find_one({"email": token_data.email})
    if user is None:
        raise credentials_exception
    
    # Convert ObjectId to string
    user["_id"] = str(user["_id"])
    return UserInDB(**user)


async def get_current_active_user(
    current_user: UserInDB = Depends(get_current_user)
) -> UserInDB:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_super_admin_user(
    current_user: UserInDB = Depends(get_current_active_user)
) -> UserInDB:
    """Require super admin user."""
    if not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required"
        )
    return current_user


# Alias for backward compatibility
get_current_super_admin = get_super_admin_user


async def authenticate_user(email: str, password: str) -> Optional[UserInDB]:
    """Authenticate a user by email and password."""
    db = get_database()
    user = await db[COLLECTIONS["users"]].find_one({"email": email})
    if not user:
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    
    # Update last login
    await db[COLLECTIONS["users"]].update_one(
        {"email": email},
        {"$set": {"last_login": datetime.utcnow()}}
    )
    
    user["_id"] = str(user["_id"])
    return UserInDB(**user)
