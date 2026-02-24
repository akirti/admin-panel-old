"""Async Feedback Routes"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query

from .models import (
    FeedbackCreate, FeedbackUpdate, FeedbackResponse, MessageResponse,
    PublicFeedbackCreate, FeedbackStats, PaginatedFeedbackResponse
)
from .dependencies import get_current_user, get_feedback_service
from ..services.feedback_service import FeedbackService
from ..security.access_control import CurrentUser, require_admin
from ..db.constants import EDITORS
from ..errors.auth_error import AuthError

router = APIRouter(prefix="/feedback", tags=["Feedback"])


# Static routes MUST come before parameterized routes like /{feedback_id}

@router.post("/public", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def create_public_feedback(
    data: PublicFeedbackCreate,
    feedback_service: FeedbackService = Depends(get_feedback_service)
):
    """Create feedback from unauthenticated users (public endpoint)"""
    try:
        feedback_data = data.model_dump()
        result = await feedback_service.save_public(feedback_data)
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/stats", response_model=FeedbackStats)
async def get_feedback_stats(
    current_user: CurrentUser = Depends(require_admin),
    feedback_service: FeedbackService = Depends(get_feedback_service)
):
    """Get feedback statistics for dashboard"""
    try:
        result = await feedback_service.get_stats()
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


@router.get("/admin/list", response_model=PaginatedFeedbackResponse)
async def get_admin_feedback_list(
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by email"),
    rating: Optional[int] = Query(None, ge=1, le=5, description="Filter by rating (1-5)"),
    sort_by: str = Query("createdAt", description="Field to sort by"),
    sort_order: str = Query("desc", description="Sort order (asc/desc)"),
    current_user: CurrentUser = Depends(require_admin),
    feedback_service: FeedbackService = Depends(get_feedback_service)
):
    """Get paginated feedback list for administrators"""
    try:
        result = await feedback_service.get_paginated(
            page=page,
            limit=limit,
            search=search,
            rating=rating,
            sort_by=sort_by,
            sort_order=sort_order
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


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
        # Ownership check: only creator or editor+ can update
        if not any(r in EDITORS for r in current_user.roles):
            existing = await feedback_service.get(feedback_id)
            if existing.get("user_id") != current_user.user_id and existing.get("email") != current_user.email:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only update your own feedback")

        update_data = data.model_dump(exclude_unset=True)
        update_data["feedback_id"] = feedback_id
        result = await feedback_service.update(update_data)
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


# Parameterized route MUST come last
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
