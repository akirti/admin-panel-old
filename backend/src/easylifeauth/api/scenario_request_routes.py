"""Enhanced Async Scenario Request Routes"""
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import StreamingResponse
import io

from ..models.scenario_request import (
    ScenarioRequestCreate, ScenarioRequestUpdate, ScenarioRequestAdminUpdate,
    ScenarioRequestResponse
)
from .dependencies import get_current_user, get_scenario_request_service, get_jira_service
from ..services.new_scenarios_service import NewScenarioService
from ..services.jira_service import JiraService
from ..security.access_control import CurrentUser, require_admin_or_editor
from ..db.constants import EDITORS
from ..db.lookup import ScenarioRequestStatusTypes, RequestType, REQUEST_STATUS_DESC
from ..errors.auth_error import AuthError

router = APIRouter(prefix="/ask_scenarios", tags=["Scenario Requests"])


@router.get("/lookup/statuses")
async def get_status_options(
    current_user: CurrentUser = Depends(get_current_user)
) -> List[Dict[str, str]]:
    """Get all available status options"""
    return [
        {"value": s.value, "label": REQUEST_STATUS_DESC.get(s.value, s.name)}
        for s in ScenarioRequestStatusTypes
    ]


@router.get("/lookup/request_types")
async def get_request_type_options(
    current_user: CurrentUser = Depends(get_current_user)
) -> List[Dict[str, str]]:
    """Get all available request type options"""   
    data = [
        {
            "value": "scenario",
            "label": "New Scenario Request"
        },
        {
            "value": "scenario_update",
            "label": "Scenario Update"
        },
        {
            "value": "update_feature",
            "label": "Feature Enhancement"
        },
        {
            "value": "new_feature",
            "label": "New Feature"
        },
        {
            "value": "add_user",
            "label": "Add New User"
        },
        {
            "value": "drop_user",
            "label": "Remove User"
        }
    ]
    return data


@router.get("/lookup/domains")
async def get_domain_options(
    current_user: CurrentUser = Depends(get_current_user),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
) -> List[Dict[str, str]]:
    """Get all active domains for dropdown"""
    try:
        domains = await scenario_request_service.get_domains()
        return domains
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/lookup/defaults")
async def get_defaults(
    current_user: CurrentUser = Depends(get_current_user),
    jira_service: JiraService = Depends(get_jira_service)
) -> Dict[str, Any]:
    """Get default team and assignee for new scenario requests"""
    defaults = {
        "team": None,
        "assignee": None,
        "assignee_name": None
    }
    if jira_service and jira_service.enabled:
        defaults["team"] = jira_service.default_team
        defaults["assignee"] = jira_service.default_assignee
        defaults["assignee_name"] = jira_service.default_assignee_name
    return defaults


