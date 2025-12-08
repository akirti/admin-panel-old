"""Tests for Activity Log Service"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId

from easylifeauth.services.activity_log_service import (
    ActivityLogService,
    init_activity_log_service,
    get_activity_log_service,
    log_activity,
    _activity_log_service
)


class TestActivityLogService:
    """Tests for ActivityLogService"""

    @pytest.fixture
    def mock_db(self):
        """Create mock database"""
        db = MagicMock()
        db.activity_logs = MagicMock()
        db.activity_logs.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        return db

    @pytest.fixture
    def activity_service(self, mock_db):
        """Create activity log service"""
        return ActivityLogService(mock_db)

    @pytest.mark.asyncio
    async def test_log_success(self, activity_service, mock_db):
        """Test successful activity logging"""
        result = await activity_service.log(
            action="create",
            entity_type="user",
            entity_id="507f1f77bcf86cd799439011",
            user_email="admin@example.com",
            details={"ip": "127.0.0.1"}
        )

        assert result is not None
        mock_db.activity_logs.insert_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_with_old_values(self, activity_service, mock_db):
        """Test logging with old values"""
        result = await activity_service.log(
            action="update",
            entity_type="user",
            entity_id="507f1f77bcf86cd799439011",
            user_email="admin@example.com",
            old_values={"name": "Old Name"}
        )

        assert result is not None
        call_args = mock_db.activity_logs.insert_one.call_args[0][0]
        assert "old_values" in call_args

    @pytest.mark.asyncio
    async def test_log_with_new_values(self, activity_service, mock_db):
        """Test logging with new values"""
        result = await activity_service.log(
            action="update",
            entity_type="user",
            entity_id="507f1f77bcf86cd799439011",
            user_email="admin@example.com",
            new_values={"name": "New Name"}
        )

        assert result is not None
        call_args = mock_db.activity_logs.insert_one.call_args[0][0]
        assert "new_values" in call_args

    @pytest.mark.asyncio
    async def test_log_with_both_old_and_new_values(self, activity_service, mock_db):
        """Test logging with both old and new values"""
        result = await activity_service.log(
            action="update",
            entity_type="user",
            entity_id="507f1f77bcf86cd799439011",
            user_email="admin@example.com",
            old_values={"name": "Old Name"},
            new_values={"name": "New Name"}
        )

        assert result is not None
        call_args = mock_db.activity_logs.insert_one.call_args[0][0]
        assert "old_values" in call_args
        assert "new_values" in call_args

    @pytest.mark.asyncio
    async def test_log_no_activity_logs_collection(self):
        """Test logging when activity_logs collection doesn't exist"""
        db = MagicMock()
        # Remove the activity_logs attribute
        del db.activity_logs

        service = ActivityLogService(db)
        result = await service.log(
            action="create",
            entity_type="user",
            entity_id="123",
            user_email="test@example.com"
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_log_activity_logs_is_none(self):
        """Test logging when activity_logs is None"""
        db = MagicMock()
        db.activity_logs = None

        service = ActivityLogService(db)
        result = await service.log(
            action="create",
            entity_type="user",
            entity_id="123",
            user_email="test@example.com"
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_log_exception_handling(self, mock_db):
        """Test logging handles exceptions gracefully"""
        mock_db.activity_logs.insert_one = AsyncMock(
            side_effect=Exception("Database error")
        )

        service = ActivityLogService(mock_db)
        result = await service.log(
            action="create",
            entity_type="user",
            entity_id="123",
            user_email="test@example.com"
        )

        assert result is None


class TestModuleFunctions:
    """Tests for module-level functions"""

    @pytest.fixture
    def mock_db(self):
        """Create mock database"""
        db = MagicMock()
        db.activity_logs = MagicMock()
        db.activity_logs.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        return db

    def test_init_activity_log_service(self, mock_db):
        """Test initializing activity log service"""
        service = init_activity_log_service(mock_db)

        assert service is not None
        assert isinstance(service, ActivityLogService)

    def test_get_activity_log_service(self, mock_db):
        """Test getting activity log service"""
        init_activity_log_service(mock_db)
        service = get_activity_log_service()

        assert service is not None
        assert isinstance(service, ActivityLogService)

    @pytest.mark.asyncio
    async def test_log_activity_convenience_function(self, mock_db):
        """Test convenience log_activity function"""
        init_activity_log_service(mock_db)

        result = await log_activity(
            action="login",
            entity_type="session",
            entity_id="session_123",
            user_email="user@example.com",
            details={"ip": "192.168.1.1"}
        )

        assert result is not None

    @pytest.mark.asyncio
    async def test_log_activity_without_service_init(self):
        """Test log_activity returns None when service not initialized"""
        # Reset the global service
        import easylifeauth.services.activity_log_service as als
        als._activity_log_service = None

        result = await log_activity(
            action="test",
            entity_type="test",
            entity_id="123",
            user_email="test@example.com"
        )

        assert result is None
