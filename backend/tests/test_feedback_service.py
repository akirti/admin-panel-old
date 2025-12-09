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

    # ===================== Additional Tests for Coverage =====================

    @pytest.mark.asyncio
    async def test_update_with_email_error(self, feedback_service, mock_db, mock_email_service, sample_feedback_data):
        """Test updating feedback when email sending fails"""
        from easylifeauth.errors.email_error import EmailError

        mock_db.feedbacks.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        mock_db.feedbacks.find_one = AsyncMock(return_value=sample_feedback_data)
        mock_email_service.send_feedback_email = AsyncMock(side_effect=EmailError("Email failed"))

        # Should not raise, just log the error
        result = await feedback_service.update({
            "feedback_id": "507f1f77bcf86cd799439016",
            "rating": 4
        })

        assert result is not None

    @pytest.mark.asyncio
    async def test_get_all_admin(self, feedback_service, mock_db, sample_feedback_data):
        """Test getting all feedback as admin"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_feedback_data])
        mock_db.feedbacks.find = MagicMock(return_value=mock_cursor)

        result = await feedback_service.get_all(
            user_email="admin@test.com",
            user_roles=["administrator"]
        )

        assert len(result) == 1
        # Admin should see all feedback (empty query)
        mock_db.feedbacks.find.assert_called_once_with({})

    @pytest.mark.asyncio
    async def test_get_all_regular_user(self, feedback_service, mock_db, sample_feedback_data):
        """Test getting all feedback as regular user (filtered by email)"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_feedback_data])
        mock_db.feedbacks.find = MagicMock(return_value=mock_cursor)

        result = await feedback_service.get_all(
            user_email="user@test.com",
            user_roles=["user"]
        )

        assert len(result) == 1
        # Regular user should only see their own feedback
        mock_db.feedbacks.find.assert_called_once_with({"email": "user@test.com"})

    @pytest.mark.asyncio
    async def test_get_all_super_admin(self, feedback_service, mock_db, sample_feedback_data):
        """Test getting all feedback as super-administrator"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_feedback_data])
        mock_db.feedbacks.find = MagicMock(return_value=mock_cursor)

        result = await feedback_service.get_all(
            user_email="superadmin@test.com",
            user_roles=["super-administrator"]
        )

        assert len(result) == 1
        mock_db.feedbacks.find.assert_called_once_with({})

    @pytest.mark.asyncio
    async def test_get_all_editor(self, feedback_service, mock_db, sample_feedback_data):
        """Test getting all feedback as editor"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_feedback_data])
        mock_db.feedbacks.find = MagicMock(return_value=mock_cursor)

        result = await feedback_service.get_all(
            user_email="editor@test.com",
            user_roles=["editor"]
        )

        assert len(result) == 1
        mock_db.feedbacks.find.assert_called_once_with({})

    @pytest.mark.asyncio
    async def test_get_all_no_roles(self, feedback_service, mock_db, sample_feedback_data):
        """Test getting all feedback with no roles provided"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_feedback_data])
        mock_db.feedbacks.find = MagicMock(return_value=mock_cursor)

        result = await feedback_service.get_all()

        assert len(result) == 1
        mock_db.feedbacks.find.assert_called_once_with({})

    @pytest.mark.asyncio
    async def test_save_public_success(self, feedback_service, mock_db, sample_feedback_data):
        """Test saving public feedback"""
        mock_db.feedbacks.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        mock_db.feedbacks.find_one = AsyncMock(return_value=sample_feedback_data)

        result = await feedback_service.save_public({
            "rating": 4,
            "improvements": "Better UI",
            "email": "public@example.com"
        })

        assert result is not None
        assert result["rating"] == 5

    @pytest.mark.asyncio
    async def test_save_public_empty_data(self, feedback_service):
        """Test saving public feedback with empty data"""
        with pytest.raises(AuthError) as exc_info:
            await feedback_service.save_public({})
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_save_public_none_data(self, feedback_service):
        """Test saving public feedback with None data"""
        with pytest.raises(AuthError) as exc_info:
            await feedback_service.save_public(None)
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_save_public_no_email(self, feedback_service):
        """Test saving public feedback without email"""
        with pytest.raises(AuthError) as exc_info:
            await feedback_service.save_public({"rating": 4})
        assert exc_info.value.status_code == 400
        assert "Email is required" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_save_public_with_email_error(self, feedback_service, mock_db, mock_email_service, sample_feedback_data):
        """Test saving public feedback when email fails"""
        from easylifeauth.errors.email_error import EmailError

        mock_db.feedbacks.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        mock_db.feedbacks.find_one = AsyncMock(return_value=sample_feedback_data)
        mock_email_service.send_feedback_email = AsyncMock(side_effect=EmailError("Email failed"))

        # Should not raise, just log the error
        result = await feedback_service.save_public({
            "rating": 4,
            "email": "public@example.com"
        })

        assert result is not None

    @pytest.mark.asyncio
    async def test_get_paginated_basic(self, feedback_service, mock_db, sample_feedback_data):
        """Test getting paginated feedback list"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_feedback_data])

        mock_db.feedbacks.find = MagicMock(return_value=mock_cursor)
        mock_db.feedbacks.count_documents = AsyncMock(return_value=50)

        result = await feedback_service.get_paginated(page=0, limit=25)

        assert "data" in result
        assert "pagination" in result
        assert result["pagination"]["total"] == 50
        assert result["pagination"]["page"] == 0
        assert result["pagination"]["limit"] == 25
        assert result["pagination"]["pages"] == 2
        assert result["pagination"]["has_next"] is True
        assert result["pagination"]["has_prev"] is False

    @pytest.mark.asyncio
    async def test_get_paginated_with_search(self, feedback_service, mock_db, sample_feedback_data):
        """Test getting paginated feedback with search"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_feedback_data])

        mock_db.feedbacks.find = MagicMock(return_value=mock_cursor)
        mock_db.feedbacks.count_documents = AsyncMock(return_value=10)

        result = await feedback_service.get_paginated(
            page=0,
            limit=25,
            search="test@"
        )

        assert "data" in result
        # Verify search query was constructed
        mock_db.feedbacks.find.assert_called_once()
        call_args = mock_db.feedbacks.find.call_args[0][0]
        assert "email" in call_args
        assert call_args["email"]["$regex"] == "test@"

    @pytest.mark.asyncio
    async def test_get_paginated_with_rating_filter(self, feedback_service, mock_db, sample_feedback_data):
        """Test getting paginated feedback with rating filter"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_feedback_data])

        mock_db.feedbacks.find = MagicMock(return_value=mock_cursor)
        mock_db.feedbacks.count_documents = AsyncMock(return_value=5)

        result = await feedback_service.get_paginated(
            page=0,
            limit=25,
            rating=5
        )

        assert "data" in result
        # Verify rating filter was applied
        mock_db.feedbacks.find.assert_called_once()
        call_args = mock_db.feedbacks.find.call_args[0][0]
        assert "rating" in call_args
        assert call_args["rating"] == 5

    @pytest.mark.asyncio
    async def test_get_paginated_ascending_sort(self, feedback_service, mock_db, sample_feedback_data):
        """Test getting paginated feedback with ascending sort"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_feedback_data])

        mock_db.feedbacks.find = MagicMock(return_value=mock_cursor)
        mock_db.feedbacks.count_documents = AsyncMock(return_value=10)

        result = await feedback_service.get_paginated(
            page=0,
            limit=25,
            sort_order="asc"
        )

        assert "data" in result
        # Verify ascending sort (1)
        mock_cursor.sort.assert_called_once_with("createdAt", 1)

    @pytest.mark.asyncio
    async def test_get_paginated_last_page(self, feedback_service, mock_db, sample_feedback_data):
        """Test getting paginated feedback on last page"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_feedback_data])

        mock_db.feedbacks.find = MagicMock(return_value=mock_cursor)
        mock_db.feedbacks.count_documents = AsyncMock(return_value=50)

        result = await feedback_service.get_paginated(page=1, limit=25)

        assert result["pagination"]["has_next"] is False
        assert result["pagination"]["has_prev"] is True

    @pytest.mark.asyncio
    async def test_get_paginated_empty_results(self, feedback_service, mock_db):
        """Test getting paginated feedback with no results"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[])

        mock_db.feedbacks.find = MagicMock(return_value=mock_cursor)
        mock_db.feedbacks.count_documents = AsyncMock(return_value=0)

        result = await feedback_service.get_paginated(page=0, limit=25)

        assert result["data"] == []
        assert result["pagination"]["total"] == 0
        assert result["pagination"]["pages"] == 0

    @pytest.mark.asyncio
    async def test_get_stats_basic(self, feedback_service, mock_db):
        """Test getting feedback statistics"""
        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[
            {"rating": 5},
            {"rating": 4},
            {"rating": 5},
            {"rating": 3}
        ])

        mock_db.feedbacks.count_documents = AsyncMock(side_effect=[100, 25])
        mock_db.feedbacks.find = MagicMock(return_value=mock_cursor)

        result = await feedback_service.get_stats()

        assert "total_feedback" in result
        assert "avg_rating" in result
        assert "this_week_count" in result
        assert "rating_distribution" in result
        assert result["total_feedback"] == 100
        assert result["this_week_count"] == 25
        assert result["avg_rating"] == 4.2  # (5+4+5+3)/4 = 4.25, rounded to 4.2

    @pytest.mark.asyncio
    async def test_get_stats_no_ratings(self, feedback_service, mock_db):
        """Test getting feedback statistics with no ratings"""
        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[])

        mock_db.feedbacks.count_documents = AsyncMock(side_effect=[10, 2])
        mock_db.feedbacks.find = MagicMock(return_value=mock_cursor)

        result = await feedback_service.get_stats()

        assert result["total_feedback"] == 10
        assert result["this_week_count"] == 2
        assert result["avg_rating"] == 0.0
        assert result["rating_distribution"] == {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}

    @pytest.mark.asyncio
    async def test_get_stats_rating_distribution(self, feedback_service, mock_db):
        """Test feedback statistics rating distribution"""
        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[
            {"rating": 1},
            {"rating": 2},
            {"rating": 3},
            {"rating": 3},
            {"rating": 4},
            {"rating": 4},
            {"rating": 4},
            {"rating": 5},
            {"rating": 5},
            {"rating": 5}
        ])

        mock_db.feedbacks.count_documents = AsyncMock(side_effect=[50, 10])
        mock_db.feedbacks.find = MagicMock(return_value=mock_cursor)

        result = await feedback_service.get_stats()

        assert result["rating_distribution"]["1"] == 1
        assert result["rating_distribution"]["2"] == 1
        assert result["rating_distribution"]["3"] == 2
        assert result["rating_distribution"]["4"] == 3
        assert result["rating_distribution"]["5"] == 3

    @pytest.mark.asyncio
    async def test_get_stats_invalid_ratings_ignored(self, feedback_service, mock_db):
        """Test that invalid ratings are ignored in statistics"""
        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[
            {"rating": 5},
            {"rating": 0},  # Invalid - out of range
            {"rating": 6},  # Invalid - out of range
            {"rating": None},  # Invalid - None
            {"rating": 4}
        ])

        mock_db.feedbacks.count_documents = AsyncMock(side_effect=[20, 5])
        mock_db.feedbacks.find = MagicMock(return_value=mock_cursor)

        result = await feedback_service.get_stats()

        # Only ratings 5 and 4 should be counted
        assert result["avg_rating"] == 4.5  # (5+4)/2 = 4.5
        assert result["rating_distribution"]["5"] == 1
        assert result["rating_distribution"]["4"] == 1
        assert result["rating_distribution"]["1"] == 0

    @pytest.mark.asyncio
    async def test_save_without_email_service(self, mock_db, mock_token_manager, sample_feedback_data):
        """Test saving feedback without email service configured"""
        service = FeedbackService(mock_db, mock_token_manager, email_service=None)

        mock_db.feedbacks.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        mock_db.feedbacks.find_one = AsyncMock(return_value=sample_feedback_data)

        result = await service.save({
            "rating": 5,
            "email": "test@example.com"
        })

        assert result is not None

    @pytest.mark.asyncio
    async def test_update_without_email_in_feedback(self, feedback_service, mock_db, mock_email_service):
        """Test updating feedback that has no email field"""
        feedback_without_email = {
            "_id": ObjectId("507f1f77bcf86cd799439016"),
            "rating": 5,
            "improvements": "None"
        }

        mock_db.feedbacks.update_one = AsyncMock(return_value=MagicMock(matched_count=1))
        mock_db.feedbacks.find_one = AsyncMock(return_value=feedback_without_email)

        result = await feedback_service.update({
            "feedback_id": "507f1f77bcf86cd799439016",
            "rating": 4
        })

        assert result is not None
        # Email service should not be called since there's no email
        mock_email_service.send_feedback_email.assert_not_called()
