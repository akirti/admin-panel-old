"""Pydantic models for API requests and responses"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


# Auth Models
class UserRegister(BaseModel):
    email: str
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = None
    roles: Optional[List[str]] = ["user"]
    groups: Optional[List[str]] = ["viewer"]
    domains: Optional[List[str]] = []


class UserLogin(BaseModel):
    email: str
    password: str


class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    username: Optional[str] = None


class PasswordUpdate(BaseModel):
    password: str
    new_password: str = Field(..., min_length=8)


class PasswordReset(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


class ForgotPassword(BaseModel):
    email: str
    reset_url: Optional[str] = None


class RefreshToken(BaseModel):
    refresh_token: str


# User Response Models
class UserResponse(BaseModel):
    user_id: str
    email: str
    username: Optional[str] = None
    full_name: Optional[str] = None
    roles: List[str] = []
    groups: List[str] = []
    domains: List[str] = []
    is_active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None


class AuthResponse(BaseModel):
    user_id: str
    email: str
    username: Optional[str] = None
    full_name: Optional[str] = None
    roles: List[str] = []
    groups: List[str] = []
    domains: List[str] = []
    access_token: str
    refresh_token: str
    expires_in: int


# Admin Models
class UserStatusUpdate(BaseModel):
    is_active: bool


class UserRoleUpdate(BaseModel):
    roles: List[str]


class UserGroupUpdate(BaseModel):
    groups: List[str]


class UserDomainUpdate(BaseModel):
    domains: List[str]


# Domain Models
class DomainCreate(BaseModel):
    key: str
    name: str
    description: Optional[str] = None
    path: Optional[str] = None
    icon: Optional[str] = None
    order: Optional[int] = 0
    defaultSelected: Optional[bool] = False
    actions: Optional[List[str]] = []
    type: Optional[str] = None
    subDomain: Optional[List[str]] = []


class DomainUpdate(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: Optional[str] = None
    description: Optional[str] = None
    path: Optional[str] = None
    icon: Optional[str] = None
    order: Optional[int] = None
    defaultSelected: Optional[bool] = None
    status: Optional[str] = None
    
    class Config:
        populate_by_name = True


class DomainResponse(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    key: str
    name: str
    description: Optional[str] = None
    path: Optional[str] = None
    icon: Optional[str] = None
    order: Optional[int] = 0
    defaultSelected: Optional[bool] = False
    actions: Optional[List[str]] = []
    type: Optional[str] = None
    subDomain: Optional[List[str]] = []
    status: Optional[str] = "A"
    
    class Config:
        extra = "allow"
        populate_by_name = True


# Scenario Models
class ScenarioCreate(BaseModel):
    key: str
    name: str
    dataDomain: str
    description: Optional[str] = None
    fullDescription: Optional[str] = None
    path: Optional[str] = None
    icon: Optional[str] = None
    order: Optional[int] = 0
    defaultSelected: Optional[bool] = False
    actions: Optional[List[str]] = []


class ScenarioUpdate(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: Optional[str] = None
    description: Optional[str] = None
    fullDescription: Optional[str] = None
    path: Optional[str] = None
    icon: Optional[str] = None
    order: Optional[int] = None
    defaultSelected: Optional[bool] = None
    status: Optional[str] = None
    dataDomain: Optional[str] = None
    
    class Config:
        populate_by_name = True


class ScenarioResponse(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    key: str
    name: str
    dataDomain: str
    description: Optional[str] = None
    fullDescription: Optional[str] = None
    path: Optional[str] = None
    icon: Optional[str] = None
    order: Optional[int] = 0
    defaultSelected: Optional[bool] = False
    actions: Optional[List[str]] = []
    status: Optional[str] = "A"
    
    class Config:
        extra = "allow"
        populate_by_name = True


# Playboard Models
class PlayboardCreate(BaseModel):
    dataDomain: str
    scenerioKey: str
    widgets: Optional[List[Dict[str, Any]]] = []
    order: Optional[int] = 0
    program_key: Optional[str] = None
    addon_configurations: Optional[Dict[str, Any]] = {}


class PlayboardUpdate(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    dataDomain: Optional[str] = None
    scenerioKey: Optional[str] = None
    widgets: Optional[List[Dict[str, Any]]] = None
    order: Optional[int] = None
    status: Optional[str] = None
    program_key: Optional[str] = None
    addon_configurations: Optional[Dict[str, Any]] = None
    
    class Config:
        populate_by_name = True


class PlayboardResponse(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    dataDomain: str
    scenerioKey: str
    widgets: Optional[List[Dict[str, Any]]] = []
    order: Optional[int] = 0
    program_key: Optional[str] = None
    addon_configurations: Optional[Dict[str, Any]] = {}
    status: Optional[str] = "A"
    
    class Config:
        extra = "allow"
        populate_by_name = True


# Feedback Models
class FeedbackCreate(BaseModel):
    rating: Optional[int] = None
    improvements: Optional[str] = None
    suggestions: Optional[str] = None
    email: Optional[str] = None


class FeedbackUpdate(BaseModel):
    feedback_id: str
    rating: Optional[int] = None
    improvements: Optional[str] = None
    suggestions: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    rating: Optional[int] = None
    improvements: Optional[str] = None
    suggestions: Optional[str] = None
    email: Optional[str] = None
    is_public: Optional[bool] = None
    user_id: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

    class Config:
        extra = "allow"
        populate_by_name = True


class PublicFeedbackCreate(BaseModel):
    """Feedback from unauthenticated users - email is required"""
    rating: Optional[int] = Field(None, ge=1, le=5)
    improvements: Optional[str] = None
    suggestions: Optional[str] = None
    email: str = Field(..., description="Email is required for public feedback")


class FeedbackStats(BaseModel):
    """Feedback statistics for dashboard"""
    total_feedback: int = 0
    avg_rating: float = 0.0
    this_week_count: int = 0
    rating_distribution: Dict[str, int] = Field(default_factory=dict)


class FeedbackPagination(BaseModel):
    """Pagination metadata"""
    total: int = 0
    page: int = 0
    limit: int = 25
    pages: int = 0
    has_next: bool = False
    has_prev: bool = False


class PaginatedFeedbackResponse(BaseModel):
    """Paginated feedback list response"""
    data: List[FeedbackResponse] = []
    pagination: FeedbackPagination


# Scenario Request Models
class ScenarioRequestCreate(BaseModel):
    scenarioName: str
    description: str
    dataDomain: str
    databases: Optional[List[str]] = []
    steps: Optional[List[str]] = []
    stepQueries: Optional[List[str]] = []
    resultSize: Optional[int] = 100
    filters: Optional[List[str]] = []


class ScenarioRequestUpdate(BaseModel):
    request_id: str
    scenarioName: Optional[str] = None
    description: Optional[str] = None
    dataDomain: Optional[str] = None
    databases: Optional[List[str]] = None
    steps: Optional[List[str]] = None
    stepQueries: Optional[List[str]] = None
    resultSize: Optional[int] = None
    filters: Optional[List[str]] = None
    status: Optional[str] = None
    assignedTo: Optional[str] = None
    scenarioKey: Optional[str] = None
    configName: Optional[str] = None
    fulfilmentDate: Optional[str] = None
    comments: Optional[List[str]] = None


class ScenarioRequestResponse(BaseModel):
    requestId: Optional[str] = None
    scenarioName: str
    description: str
    dataDomain: str
    databases: Optional[List[str]] = []
    steps: Optional[List[str]] = []
    stepQueries: Optional[List[str]] = []
    resultSize: Optional[int] = 100
    filters: Optional[List[str]] = []
    status: Optional[str] = "S"
    assignedTo: Optional[str] = None
    scenarioKey: Optional[str] = None
    configName: Optional[str] = None
    fulfilmentDate: Optional[str] = None
    comments: Optional[List[str]] = []
    name: Optional[str] = None
    email: Optional[str] = None
    user_id: Optional[str] = None
    rowAddStp: Optional[datetime] = None
    rowUpdateStp: Optional[datetime] = None
    
    class Config:
        extra = "allow"


# Pagination Models
class PaginationParams(BaseModel):
    limit: int = 25
    page: int = 0
    skip: int = 0
    total: Optional[int] = None


class PaginationInfo(BaseModel):
    page: int = 0
    limit: int = 25
    skip: int = 0
    total: int = 0
    current: int = 0
    pages: List[int] = []


class PaginatedResponse(BaseModel):
    data: List[Dict[str, Any]]
    pagination: Dict[str, Any]


class PaginatedUsersResponse(BaseModel):
    data: List[Dict[str, Any]]
    pagination: PaginationInfo


class PaginatedScenarioRequestsResponse(BaseModel):
    data: List[Dict[str, Any]]
    pagination: Dict[str, Any]
    
    class Config:
        extra = "allow"


# Generic Response Models
class MessageResponse(BaseModel):
    message: str


class ErrorResponse(BaseModel):
    error: str


# ============ Enums ============
from enum import Enum


class StatusEnum(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"


class TypeEnum(str, Enum):
    SYSTEM = "system"
    DOMAIN = "domain"
    BOOKMARK = "bookmark"
    AUTHENTICATION ="authentication"


# ============ Pagination Models ============
class PaginationMeta(BaseModel):
    total: int
    page: int
    limit: int
    pages: int
    has_next: bool
    has_prev: bool


# ============ Permission Models ============
class PermissionBase(BaseModel):
    key: str
    name: str
    description: Optional[str] = None
    module: str
    actions: List[str] = ["read"]


class PermissionCreate(PermissionBase):
    pass


class PermissionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    module: Optional[str] = None
    actions: Optional[List[str]] = None


class PermissionInDB(PermissionBase):
    id: Optional[str] = Field(None, alias="_id")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


# ============ Role Models ============
class RoleBase(BaseModel):
    type: str = "custom"
    roleId: str
    name: str
    description: Optional[str] = None
    permissions: List[str] = []
    domains: List[str] = []
    status: str = "active"
    priority: int = 0


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    type: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    domains: Optional[List[str]] = None
    status: Optional[str] = None
    priority: Optional[int] = None


class RoleInDB(RoleBase):
    id: Optional[str] = Field(None, alias="_id")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


# ============ Group Models ============
class GroupBase(BaseModel):
    type: str = "custom"
    groupId: str
    name: str
    description: Optional[str] = None
    permissions: List[str] = []
    domains: List[str] = []
    status: str = "active"
    priority: int = 0


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    type: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    domains: Optional[List[str]] = None
    status: Optional[str] = None
    priority: Optional[int] = None


class GroupInDB(GroupBase):
    id: Optional[str] = Field(None, alias="_id")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


# ============ Customer Models ============
class CustomerBase(BaseModel):
    customerId: str
    name: str
    description: Optional[str] = None
    status: str = "active"
    settings: Dict[str, Any] = {}


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class CustomerInDB(CustomerBase):
    id: Optional[str] = Field(None, alias="_id")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


# ============ Extended User Models ============
class UserCreate(BaseModel):
    email: str
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    full_name: str
    roles: List[str] = []
    groups: List[str] = []
    customers: List[str] = []
    is_active: bool = True
    send_password_email: bool = True


class UserUpdate(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    roles: Optional[List[str]] = None
    groups: Optional[List[str]] = None
    customers: Optional[List[str]] = None
    is_active: Optional[bool] = None


class UserInDB(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    email: str
    username: str
    full_name: str
    password_hash: str
    roles: List[str] = []
    groups: List[str] = []
    customers: List[str] = []
    is_active: bool = True
    is_super_admin: bool = False
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


class UserResponseFull(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    email: str
    username: str
    full_name: str
    roles: List[str] = []
    groups: List[str] = []
    customers: List[str] = []
    is_active: bool = True
    is_super_admin: bool = False
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


# ============ Extended Domain Models ============
class SubDomain(BaseModel):
    key: str
    name: str
    description: Optional[str] = None
    path: str
    status: str = "active"
    order: int = 0
    icon: Optional[str] = None


class DomainInDB(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    type: str = "custom"
    key: str
    name: str
    description: Optional[str] = None
    path: str
    dataDomain: Optional[str] = None
    status: str = "active"
    defaultSelected: bool = False
    order: int = 0
    icon: Optional[str] = None
    subDomains: List[SubDomain] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


# ============ Domain Scenario Models ============
class DomainScenarioCreate(BaseModel):
    type: str = "custom"
    key: str
    name: str
    description: Optional[str] = None
    path: str
    dataDomain: Optional[str] = None
    status: str = "active"
    defaultSelected: bool = False
    order: int = 0
    icon: Optional[str] = None
    subDomains: List[SubDomain] = []
    domainKey: str


class DomainScenarioUpdate(BaseModel):
    type: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    path: Optional[str] = None
    dataDomain: Optional[str] = None
    status: Optional[str] = None
    defaultSelected: Optional[bool] = None
    order: Optional[int] = None
    icon: Optional[str] = None
    subDomains: Optional[List[SubDomain]] = None
    domainKey: Optional[str] = None


class DomainScenarioInDB(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    type: str = "custom"
    key: str
    name: str
    description: Optional[str] = None
    path: str = ""
    dataDomain: Optional[str] = None
    status: str = "active"
    defaultSelected: bool = False
    order: int = 0
    icon: Optional[str] = None
    subDomains: List[SubDomain] = []
    domainKey: Optional[str] = None  # Optional to handle legacy data
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


# ============ Extended Playboard Models ============
class PlayboardInDB(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    name: str
    description: Optional[str] = None
    scenarioKey: str
    data: Dict[str, Any] = {}
    status: str = "active"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True


# ============ Configuration Models ============
class ConfigurationCreate(BaseModel):
    type: str
    key: str
    lookups: Optional[Dict[str, Any]] = None
    queries: Optional[Dict[str, Any]] = None
    logics: Optional[Dict[str, Any]] = None
    operations: Optional[Dict[str, Any]] = None
    data: Optional[Dict[str, Any]] = None


class ConfigurationUpdate(BaseModel):
    type: Optional[str] = None
    key: Optional[str] = None
    lookups: Optional[Dict[str, Any]] = None
    queries: Optional[Dict[str, Any]] = None
    logics: Optional[Dict[str, Any]] = None
    operations: Optional[Dict[str, Any]] = None
    data: Optional[Dict[str, Any]] = None


class ConfigurationResponse(BaseModel):
    id: Optional[str] = None
    config_id: Optional[str] = None
    type: str
    key: str
    lookups: Optional[Dict[str, Any]] = None
    queries: Optional[Dict[str, Any]] = None
    logics: Optional[Dict[str, Any]] = None
    operations: Optional[Dict[str, Any]] = None
    data: Optional[Dict[str, Any]] = None
    gcs: Optional[Dict[str, Any]] = None
    row_add_userid: Optional[str] = None
    row_add_stp: Optional[str] = None
    row_update_userid: Optional[str] = None
    row_update_stp: Optional[str] = None

    class Config:
        extra = "allow"


class FileUploadResponse(BaseModel):
    message: str
    config_id: str
    key: str
    gcs_key: Optional[str] = None
    version: Optional[int] = None
    file_name: Optional[str] = None


# ============ Bulk Upload Models ============
class BulkUploadResult(BaseModel):
    total: int
    successful: int
    failed: int
    errors: List[Dict[str, Any]] = []


# ============ Dashboard Models ============
class DashboardStats(BaseModel):
    total_users: int = 0
    active_users: int = 0
    total_roles: int = 0
    total_groups: int = 0
    total_customers: int = 0
    total_domains: int = 0
    total_scenarios: int = 0
    total_configurations: int = 0
    total_playboards: int = 0
    recent_activities: List[Dict[str, Any]] = []


# ============ Jira Models ============
class JiraProject(BaseModel):
    id: str
    key: str
    name: str
    project_type: Optional[str] = "software"


class JiraTask(BaseModel):
    id: str
    key: str
    summary: str
    status: str
    issue_type: Optional[str] = None
    priority: Optional[str] = None
    created: Optional[str] = None
    updated: Optional[str] = None
    reporter: Optional[str] = None
    assignee: Optional[str] = None
    url: Optional[str] = None


class JiraIssueType(BaseModel):
    id: str
    name: str
    description: Optional[str] = None


class JiraStatus(BaseModel):
    id: str
    name: str
    category: Optional[str] = None


class JiraConnectionStatus(BaseModel):
    connected: bool
    user: Optional[str] = None
    email: Optional[str] = None
    error: Optional[str] = None


class JiraCreateTaskRequest(BaseModel):
    """Request model for creating a Jira task from scenario request"""
    scenario_request_id: str
    project_key: Optional[str] = None
    issue_type: Optional[str] = None


class JiraCreateTaskResponse(BaseModel):
    ticket_id: Optional[str] = None
    ticket_key: Optional[str] = None
    ticket_url: Optional[str] = None
    project_key: Optional[str] = None
    created_at: Optional[str] = None
    sync_status: str = "pending"
    error: Optional[str] = None


class JiraAttachmentRequest(BaseModel):
    """Request model for attaching file to Jira"""
    ticket_key: str
    file_url: str
    file_name: str


class JiraAttachmentResponse(BaseModel):
    attachment_id: Optional[str] = None
    filename: str
    uploaded_at: Optional[str] = None
    error: Optional[str] = None


class JiraTransitionRequest(BaseModel):
    """Request model for transitioning Jira ticket status"""
    ticket_key: str
    status: str


class JiraUserTasksRequest(BaseModel):
    """Request model for getting user tasks"""
    project_key: Optional[str] = None
    status: Optional[str] = None
    max_results: int = 50
