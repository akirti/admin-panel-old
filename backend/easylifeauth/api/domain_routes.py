"""Async Domain Routes"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status

from .models import DomainCreate, DomainUpdate, DomainResponse, MessageResponse
from .dependencies import get_current_user, get_domain_service
from ..services.domain_service import DataDomainService
from ..security.access_control import CurrentUser, require_admin_or_editor
from ..errors.domain_error import DomainError, DomainNotFoundError, DomainBadError

router = APIRouter(prefix="/domains", tags=["Domains"])


@router.get("/all")
async def get_all_domains(
    current_user: CurrentUser = Depends(get_current_user),
    domain_service: DataDomainService = Depends(get_domain_service)
) -> List[Dict[str, Any]]:
    """Get all domains"""
    try:
        result = await domain_service.get_all()
        return result
    except (DomainError, DomainBadError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("", response_model=DomainResponse, status_code=status.HTTP_201_CREATED)
async def create_domain(
    data: DomainCreate,
    current_user: CurrentUser = Depends(require_admin_or_editor),
    domain_service: DataDomainService = Depends(get_domain_service)
):
    """Create a new domain"""
    try:
        result = await domain_service.save(
            data.model_dump(),
            user_id=current_user.user_id
        )
        return result
    except (DomainError, DomainBadError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put("/{key}", response_model=DomainResponse)
async def update_domain(
    key: str,
    data: DomainUpdate,
    current_user: CurrentUser = Depends(require_admin_or_editor),
    domain_service: DataDomainService = Depends(get_domain_service)
):
    """Update a domain"""
    if data.id and data.id != key:
        raise HTTPException(status_code=400, detail="ID mismatch")
    
    try:
        update_data = data.model_dump(exclude_unset=True)
        update_data["_id"] = key
        result = await domain_service.update(update_data, user_id=current_user.user_id)
        return result
    except DomainNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except (DomainError, DomainBadError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/{key}", response_model=DomainResponse)
async def get_domain(
    key: str,
    current_user: CurrentUser = Depends(get_current_user),
    domain_service: DataDomainService = Depends(get_domain_service)
):
    """Get domain by key or ID"""
    try:
        result = await domain_service.get(key)
        if not result:
            raise HTTPException(status_code=404, detail="Domain not found")
        return result
    except DomainNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except (DomainError, DomainBadError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.delete("/{key}", response_model=MessageResponse)
async def delete_domain(
    key: str,
    current_user: CurrentUser = Depends(require_admin_or_editor),
    domain_service: DataDomainService = Depends(get_domain_service)
):
    """Delete domain (set to inactive)"""
    try:
        result = await domain_service.delete(key)
        return result
    except DomainNotFoundError as e:
        raise HTTPException(status_code=404, detail=e.message)
    except (DomainError, DomainBadError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
