"""Tests for Domain Service"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId

from easylifeauth.services.domain_service import DataDomainService
from easylifeauth.errors.domain_error import DomainNotFoundError, DomainBadError


class TestDomainService:
    """Tests for DataDomainService"""

    @pytest.fixture
    def domain_service(self, mock_db):
        """Create domain service with mocks"""
        return DataDomainService(mock_db)

    @pytest.mark.asyncio
    async def test_get_all_success(self, domain_service, mock_db, sample_domain_data):
        """Test getting all domains"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_domain_data])
        mock_db.domains.find = MagicMock(return_value=mock_cursor)
        
        result = await domain_service.get_all()
        
        assert len(result) == 1
        assert result[0]["key"] == "test-domain"

    @pytest.mark.asyncio
    async def test_get_domain_by_key_success(self, domain_service, mock_db, sample_domain_data):
        """Test getting domain by key"""
        mock_db.domains.find_one = AsyncMock(return_value=sample_domain_data)
        
        result = await domain_service.get_domain_by_key("test-domain")
        
        assert result["key"] == "test-domain"

    @pytest.mark.asyncio
    async def test_get_domain_by_key_not_found(self, domain_service, mock_db):
        """Test getting non-existent domain by key"""
        mock_db.domains.find_one = AsyncMock(return_value=None)
        
        result = await domain_service.get_domain_by_key("nonexistent")
        
        assert result is None

    @pytest.mark.asyncio
    async def test_get_by_object_id(self, domain_service, mock_db, sample_domain_data):
        """Test getting domain by ObjectId"""
        mock_db.domains.find_one = AsyncMock(return_value=sample_domain_data)
        
        result = await domain_service.get("507f1f77bcf86cd799439013")
        
        assert result["key"] == "test-domain"

    @pytest.mark.asyncio
    async def test_get_by_key_string(self, domain_service, mock_db, sample_domain_data):
        """Test getting domain by key string"""
        mock_db.domains.find_one = AsyncMock(return_value=sample_domain_data)
        
        result = await domain_service.get("test-domain")
        
        assert result["key"] == "test-domain"

    @pytest.mark.asyncio
    async def test_get_not_found(self, domain_service, mock_db):
        """Test getting non-existent domain"""
        mock_db.domains.find_one = AsyncMock(return_value=None)
        
        result = await domain_service.get("nonexistent")
        
        assert result is None

    @pytest.mark.asyncio
    async def test_save_success(self, domain_service, mock_db, sample_domain_data):
        """Test saving a new domain"""
        mock_db.domains.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        mock_db.domains.find_one = AsyncMock(return_value=sample_domain_data)
        
        result = await domain_service.save(
            {"key": "new-domain", "name": "New Domain"},
            user_id="507f1f77bcf86cd799439011"
        )
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_save_bad_data(self, domain_service, mock_db):
        """Test saving with bad data"""
        result = await domain_service.save(None, user_id="test")
        
        assert isinstance(result, DomainBadError)

    @pytest.mark.asyncio
    async def test_save_not_dict(self, domain_service, mock_db):
        """Test saving with non-dict data"""
        result = await domain_service.save("not a dict", user_id="test")
        
        assert isinstance(result, DomainBadError)

    @pytest.mark.asyncio
    async def test_update_success(self, domain_service, mock_db, sample_domain_data):
        """Test updating a domain"""
        mock_db.domains.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.domains.find_one = AsyncMock(return_value=sample_domain_data)
        
        result = await domain_service.update(
            {"_id": "507f1f77bcf86cd799439013", "name": "Updated Domain"},
            user_id="507f1f77bcf86cd799439011"
        )
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_update_not_found(self, domain_service, mock_db):
        """Test updating non-existent domain"""
        mock_db.domains.update_one = AsyncMock(
            return_value=MagicMock(matched_count=0)
        )
        
        with pytest.raises(DomainNotFoundError):
            await domain_service.update(
                {"_id": "nonexistent", "name": "Updated"},
                user_id="test"
            )

    @pytest.mark.asyncio
    async def test_update_status_success(self, domain_service, mock_db, sample_domain_data):
        """Test updating domain status"""
        mock_db.domains.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.domains.find_one = AsyncMock(return_value=sample_domain_data)
        
        result = await domain_service.update_status("507f1f77bcf86cd799439013", "I")
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_update_status_bad_values(self, domain_service, mock_db):
        """Test updating status with bad values"""
        result = await domain_service.update_status(None, "X")
        
        assert isinstance(result, DomainBadError)

    @pytest.mark.asyncio
    async def test_update_status_not_found(self, domain_service, mock_db):
        """Test updating status of non-existent domain"""
        mock_db.domains.update_one = AsyncMock(
            return_value=MagicMock(matched_count=0)
        )
        
        with pytest.raises(DomainNotFoundError):
            await domain_service.update_status("nonexistent", "A")

    @pytest.mark.asyncio
    async def test_delete_success(self, domain_service, mock_db, sample_domain_data):
        """Test deleting (deactivating) a domain"""
        mock_db.domains.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        
        result = await domain_service.delete("507f1f77bcf86cd799439013")
        
        assert result["message"] == "Domain deleted successfully"

    @pytest.mark.asyncio
    async def test_delete_not_found(self, domain_service, mock_db):
        """Test deleting non-existent domain"""
        mock_db.domains.update_one = AsyncMock(
            return_value=MagicMock(matched_count=0)
        )
        
        with pytest.raises(DomainNotFoundError):
            await domain_service.delete("nonexistent")
