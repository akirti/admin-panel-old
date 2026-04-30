"""UI Template Management Routes"""
from typing import Annotated, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query

from .dependencies import get_current_user
from ..models.ui_template import (
    UITemplateCreate,
    UITemplateUpdate,
    UITemplateVersionBump,
    TemplateComment,
    WidgetAttribute,
    WidgetOverride,
)

router = APIRouter(prefix="/ui-templates", tags=["UI Templates"])

# ── Constants ─────────────────────────────────────────────
_NOT_FOUND = "Template not found"
_WIDGET_NOT_FOUND = "Template or widget not found"
_RESP_404 = {404: {"description": _NOT_FOUND}}
_RESP_400_404 = {400: {"description": "Bad request"}, 404: {"description": _NOT_FOUND}}


# ── Dependency: access control ────────────────────────────

def _get_service():
    from .dependencies import get_ui_template_service
    return get_ui_template_service()


def _check_ui_editor_access(current_user) -> None:
    """Raise 403 unless user can edit UI schemas.

    Allowed: super-administrator, administrator, or any role with ui-editors group.
    """
    roles = current_user.roles or []
    groups = current_user.groups if hasattr(current_user, "groups") else []

    if "super-administrator" in roles or "administrator" in roles:
        return

    if "ui-editors" in (groups or []):
        return

    raise HTTPException(403, "Requires ui-editors group or administrator role")


def require_ui_editor_access(
    current_user: Annotated[object, Depends(get_current_user)],
):
    """Dependency: require ui-editors access for write operations."""
    _check_ui_editor_access(current_user)
    return current_user


# Annotated type aliases for DI
EditorUser = Annotated[object, Depends(require_ui_editor_access)]
AuthenticatedUser = Annotated[object, Depends(get_current_user)]


# ── Endpoints ─────────────────────────────────────────────

@router.get("")
async def list_templates(
    current_user: AuthenticatedUser,
    page: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=500),
    search: Optional[str] = None,
    status: Optional[str] = None,
    page_code: Optional[str] = None,
):
    svc = _get_service()
    templates = await svc.list_templates(page, limit, search, status, page_code)
    total = await svc.count_templates(search, status, page_code)
    pages = (total + limit - 1) // limit if limit else 0
    return {
        "data": templates,
        "pagination": {"page": page, "limit": limit, "total": total, "pages": pages},
    }


@router.get("/count")
async def count_templates(
    current_user: AuthenticatedUser,
    search: Optional[str] = None,
    status: Optional[str] = None,
    page_code: Optional[str] = None,
):
    svc = _get_service()
    total = await svc.count_templates(search, status, page_code)
    return {"count": total}


@router.get("/lookup", responses=_RESP_404)
async def lookup_template(
    current_user: AuthenticatedUser,
    page: str = Query(...),
    component: Optional[str] = None,
):
    """Public lookup: find active template by page + component."""
    svc = _get_service()
    template = await svc.get_by_page(page, component)
    if not template:
        raise HTTPException(404, _NOT_FOUND)
    return template


@router.get("/{template_id}", responses=_RESP_404)
async def get_template(
    template_id: str,
    current_user: AuthenticatedUser,
):
    svc = _get_service()
    template = await svc.get_by_id(template_id)
    if not template:
        raise HTTPException(404, _NOT_FOUND)
    return template


@router.post("", responses={400: {"description": "Bad request"}})
async def create_template(
    body: UITemplateCreate,
    current_user: EditorUser,
):
    svc = _get_service()
    data = body.model_dump()
    if not data.get("author"):
        data["author"] = current_user.email
    try:
        return await svc.create_template(data, current_user.email)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.put("/{template_id}", responses=_RESP_404)
async def update_template(
    template_id: str,
    body: UITemplateUpdate,
    current_user: EditorUser,
):
    svc = _get_service()
    data = body.model_dump(exclude_none=True)
    result = await svc.update_template(template_id, data, current_user.email)
    if not result:
        raise HTTPException(404, _NOT_FOUND)
    return result


@router.delete("/{template_id}", responses=_RESP_404)
async def delete_template(
    template_id: str,
    current_user: EditorUser,
):
    svc = _get_service()
    success = await svc.delete_template(template_id, current_user.email)
    if not success:
        raise HTTPException(404, _NOT_FOUND)
    return {"message": "Template deleted"}


@router.post("/{template_id}/toggle-status", responses=_RESP_404)
async def toggle_status(
    template_id: str,
    current_user: EditorUser,
):
    svc = _get_service()
    result = await svc.toggle_status(template_id, current_user.email)
    if not result:
        raise HTTPException(404, _NOT_FOUND)
    return result


@router.post("/{template_id}/bump-version", responses=_RESP_400_404)
async def bump_version(
    template_id: str,
    body: UITemplateVersionBump,
    current_user: EditorUser,
):
    svc = _get_service()
    data = body.model_dump()
    try:
        result = await svc.bump_version(template_id, data, current_user.email)
        if not result:
            raise HTTPException(404, _NOT_FOUND)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.put("/{template_id}/widgets/reorder", responses=_RESP_404)
async def reorder_widgets(
    template_id: str,
    widget_keys: List[str],
    current_user: EditorUser,
):
    svc = _get_service()
    result = await svc.reorder_widgets(
        template_id, widget_keys, current_user.email
    )
    if not result:
        raise HTTPException(404, _NOT_FOUND)
    return result


@router.put(
    "/{template_id}/widgets/{widget_key}/attributes",
    responses={404: {"description": _WIDGET_NOT_FOUND}},
)
async def update_widget_attributes(
    template_id: str,
    widget_key: str,
    attributes: List[WidgetAttribute],
    current_user: EditorUser,
):
    svc = _get_service()
    attrs = [a.model_dump() for a in attributes]
    result = await svc.update_widget_attributes(
        template_id, widget_key, attrs, current_user.email
    )
    if not result:
        raise HTTPException(404, _WIDGET_NOT_FOUND)
    return result


@router.post("/{template_id}/comments", responses=_RESP_400_404)
async def add_comment(
    template_id: str,
    body: TemplateComment,
    current_user: EditorUser,
):
    svc = _get_service()
    comment = body.model_dump()
    if not comment.get("author"):
        comment["author"] = current_user.email
    try:
        result = await svc.add_comment(template_id, comment)
        if not result:
            raise HTTPException(404, _NOT_FOUND)
        return result
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.put(
    "/{template_id}/widgets/{widget_key}/overrides/{override_key}",
    responses={404: {"description": _WIDGET_NOT_FOUND}},
)
async def set_widget_override(
    template_id: str,
    widget_key: str,
    override_key: str,
    body: WidgetOverride,
    current_user: EditorUser,
):
    svc = _get_service()
    override = body.model_dump()
    result = await svc.set_widget_override(
        template_id, widget_key, override_key, override, current_user.email
    )
    if not result:
        raise HTTPException(404, _WIDGET_NOT_FOUND)
    return result


@router.delete(
    "/{template_id}/widgets/{widget_key}/overrides/{override_key}",
    responses={404: {"description": _WIDGET_NOT_FOUND}},
)
async def remove_widget_override(
    template_id: str,
    widget_key: str,
    override_key: str,
    current_user: EditorUser,
):
    svc = _get_service()
    result = await svc.remove_widget_override(
        template_id, widget_key, override_key, current_user.email
    )
    if not result:
        raise HTTPException(404, _WIDGET_NOT_FOUND)
    return result
