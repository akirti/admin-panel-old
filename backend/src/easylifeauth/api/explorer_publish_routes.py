"""API routes for publishing EasyWeaver processes to Explorer."""
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from easylifeauth.security.access_control import get_current_user, CurrentUser

router = APIRouter(prefix="/explorer", tags=["Explorer Publish"])


class PublishRequest(BaseModel):
    process_id: str
    name: str
    description: str
    domain_key: str
    icon: Optional[str] = None
    tags: Optional[List[str]] = None
    republish: bool = False


class PublishResponse(BaseModel):
    scenario_key: str
    playboard_key: str
    message: str


_publish_service = None

def get_publish_service():
    return _publish_service

def set_publish_service(service):
    global _publish_service
    _publish_service = service


@router.post("/publish", response_model=PublishResponse, status_code=201)
async def publish_process(
    request: PublishRequest,
    current_user: CurrentUser = Depends(get_current_user),
    publish_service=Depends(get_publish_service),
):
    allowed_roles = {"editor", "group-editor", "group-administrator",
                     "administrator", "super-administrator"}
    if not any(r in allowed_roles for r in current_user.roles):
        raise HTTPException(status_code=403, detail="Insufficient permissions to publish")

    if "all" not in current_user.domains and request.domain_key not in current_user.domains:
        raise HTTPException(status_code=403, detail="No access to target domain")

    try:
        result = await publish_service.publish(
            process_id=request.process_id,
            name=request.name,
            description=request.description,
            domain_key=request.domain_key,
            token="Bearer placeholder",
            user_email=current_user.email,
            icon=request.icon,
            tags=request.tags,
            republish=request.republish,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
