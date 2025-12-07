"""Tests for Scenario Service"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId

from easylifeauth.services.scenario_service import ScenarioService
from easylifeauth.errors.scenario_error import ScenarioNotFoundError, ScenarioBadError


class TestScenarioService:
    """Tests for ScenarioService"""

    @pytest.fixture
    def scenario_service(self, mock_db):
        """Create scenario service with mocks"""
        return ScenarioService(mock_db)

    @pytest.mark.asyncio
    async def test_get_all_success(self, scenario_service, mock_db, sample_scenario_data):
        """Test getting all scenarios"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_scenario_data])
        mock_db.domain_scenarios.find = MagicMock(return_value=mock_cursor)
        
        result = await scenario_service.get_all()
        
        assert len(result) == 1
        assert result[0]["key"] == "test-scenario"

    @pytest.mark.asyncio
    async def test_get_all_by_domain_key(self, scenario_service, mock_db, sample_scenario_data):
        """Test getting scenarios by domain key"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_scenario_data])
        mock_db.domain_scenarios.find = MagicMock(return_value=mock_cursor)
        
        result = await scenario_service.get_all_by_data_domain_key("test-domain")
        
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_get_by_object_id(self, scenario_service, mock_db, sample_scenario_data):
        """Test getting scenario by ObjectId"""
        mock_db.domain_scenarios.find_one = AsyncMock(return_value=sample_scenario_data)
        
        result = await scenario_service.get("507f1f77bcf86cd799439014")
        
        assert result["key"] == "test-scenario"

    @pytest.mark.asyncio
    async def test_get_by_key_string(self, scenario_service, mock_db, sample_scenario_data):
        """Test getting scenario by key string"""
        mock_db.domain_scenarios.find_one = AsyncMock(return_value=sample_scenario_data)
        
        result = await scenario_service.get("test-scenario")
        
        assert result["key"] == "test-scenario"

    @pytest.mark.asyncio
    async def test_get_not_found(self, scenario_service, mock_db):
        """Test getting non-existent scenario"""
        mock_db.domain_scenarios.find_one = AsyncMock(return_value=None)
        
        with pytest.raises(ScenarioNotFoundError):
            await scenario_service.get("nonexistent")

    @pytest.mark.asyncio
    async def test_get_scenario_by_id(self, scenario_service, mock_db, sample_scenario_data):
        """Test get_scenario method"""
        mock_db.domain_scenarios.find_one = AsyncMock(return_value=sample_scenario_data)
        
        result = await scenario_service.get_scenario("507f1f77bcf86cd799439014")
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_get_scenario_not_found(self, scenario_service, mock_db):
        """Test get_scenario with non-existent ID"""
        mock_db.domain_scenarios.find_one = AsyncMock(return_value=None)
        
        with pytest.raises(ScenarioNotFoundError):
            await scenario_service.get_scenario("nonexistent")

    @pytest.mark.asyncio
    async def test_save_success(self, scenario_service, mock_db, sample_scenario_data):
        """Test saving a new scenario"""
        mock_db.domain_scenarios.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        mock_db.domain_scenarios.find_one = AsyncMock(return_value=sample_scenario_data)
        
        result = await scenario_service.save(
            {"key": "new-scenario", "name": "New Scenario", "dataDomain": "test"},
            user_id="507f1f77bcf86cd799439011"
        )
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_save_bad_data(self, scenario_service, mock_db):
        """Test saving with bad data"""
        result = await scenario_service.save(None, user_id="test")
        
        assert isinstance(result, ScenarioBadError)

    @pytest.mark.asyncio
    async def test_save_not_dict(self, scenario_service, mock_db):
        """Test saving with non-dict data"""
        result = await scenario_service.save("not a dict", user_id="test")
        
        assert isinstance(result, ScenarioBadError)

    @pytest.mark.asyncio
    async def test_update_success(self, scenario_service, mock_db, sample_scenario_data):
        """Test updating a scenario"""
        mock_db.domain_scenarios.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.domain_scenarios.find_one = AsyncMock(return_value=sample_scenario_data)
        
        result = await scenario_service.update(
            {"_id": "507f1f77bcf86cd799439014", "name": "Updated Scenario"},
            user_id="507f1f77bcf86cd799439011"
        )
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_update_not_found(self, scenario_service, mock_db):
        """Test updating non-existent scenario"""
        mock_db.domain_scenarios.update_one = AsyncMock(
            return_value=MagicMock(matched_count=0)
        )
        
        with pytest.raises(ScenarioNotFoundError):
            await scenario_service.update(
                {"_id": "nonexistent", "name": "Updated"},
                user_id="test"
            )

    @pytest.mark.asyncio
    async def test_update_status_success(self, scenario_service, mock_db, sample_scenario_data):
        """Test updating scenario status"""
        mock_db.domain_scenarios.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.domain_scenarios.find_one = AsyncMock(return_value=sample_scenario_data)
        
        result = await scenario_service.update_status("507f1f77bcf86cd799439014", "I")
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_update_status_bad_values(self, scenario_service, mock_db):
        """Test updating status with bad values"""
        result = await scenario_service.update_status(None, "X")
        
        assert isinstance(result, ScenarioBadError)

    @pytest.mark.asyncio
    async def test_update_status_not_found(self, scenario_service, mock_db):
        """Test updating status of non-existent scenario"""
        mock_db.domain_scenarios.update_one = AsyncMock(
            return_value=MagicMock(matched_count=0)
        )
        
        with pytest.raises(ScenarioBadError):
            await scenario_service.update_status("nonexistent", "A")

    @pytest.mark.asyncio
    async def test_delete_success(self, scenario_service, mock_db):
        """Test deleting (deactivating) a scenario"""
        mock_db.domain_scenarios.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        
        result = await scenario_service.delete("507f1f77bcf86cd799439014")
        
        assert result["message"] == "Scenario deleted successfully"

    @pytest.mark.asyncio
    async def test_delete_not_found(self, scenario_service, mock_db):
        """Test deleting non-existent scenario"""
        mock_db.domain_scenarios.update_one = AsyncMock(
            return_value=MagicMock(matched_count=0)
        )
        
        with pytest.raises(ScenarioNotFoundError):
            await scenario_service.delete("nonexistent")