@router.get("/lookup/users")
async def search_users(
    q: str = Query(..., min_length=1, description="Search term"),
    limit: int = Query(10, ge=1, le=50),
    current_user: CurrentUser = Depends(get_current_user),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
) -> List[Dict[str, Any]]:
    """Search users for autocomplete (assigned_to field)"""
    try:
        users = await scenario_request_service.search_users(q, limit)
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/all")
async def get_all_scenario_requests(
    page: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=1000),
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


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_scenario_request(
    data: ScenarioRequestCreate,
    current_user: CurrentUser = Depends(get_current_user),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
) -> Dict[str, Any]:
    """Create a new scenario request"""
    try:
        request_data = data.model_dump()
        request_data["user_id"] = current_user.user_id
        request_data["email"] = current_user.email
        request_data["row_add_user_id"] = current_user.user_id
        request_data["row_update_user_id"] = current_user.user_id
        
        # Generate name from email if not provided
        if not request_data.get("name"):
            email = current_user.email
            request_data["name"] = email[:email.find("@")].replace(".", " ").replace("_", " ").title()
        
        result = await scenario_request_service.save(
            request_data,
            current_user=current_user.model_dump()
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put("/{request_id}")
async def update_scenario_request(
    request_id: str,
    data: ScenarioRequestUpdate,
    current_user: CurrentUser = Depends(get_current_user),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
) -> Dict[str, Any]:
    """Update a scenario request (user fields only)"""
    try:
        update_data = data.model_dump(exclude_unset=True)
        update_data["request_id"] = request_id
        
        result = await scenario_request_service.update(
            update_data,
            current_user=current_user.model_dump()
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put("/{request_id}/admin")
async def admin_update_scenario_request(
    request_id: str,
    data: ScenarioRequestAdminUpdate,
    current_user: CurrentUser = Depends(require_admin_or_editor),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
) -> Dict[str, Any]:
    """Update a scenario request (admin fields - requires editor role)"""
    try:
        update_data = data.model_dump(exclude_unset=True)
        update_data["request_id"] = request_id
        
        result = await scenario_request_service.update(
            update_data,
            current_user=current_user.model_dump()
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/{request_id}")
async def get_scenario_request(
    request_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
) -> Dict[str, Any]:
    """Get scenario request by ID"""
    try:
        result = await scenario_request_service.get(request_id)
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/{request_id}/files")
async def upload_user_file(
    request_id: str,
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
) -> Dict[str, Any]:
    """Upload a sample file (user files)"""
    try:
        from ..utils.file_validation import validate_upload
        content = await file.read()
        validate_upload(file, {".csv", ".xlsx", ".xls", ".json", ".pdf", ".png", ".jpg", ".jpeg"}, content=content)
        file_info = await scenario_request_service.upload_file(
            request_id=request_id,
            file_name=file.filename,
            file_content=content,
            folder="files",
            current_user=current_user.model_dump()
        )
        return file_info
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/{request_id}/buckets")
async def upload_bucket_file(
    request_id: str,
    file: UploadFile = File(...),
    comment: Optional[str] = Form(None),
    current_user: CurrentUser = Depends(require_admin_or_editor),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
) -> Dict[str, Any]:
    """Upload a bucket file (admin only, after acceptance)"""
    try:
        from ..utils.file_validation import validate_upload
        content = await file.read()
        validate_upload(file, {".csv", ".xlsx", ".xls", ".json", ".pdf", ".png", ".jpg", ".jpeg"}, content=content)
        file_info = await scenario_request_service.upload_file(
            request_id=request_id,
            file_name=file.filename,
            file_content=content,
            folder="buckets",
            current_user=current_user.model_dump(),
            comment=comment
        )
        return file_info
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/{request_id}/files/{file_path:path}/preview")
async def preview_file(
    request_id: str,
    file_path: str,
    current_user: CurrentUser = Depends(get_current_user),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
) -> Dict[str, Any]:
    """Get file preview (grid/json view)"""
    try:
        preview = await scenario_request_service.get_file_preview(
            request_id=request_id,
            file_path=file_path,
            current_user=current_user.model_dump()
        )
        return preview
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get("/{request_id}/files/{file_path:path}/download")
async def download_file(
    request_id: str,
    file_path: str,
    current_user: CurrentUser = Depends(get_current_user),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
):
    """Download a file"""
    try:
        result = await scenario_request_service.download_file(
            request_id=request_id,
            file_path=file_path,
            current_user=current_user.model_dump()
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="File not found")
        
        content, file_name = result
        
        return StreamingResponse(
            io.BytesIO(content),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{file_name}"'
            }
        )
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/{request_id}/comment")
async def add_comment(
    request_id: str,
    comment: str = Form(...),
    current_user: CurrentUser = Depends(get_current_user),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
) -> Dict[str, Any]:
    """Add a comment to scenario request"""
    try:
        update_data = {
            "request_id": request_id,
            "new_comment": {
                "comment": comment
            }
        }
        
        result = await scenario_request_service.update(
            update_data,
            current_user=current_user.model_dump()
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post("/{request_id}/workflow")
async def add_workflow(
    request_id: str,
    assigned_to: Optional[str] = Form(None),
    to_status: Optional[str] = Form(None),
    comment: Optional[str] = Form(None),
    current_user: CurrentUser = Depends(require_admin_or_editor),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
) -> Dict[str, Any]:
    """Add a workflow entry (admin only)"""
    try:
        update_data = {
            "request_id": request_id,
            "new_workflow": {
                "assigned_to": assigned_to,
                "to_status": to_status,
                "comment": comment
            }
        }
        
        if to_status:
            update_data["status"] = to_status
        
        result = await scenario_request_service.update(
            update_data,
            current_user=current_user.model_dump()
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put("/{request_id}/status")
async def update_status(
    request_id: str,
    new_status: str = Form(...),
    comment: Optional[str] = Form(None),
    current_user: CurrentUser = Depends(require_admin_or_editor),
    scenario_request_service: NewScenarioService = Depends(get_scenario_request_service)
) -> Dict[str, Any]:
    """Update scenario request status (admin only)"""
    try:
        update_data = {
            "request_id": request_id,
            "status": new_status,
            "status_comment": comment
        }
        
        result = await scenario_request_service.update(
            update_data,
            current_user=current_user.model_dump()
        )
        return result
    except AuthError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
