"""Async Scenario Request Routes"""
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query

from .models import (
    ScenarioRequestCreate, ScenarioRequestUpdate,
    ScenarioRequestResponse, PaginatedScenarioRequestsResponse
)
from .dependencies import get_current_user, get_scenario_request_service
from ..services.new_scenarios_service import NewScenarioService
from ..security.access_control import CurrentUser, require_admin_or_editor
from ..db.constants import EDITORS
from ..errors.auth_error import AuthError

router = APIRouter(prefix="/ask_scenarios", tags=["Scenario Requests"])


@router.get("/all")
async def get_all_scenario_requests(
    page: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
) -> Dict[str, Any]:
    """Get all scenario requests (filtered by user role)"""
    try:
        # Editors and admins see all, users see only their own
        user_id = current_user.user_id
        if any(r in EDITORS for r in current_user.roles):
            user_id = None
        
        result = await scenario_request_service.get_all(
            user_id=user_id,
            pagination={"page": page, "limit": limit}
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("", response_model=ScenarioRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_scenario_request(
    data: ScenarioRequestCreate,
    current_user: CurrentUser = Depends(get_current_user),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
):
    """Create a new scenario request"""
    try:
        request_data = data.model_dump()
        request_data["user_id"] = current_user.user_id
        request_data["email"] = current_user.email
        request_data["rowAddUserId"] = current_user.user_id
        request_data["rowUpdateUserId"] = current_user.user_id
        
        # Generate name from email
        email = current_user.email
        request_data["name"] = email[:email.find("@")].replace(".", " ").replace("_", " ").title()
        
        result = await scenario_request_service.save(request_data)
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put("/{request_id}", response_model=ScenarioRequestResponse)
async def update_scenario_request(
    request_id: str,
    data: ScenarioRequestUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
):
    """Update a scenario request"""
    try:
        update_data = data.model_dump(exclude_unset=True)
        update_data["rowUpdateUserId"] = current_user.user_id
        update_data["user_id"] = current_user.user_id
        update_data["request_id"] = request_id
        
        result = await scenario_request_service.update(update_data, current_user.roles)
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/{request_id}", response_model=ScenarioRequestResponse)
async def get_scenario_request(
    request_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
):
    """Get scenario request by ID"""
    try:
        result = await scenario_request_service.get(request_id)
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
