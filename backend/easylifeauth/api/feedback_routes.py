"""Async Feedback Routes"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status

from .models import FeedbackCreate, FeedbackUpdate, FeedbackResponse, MessageResponse
from .dependencies import get_current_user, get_feedback_service
from ..services.feedback_service import FeedbackService
from ..security.access_control import CurrentUser
from ..errors.auth_error import AuthError

router = APIRouter(prefix="/feedback", tags=["Feedback"])


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def create_feedback(
    data: FeedbackCreate,
    current_user: CurrentUser = Depends(get_current_user),
    feedback_service: FeedbackService = Depends(get_feedback_service)
):
    """Create new feedback"""
    try:
        feedback_data = data.model_dump()
        feedback_data["user_id"] = current_user.user_id
        feedback_data["email"] = current_user.email
        result = await feedback_service.save(feedback_data)
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put("/{feedback_id}", response_model=FeedbackResponse)
async def update_feedback(
    feedback_id: str,
    data: FeedbackUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    feedback_service: FeedbackService = Depends(get_feedback_service)
):
    """Update feedback"""
    try:
        update_data = data.model_dump(exclude_unset=True)
        update_data["feedback_id"] = feedback_id
        result = await feedback_service.update(update_data)
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/{feedback_id}", response_model=FeedbackResponse)
async def get_feedback(
    feedback_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    feedback_service: FeedbackService = Depends(get_feedback_service)
):
    """Get feedback by ID"""
    try:
        result = await feedback_service.get(feedback_id)
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/all", response_model=List[FeedbackResponse])
async def get_all_feedback(
    current_user: CurrentUser = Depends(get_current_user),
    feedback_service: FeedbackService = Depends(get_feedback_service)
):
    """Get all feedback (filtered by role)"""
    try:
        result = await feedback_service.get_all(
            user_email=current_user.email,
            user_roles=current_user.roles
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
