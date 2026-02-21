"""Scenario Request Pydantic Models"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr, Field, model_validator

from ..db.lookup import (
    ScenarioRequestStatusTypes, RequestType, REQUEST_STATUS_DESC,
    StatusTypes, SharingTypes
)


class SnapshotConfig(BaseModel):
    """GCS callback response Object"""
    file_name: Optional[str] = None
    bucket: Optional[str] = None
    upload_date: Optional[str] = None
    code: Optional[str] = None
    gcs_path: str
    status: StatusTypes = StatusTypes.active
    age: Optional[int] = 14  # default to 14 days
    
    class Config:
        extra = "allow"


class BucketConfig(SnapshotConfig):
    """Files config"""
    order: Optional[int] = None
    name: Optional[str] = None
    comment: Optional[str] = None
    file_type: Optional[str] = None  # excel, csv, json, image
    file_size: Optional[int] = None
    version: Optional[int] = 1
    uploaded_by: Optional[str] = None
    
    class Config:
        extra = "allow"


class ScenarioComments(BaseModel):
    """Scenario Request Comment"""
    comment: Optional[str] = None  # Rich text HTML content
    username: Optional[str] = None
    user_id: Optional[str] = None
    commentDate: Optional[str] = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    order: Optional[int] = None
    
    class Config:
        extra = "allow"


class ScenarioSteps(BaseModel):
    """Scenario Steps"""
    description: Optional[str] = None  # Rich text HTML content
    database: Optional[str] = None
    dbSchema: Optional[str] = None
    table: Optional[str] = None
    query: Optional[List[str]] = []
    params: Optional[List[str]] = []
    sampleFiles: Optional[List[BucketConfig]] = []
    order: Optional[int] = None
    
    class Config:
        extra = "allow"


class WorkFlow(BaseModel):
    """Scenario Work Flow"""
    assigned_to: Optional[str] = None  # User ID from users collection
    assigned_to_email: Optional[str] = None
    assigned_to_name: Optional[str] = None
    assigned_by: Optional[str] = None  # User ID
    assigned_by_email: Optional[str] = None
    assigned_by_name: Optional[str] = None
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    start_date: Optional[str] = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    end_date: Optional[str] = None
    comment: Optional[str] = None  # Rich text HTML content
    flowOrder: Optional[int] = None
    create_stp: Optional[str] = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    update_stp: Optional[str] = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    class Config:
        extra = "allow"


class JiraTicketInfo(BaseModel):
    """Jira Ticket Information"""
    ticket_id: Optional[str] = None
    ticket_key: Optional[str] = None
    ticket_url: Optional[str] = None
    project_key: Optional[str] = None
    created_at: Optional[str] = None
    last_synced: Optional[str] = None
    sync_status: Optional[str] = "pending"  # pending, synced, failed

    class Config:
        extra = "allow"


class JiraLink(BaseModel):
    """Jira Link for dependency tracking"""
    ticket_key: str
    ticket_url: Optional[str] = None
    title: Optional[str] = None
    link_type: Optional[str] = "dependency"  # dependency, related, blocks, blocked_by
    added_by: Optional[str] = None
    added_at: Optional[str] = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    class Config:
        extra = "allow"


class ScenarioRequestCreate(BaseModel):
    """Create new scenario request - User facing"""
    requestType: RequestType = RequestType.scenario
    dataDomain: str = Field(..., min_length=1, description="Domain key - required")
    name: str = Field(..., min_length=1, description="Request name - required")
    description: str = Field(..., min_length=1, description="Rich text description - required")
    
    # Optional: User knows how data will be processed
    has_suggestion: bool = False  # True if user has suggestion
    knows_steps: bool = False  # True if user knows the steps
    steps: Optional[List[ScenarioSteps]] = []
    
    # User uploaded sample files
    files: Optional[List[BucketConfig]] = []
    
    # Optional reason
    reason: Optional[str] = None

    # Jira team and assignee (populated from defaults on create)
    team: Optional[str] = None  # Jira board/team name
    assignee: Optional[str] = None  # Jira user accountId
    assignee_name: Optional[str] = None  # Jira user display name

    class Config:
        extra = "allow"


class ScenarioRequestUpdate(BaseModel):
    """Update scenario request - User fields"""
    name: Optional[str] = None
    description: Optional[str] = None  # Rich text
    has_suggestion: Optional[bool] = None
    knows_steps: Optional[bool] = None
    steps: Optional[List[ScenarioSteps]] = None
    files: Optional[List[BucketConfig]] = None
    reason: Optional[str] = None

    # Team and assignee
    team: Optional[str] = None
    assignee: Optional[str] = None
    assignee_name: Optional[str] = None

    # Comments can be added by users
    new_comment: Optional[ScenarioComments] = None

    class Config:
        extra = "allow"


class ScenarioRequestAdminUpdate(BaseModel):
    """Update scenario request - Admin/Editor fields"""
    # All user fields
    name: Optional[str] = None
    description: Optional[str] = None
    dataDomain: Optional[str] = None
    has_suggestion: Optional[bool] = None
    knows_steps: Optional[bool] = None
    steps: Optional[List[ScenarioSteps]] = None
    files: Optional[List[BucketConfig]] = None
    reason: Optional[str] = None

    # Jira team and assignee
    team: Optional[str] = None
    assignee: Optional[str] = None
    assignee_name: Optional[str] = None
    new_comment: Optional[ScenarioComments] = None

    # Admin only fields
    status: Optional[ScenarioRequestStatusTypes] = None
    scenarioKey: Optional[str] = None
    configName: Optional[str] = None
    fulfilmentDate: Optional[str] = None

    # Workflow
    new_workflow: Optional[WorkFlow] = None

    # Buckets for file uploads after acceptance
    buckets: Optional[List[BucketConfig]] = None

    # Email recipients for notifications
    email_recipients: Optional[List[str]] = None

    # Jira dependency links
    jira_links: Optional[List[JiraLink]] = None
    remove_jira_link_index: Optional[int] = None  # Index to remove from jira_links array

    class Config:
        extra = "allow"


class ScenarioRequestBase(BaseModel):
    """Base scenario request model"""
    requestId: Optional[str] = None
    requestType: RequestType = RequestType.scenario
    dataDomain: str
    name: str
    description: str  # Rich text HTML
    status: ScenarioRequestStatusTypes = ScenarioRequestStatusTypes.SUBMITTED
    statusDescription: Optional[str] = Field(default="")
    
    has_suggestion: bool = False
    knows_steps: bool = False
    steps: Optional[List[ScenarioSteps]] = []
    comments: Optional[List[ScenarioComments]] = []
    files: Optional[List[BucketConfig]] = []
    
    user_id: str
    email: str
    reason: Optional[str] = None

    # Jira team and assignee
    team: Optional[str] = None
    assignee: Optional[str] = None
    assignee_name: Optional[str] = None

    row_add_user_id: Optional[str] = None
    row_add_stp: Optional[str] = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    row_update_user_id: Optional[str] = None
    row_update_stp: Optional[str] = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    @model_validator(mode='after')
    def set_status_description(self) -> "ScenarioRequestBase":
        """Sets the statusDescription based on the status value"""
        self.statusDescription = REQUEST_STATUS_DESC.get(self.status.value if hasattr(self.status, 'value') else self.status, "Unknown Status")
        return self
    
    class Config:
        extra = "allow"


class ScenarioRequest(ScenarioRequestBase):
    """Full Scenario Request with Admin fields"""
    work_flow: Optional[List[WorkFlow]] = []
    scenarioKey: Optional[str] = None
    configName: Optional[str] = None
    fulfilmentDate: Optional[str] = None
    buckets: Optional[List[BucketConfig]] = []
    jira: Optional[JiraTicketInfo] = None
    jira_integration: Optional[JiraTicketInfo] = None  # Alternate field for Jira info
    jira_links: Optional[List[JiraLink]] = []  # Dependency links to other Jira tickets
    email_recipients: Optional[List[str]] = []
    team: Optional[str] = None
    assignee: Optional[str] = None
    assignee_name: Optional[str] = None

    class Config:
        extra = "allow"


class ScenarioRequestResponse(BaseModel):
    """Response model for scenario request"""
    requestId: Optional[str] = None
    requestType: Optional[str] = None
    dataDomain: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    statusDescription: Optional[str] = None
    has_suggestion: Optional[bool] = False
    knows_steps: Optional[bool] = False
    steps: Optional[List[Dict[str, Any]]] = []
    comments: Optional[List[Dict[str, Any]]] = []
    files: Optional[List[Dict[str, Any]]] = []
    work_flow: Optional[List[Dict[str, Any]]] = []
    scenarioKey: Optional[str] = None
    configName: Optional[str] = None
    fulfilmentDate: Optional[str] = None
    buckets: Optional[List[Dict[str, Any]]] = []
    jira: Optional[Dict[str, Any]] = None
    jira_integration: Optional[Dict[str, Any]] = None
    jira_links: Optional[List[Dict[str, Any]]] = []
    email_recipients: Optional[List[str]] = []
    user_id: Optional[str] = None
    email: Optional[str] = None
    reason: Optional[str] = None
    team: Optional[str] = None
    assignee: Optional[str] = None
    assignee_name: Optional[str] = None
    row_add_user_id: Optional[str] = None
    row_add_stp: Optional[str] = None
    row_update_user_id: Optional[str] = None
    row_update_stp: Optional[str] = None

    class Config:
        extra = "allow"


# Fields that regular users can edit
USER_EDITABLE_FIELDS = {
    "name", "description", "has_suggestion", "knows_steps",
    "steps", "files", "reason", "new_comment",
    "team", "assignee", "assignee_name"
}

# Fields that admins/editors can edit (includes user fields)
ADMIN_EDITABLE_FIELDS = USER_EDITABLE_FIELDS | {
    "dataDomain", "status", "scenarioKey", "configName",
    "fulfilmentDate", "new_workflow", "buckets", "email_recipients",
    "jira_links", "remove_jira_link_index",
    "team", "assignee", "assignee_name"
}

# Fields that only work with toggle (can be set once or toggled)
TOGGLE_FIELDS = {"scenarioKey", "configName", "fulfilmentDate"}
