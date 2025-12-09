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
        """Test logout with no active session (still returns success)"""
        mock_db.tokens.delete_many = AsyncMock(return_value=MagicMock(deleted_count=0))

        result = await user_service.logout_user(
            "507f1f77bcf86cd799439011",
            "test@example.com"
        )

        # Service always returns success regardless of whether tokens existed
        assert result["message"] == "Logged out successfully"

    # ===================== Additional Tests for Coverage =====================

    @pytest.mark.asyncio
    async def test_resolve_user_domains_with_roles(self, user_service, mock_db):
        """Test resolving domains from user roles"""
        # Create async iterator for roles
        async def roles_cursor_iter():
            yield {"roleId": "editor", "domains": ["domain1", "domain2"], "status": "active"}
            yield {"roleId": "viewer", "domains": ["domain3"], "status": "active"}

        mock_cursor = MagicMock()
        mock_cursor.__aiter__ = lambda self: roles_cursor_iter()
        mock_db.roles.find = MagicMock(return_value=mock_cursor)
        mock_db.groups.find = MagicMock(return_value=MagicMock(__aiter__=lambda self: iter(())))

        user = {
            "domains": ["base_domain"],
            "roles": ["editor", "viewer"],
            "groups": []
        }

        result = await user_service.resolve_user_domains(user)

        assert "base_domain" in result
        assert "domain1" in result
        assert "domain2" in result
        assert "domain3" in result

    @pytest.mark.asyncio
    async def test_resolve_user_domains_with_groups(self, user_service, mock_db):
        """Test resolving domains from user groups"""
        # Create async iterator for groups
        async def groups_cursor_iter():
            yield {"groupId": "team-a", "domains": ["team_domain"], "status": "active"}

        mock_db.roles.find = MagicMock(return_value=MagicMock(__aiter__=lambda self: iter(())))
        mock_cursor = MagicMock()
        mock_cursor.__aiter__ = lambda self: groups_cursor_iter()
        mock_db.groups.find = MagicMock(return_value=mock_cursor)

        user = {
            "domains": ["user_domain"],
            "roles": [],
            "groups": ["team-a"]
        }

        result = await user_service.resolve_user_domains(user)

        assert "user_domain" in result
        assert "team_domain" in result

    @pytest.mark.asyncio
    async def test_resolve_user_permissions_with_roles(self, user_service, mock_db):
        """Test resolving permissions from user roles"""
        async def roles_cursor_iter():
            yield {"roleId": "editor", "permissions": ["read", "write"], "status": "active"}

        mock_cursor = MagicMock()
        mock_cursor.__aiter__ = lambda self: roles_cursor_iter()
        mock_db.roles.find = MagicMock(return_value=mock_cursor)
        mock_db.groups.find = MagicMock(return_value=MagicMock(__aiter__=lambda self: iter(())))

        user = {
            "roles": ["editor"],
            "groups": []
        }

        result = await user_service.resolve_user_permissions(user)

        assert "read" in result
        assert "write" in result

    @pytest.mark.asyncio
    async def test_resolve_user_permissions_with_groups(self, user_service, mock_db):
        """Test resolving permissions from user groups"""
        async def groups_cursor_iter():
            yield {"groupId": "team-a", "permissions": ["view", "edit"], "status": "active"}

        mock_db.roles.find = MagicMock(return_value=MagicMock(__aiter__=lambda self: iter(())))
        mock_cursor = MagicMock()
        mock_cursor.__aiter__ = lambda self: groups_cursor_iter()
        mock_db.groups.find = MagicMock(return_value=mock_cursor)

        user = {
            "roles": [],
            "groups": ["team-a"]
        }

        result = await user_service.resolve_user_permissions(user)

        assert "view" in result
        assert "edit" in result

    @pytest.mark.asyncio
    async def test_get_user_by_email_success(self, user_service, mock_db, sample_user_data):
        """Test getting user by email successfully"""
        sample_user_data["_id"] = ObjectId(sample_user_data["_id"])
        mock_db.users.find_one = AsyncMock(return_value=sample_user_data)

        result = await user_service.get_user_by_email("test@example.com")

        assert result is not None
        assert result["email"] == "test@example.com"
        assert "password_hash" not in result

    @pytest.mark.asyncio
    async def test_get_user_by_email_not_found(self, user_service, mock_db):
        """Test getting non-existent user by email"""
        mock_db.users.find_one = AsyncMock(return_value=None)

        result = await user_service.get_user_by_email("notfound@example.com")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_by_email_exception(self, user_service, mock_db):
        """Test getting user by email with exception"""
        mock_db.users.find_one = AsyncMock(side_effect=Exception("DB Error"))

        result = await user_service.get_user_by_email("test@example.com")

        assert result is None

    @pytest.mark.asyncio
    async def test_update_user_data_get_user_fails(self, user_service, mock_db, sample_user_data):
        """Test update when get_user_by_id returns None after update"""
        sample_user_data["_id"] = ObjectId(sample_user_data["_id"])
        # First call is for checking username, second/third is for get_user_by_id
        mock_db.users.find_one = AsyncMock(side_effect=[None, None])
        mock_db.users.update_one = AsyncMock(return_value=MagicMock(matched_count=1))

        with pytest.raises(AuthError) as exc_info:
            await user_service.update_user_data(
                "507f1f77bcf86cd799439011",
                {"full_name": "New Name"}
            )
        assert exc_info.value.status_code == 404


