"""Async Feedback Service"""
import re
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import math

from ..db.db_manager import DatabaseManager
from .token_manager import TokenManager
from .email_service import EmailService
from ..errors.auth_error import AuthError


class FeedbackService:
    """Async Feedback Service"""
    
    def __init__(
        self,
        db: DatabaseManager,
        token_manager: TokenManager,
        email_service: Optional[EmailService] = None
    ):
        self.db = db
        self.token_manager = token_manager
        self.email_service = email_service

    async def save(self, feedback_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save new feedback"""
        if not feedback_data or not isinstance(feedback_data, dict):
            raise AuthError("Feedback data is required", 400)
        
        feedback_data["createdAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %I:%M:%S %p")
        
        result = await self.db.feedbacks.insert_one(feedback_data)
        feedback = await self.db.feedbacks.find_one({"_id": ObjectId(result.inserted_id)})
        feedback["_id"] = str(feedback["_id"])
        
        # Send email notification
        if self.email_service:
            try:
                email = feedback.get('email')
                if email:
                    await self.email_service.send_feedback_email(to_email=email, data=feedback)
            except Exception as e:
                print(f"Failed to send feedback email: {e}")
        
        return feedback

    async def update(self, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update feedback"""
        feedback_id = update_data.get("feedback_id")
        if not feedback_id:
            raise AuthError("feedback_id is required for update", 400)

        update_fields = {k: v for k, v in update_data.items() if k != "feedback_id"}

        if not update_fields:
            raise AuthError("No valid fields to update", 400)

        update_fields["updatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %I:%M:%S %p")

        result = await self.db.feedbacks.update_one(
            {"_id": ObjectId(feedback_id)},
            {"$set": update_fields}
        )

        if result.matched_count == 0:
            raise AuthError("Feedback not found", 404)

        updated = await self.db.feedbacks.find_one({"_id": ObjectId(feedback_id)})
        updated["_id"] = str(updated["_id"])
        
        # Send email notification
        if self.email_service:
            try:
                email = updated.get('email')
                if email:
                    await self.email_service.send_feedback_email(to_email=email, data=updated)
            except Exception as e:
                print(f"Failed to send feedback email: {e}")
            
        return updated

    async def get(self, feedback_id: str) -> Dict[str, Any]:
        """Get feedback by ID"""
        if not feedback_id:
            raise AuthError("feedback_id is required", 400)

        feedback = await self.db.feedbacks.find_one({"_id": ObjectId(feedback_id)})
        if not feedback:
            raise AuthError("Feedback not found", 404)

        feedback["_id"] = str(feedback["_id"])
        return feedback

    async def get_all(
        self,
        user_email: Optional[str] = None,
        user_roles: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Get all feedback (filtered by role)"""
        query = {}
        
        # If not admin/editor, only show own feedback
        if user_roles:
            is_admin = any(r in user_roles for r in ["administrator", "super-administrator", "editor"])
            if not is_admin and user_email:
                query = {"email": user_email}
        
        cursor = self.db.feedbacks.find(query).sort("createdAt", -1)
        results = await cursor.to_list(length=1000)

        for doc in results:
            doc["_id"] = str(doc["_id"])

        return results

    async def save_public(self, feedback_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save public feedback from unauthenticated users"""
        if not feedback_data or not isinstance(feedback_data, dict):
            raise AuthError("Feedback data is required", 400)

        if not feedback_data.get("email"):
            raise AuthError("Email is required for public feedback", 400)

        feedback_data["createdAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%d %I:%M:%S %p")
        feedback_data["is_public"] = True  # Mark as public submission

        result = await self.db.feedbacks.insert_one(feedback_data)
        feedback = await self.db.feedbacks.find_one({"_id": ObjectId(result.inserted_id)})
        feedback["_id"] = str(feedback["_id"])

        # Send email notification
        if self.email_service:
            try:
                email = feedback.get('email')
                if email:
                    await self.email_service.send_feedback_email(to_email=email, data=feedback)
            except Exception as e:
                print(f"Failed to send feedback email: {e}")

        return feedback

    async def get_paginated(
        self,
        page: int = 0,
        limit: int = 25,
        search: Optional[str] = None,
        rating: Optional[int] = None,
        sort_by: str = "createdAt",
        sort_order: str = "desc"
    ) -> Dict[str, Any]:
        """Get paginated feedback list for admin"""
        query = {}

        # Search by email
        if search:
            query["email"] = {"$regex": re.escape(search), "$options": "i"}

        # Filter by rating
        if rating is not None:
            query["rating"] = rating

        # Get total count
        total = await self.db.feedbacks.count_documents(query)

        # Calculate pagination
        pages = math.ceil(total / limit) if limit > 0 else 0
        skip = page * limit

        # Sort direction
        sort_direction = -1 if sort_order == "desc" else 1

        # Fetch paginated results
        cursor = self.db.feedbacks.find(query).sort(sort_by, sort_direction).skip(skip).limit(limit)
        results = await cursor.to_list(length=limit)

        for doc in results:
            doc["_id"] = str(doc["_id"])

        return {
            "data": results,
            "pagination": {
                "total": total,
                "page": page,
                "limit": limit,
                "pages": pages,
                "has_next": page < pages - 1,
                "has_prev": page > 0
            }
        }

    async def get_stats(self) -> Dict[str, Any]:
        """Get feedback statistics for dashboard"""
        # Total feedback count
        total = await self.db.feedbacks.count_documents({})

        # This week count
        week_ago = datetime.now(timezone.utc) - timedelta(days=7)
        week_ago_str = week_ago.strftime("%Y-%m-%d")
        this_week_count = await self.db.feedbacks.count_documents({
            "createdAt": {"$gte": week_ago_str}
        })

        # Calculate average rating and distribution
        all_feedback = await self.db.feedbacks.find(
            {"rating": {"$exists": True, "$ne": None}},
            {"rating": 1}
        ).to_list(length=10000)

        rating_distribution = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
        total_rating = 0
        rating_count = 0

        for fb in all_feedback:
            rating = fb.get("rating")
            if rating and 1 <= rating <= 5:
                rating_distribution[str(rating)] += 1
                total_rating += rating
                rating_count += 1

        avg_rating = round(total_rating / rating_count, 1) if rating_count > 0 else 0.0

        return {
            "total_feedback": total,
            "avg_rating": avg_rating,
            "this_week_count": this_week_count,
            "rating_distribution": rating_distribution
        }
