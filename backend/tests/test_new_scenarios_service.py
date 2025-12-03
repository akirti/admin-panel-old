"""Tests for New Scenarios Service"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId

from easylifeauth.services.new_scenarios_service import NewScenarioService
from easylifeauth.errors.auth_error import AuthError


class TestNewScenarioService:
    """Tests for NewScenarioService"""

    @pytest.fixture
    def scenario_service(self, mock_db, mock_token_manager, mock_email_service):
        """Create scenario request service with mocks"""
        return NewScenarioService(mock_db, mock_token_manager, mock_email_service)

    @pytest.mark.asyncio
    async def test_generate_next_id(self, scenario_service, mock_db):
        """Test generating next request ID"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.__aiter__ = lambda self: iter([{"requestId": "REQ-SCR-0005"}])
        mock_db.scenario_requests.find = MagicMock(return_value=mock_cursor)
        
        result = await scenario_service.generate_next_id()
        
        assert result == "REQ-SCR-0006"

    @pytest.mark.asyncio
    async def test_generate_next_id_first(self, scenario_service, mock_db):
        """Test generating first request ID"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.__aiter__ = lambda self: iter([])
        mock_db.scenario_requests.find = MagicMock(return_value=mock_cursor)
        
        result = await scenario_service.generate_next_id()
        
        assert result == "REQ-SCR-0001"

    @pytest.mark.asyncio
    async def test_save_success(self, scenario_service, mock_db, sample_scenario_request_data):
        """Test saving scenario request"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.__aiter__ = lambda self: iter([])
        mock_db.scenario_requests.find = MagicMock(return_value=mock_cursor)
        
        mock_db.scenario_requests.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        mock_db.scenario_requests.find_one = AsyncMock(return_value=sample_scenario_request_data)
        
        result = await scenario_service.save({
            "scenarioName": "Test Scenario",
            "description": "Test Description",
            "dataDomain": "test-domain",
            "email": "test@example.com"
        })
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_save_empty_data(self, scenario_service):
        """Test saving with empty data"""
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.save({})
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_save_none_data(self, scenario_service):
        """Test saving with None data"""
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.save(None)
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_save_not_dict(self, scenario_service):
        """Test saving with non-dict data"""
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.save("not a dict")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_update_success_user(self, scenario_service, mock_db, sample_scenario_request_data):
        """Test updating scenario request as user"""
        mock_db.scenario_requests.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.scenario_requests.find_one = AsyncMock(return_value=sample_scenario_request_data)
        
        result = await scenario_service.update(
            {
                "request_id": "REQ-SCR-0001",
                "scenarioName": "Updated Name"
            },
            user_role=["user"]
        )
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_update_success_admin(self, scenario_service, mock_db, sample_scenario_request_data):
        """Test updating scenario request as admin"""
        mock_db.scenario_requests.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.scenario_requests.find_one = AsyncMock(return_value=sample_scenario_request_data)
        
        result = await scenario_service.update(
            {
                "request_id": "REQ-SCR-0001",
                "status": "P",
                "assgiendTo": "Admin"
            },
            user_role=["administrator"]
        )
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_update_empty_data(self, scenario_service):
        """Test updating with empty data"""
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.update({}, user_role=["user"])
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_update_missing_request_id(self, scenario_service):
        """Test updating without request_id"""
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.update(
                {"scenarioName": "Name"},
                user_role=["user"]
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_update_unauthorized_role(self, scenario_service):
        """Test updating with unauthorized role"""
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.update(
                {"request_id": "REQ-SCR-0001", "scenarioName": "Name"},
                user_role=["viewer"]
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_update_no_valid_fields(self, scenario_service):
        """Test updating with no valid fields"""
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.update(
                {"request_id": "REQ-SCR-0001", "invalid_field": "value"},
                user_role=["user"]
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_get_success(self, scenario_service, mock_db, sample_scenario_request_data):
        """Test getting scenario request"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value=sample_scenario_request_data)
        
        result = await scenario_service.get("REQ-SCR-0001")
        
        assert result["requestId"] == "REQ-SCR-0001"

    @pytest.mark.asyncio
    async def test_get_missing_id(self, scenario_service):
        """Test getting without request_id"""
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.get(None)
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_get_not_found(self, scenario_service, mock_db):
        """Test getting non-existent request"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value=None)
        
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.get("REQ-SCR-9999")
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_all_success(self, scenario_service, mock_db, sample_scenario_request_data):
        """Test getting all scenario requests"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_scenario_request_data])
        mock_db.scenario_requests.find = MagicMock(return_value=mock_cursor)
        mock_db.scenario_requests.count_documents = AsyncMock(return_value=1)
        
        result = await scenario_service.get_all(
            user_id="507f1f77bcf86cd799439011",
            pagination={"page": 0, "limit": 25}
        )
        
        assert "data" in result
        assert "pagination" in result

    @pytest.mark.asyncio
    async def test_get_all_admin_no_user_filter(self, scenario_service, mock_db, sample_scenario_request_data):
        """Test getting all requests as admin (no user filter)"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_scenario_request_data])
        mock_db.scenario_requests.find = MagicMock(return_value=mock_cursor)
        mock_db.scenario_requests.count_documents = AsyncMock(return_value=1)
        
        result = await scenario_service.get_all(
            user_id=None,  # Admin sees all
            pagination={"page": 0, "limit": 25}
        )
        
        assert "data" in result

    @pytest.mark.asyncio
    async def test_get_user_by_id(self, scenario_service, mock_db, sample_user_data):
        """Test getting user by email"""
        sample_user_data["_id"] = ObjectId(sample_user_data["_id"])
        mock_db.users.find_one = AsyncMock(return_value=sample_user_data)
        
        result = await scenario_service.get_user_by_id("test@example.com")
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_get_user_by_id_not_found(self, scenario_service, mock_db):
        """Test getting non-existent user"""
        mock_db.users.find_one = AsyncMock(return_value=None)
        
        result = await scenario_service.get_user_by_id("notfound@example.com")
        
        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_by_id_exception(self, scenario_service, mock_db):
        """Test getting user with exception"""
        mock_db.users.find_one = AsyncMock(side_effect=Exception("DB Error"))
        
        result = await scenario_service.get_user_by_id("test@example.com")
        
        assert result is None
