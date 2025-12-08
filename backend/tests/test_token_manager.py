"""Tests for Token Manager"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
import jwt

from easylifeauth.services.token_manager import TokenManager
from easylifeauth.errors.auth_error import AuthError


class TestTokenManager:
    """Tests for TokenManager"""

    @pytest.fixture
    def mock_db(self):
        """Create mock database"""
        db = MagicMock()
        db.tokens = MagicMock()
        db.tokens.find_one = AsyncMock(return_value=None)
        db.tokens.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        db.tokens.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        db.users = MagicMock()
        db.users.find_one = AsyncMock(return_value=None)
        return db

    @pytest.fixture
    def token_manager(self, mock_db):
        """Create token manager with mocks"""
        return TokenManager(secret_key="test_secret_key", db=mock_db)

    @pytest.mark.asyncio
    async def test_generate_tokens_success(self, token_manager, mock_db):
        """Test generating tokens"""
        result = await token_manager.generate_tokens(
            user_id="507f1f77bcf86cd799439011",
            email="test@example.com",
            roles=["user"]
        )

        assert "access_token" in result
        assert "refresh_token" in result
        assert "expires_in" in result

    @pytest.mark.asyncio
    async def test_generate_tokens_with_groups_and_domains(self, token_manager, mock_db):
        """Test generating tokens with groups and domains"""
        result = await token_manager.generate_tokens(
            user_id="507f1f77bcf86cd799439011",
            email="test@example.com",
            roles=["admin"],
            groups=["administrators"],
            domains=["domain1"]
        )

        assert "access_token" in result
        assert "refresh_token" in result

    @pytest.mark.asyncio
    async def test_verify_token_success(self, token_manager, mock_db):
        """Test verifying valid token"""
        now = datetime.now(timezone.utc)
        payload = {
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "roles": ["user"],
            "groups": [],
            "domains": [],
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

        result = await token_manager.verify_token(token, token_type="access")
        assert result["user_id"] == "507f1f77bcf86cd799439011"

    @pytest.mark.asyncio
    async def test_verify_token_expired(self, token_manager):
        """Test verifying expired token"""
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
            await token_manager.verify_token(token)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_verify_token_invalid(self, token_manager):
        """Test verifying invalid token"""
        with pytest.raises(AuthError) as exc_info:
            await token_manager.verify_token("invalid_token")
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_verify_token_wrong_type(self, token_manager, mock_db):
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
            await token_manager.verify_token(token, token_type="access")
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_verify_token_backend_validation_failed(self, token_manager, mock_db):
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

        # Return None from backend validation (no token found)
        mock_db.tokens.find_one = AsyncMock(return_value=None)

        with pytest.raises(AuthError) as exc_info:
            await token_manager.verify_token(token)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_access_token_success(self, token_manager, mock_db):
        """Test refreshing access token - mock verify_token to isolate test"""
        sample_user_data = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "roles": ["user"],
            "groups": ["viewer"],
            "domains": []
        }

        mock_db.users.find_one = AsyncMock(return_value=sample_user_data)
        mock_db.tokens.find_one = AsyncMock(return_value=None)
        mock_db.tokens.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        mock_db.tokens.update_one = AsyncMock(return_value=MagicMock(matched_count=1))

        # Mock verify_token to return valid payload
        async def mock_verify_token(token, token_type="access"):
            return {
                "user_id": "507f1f77bcf86cd799439011",
                "email": "test@example.com",
                "roles": ["user"],
                "type": "refresh"
            }

        token_manager.verify_token = mock_verify_token

        result = await token_manager.refresh_access_token("fake_refresh_token", mock_db)
        assert "access_token" in result

    @pytest.mark.asyncio
    async def test_refresh_access_token_user_not_found(self, token_manager, mock_db):
        """Test refreshing token when user not found - mock verify_token"""
        mock_db.users.find_one = AsyncMock(return_value=None)

        # Mock verify_token to return valid payload
        async def mock_verify_token(token, token_type="access"):
            return {
                "user_id": "507f1f77bcf86cd799439011",
                "email": "test@example.com",
                "roles": ["user"],
                "type": "refresh"
            }

        token_manager.verify_token = mock_verify_token

        with pytest.raises(AuthError) as exc_info:
            await token_manager.refresh_access_token("fake_refresh_token", mock_db)
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_validate_backend_token_success(self, token_manager, mock_db):
        """Test validating backend token"""
        now = datetime.now(timezone.utc)
        mock_db.tokens.find_one = AsyncMock(return_value={
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "token_hash": "token",
            "expires_at": now + timedelta(hours=1)
        })

        result = await token_manager.validate_backend_token(
            user_id="507f1f77bcf86cd799439011",
            email="test@example.com",
            token="token",
            token_type="access",
            db=mock_db
        )

        assert result is not None

    @pytest.mark.asyncio
    async def test_validate_backend_token_insufficient_keys(self, token_manager, mock_db):
        """Test validating with insufficient keys"""
        result = await token_manager.validate_backend_token(
            user_id=None,
            email=None,
            token="token",
            token_type="access",
            db=mock_db
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_validate_backend_token_refresh_type(self, token_manager, mock_db):
        """Test validating refresh token type"""
        now = datetime.now(timezone.utc)
        mock_db.tokens.find_one = AsyncMock(return_value={
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "refresh_token_hash": "refresh_token",
            "expires_at": now + timedelta(hours=1)
        })

        result = await token_manager.validate_backend_token(
            user_id="507f1f77bcf86cd799439011",
            email="test@example.com",
            token="refresh_token",
            token_type="refresh",
            db=mock_db
        )

        assert result is not None

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
        mock_db.tokens.insert_one.assert_called_once()

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
        mock_db.tokens.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_sync_access_token_uses_default_db(self, token_manager, mock_db):
        """Test syncing access token uses default db when not provided"""
        mock_db.tokens.find_one = AsyncMock(return_value=None)
        mock_db.tokens.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))

        result = await token_manager.sync_access_token(
            user_id="507f1f77bcf86cd799439011",
            email="test@example.com",
            access_token="access_token",
            refresh_token="refresh_token",
            db=None  # Uses default self.db
        )

        assert result is not None

    def test_decode_token_success(self, token_manager):
        """Test decoding valid token without verification"""
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

        result = token_manager.decode_token(token)
        assert result["user_id"] == "507f1f77bcf86cd799439011"

    def test_decode_token_invalid(self, token_manager):
        """Test decoding invalid token returns empty dict"""
        result = token_manager.decode_token("invalid_token")
        assert result == {}

    def test_decode_token_wrong_secret(self, token_manager):
        """Test decoding token with wrong secret returns empty dict"""
        now = datetime.now(timezone.utc)
        payload = {
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "type": "access"
        }
        token = jwt.encode(payload, "wrong_secret", algorithm="HS256")

        result = token_manager.decode_token(token)
        assert result == {}
