"""Tests for Token Manager"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
import jwt

from easylifeauth.services.token_manager import TokenManager
from easylifeauth.errors.auth_error import AuthError
from mock_data import MOCK_EMAIL
OID_9011 = "507f1f77bcf86cd799439011"
STR_HS256 = "HS256"
TEST_ISSUER = "easylife-auth"
TEST_AUDIENCE = "easylife-api"
TEST_SECRET_KEY = "test_secret_key"
ACCESS_TOKEN = "access_token"
REFRESH_TOKEN = "refresh_token"
TYPE_ACCESS = "access"
TYPE_REFRESH = "refresh"
ROLE_USER = "user"



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
        return TokenManager(
            secret_key=TEST_SECRET_KEY,
            db=mock_db,
            issuer=TEST_ISSUER,
            audience=TEST_AUDIENCE
        )

    @pytest.mark.asyncio
    async def test_generate_tokens_success(self, token_manager, mock_db):
        """Test generating tokens"""
        result = await token_manager.generate_tokens(
            user_id=OID_9011,
            email=MOCK_EMAIL,
            roles=[ROLE_USER]
        )

        assert ACCESS_TOKEN in result
        assert REFRESH_TOKEN in result
        assert "expires_in" in result

    @pytest.mark.asyncio
    async def test_generate_tokens_with_groups_and_domains(self, token_manager, mock_db):
        """Test generating tokens with groups and domains"""
        result = await token_manager.generate_tokens(
            user_id=OID_9011,
            email=MOCK_EMAIL,
            roles=["admin"],
            groups=["administrators"],
            domains=["domain1"]
        )

        assert ACCESS_TOKEN in result
        assert REFRESH_TOKEN in result

    @pytest.mark.asyncio
    async def test_generate_tokens_include_standard_claims(self, token_manager, mock_db):
        """Test that generated tokens include sub, iss, aud standard claims"""
        result = await token_manager.generate_tokens(
            user_id=OID_9011,
            email=MOCK_EMAIL,
            roles=[ROLE_USER]
        )

        # Decode without verification to inspect claims
        access_payload = jwt.decode(
            result[ACCESS_TOKEN], TEST_SECRET_KEY,
            algorithms=[STR_HS256], audience=TEST_AUDIENCE, issuer=TEST_ISSUER
        )
        assert access_payload["sub"] == ACCESS_TOKEN
        assert access_payload["iss"] == TEST_ISSUER
        assert access_payload["aud"] == TEST_AUDIENCE

        refresh_payload = jwt.decode(
            result[REFRESH_TOKEN], TEST_SECRET_KEY,
            algorithms=[STR_HS256], audience=TEST_AUDIENCE, issuer=TEST_ISSUER
        )
        assert refresh_payload["sub"] == REFRESH_TOKEN
        assert refresh_payload["iss"] == TEST_ISSUER
        assert refresh_payload["aud"] == TEST_AUDIENCE

    @pytest.mark.asyncio
    async def test_verify_token_success(self, token_manager, mock_db):
        """Test verifying valid token"""
        now = datetime.now(timezone.utc)
        payload = {
            "sub": ACCESS_TOKEN,
            "iss": TEST_ISSUER,
            "aud": TEST_AUDIENCE,
            "user_id": OID_9011,
            "email": MOCK_EMAIL,
            "roles": [ROLE_USER],
            "groups": [],
            "domains": [],
            "iat": now,
            "exp": now + timedelta(minutes=15),
            "type": TYPE_ACCESS
        }
        token = jwt.encode(payload, TEST_SECRET_KEY, algorithm=STR_HS256)

        # Mock backend validation
        mock_db.tokens.find_one = AsyncMock(return_value={
            "user_id": OID_9011,
            "email": MOCK_EMAIL,
            "token_hash": token,
            "refresh_token_hash": REFRESH_TOKEN,
            "expires_at": now + timedelta(hours=1)
        })

        result = await token_manager.verify_token(token, token_type=TYPE_ACCESS)
        assert result["user_id"] == OID_9011

    @pytest.mark.asyncio
    async def test_verify_token_expired(self, token_manager):
        """Test verifying expired token"""
        now = datetime.now(timezone.utc)
        payload = {
            "sub": ACCESS_TOKEN,
            "iss": TEST_ISSUER,
            "aud": TEST_AUDIENCE,
            "user_id": OID_9011,
            "email": MOCK_EMAIL,
            "roles": [ROLE_USER],
            "iat": now - timedelta(hours=2),
            "exp": now - timedelta(hours=1),
            "type": TYPE_ACCESS
        }
        token = jwt.encode(payload, TEST_SECRET_KEY, algorithm=STR_HS256)

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
            "sub": REFRESH_TOKEN,
            "iss": TEST_ISSUER,
            "aud": TEST_AUDIENCE,
            "user_id": OID_9011,
            "email": MOCK_EMAIL,
            "roles": [ROLE_USER],
            "iat": now,
            "exp": now + timedelta(minutes=15),
            "type": TYPE_REFRESH  # Wrong type
        }
        token = jwt.encode(payload, TEST_SECRET_KEY, algorithm=STR_HS256)

        with pytest.raises(AuthError) as exc_info:
            await token_manager.verify_token(token, token_type=TYPE_ACCESS)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_verify_token_wrong_audience(self, token_manager, mock_db):
        """Test verifying token with wrong audience is rejected"""
        now = datetime.now(timezone.utc)
        payload = {
            "sub": ACCESS_TOKEN,
            "iss": TEST_ISSUER,
            "aud": "wrong-audience",
            "user_id": OID_9011,
            "email": MOCK_EMAIL,
            "roles": [ROLE_USER],
            "iat": now,
            "exp": now + timedelta(minutes=15),
            "type": TYPE_ACCESS
        }
        token = jwt.encode(payload, TEST_SECRET_KEY, algorithm=STR_HS256)

        with pytest.raises(AuthError) as exc_info:
            await token_manager.verify_token(token, token_type=TYPE_ACCESS)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_verify_token_wrong_issuer(self, token_manager, mock_db):
        """Test verifying token with wrong issuer is rejected"""
        now = datetime.now(timezone.utc)
        payload = {
            "sub": ACCESS_TOKEN,
            "iss": "wrong-issuer",
            "aud": TEST_AUDIENCE,
            "user_id": OID_9011,
            "email": MOCK_EMAIL,
            "roles": [ROLE_USER],
            "iat": now,
            "exp": now + timedelta(minutes=15),
            "type": TYPE_ACCESS
        }
        token = jwt.encode(payload, TEST_SECRET_KEY, algorithm=STR_HS256)

        with pytest.raises(AuthError) as exc_info:
            await token_manager.verify_token(token, token_type=TYPE_ACCESS)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_verify_token_backend_validation_failed(self, token_manager, mock_db):
        """Test verifying token when backend validation fails"""
        now = datetime.now(timezone.utc)
        payload = {
            "sub": ACCESS_TOKEN,
            "iss": TEST_ISSUER,
            "aud": TEST_AUDIENCE,
            "user_id": OID_9011,
            "email": MOCK_EMAIL,
            "roles": [ROLE_USER],
            "iat": now,
            "exp": now + timedelta(minutes=15),
            "type": TYPE_ACCESS
        }
        token = jwt.encode(payload, TEST_SECRET_KEY, algorithm=STR_HS256)

        # Return None from backend validation (no token found)
        mock_db.tokens.find_one = AsyncMock(return_value=None)

        with pytest.raises(AuthError) as exc_info:
            await token_manager.verify_token(token)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_access_token_success(self, token_manager, mock_db):
        """Test refreshing access token - mock verify_token to isolate test"""
        sample_user_data = {
            "_id": ObjectId(OID_9011),
            "email": MOCK_EMAIL,
            "roles": [ROLE_USER],
            "groups": ["viewer"],
            "domains": []
        }

        mock_db.users.find_one = AsyncMock(return_value=sample_user_data)
        mock_db.tokens.find_one = AsyncMock(return_value=None)
        mock_db.tokens.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        mock_db.tokens.update_one = AsyncMock(return_value=MagicMock(matched_count=1))

        # Mock verify_token to return valid payload
        async def mock_verify_token(token, token_type=TYPE_ACCESS):
            return {
                "user_id": OID_9011,
                "email": MOCK_EMAIL,
                "roles": [ROLE_USER],
                "type": TYPE_REFRESH
            }

        token_manager.verify_token = mock_verify_token

        result = await token_manager.refresh_access_token("fake_refresh_token", mock_db)
        assert ACCESS_TOKEN in result

    @pytest.mark.asyncio
    async def test_refresh_access_token_user_not_found(self, token_manager, mock_db):
        """Test refreshing token when user not found - mock verify_token"""
        mock_db.users.find_one = AsyncMock(return_value=None)

        # Mock verify_token to return valid payload
        async def mock_verify_token(token, token_type=TYPE_ACCESS):
            return {
                "user_id": OID_9011,
                "email": MOCK_EMAIL,
                "roles": [ROLE_USER],
                "type": TYPE_REFRESH
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
            "user_id": OID_9011,
            "email": MOCK_EMAIL,
            "token_hash": "token",
            "expires_at": now + timedelta(hours=1)
        })

        result = await token_manager.validate_backend_token(
            user_id=OID_9011,
            email=MOCK_EMAIL,
            token="token",
            token_type=TYPE_ACCESS,
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
            token_type=TYPE_ACCESS,
            db=mock_db
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_validate_backend_token_refresh_type(self, token_manager, mock_db):
        """Test validating refresh token type"""
        now = datetime.now(timezone.utc)
        mock_db.tokens.find_one = AsyncMock(return_value={
            "user_id": OID_9011,
            "email": MOCK_EMAIL,
            "refresh_token_hash": REFRESH_TOKEN,
            "expires_at": now + timedelta(hours=1)
        })

        result = await token_manager.validate_backend_token(
            user_id=OID_9011,
            email=MOCK_EMAIL,
            token=REFRESH_TOKEN,
            token_type=TYPE_REFRESH,
            db=mock_db
        )

        assert result is not None

    @pytest.mark.asyncio
    async def test_sync_access_token_insert(self, token_manager, mock_db):
        """Test syncing access token (new insert)"""
        mock_db.tokens.find_one = AsyncMock(return_value=None)
        mock_db.tokens.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))

        result = await token_manager.sync_access_token(
            user_id=OID_9011,
            email=MOCK_EMAIL,
            access_token=ACCESS_TOKEN,
            refresh_token=REFRESH_TOKEN,
            db=mock_db
        )

        assert result is not None
        mock_db.tokens.insert_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_sync_access_token_update(self, token_manager, mock_db):
        """Test syncing access token (update existing)"""
        mock_db.tokens.find_one = AsyncMock(return_value={
            "user_id": OID_9011,
            "email": MOCK_EMAIL
        })
        mock_db.tokens.update_one = AsyncMock(return_value=MagicMock(matched_count=1))

        result = await token_manager.sync_access_token(
            user_id=OID_9011,
            email=MOCK_EMAIL,
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
            user_id=OID_9011,
            email=MOCK_EMAIL,
            access_token=ACCESS_TOKEN,
            refresh_token=REFRESH_TOKEN,
            db=None  # Uses default self.db
        )

        assert result is not None

    def test_decode_token_success(self, token_manager):
        """Test decoding valid token without verification"""
        now = datetime.now(timezone.utc)
        payload = {
            "sub": ACCESS_TOKEN,
            "iss": TEST_ISSUER,
            "aud": TEST_AUDIENCE,
            "user_id": OID_9011,
            "email": MOCK_EMAIL,
            "roles": [ROLE_USER],
            "iat": now,
            "exp": now + timedelta(minutes=15),
            "type": TYPE_ACCESS
        }
        token = jwt.encode(payload, TEST_SECRET_KEY, algorithm=STR_HS256)

        result = token_manager.decode_token(token)
        assert result["user_id"] == OID_9011

    def test_decode_token_invalid(self, token_manager):
        """Test decoding invalid token returns empty dict"""
        result = token_manager.decode_token("invalid_token")
        assert result == {}

    def test_decode_token_wrong_secret(self, token_manager):
        """Test decoding token with wrong secret returns empty dict"""
        now = datetime.now(timezone.utc)
        payload = {
            "sub": ACCESS_TOKEN,
            "iss": TEST_ISSUER,
            "aud": TEST_AUDIENCE,
            "user_id": OID_9011,
            "email": MOCK_EMAIL,
            "type": TYPE_ACCESS
        }
        token = jwt.encode(payload, "wrong_secret", algorithm=STR_HS256)

        result = token_manager.decode_token(token)
        assert result == {}
