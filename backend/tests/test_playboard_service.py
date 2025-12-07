"""Tests for Playboard Service"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId

from easylifeauth.services.playboard_service import PlayboardService
from easylifeauth.errors.playboard_error import PlayboardNotFoundError, PlayboardBadError


class TestPlayboardService:
    """Tests for PlayboardService"""

    @pytest.fixture
    def playboard_service(self, mock_db):
        """Create playboard service with mocks"""
        return PlayboardService(mock_db)

    @pytest.mark.asyncio
    async def test_get_all_success(self, playboard_service, mock_db, sample_playboard_data):
        """Test getting all playboards"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_playboard_data])
        mock_db.playboards.find = MagicMock(return_value=mock_cursor)
        
        result = await playboard_service.get_all()
        
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_get_all_empty(self, playboard_service, mock_db):
        """Test getting all playboards when empty"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.playboards.find = MagicMock(return_value=mock_cursor)
        
        result = await playboard_service.get_all()
        
        assert result == []

    @pytest.mark.asyncio
    async def test_get_all_by_domain_key(self, playboard_service, mock_db, sample_playboard_data):
        """Test getting playboards by domain key"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_playboard_data])
        mock_db.playboards.find = MagicMock(return_value=mock_cursor)
        
        result = await playboard_service.get_all_by_data_domain_key("test-domain")
        
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_get_playboard_by_key(self, playboard_service, mock_db, sample_playboard_data):
        """Test getting playboard by key"""
        mock_db.playboards.find_one = AsyncMock(return_value=sample_playboard_data)
        
        result = await playboard_service.get_playboard_by_key("test-playboard")
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_get_playboard_by_key_not_found(self, playboard_service, mock_db):
        """Test getting non-existent playboard by key"""
        mock_db.playboards.find_one = AsyncMock(return_value=None)
        
        result = await playboard_service.get_playboard_by_key("nonexistent")
        
        assert result is None

    @pytest.mark.asyncio
    async def test_get_playboard_by_scenario_key(self, playboard_service, mock_db, sample_playboard_data):
        """Test getting playboard by scenario key"""
        mock_db.playboards.find_one = AsyncMock(return_value=sample_playboard_data)
        
        result = await playboard_service.get_playboard_by_scenerio_key("test-scenario")
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_get_by_object_id(self, playboard_service, mock_db, sample_playboard_data):
        """Test getting playboard by ObjectId"""
        mock_db.playboards.find_one = AsyncMock(return_value=sample_playboard_data)
        
        result = await playboard_service.get("507f1f77bcf86cd799439015")
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_get_by_key_string(self, playboard_service, mock_db, sample_playboard_data):
        """Test getting playboard by key string"""
        mock_db.playboards.find_one = AsyncMock(return_value=sample_playboard_data)
        
        result = await playboard_service.get("test-playboard")
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_get_not_found(self, playboard_service, mock_db):
        """Test getting non-existent playboard"""
        mock_db.playboards.find_one = AsyncMock(return_value=None)
        
        result = await playboard_service.get("nonexistent")
        
        assert result is None

    @pytest.mark.asyncio
    async def test_save_success(self, playboard_service, mock_db, sample_playboard_data):
        """Test saving a new playboard"""
        mock_db.playboards.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        mock_db.playboards.find_one = AsyncMock(return_value=sample_playboard_data)
        
        result = await playboard_service.save(
            {"dataDomain": "test", "scenerioKey": "test-scenario"},
            user_id="507f1f77bcf86cd799439011"
        )
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_save_bad_data(self, playboard_service, mock_db):
        """Test saving with bad data"""
        result = await playboard_service.save(None, user_id="test")
        
        assert isinstance(result, PlayboardBadError)

    @pytest.mark.asyncio
    async def test_save_not_dict(self, playboard_service, mock_db):
        """Test saving with non-dict data"""
        result = await playboard_service.save("not a dict", user_id="test")
        
        assert isinstance(result, PlayboardBadError)

    @pytest.mark.asyncio
    async def test_update_success(self, playboard_service, mock_db, sample_playboard_data):
        """Test updating a playboard"""
        mock_db.playboards.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.playboards.find_one = AsyncMock(return_value=sample_playboard_data)
        
        result = await playboard_service.update(
            {"_id": "507f1f77bcf86cd799439015", "order": 2},
            user_id="507f1f77bcf86cd799439011"
        )
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_update_not_found(self, playboard_service, mock_db):
        """Test updating non-existent playboard"""
        mock_db.playboards.update_one = AsyncMock(
            return_value=MagicMock(matched_count=0)
        )
        
        with pytest.raises(PlayboardNotFoundError):
            await playboard_service.update(
                {"_id": "nonexistent", "order": 2},
                user_id="test"
            )

    @pytest.mark.asyncio
    async def test_update_status_success(self, playboard_service, mock_db, sample_playboard_data):
        """Test updating playboard status"""
        mock_db.playboards.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.playboards.find_one = AsyncMock(return_value=sample_playboard_data)
        
        result = await playboard_service.update_status("507f1f77bcf86cd799439015", "I")
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_update_status_bad_values(self, playboard_service, mock_db):
        """Test updating status with bad values"""
        result = await playboard_service.update_status(None, "X")
        
        assert isinstance(result, PlayboardBadError)

    @pytest.mark.asyncio
    async def test_update_status_not_found(self, playboard_service, mock_db):
        """Test updating status of non-existent playboard"""
        mock_db.playboards.update_one = AsyncMock(
            return_value=MagicMock(matched_count=0)
        )
        
        with pytest.raises(PlayboardBadError):
            await playboard_service.update_status("nonexistent", "A")

    @pytest.mark.asyncio
    async def test_delete_success(self, playboard_service, mock_db):
        """Test deleting (deactivating) a playboard"""
        mock_db.playboards.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        
        result = await playboard_service.delete("507f1f77bcf86cd799439015")
        
        assert result["message"] == "Playboard deleted successfully"

    @pytest.mark.asyncio
    async def test_delete_not_found(self, playboard_service, mock_db):
        """Test deleting non-existent playboard"""
        mock_db.playboards.update_one = AsyncMock(
            return_value=MagicMock(matched_count=0)
        )
        
        with pytest.raises(PlayboardNotFoundError):
            await playboard_service.delete("nonexistent")
