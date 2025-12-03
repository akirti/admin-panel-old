"""Tests for Token Manager"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId
import jwt

from easylifeauth.services.token_manager import TokenManager
from easylifeauth.errors.auth_error import AuthError


class TestTokenManager:
    """Tests for TokenManager"""

    @pytest.fixture
    def token_manager(self, mock_db):
        """Create token manager with mocks"""
        return TokenManager(secret_key="test_secret_key", db=mock_db)

    def test_generate_tokens_success(self, token_manager, mock_db):
        """Test generating tokens"""
        mock_db.tokens.find_one = AsyncMock(return_value=None)
        mock_db.tokens.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        
        # Mock sync_access_token as it's called during generate
        token_manager.sync_access_token = MagicMock(return_value=MagicMock())
        
        result = token_manager.generate_tokens(
            user_id="507f1f77bcf86cd799439011",
            email="test@example.com",
            roles=["user"]
        )
        
        assert "access_token" in result
        assert "refresh_token" in result
        assert "expires_in" in result

    def test_verify_token_success(self, token_manager, mock_db):
        """Test verifying valid token"""
        # Generate a valid token
        now = datetime.now(timezone.utc)
        payload = {
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "roles": ["user"],
            "iat": now,
            "exp": now + timedelta(minutes=15),
            "type": "access"
        }
        token = jwt.encode(payload, "test_secret_key", algorithm="HS256")
        
        # Mock backend validation
        mock_db.tokens.find_one = AsyncMock(return_value={
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "token_hash": token,
            "refresh_token_hash": "refresh_token",
            "expires_at": now + timedelta(hours=1)
        })
        
        token_manager.validate_backend_token = MagicMock(return_value={
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "token_hash": token,
            "refresh_token_hash": "refresh_token",
            "expires_at": now + timedelta(hours=1)
        })
        
        result = token_manager.verify_token(token, token_type="access")
        
        assert result["user_id"] == "507f1f77bcf86cd799439011"

    def test_verify_token_expired(self, token_manager):
        """Test verifying expired token"""
        # Generate an expired token
        now = datetime.now(timezone.utc)
        payload = {
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "roles": ["user"],
            "iat": now - timedelta(hours=2),
            "exp": now - timedelta(hours=1),
            "type": "access"
        }
        token = jwt.encode(payload, "test_secret_key", algorithm="HS256")
        
        with pytest.raises(AuthError) as exc_info:
            token_manager.verify_token(token)
        assert exc_info.value.status_code == 401

    def test_verify_token_invalid(self, token_manager):
        """Test verifying invalid token"""
        with pytest.raises(AuthError) as exc_info:
            token_manager.verify_token("invalid_token")
        assert exc_info.value.status_code == 401

    def test_verify_token_wrong_type(self, token_manager, mock_db):
        """Test verifying token with wrong type"""
        now = datetime.now(timezone.utc)
        payload = {
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "roles": ["user"],
            "iat": now,
            "exp": now + timedelta(minutes=15),
            "type": "refresh"  # Wrong type
        }
        token = jwt.encode(payload, "test_secret_key", algorithm="HS256")
        
        with pytest.raises(AuthError) as exc_info:
            token_manager.verify_token(token, token_type="access")
        assert exc_info.value.status_code == 401

    def test_verify_token_backend_validation_failed(self, token_manager, mock_db):
        """Test verifying token when backend validation fails"""
        now = datetime.now(timezone.utc)
        payload = {
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "roles": ["user"],
            "iat": now,
            "exp": now + timedelta(minutes=15),
            "type": "access"
        }
        token = jwt.encode(payload, "test_secret_key", algorithm="HS256")
        
        token_manager.validate_backend_token = MagicMock(return_value=None)
        
        with pytest.raises(AuthError) as exc_info:
            token_manager.verify_token(token)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_access_token_success(self, token_manager, mock_db, sample_user_data):
        """Test refreshing access token"""
        now = datetime.now(timezone.utc)
        payload = {
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "roles": ["user"],
            "iat": now,
            "exp": now + timedelta(hours=1),
            "type": "refresh"
        }
        refresh_token = jwt.encode(payload, "test_secret_key", algorithm="HS256")
        
        sample_user_data["_id"] = ObjectId(sample_user_data["_id"])
        mock_db.users.find_one = AsyncMock(return_value=sample_user_data)
        
        # Mock verify_token to return valid payload
        token_manager.verify_token = MagicMock(return_value=payload)
        token_manager.sync_access_token = MagicMock(return_value=MagicMock())
        
        result = await token_manager.refresh_access_token(refresh_token, mock_db)
        
        assert "access_token" in result

    @pytest.mark.asyncio
    async def test_refresh_access_token_user_not_found(self, token_manager, mock_db):
        """Test refreshing token when user not found"""
        now = datetime.now(timezone.utc)
        payload = {
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "roles": ["user"],
            "iat": now,
            "exp": now + timedelta(hours=1),
            "type": "refresh"
        }
        refresh_token = jwt.encode(payload, "test_secret_key", algorithm="HS256")
        
        mock_db.users.find_one = AsyncMock(return_value=None)
        token_manager.verify_token = MagicMock(return_value=payload)
        
        with pytest.raises(AuthError) as exc_info:
            await token_manager.refresh_access_token(refresh_token, mock_db)
        assert exc_info.value.status_code == 404

    def test_validate_backend_token_success(self, token_manager, mock_db):
        """Test validating backend token"""
        mock_db.tokens.find_one = MagicMock(return_value={
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "token_hash": "token",
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1)
        })
        
        result = token_manager.validate_backend_token(
            user_id="507f1f77bcf86cd799439011",
            email="test@example.com",
            token="token",
            type="access",
            db=mock_db
        )
        
        assert result is not None

    def test_validate_backend_token_insufficient_keys(self, token_manager, mock_db):
        """Test validating with insufficient keys"""
        result = token_manager.validate_backend_token(
            user_id=None,
            email=None,
            token="token",
            type="access",
            db=mock_db
        )
        
        assert result is None

    @pytest.mark.asyncio
    async def test_sync_access_token_insert(self, token_manager, mock_db):
        """Test syncing access token (new insert)"""
        mock_db.tokens.find_one = AsyncMock(return_value=None)
        mock_db.tokens.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        
        result = await token_manager.sync_access_token(
            user_id="507f1f77bcf86cd799439011",
            email="test@example.com",
            access_token="access_token",
            refresh_token="refresh_token",
            db=mock_db
        )
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_sync_access_token_update(self, token_manager, mock_db):
        """Test syncing access token (update existing)"""
        mock_db.tokens.find_one = AsyncMock(return_value={
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com"
        })
        mock_db.tokens.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        
        result = await token_manager.sync_access_token(
            user_id="507f1f77bcf86cd799439011",
            email="test@example.com",
            access_token="new_access_token",
            refresh_token="new_refresh_token",
            db=mock_db
        )
        
        assert result is not None
