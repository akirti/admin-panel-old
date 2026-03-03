"""Tests for Password Service"""
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId

from easylifeauth.services.password_service import PasswordResetService
from easylifeauth.errors.auth_error import AuthError
from mock_data import MOCK_EMAIL, MOCK_EMAIL_NOTFOUND, MOCK_PASSWORD_ALT, MOCK_PASSWORD_NEW, MOCK_PASSWORD_OLD, MOCK_PASSWORD_WRONG, MOCK_URL_RESET


class TestPasswordService:
    """Tests for PasswordResetService"""

    @pytest.fixture
    def password_service(self, mock_db, mock_token_manager, mock_email_service):
        """Create password service with mocks"""
        return PasswordResetService(mock_db, mock_token_manager, mock_email_service)

    @pytest.mark.asyncio
    async def test_request_password_reset_success(self, password_service, mock_db, sample_user_data):
        """Test requesting password reset"""
        sample_user_data["_id"] = ObjectId(sample_user_data["_id"])
        mock_db.users.find_one = AsyncMock(return_value=sample_user_data)
        mock_db.reset_tokens.insert_one = AsyncMock()
        
        result = await password_service.request_password_reset(
            MOCK_EMAIL,
            MOCK_URL_RESET
        )
        
        assert "message" in result

    @pytest.mark.asyncio
    async def test_request_password_reset_user_not_found(self, password_service, mock_db):
        """Test requesting reset for non-existent user"""
        mock_db.users.find_one = AsyncMock(return_value=None)
        
        result = await password_service.request_password_reset(
            MOCK_EMAIL_NOTFOUND,
            MOCK_URL_RESET
        )
        
        # Should still return success message for security
        assert "message" in result

    @pytest.mark.asyncio
    async def test_reset_password_success(self, password_service, mock_db, sample_user_data):
        """Test resetting password"""
        reset_record = {
            "_id": ObjectId(),
            "user_id": ObjectId(sample_user_data["_id"]),
            "token_hash": "hashed_token",
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1)
        }
        
        mock_db.reset_tokens.find_one = AsyncMock(return_value=reset_record)
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        mock_db.reset_tokens.delete_one = AsyncMock()
        
        result = await password_service.reset_password(
            "valid_token",
            MOCK_PASSWORD_NEW
        )
        
        assert result["message"] == "Password reset successfully"

    @pytest.mark.asyncio
    async def test_reset_password_short_password(self, password_service):
        """Test resetting with short password"""
        with pytest.raises(AuthError) as exc_info:
            await password_service.reset_password("token", "short")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_reset_password_invalid_token(self, password_service, mock_db):
        """Test resetting with invalid token"""
        mock_db.reset_tokens.find_one = AsyncMock(return_value=None)
        
        with pytest.raises(AuthError) as exc_info:
            await password_service.reset_password("invalid_token", MOCK_PASSWORD_NEW)
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_reset_password_user_not_found(self, password_service, mock_db):
        """Test resetting password when user not found"""
        reset_record = {
            "_id": ObjectId(),
            "user_id": ObjectId(),
            "token_hash": "hashed_token",
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1)
        }
        
        mock_db.reset_tokens.find_one = AsyncMock(return_value=reset_record)
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=0))
        
        with pytest.raises(AuthError) as exc_info:
            await password_service.reset_password("valid_token", MOCK_PASSWORD_NEW)
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_update_user_password_success(self, password_service, mock_db, sample_user_data):
        """Test updating user password"""
        from werkzeug.security import generate_password_hash
        sample_user_data["password_hash"] = generate_password_hash(MOCK_PASSWORD_OLD)
        sample_user_data["_id"] = ObjectId(sample_user_data["_id"])
        
        mock_db.users.find_one = AsyncMock(return_value=sample_user_data)
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        
        result = await password_service.update_user_password(
            email=MOCK_EMAIL,
            password=MOCK_PASSWORD_OLD,
            new_password=MOCK_PASSWORD_NEW
        )
        
        assert "access_token" in result

    @pytest.mark.asyncio
    async def test_update_user_password_missing_fields(self, password_service):
        """Test updating password with missing fields"""
        with pytest.raises(AuthError) as exc_info:
            await password_service.update_user_password(
                email="",
                password="",
                new_password=""
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_update_user_password_user_not_found(self, password_service, mock_db):
        """Test updating password for non-existent user"""
        mock_db.users.find_one = AsyncMock(return_value=None)
        
        with pytest.raises(AuthError) as exc_info:
            await password_service.update_user_password(
                email=MOCK_EMAIL_NOTFOUND,
                password=MOCK_PASSWORD_OLD,
                new_password=MOCK_PASSWORD_NEW
            )
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_update_user_password_wrong_password(self, password_service, mock_db, sample_user_data):
        """Test updating password with wrong current password"""
        from werkzeug.security import generate_password_hash
        sample_user_data["password_hash"] = generate_password_hash(MOCK_PASSWORD_ALT)
        
        mock_db.users.find_one = AsyncMock(return_value=sample_user_data)
        
        with pytest.raises(AuthError) as exc_info:
            await password_service.update_user_password(
                email=MOCK_EMAIL,
                password=MOCK_PASSWORD_WRONG,
                new_password=MOCK_PASSWORD_NEW
            )
        assert exc_info.value.status_code == 401
