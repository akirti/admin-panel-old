"""Jira API Routes"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId

from .dependencies import (
    get_jira_service,
    get_db,
    get_current_user,
    get_file_storage_service
)
from ..services.file_storage_service import FileStorageService
from .models import (
    JiraProject,
    JiraTask,
    JiraIssueType,
    JiraStatus,
    JiraConnectionStatus,
    JiraCreateTaskRequest,
    JiraCreateTaskResponse,
    JiraAttachmentRequest,
    JiraAttachmentResponse,
    JiraTransitionRequest,
    MessageResponse
)
from ..services.jira_service import JiraService
from ..security.access_control import CurrentUser
from ..db.db_manager import DatabaseManager

router = APIRouter(prefix="/jira", tags=["jira"])


@router.get("/status", response_model=JiraConnectionStatus)
async def get_jira_status(
    current_user: CurrentUser = Depends(get_current_user),
    jira_service: JiraService = Depends(get_jira_service)
):
    """Check Jira connection status"""
    if not jira_service or not jira_service.enabled:
        return JiraConnectionStatus(connected=False, error="Jira not configured")

    result = await jira_service.test_connection()
    return JiraConnectionStatus(**result)


@router.get("/projects", response_model=List[JiraProject])
async def get_projects(
    current_user: CurrentUser = Depends(get_current_user),
    jira_service: JiraService = Depends(get_jira_service)
):
    """Get list of Jira projects accessible to user"""
    if not jira_service or not jira_service.enabled:
        raise HTTPException(status_code=503, detail="Jira service not configured")

    projects = await jira_service.get_projects(current_user.email)
    return [JiraProject(**p) for p in projects]


@router.get("/projects/latest", response_model=Optional[JiraProject])
async def get_latest_project(
    current_user: CurrentUser = Depends(get_current_user),
    jira_service: JiraService = Depends(get_jira_service)
):
    """Get the latest (most recently created) project"""
    if not jira_service or not jira_service.enabled:
        raise HTTPException(status_code=503, detail="Jira service not configured")

    project = await jira_service.get_latest_project()
    if not project:
        return None
    return JiraProject(**project)


@router.get("/tasks/my", response_model=List[JiraTask])
async def get_my_tasks(
    project_key: Optional[str] = Query(None, description="Filter by project key"),
    status: Optional[str] = Query(None, description="Filter by status"),
    max_results: int = Query(50, ge=1, le=100, description="Maximum number of results"),
    current_user: CurrentUser = Depends(get_current_user),
    jira_service: JiraService = Depends(get_jira_service)
):
    """Get tasks created by or assigned to current user"""
    if not jira_service or not jira_service.enabled:
        raise HTTPException(status_code=503, detail="Jira service not configured")

    tasks = await jira_service.get_user_tasks(
        user_email=current_user.email,
        project_key=project_key,
        status=status,
        max_results=max_results
    )
    return [JiraTask(**t) for t in tasks]


@router.get("/tasks/by-request/{request_id}", response_model=List[JiraTask])
async def get_tasks_by_request(
    request_id: str,
    project_key: Optional[str] = Query(None, description="Filter by project key"),
    current_user: CurrentUser = Depends(get_current_user),
    jira_service: JiraService = Depends(get_jira_service)
):
    """Get Jira tasks linked to a scenario request ID"""
    if not jira_service or not jira_service.enabled:
        raise HTTPException(status_code=503, detail="Jira service not configured")

    tasks = await jira_service.get_tasks_by_request_id(request_id, project_key)
    return [JiraTask(**t) for t in tasks]


@router.post("/tasks/create", response_model=JiraCreateTaskResponse)
async def create_task_from_request(
    request: JiraCreateTaskRequest,
    current_user: CurrentUser = Depends(get_current_user),
    jira_service: JiraService = Depends(get_jira_service),
    db: DatabaseManager = Depends(get_db),
    file_storage_service: FileStorageService = Depends(get_file_storage_service)
):
    """Create a Jira task from a scenario request"""
    if not jira_service or not jira_service.enabled:
        raise HTTPException(status_code=503, detail="Jira service not configured")

    # Get scenario request from database
    try:
        scenario_request = await db.db.scenario_requests.find_one({
            "_id": ObjectId(request.scenario_request_id)
        })
    except Exception:
        scenario_request = await db.db.scenario_requests.find_one({
            "requestId": request.scenario_request_id
        })

    if not scenario_request:
        raise HTTPException(status_code=404, detail="Scenario request not found")

    # Check if already has a Jira ticket
    existing_jira = scenario_request.get("jira_integration")
    if existing_jira and existing_jira.get("ticket_key"):
        return JiraCreateTaskResponse(
            ticket_id=existing_jira.get("ticket_id"),
            ticket_key=existing_jira.get("ticket_key"),
            ticket_url=existing_jira.get("ticket_url"),
            project_key=existing_jira.get("project_key"),
            sync_status="already_exists"
        )

    # Determine project key - use provided, configured, or fallback to latest
    project_key = request.project_key
    if not project_key:
        # Check if there's a Jira configuration for this domain/customer
        jira_config = await db.db.configurations.find_one({
            "type": "jira",
            "$or": [
                {"data.domain": scenario_request.get("dataDomain")},
                {"data.customer": scenario_request.get("customer_id")}
            ]
        })
        if jira_config and jira_config.get("data", {}).get("project_key"):
            project_key = jira_config["data"]["project_key"]

    # Create the ticket with comments and file attachments
    result = await jira_service.create_ticket(
        scenario_request,
        project_key,
        file_storage_service=file_storage_service
    )

    if not result:
        raise HTTPException(status_code=500, detail="Failed to create Jira ticket")

    if result.get("sync_status") == "failed":
        return JiraCreateTaskResponse(
            sync_status="failed",
            error=result.get("error")
        )

    # Update scenario request with Jira integration info
    await db.db.scenario_requests.update_one(
        {"_id": scenario_request["_id"]},
        {"$set": {"jira_integration": result}}
    )

    return JiraCreateTaskResponse(**result)


@router.post("/tasks/transition", response_model=MessageResponse)
async def transition_task(
    request: JiraTransitionRequest,
    current_user: CurrentUser = Depends(get_current_user),
    jira_service: JiraService = Depends(get_jira_service)
):
    """Transition a Jira ticket to a new status"""
    if not jira_service or not jira_service.enabled:
        raise HTTPException(status_code=503, detail="Jira service not configured")

    result = await jira_service.transition_ticket(request.ticket_key, request.status)

    if not result:
        raise HTTPException(status_code=404, detail="Ticket not found or transition not available")

    if result.get("sync_status") == "failed":
        raise HTTPException(status_code=400, detail=result.get("error", "Transition failed"))

    return MessageResponse(message=f"Ticket {request.ticket_key} transitioned to {request.status}")


@router.post("/attachments/add", response_model=JiraAttachmentResponse)
async def add_attachment(
    request: JiraAttachmentRequest,
    current_user: CurrentUser = Depends(get_current_user),
    jira_service: JiraService = Depends(get_jira_service)
):
    """Add an attachment to a Jira ticket from a URL"""
    if not jira_service or not jira_service.enabled:
        raise HTTPException(status_code=503, detail="Jira service not configured")

    result = await jira_service.add_attachment_from_url(
        ticket_key=request.ticket_key,
        file_url=request.file_url,
        file_name=request.file_name
    )

    if not result:
        raise HTTPException(status_code=500, detail="Failed to add attachment")

    return JiraAttachmentResponse(
        attachment_id=result.get("attachment_id"),
        filename=result.get("filename"),
        uploaded_at=result.get("uploaded_at")
    )


@router.get("/issue-types", response_model=List[JiraIssueType])
async def get_issue_types(
    project_key: Optional[str] = Query(None, description="Project key to get issue types for"),
    current_user: CurrentUser = Depends(get_current_user),
    jira_service: JiraService = Depends(get_jira_service)
):
    """Get available Jira issue types"""
    if not jira_service or not jira_service.enabled:
        raise HTTPException(status_code=503, detail="Jira service not configured")

    issue_types = await jira_service.get_issue_types(project_key)
    return [JiraIssueType(**it) for it in issue_types]


@router.get("/statuses", response_model=List[JiraStatus])
async def get_statuses(
    project_key: Optional[str] = Query(None, description="Project key to get statuses for"),
    current_user: CurrentUser = Depends(get_current_user),
    jira_service: JiraService = Depends(get_jira_service)
):
    """Get available Jira statuses"""
    if not jira_service or not jira_service.enabled:
        raise HTTPException(status_code=503, detail="Jira service not configured")

    statuses = await jira_service.get_statuses(project_key)
    return [JiraStatus(**s) for s in statuses]


@router.get("/boards")
async def get_boards(
    project_key: Optional[str] = Query(None, description="Project key to filter boards"),
    current_user: CurrentUser = Depends(get_current_user),
    jira_service: JiraService = Depends(get_jira_service)
):
    """Get Jira boards (teams) for a project"""
    if not jira_service or not jira_service.enabled:
        raise HTTPException(status_code=503, detail="Jira service not configured")

    boards = await jira_service.get_boards(project_key)
    return boards


@router.get("/assignable-users")
async def get_assignable_users(
    project_key: Optional[str] = Query(None, description="Project key"),
    q: Optional[str] = Query(None, description="Search query for user name/email"),
    max_results: int = Query(50, ge=1, le=100),
    current_user: CurrentUser = Depends(get_current_user),
    jira_service: JiraService = Depends(get_jira_service)
):
    """Get users assignable to issues in a project"""
    if not jira_service or not jira_service.enabled:
        raise HTTPException(status_code=503, detail="Jira service not configured")

    users = await jira_service.get_assignable_users(
        project_key=project_key,
        query=q,
        max_results=max_results
    )
    return users


@router.post("/sync/request/{request_id}", response_model=JiraCreateTaskResponse)
async def sync_request_to_jira(
    request_id: str,
    project_key: Optional[str] = Query(None, description="Override project key"),
    current_user: CurrentUser = Depends(get_current_user),
    jira_service: JiraService = Depends(get_jira_service),
    db: DatabaseManager = Depends(get_db),
    file_storage_service: FileStorageService = Depends(get_file_storage_service)
):
    """Sync a scenario request to Jira (create ticket if not exists, update if exists)"""
    if not jira_service or not jira_service.enabled:
        raise HTTPException(status_code=503, detail="Jira service not configured")

    # Get scenario request
    try:
        scenario_request = await db.db.scenario_requests.find_one({
            "_id": ObjectId(request_id)
        })
    except Exception:
        scenario_request = await db.db.scenario_requests.find_one({
            "requestId": request_id
        })

    if not scenario_request:
        raise HTTPException(status_code=404, detail="Scenario request not found")

    existing_jira = scenario_request.get("jira_integration")

    if existing_jira and existing_jira.get("ticket_key"):
        # Update existing ticket
        result = await jira_service.update_ticket(
            existing_jira["ticket_key"],
            scenario_request,
            "general"
        )

        if result:
            # Update sync timestamp
            await db.db.scenario_requests.update_one(
                {"_id": scenario_request["_id"]},
                {"$set": {
                    "jira_integration.last_synced": result.get("last_synced"),
                    "jira_integration.sync_status": result.get("sync_status")
                }}
            )

        return JiraCreateTaskResponse(
            ticket_id=existing_jira.get("ticket_id"),
            ticket_key=existing_jira.get("ticket_key"),
            ticket_url=existing_jira.get("ticket_url"),
            project_key=existing_jira.get("project_key"),
            sync_status=result.get("sync_status") if result else "failed"
        )
    else:
        # Create new ticket with comments and file attachments
        result = await jira_service.create_ticket(
            scenario_request,
            project_key,
            file_storage_service=file_storage_service
        )

        if result and result.get("sync_status") != "failed":
            await db.db.scenario_requests.update_one(
                {"_id": scenario_request["_id"]},
                {"$set": {"jira_integration": result}}
            )

        return JiraCreateTaskResponse(**result) if result else JiraCreateTaskResponse(
            sync_status="failed",
            error="Failed to create ticket"
        )