class TestPasswordVerification:
    """Tests for password verification functions"""

    def test_verify_scrypt_password_valid(self):
        """Test scrypt password verification with valid hash"""
        from easylifeauth.services.user_service import verify_scrypt_password

        # Create a valid scrypt hash manually
        import hashlib
        password = "testpassword123"
        salt = "testsalt12345678"
        n, r, p = 32768, 8, 1
        dklen = 64
        maxmem = 128 * n * r * p + 1024 * 1024

        derived_key = hashlib.scrypt(
            password.encode('utf-8'),
            salt=salt.encode('utf-8'),
            n=n, r=r, p=p,
            dklen=dklen,
            maxmem=maxmem
        )
        stored_hash = f"scrypt:{n}:{r}:{p}${salt}${derived_key.hex()}"

        result = verify_scrypt_password(password, stored_hash)
        assert result is True

    def test_verify_scrypt_password_invalid_format(self):
        """Test scrypt verification with invalid hash format"""
        from easylifeauth.services.user_service import verify_scrypt_password

        # Missing parts
        result = verify_scrypt_password("password", "invalid$hash")
        assert result is False

    def test_verify_scrypt_password_wrong_method(self):
        """Test scrypt verification with non-scrypt hash"""
        from easylifeauth.services.user_service import verify_scrypt_password

        result = verify_scrypt_password("password", "pbkdf2:sha256:260000$salt$hash")
        assert result is False

    def test_verify_scrypt_password_exception(self):
        """Test scrypt verification with exception"""
        from easylifeauth.services.user_service import verify_scrypt_password

        # Malformed hash that will cause exception
        result = verify_scrypt_password("password", "scrypt:invalid:params$salt$hash")
        assert result is False

    def test_verify_bcrypt_password_valid(self):
        """Test bcrypt password verification"""
        pytest.importorskip("passlib")
        from easylifeauth.services.user_service import verify_bcrypt_password
        from passlib.context import CryptContext

        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hashed = pwd_context.hash("testpassword")

        result = verify_bcrypt_password("testpassword", hashed)
        assert result is True

    def test_verify_bcrypt_password_invalid(self):
        """Test bcrypt password verification with wrong password"""
        pytest.importorskip("passlib")
        from easylifeauth.services.user_service import verify_bcrypt_password
        from passlib.context import CryptContext

        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hashed = pwd_context.hash("testpassword")

        result = verify_bcrypt_password("wrongpassword", hashed)
        assert result is False

    def test_verify_bcrypt_password_exception(self):
        """Test bcrypt verification with exception"""
        from easylifeauth.services.user_service import verify_bcrypt_password

        # Invalid bcrypt hash
        result = verify_bcrypt_password("password", "not_valid_bcrypt")
        assert result is False

    def test_verify_password_multi_empty_hash(self):
        """Test multi verify with empty hash"""
        from easylifeauth.services.user_service import verify_password_multi

        result = verify_password_multi("password", "")
        assert result is False

        result = verify_password_multi("password", None)
        assert result is False

    def test_verify_password_multi_pbkdf2(self):
        """Test multi verify with pbkdf2 hash"""
        from easylifeauth.services.user_service import verify_password_multi
        from werkzeug.security import generate_password_hash

        hashed = generate_password_hash("testpassword")
        result = verify_password_multi("testpassword", hashed)
        assert result is True

    def test_verify_password_multi_scrypt(self):
        """Test multi verify with scrypt hash"""
        from easylifeauth.services.user_service import verify_password_multi
        import hashlib

        password = "testpassword123"
        salt = "testsalt12345678"
        n, r, p = 32768, 8, 1
        dklen = 64
        maxmem = 128 * n * r * p + 1024 * 1024

        derived_key = hashlib.scrypt(
            password.encode('utf-8'),
            salt=salt.encode('utf-8'),
            n=n, r=r, p=p,
            dklen=dklen,
            maxmem=maxmem
        )
        stored_hash = f"scrypt:{n}:{r}:{p}${salt}${derived_key.hex()}"

        result = verify_password_multi(password, stored_hash)
        assert result is True

    def test_verify_password_multi_bcrypt(self):
        """Test multi verify with bcrypt hash"""
        pytest.importorskip("passlib")
        from easylifeauth.services.user_service import verify_password_multi
        from passlib.context import CryptContext

        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hashed = pwd_context.hash("testpassword")

        result = verify_password_multi("testpassword", hashed)
        assert result is True

    def test_verify_password_multi_fallback(self):
        """Test multi verify fallback with unknown hash"""
        from easylifeauth.services.user_service import verify_password_multi

        # Unknown hash format will trigger fallback
        result = verify_password_multi("password", "unknown_hash_format")
        assert result is False

    def test_verify_password_multi_fallback_exception(self):
        """Test multi verify fallback with exception-causing hash"""
        from easylifeauth.services.user_service import verify_password_multi

        # This should trigger the exception handler in fallback
        result = verify_password_multi("password", "invalid:format:that:causes:exception")
        assert result is False
