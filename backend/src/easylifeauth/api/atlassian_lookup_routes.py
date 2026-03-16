"""Atlassian Lookup API Routes — board and user search"""
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from .dependencies import get_atlassian_lookup_service, get_current_user
from ..services.atlassian_lookup_service import AtlassianLookupService
from ..security.access_control import CurrentUser

router = APIRouter(prefix="/atlassian/search", tags=["atlassian-lookup"])

_SERVICE_NOT_CONFIGURED = "Atlassian lookup service not configured"
SERVICE_UNAVAILABLE_RESP = {503: {"description": _SERVICE_NOT_CONFIGURED}}


@router.get("/boards", responses=SERVICE_UNAVAILABLE_RESP)
async def search_boards(
    project_key: Annotated[Optional[str], Query(description="Project key to filter boards")] = None,
    search: Annotated[Optional[str], Query(description="Board name search string")] = None,
    max_results: Annotated[int, Query(ge=1, le=100, description="Maximum results")] = 50,
    current_user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    service: Annotated[AtlassianLookupService, Depends(get_atlassian_lookup_service)] = None,
):
    """Search Jira boards (teams) with server-side name filtering"""
    if not service or not service.enabled:
        raise HTTPException(status_code=503, detail=_SERVICE_NOT_CONFIGURED)

    return await service.search_boards(
        project_key=project_key,
        search=search,
        max_results=max_results,
    )


@router.get("/users", responses=SERVICE_UNAVAILABLE_RESP)
async def search_users(
    q: Annotated[Optional[str], Query(description="Search query for user name/email")] = None,
    project_key: Annotated[Optional[str], Query(description="Project key context")] = None,
    max_results: Annotated[int, Query(ge=1, le=100, description="Maximum results")] = 50,
    current_user: Annotated[CurrentUser, Depends(get_current_user)] = None,
    service: Annotated[AtlassianLookupService, Depends(get_atlassian_lookup_service)] = None,
):
    """Search Jira users by name or email"""
    if not service or not service.enabled:
        raise HTTPException(status_code=503, detail=_SERVICE_NOT_CONFIGURED)

    return await service.search_users(
        query=q,
        max_results=max_results,
    )
