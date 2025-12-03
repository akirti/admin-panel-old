"""Async Playboard Routes"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status

from .models import PlayboardCreate, PlayboardUpdate, PlayboardResponse, MessageResponse
from .dependencies import get_current_user, get_playboard_service
from ..services.playboard_service import PlayboardService
from ..security.access_control import CurrentUser, require_admin_or_editor
from ..errors.playboard_error import PlayboardError, PlayboardNotFoundError, PlayboardBadError

router = APIRouter(prefix="/playboards", tags=["Playboards"])


@router.get("/all")
async def get_all_playboards(
    current_user: CurrentUser = Depends(get_current_user),
    playboard_service: PlayboardService = Depends(get_playboard_service)
) -> List[Dict[str, Any]]:
    """Get all playboards"""
    try:
        result = await playboard_service.get_all()
        return result
    except (PlayboardError, PlayboardBadError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/all/{domain_key}")
async def get_playboards_by_domain(
    domain_key: str,
    current_user: CurrentUser = Depends(get_current_user),
    playboard_service: PlayboardService = Depends(get_playboard_service)
) -> List[Dict[str, Any]]:
    """Get all playboards for a domain"""
    try:
        result = await playboard_service.get_all_by_data_domain_key(domain_key)
        return result
    except (PlayboardError, PlayboardBadError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("", response_model=PlayboardResponse, status_code=status.HTTP_201_CREATED)
async def create_playboard(
    data: PlayboardCreate,
    current_user: CurrentUser = Depends(require_admin_or_editor),
    playboard_service: PlayboardService = Depends(get_playboard_service)
):
    """Create a new playboard"""
    try:
        result = await playboard_service.save(
            data.model_dump(),
            user_id=current_user.user_id
        )
        return result
    except (PlayboardError, PlayboardBadError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put("/{key}", response_model=PlayboardResponse)
async def update_playboard(
    key: str,
    data: PlayboardUpdate,
    current_user: CurrentUser = Depends(require_admin_or_editor),
    playboard_service: PlayboardService = Depends(get_playboard_service)
):
    """Update a playboard"""
    if data.id and data.id != key:
        raise HTTPException(status_code=400, detail="ID mismatch")
    
    try:
        update_data = data.model_dump(exclude_unset=True)
        update_data["_id"] = key
        result = await playboard_service.update(update_data, user_id=current_user.user_id)
        return result
    except PlayboardNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except (PlayboardError, PlayboardBadError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/{key}", response_model=PlayboardResponse)
async def get_playboard(
    key: str,
    current_user: CurrentUser = Depends(get_current_user),
    playboard_service: PlayboardService = Depends(get_playboard_service)
):
    """Get playboard by key or ID"""
    try:
        result = await playboard_service.get(key)
        if not result:
            raise HTTPException(status_code=404, detail="Playboard not found")
        return result
    except PlayboardNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except (PlayboardError, PlayboardBadError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.delete("/{key}", response_model=MessageResponse)
async def delete_playboard(
    key: str,
    current_user: CurrentUser = Depends(require_admin_or_editor),
    playboard_service: PlayboardService = Depends(get_playboard_service)
):
    """Delete playboard (set to inactive)"""
    try:
        result = await playboard_service.delete(key)
        return result
    except PlayboardNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except (PlayboardError, PlayboardBadError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
