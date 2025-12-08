"""Tests for Feedback Service"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId

from easylifeauth.services.feedback_service import FeedbackService
from easylifeauth.errors.auth_error import AuthError


class TestFeedbackService:
    """Tests for FeedbackService"""

    @pytest.fixture
    def feedback_service(self, mock_db, mock_token_manager, mock_email_service):
        """Create feedback service with mocks"""
        return FeedbackService(mock_db, mock_token_manager, mock_email_service)

    @pytest.mark.asyncio
    async def test_save_success(self, feedback_service, mock_db, sample_feedback_data):
        """Test saving feedback"""
        mock_db.feedbacks.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        mock_db.feedbacks.find_one = AsyncMock(return_value=sample_feedback_data)
        
        result = await feedback_service.save({
            "rating": 5,
            "improvements": "None",
            "suggestions": "Great!",
            "email": "test@example.com"
        })
        
        assert result is not None
        assert result["rating"] == 5

    @pytest.mark.asyncio
    async def test_save_empty_data(self, feedback_service):
        """Test saving with empty data"""
        with pytest.raises(AuthError) as exc_info:
            await feedback_service.save({})
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_save_none_data(self, feedback_service):
        """Test saving with None data"""
        with pytest.raises(AuthError) as exc_info:
            await feedback_service.save(None)
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_save_not_dict(self, feedback_service):
        """Test saving with non-dict data"""
        with pytest.raises(AuthError) as exc_info:
            await feedback_service.save("not a dict")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_save_email_error(self, feedback_service, mock_db, mock_email_service, sample_feedback_data):
        """Test saving feedback with email error (should not fail)"""
        from easylifeauth.errors.email_error import EmailError

        mock_db.feedbacks.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        mock_db.feedbacks.find_one = AsyncMock(return_value=sample_feedback_data)
        # Use AsyncMock since send_feedback_email is async (uses await)
        mock_email_service.send_feedback_email = AsyncMock(
            side_effect=EmailError("Email failed")
        )

        # Should not raise, just log the error
        result = await feedback_service.save({
            "rating": 5,
            "email": "test@example.com"
        })

        assert result is not None

    @pytest.mark.asyncio
    async def test_update_success(self, feedback_service, mock_db, sample_feedback_data):
        """Test updating feedback"""
        mock_db.feedbacks.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.feedbacks.find_one = AsyncMock(return_value=sample_feedback_data)
        
        result = await feedback_service.update({
            "feedback_id": "507f1f77bcf86cd799439016",
            "rating": 4
        })
        
        assert result is not None

    @pytest.mark.asyncio
    async def test_update_missing_id(self, feedback_service):
        """Test updating without feedback_id"""
        with pytest.raises(AuthError) as exc_info:
            await feedback_service.update({"rating": 4})
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_update_no_valid_fields(self, feedback_service):
        """Test updating with only feedback_id and no other fields"""
        with pytest.raises(AuthError) as exc_info:
            await feedback_service.update({
                "feedback_id": "507f1f77bcf86cd799439016"
            })
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_update_not_found(self, feedback_service, mock_db):
        """Test updating non-existent feedback"""
        mock_db.feedbacks.update_one = AsyncMock(
            return_value=MagicMock(matched_count=0)
        )

        with pytest.raises(AuthError) as exc_info:
            await feedback_service.update({
                "feedback_id": "507f1f77bcf86cd799439099",
                "rating": 4
            })
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_success(self, feedback_service, mock_db, sample_feedback_data):
        """Test getting feedback"""
        mock_db.feedbacks.find_one = AsyncMock(return_value=sample_feedback_data)
        
        result = await feedback_service.get("507f1f77bcf86cd799439016")
        
        assert result is not None
        assert result["rating"] == 5

    @pytest.mark.asyncio
    async def test_get_missing_id(self, feedback_service):
        """Test getting feedback without ID"""
        with pytest.raises(AuthError) as exc_info:
            await feedback_service.get(None)
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_get_not_found(self, feedback_service, mock_db):
        """Test getting non-existent feedback"""
        mock_db.feedbacks.find_one = AsyncMock(return_value=None)

        with pytest.raises(AuthError) as exc_info:
            await feedback_service.get("507f1f77bcf86cd799439099")
        assert exc_info.value.status_code == 404
