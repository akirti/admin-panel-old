"""Tests for User Service"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId

from easylifeauth.services.user_service import UserService
from easylifeauth.errors.auth_error import AuthError


class TestUserService:
    """Tests for UserService"""

    @pytest.fixture
    def user_service(self, mock_db, mock_token_manager):
        """Create user service with mocks"""
        return UserService(mock_db, mock_token_manager)

    @pytest.mark.asyncio
    async def test_register_user_success(self, user_service, mock_db, mock_token_manager):
        """Test successful user registration"""
        mock_db.users.find_one = AsyncMock(return_value=None)
        mock_db.users.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        
        result = await user_service.register_user(
            email="new@example.com",
            username="newuser",
            password="password123",
            full_name="New User"
        )
        
        assert "user_id" in result
        assert result["email"] == "new@example.com"
        assert "access_token" in result

    @pytest.mark.asyncio
    async def test_register_user_missing_fields(self, user_service):
        """Test registration with missing fields"""
        with pytest.raises(AuthError) as exc_info:
            await user_service.register_user(
                email="",
                username="",
                password=""
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_register_user_short_password(self, user_service):
        """Test registration with short password"""
        with pytest.raises(AuthError) as exc_info:
            await user_service.register_user(
                email="test@example.com",
                username="testuser",
                password="short"
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_register_user_email_exists(self, user_service, mock_db):
        """Test registration with existing email"""
        mock_db.users.find_one = AsyncMock(return_value={"email": "exists@example.com"})
        
        with pytest.raises(AuthError) as exc_info:
            await user_service.register_user(
                email="exists@example.com",
                username="newuser",
                password="password123"
            )
        assert exc_info.value.status_code == 409

    @pytest.mark.asyncio
    async def test_login_user_success(self, user_service, mock_db, sample_user_data):
        """Test successful login"""
        from werkzeug.security import generate_password_hash
        sample_user_data["password_hash"] = generate_password_hash("password123")
        sample_user_data["_id"] = ObjectId(sample_user_data["_id"])
        
        mock_db.users.find_one = AsyncMock(return_value=sample_user_data)
        mock_db.users.update_one = AsyncMock()
        
        result = await user_service.login_user(
            email="test@example.com",
            password="password123"
        )
        
        assert "access_token" in result
        assert result["email"] == "test@example.com"

    @pytest.mark.asyncio
    async def test_login_user_missing_credentials(self, user_service):
        """Test login with missing credentials"""
        with pytest.raises(AuthError) as exc_info:
            await user_service.login_user(email="", password="")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_login_user_not_found(self, user_service, mock_db):
        """Test login with non-existent user"""
        mock_db.users.find_one = AsyncMock(return_value=None)
        
        with pytest.raises(AuthError) as exc_info:
            await user_service.login_user(
                email="notfound@example.com",
                password="password123"
            )
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_login_user_inactive(self, user_service, mock_db, sample_user_data):
        """Test login with inactive user"""
        sample_user_data["is_active"] = False
        mock_db.users.find_one = AsyncMock(return_value=sample_user_data)
        
        with pytest.raises(AuthError) as exc_info:
            await user_service.login_user(
                email="test@example.com",
                password="password123"
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_login_user_wrong_password(self, user_service, mock_db, sample_user_data):
        """Test login with wrong password"""
        from werkzeug.security import generate_password_hash
        sample_user_data["password_hash"] = generate_password_hash("correctpassword")
        mock_db.users.find_one = AsyncMock(return_value=sample_user_data)
        
        with pytest.raises(AuthError) as exc_info:
            await user_service.login_user(
                email="test@example.com",
                password="wrongpassword"
            )
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_get_user_by_id_success(self, user_service, mock_db, sample_user_data):
        """Test getting user by ID"""
        sample_user_data["_id"] = ObjectId(sample_user_data["_id"])
        mock_db.users.find_one = AsyncMock(return_value=sample_user_data)
        
        result = await user_service.get_user_by_id("507f1f77bcf86cd799439011")
        
        assert result["email"] == "test@example.com"
        assert "password_hash" not in result

    @pytest.mark.asyncio
    async def test_get_user_by_id_not_found(self, user_service, mock_db):
        """Test getting non-existent user"""
        mock_db.users.find_one = AsyncMock(return_value=None)
        
        result = await user_service.get_user_by_id("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_by_id_exception(self, user_service, mock_db):
        """Test getting user with exception"""
        mock_db.users.find_one = AsyncMock(side_effect=Exception("DB Error"))
        
        result = await user_service.get_user_by_id("507f1f77bcf86cd799439011")
        assert result is None

    @pytest.mark.asyncio
    async def test_update_user_data_success(self, user_service, mock_db, sample_user_data):
        """Test updating user data"""
        sample_user_data["_id"] = ObjectId(sample_user_data["_id"])
        mock_db.users.find_one = AsyncMock(return_value=sample_user_data)
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        
        result = await user_service.update_user_data(
            "507f1f77bcf86cd799439011",
            {"full_name": "Updated Name"}
        )
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_update_user_data_no_valid_fields(self, user_service):
        """Test updating user with no valid fields"""
        with pytest.raises(AuthError) as exc_info:
            await user_service.update_user_data(
                "507f1f77bcf86cd799439011",
                {"invalid_field": "value"}
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_update_user_data_username_taken(self, user_service, mock_db):
        """Test updating username to existing one"""
        mock_db.users.find_one = AsyncMock(return_value={"username": "taken"})
        
        with pytest.raises(AuthError) as exc_info:
            await user_service.update_user_data(
                "507f1f77bcf86cd799439011",
                {"username": "taken"}
            )
        assert exc_info.value.status_code == 409

    @pytest.mark.asyncio
    async def test_update_user_data_not_found(self, user_service, mock_db):
        """Test updating non-existent user"""
        mock_db.users.find_one = AsyncMock(side_effect=[None, None])
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=0))
        
        with pytest.raises(AuthError) as exc_info:
            await user_service.update_user_data(
                "507f1f77bcf86cd799439011",
                {"full_name": "New Name"}
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_logout_user_success(self, user_service, mock_db):
        """Test successful logout"""
        mock_db.tokens.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))
        
        result = await user_service.logout_user(
            "507f1f77bcf86cd799439011",
            "test@example.com"
        )
        
        assert result["message"] == "Logged out successfully"

    @pytest.mark.asyncio
    async def test_logout_user_no_session(self, user_service, mock_db):
        """Test logout with no active session"""
        mock_db.tokens.delete_one = AsyncMock(return_value=MagicMock(deleted_count=0))
        
        result = await user_service.logout_user(
            "507f1f77bcf86cd799439011",
            "test@example.com"
        )
        
        assert result["message"] == "No active session found"
