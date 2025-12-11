"""Pydantic models for API requests and responses"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


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


# Playboard Models - Updated to match PlayboardInDB structure
class PlayboardCreate(BaseModel):
    """
    Create a new playboard.
    Fields can be provided at top level OR inside the 'data' object.
    The route will extract values from 'data' if not provided at top level.
    """
    key: Optional[str] = None  # Can be extracted from data.key
    name: str
    description: Optional[str] = None
    scenarioKey: Optional[str] = None  # Can be extracted from data.scenarioKey
    dataDomain: Optional[str] = None  # Can be extracted from data.dataDomain or scenario
    widgets: Optional[Dict[str, Any]] = None  # PlayboardWidget structure
    order: Optional[int] = 0
    program_key: Optional[str] = None
    addon_configurations: Optional[List[str]] = None
    scenarioDescription: Optional[List[Dict[str, Any]]] = None
    data: Optional[Dict[str, Any]] = None  # Full JSON data (may contain key, scenarioKey, etc.)
    status: str = "active"

    model_config = {"extra": "allow"}


class PlayboardUpdate(BaseModel):
    """Update playboard - all fields optional"""
    id: Optional[str] = Field(None, alias="_id")
    key: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    scenarioKey: Optional[str] = None
    dataDomain: Optional[str] = None
    widgets: Optional[Dict[str, Any]] = None
    order: Optional[int] = None
    program_key: Optional[str] = None
    addon_configurations: Optional[List[str]] = None
    scenarioDescription: Optional[List[Dict[str, Any]]] = None
    data: Optional[Dict[str, Any]] = None
    status: Optional[str] = None

    model_config = {
        "extra": "allow",
        "populate_by_name": True
    }


class PlayboardResponse(BaseModel):
    """Playboard response - matches PlayboardInDB"""
    id: Optional[str] = Field(None, alias="_id")
    key: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    scenarioKey: Optional[str] = None
    dataDomain: Optional[str] = None
    widgets: Optional[Dict[str, Any]] = None
    order: Optional[int] = 0
    program_key: Optional[str] = None
    addon_configurations: Optional[List[str]] = None
    scenarioDescription: Optional[List[Dict[str, Any]]] = None
    data: Optional[Dict[str, Any]] = None
    status: Optional[str] = "active"
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

    model_config = {
        "extra": "allow",
        "populate_by_name": True
    }


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
class PaginationAttributeKeyTypes(Enum):
    TYPE = "type"
    OPTIONS = "options"
    DEFAULT_VALUE = "defaultValue"
    POSITION = "position"
    PAGE_SIZES = "pageSizes"
    PAGE_SIZE = "pageSize"
    TOAL_PAGES = "pages"
    CURRENT_PAGE = "currentPage"

class WidgetAttributeKeyTypes(Enum):
    TYPE = "type"
    OPTIONS = "options"
    DEFAULT_VALUE = "defaultValue"
    width = "width"
    VALIDATE = "validate"
    REGEX = "regex"
    FORMAT = "format"
    MIN = "min"
    MAX = "max"
    PLACEHOLDER = "placeholder"
    MULTISELECT = "multiselect"
    CLEARABLE = "clearable"
    SEARCHABLE = "searchable"


class PaginationAttributes(BaseModel):
    name: PaginationAttributeKeyTypes
    value: Any
    model_config = {
            "extra": "allow"
        }
    
class PlayboardPagination(BaseModel):
    name: str
    dataKey: str
    displayName: str
    enabled: bool = False
    pageSize: int = 10
    pageSizes: List[int] = [10, 25, 50, 100]
    position: str = "bottom"
    index:int = 0
    attributes: Optional[list[Dict[str, Any]]] = None
    model_config = {
            "extra": "allow"
        }
    
class WidgetDescriptionBase(BaseModel):
    type: str
    text: str
    index:int
    styleClasses: Optional[List[str]|str] = None
    status:Optional[str] = "active"
    model_config = {
            "extra": "allow"
        }
    
class WidgetDescription(WidgetDescriptionBase):
    nodes: Optional[List[WidgetDescriptionBase]] = None


class FilterAttribute(BaseModel):
    name: WidgetAttributeKeyTypes
    value: Any

    model_config = {
            "extra": "allow"
        }

class ApiConfig(BaseModel):
    key: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    endpoint: str
    method: str = "GET"
    headers: Optional[Dict[str, str]] = None
    params: Optional[Dict[str, Any]] = None
    path_params: Optional[Dict[str, Any]] = None
    body: Optional[Dict[str, Any]] = None
    pagination: Optional[Dict[str, Any]] = None
    authentication: Optional[Dict[str, Any]] = None
    args_mapping: Optional[Dict[str, str]] = None
    response_mapping: Optional[Dict[str, str]] = None
    cached: Optional[bool] = False
    state: str = "active"
    timeout: Optional[int] = 30
    retry: Optional[int] = 0
    retry_delay: Optional[int] = 0   
    max_cache_size: Optional[int] = 128
    response_path: Optional[str] = None
    content_type: Optional[str] = "application/json"
    call_auth_service: Optional[bool] = False
    auth_service_key: Optional[str] = None
    auth_token_key: Optional[str] = None
    auth_token_location: Optional[str] = "header"  # header, query, body
    auth_token_name: Optional[str] = "Authorization"
    auth_token_prefix: Optional[str] = "Bearer "
    refresh_token_on_expiry: Optional[bool] = False
    refresh_token_endpoint: Optional[str] = None
    refresh_token_method: Optional[str] = "POST"
    refresh_token_body: Optional[Dict[str, Any]] = None
    ping_endpoint: Optional[str] = None
    ping_method: Optional[str] = "GET"
    ping_expected_status: Optional[int] = 200
    ping_timeout: Optional[int] = 5
    headers_mapping: Optional[Dict[str, str]] = None
    ssl_verify: Optional[bool] = True
    ssl_cert_path: Optional[str] = None
    ssl_key_path: Optional[str] = None
    ssl_ca_path: Optional[str] = None
    use_proxy: Optional[bool] = False
    proxy_url: Optional[str] = None
    proxies: Optional[Dict[str, str]] = None

    model_config = {
            "extra": "allow"
        }
       
class FilterControls(BaseModel):
    """controls for filter widgets"""
    #publisher and subscriber can be used to define event based communication between widgets
    publisher: Optional[Dict[str, Any]] = None
    #subscriber to listen to events from other widgets
    subscriber: Optional[Dict[str, Any]] = None
    #event handlers for filter widgets
    events: Optional[Dict[str, Any]] = None
    #Additional api configuration for dynamic filters
    api_config: Optional[ApiConfig] = None

    model_config = {
            "extra": "allow"
        }
class WidgetFilter(BaseModel):
    name: str
    dataKey: str
    displayName: str
    index:int
    visible: bool = True
    type: str
    status: str = "active"
    inputHint: Optional[str] = None
    title: Optional[str] = None    
    attributes: Optional[FilterAttribute] = None
    validators: Optional[list[dict[str,Any]]] = None
    description: Optional[list[WidgetDescription]] = None
    controls:Optional[FilterControls] = None

    model_config = {
            "extra": "allow"
        }

class WidgetFilterGroup(BaseModel):
    name: str
    index:int
    displayName: str
    visible: bool = True
    status: str = "active"
    filters: Optional[list[WidgetFilter]] = None
    model_config = {
            "extra": "allow"
        }
    
class PlayboardWidget(BaseModel):
    "filter model for playboard widgets"
    filters: Optional[list[WidgetFilter]] = None
    grid: Optional[Dict[str, Any]] = None  
    pagination: Optional[Dict[str, Any]] = None


class PlayboardInDB(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    key:str
    name: str
    description: Optional[str] = None
    scenarioKey: str
    dataDomain: str
    widgets: Optional[PlayboardWidget] = []
    order: Optional[int] = 0
    program_key: Optional[str] = None
    addon_configurations: Optional[list[str]|str] = None
    scenarioDescription: Optional[list[WidgetDescription]] = None
    data: Optional[Dict[str, Any]] = None
    status: str = "active"
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

    model_config = {
        "extra": "allow",
        "populate_by_name": True
    }


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


# ============ API Configuration Management Models ============
class ApiConfigAuthType(str, Enum):
    """Authentication types for API configurations"""
    NONE = "none"
    BASIC = "basic"
    BEARER = "bearer"
    API_KEY = "api_key"
    OAUTH2 = "oauth2"  # OAuth2 client credentials flow
    LOGIN_TOKEN = "login_token"  # Login endpoint to get bearer token
    MTLS = "mtls"
    CUSTOM = "custom"


# Auth config schemas for different auth types:
#
# 1. LOGIN_TOKEN - Login to get Bearer token:
#    auth_config = {
#        "login_endpoint": "https://api.example.com/auth/login",
#        "login_method": "POST",
#        "username_field": "email",          # Field name in request body
#        "password_field": "password",       # Field name in request body
#        "username": "user@example.com",
#        "password": "secret",
#        "extra_body": {},                   # Optional extra fields in login body
#        "token_response_path": "access_token",  # JSONPath to extract token from response
#        "token_type": "Bearer",             # Token prefix (Bearer, Token, etc.)
#        "token_header_name": "Authorization", # Header name for token
#    }
#
# 2. OAUTH2 - OAuth2 Client Credentials Flow:
#    auth_config = {
#        "token_endpoint": "https://auth.example.com/oauth/token",
#        "client_id": "my-client-id",
#        "client_secret": "my-client-secret",
#        "scope": "read write",              # Optional scope
#        "grant_type": "client_credentials", # Default
#        "audience": "",                     # Optional audience
#        "extra_params": {},                 # Optional extra params
#        "token_response_path": "access_token",
#        "token_type": "Bearer",
#        "token_header_name": "Authorization",
#    }
#
# 3. BASIC - Basic Auth:
#    auth_config = {
#        "username": "user",
#        "password": "pass"
#    }
#
# 4. BEARER - Static Bearer Token:
#    auth_config = {
#        "token": "my-static-token"
#    }
#
# 5. API_KEY - API Key:
#    auth_config = {
#        "key_name": "X-API-Key",
#        "key_value": "my-api-key",
#        "key_location": "header"  # header, query
#    }


class ApiConfigCreate(BaseModel):
    """Create a new API configuration"""
    key: str = Field(..., description="Unique identifier for the API config")
    name: str = Field(..., description="Display name for the API config")
    description: Optional[str] = None
    endpoint: str = Field(..., description="Base URL of the API")
    method: str = Field(default="GET", description="HTTP method")
    headers: Optional[Dict[str, str]] = None
    params: Optional[Dict[str, Any]] = None
    body: Optional[Dict[str, Any]] = None

    # Authentication settings
    auth_type: ApiConfigAuthType = ApiConfigAuthType.NONE
    auth_config: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Authentication configuration (credentials, tokens, etc.)"
    )

    # SSL/TLS settings
    ssl_verify: bool = True
    ssl_cert_gcs_path: Optional[str] = Field(
        default=None,
        description="GCS path to client certificate"
    )
    ssl_key_gcs_path: Optional[str] = Field(
        default=None,
        description="GCS path to client key"
    )
    ssl_ca_gcs_path: Optional[str] = Field(
        default=None,
        description="GCS path to CA certificate"
    )

    # Request settings
    timeout: int = Field(default=30, description="Request timeout in seconds")
    retry_count: int = Field(default=0, description="Number of retries on failure")
    retry_delay: int = Field(default=1, description="Delay between retries in seconds")

    # Response handling
    response_path: Optional[str] = Field(
        default=None,
        description="JSONPath to extract data from response"
    )
    response_mapping: Optional[Dict[str, str]] = None

    # Proxy settings
    use_proxy: bool = False
    proxy_url: Optional[str] = None

    # Health check / ping settings
    ping_endpoint: Optional[str] = Field(
        default=None,
        description="Endpoint to test connectivity (defaults to base endpoint)"
    )
    ping_method: str = "GET"
    ping_expected_status: int = 200
    ping_timeout: int = 5

    # Caching
    cache_enabled: bool = False
    cache_ttl: int = Field(default=300, description="Cache TTL in seconds")

    # Status
    status: str = "active"

    # Tags for categorization
    tags: List[str] = []

    model_config = {"extra": "allow"}


class ApiConfigUpdate(BaseModel):
    """Update an existing API configuration"""
    name: Optional[str] = None
    description: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    params: Optional[Dict[str, Any]] = None
    body: Optional[Dict[str, Any]] = None

    auth_type: Optional[ApiConfigAuthType] = None
    auth_config: Optional[Dict[str, Any]] = None

    ssl_verify: Optional[bool] = None
    ssl_cert_gcs_path: Optional[str] = None
    ssl_key_gcs_path: Optional[str] = None
    ssl_ca_gcs_path: Optional[str] = None

    timeout: Optional[int] = None
    retry_count: Optional[int] = None
    retry_delay: Optional[int] = None

    response_path: Optional[str] = None
    response_mapping: Optional[Dict[str, str]] = None

    use_proxy: Optional[bool] = None
    proxy_url: Optional[str] = None

    ping_endpoint: Optional[str] = None
    ping_method: Optional[str] = None
    ping_expected_status: Optional[int] = None
    ping_timeout: Optional[int] = None

    cache_enabled: Optional[bool] = None
    cache_ttl: Optional[int] = None

    status: Optional[str] = None
    tags: Optional[List[str]] = None

    model_config = {"extra": "allow"}


class ApiConfigInDB(BaseModel):
    """API configuration as stored in database"""
    id: Optional[str] = Field(None, alias="_id")
    key: str
    name: str
    description: Optional[str] = None
    endpoint: str
    method: str = "GET"
    headers: Optional[Dict[str, str]] = None
    params: Optional[Dict[str, Any]] = None
    body: Optional[Dict[str, Any]] = None

    auth_type: str = "none"
    auth_config: Optional[Dict[str, Any]] = None

    ssl_verify: bool = True
    ssl_cert_gcs_path: Optional[str] = None
    ssl_key_gcs_path: Optional[str] = None
    ssl_ca_gcs_path: Optional[str] = None

    timeout: int = 30
    retry_count: int = 0
    retry_delay: int = 1

    response_path: Optional[str] = None
    response_mapping: Optional[Dict[str, str]] = None

    use_proxy: bool = False
    proxy_url: Optional[str] = None

    ping_endpoint: Optional[str] = None
    ping_method: str = "GET"
    ping_expected_status: int = 200
    ping_timeout: int = 5

    cache_enabled: bool = False
    cache_ttl: int = 300

    status: str = "active"
    tags: List[str] = []

    created_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

    model_config = {"extra": "allow", "populate_by_name": True}


class ApiConfigTestRequest(BaseModel):
    """Request to test an API configuration"""
    config_id: Optional[str] = Field(
        default=None,
        description="ID of existing config to test"
    )
    config: Optional[ApiConfigCreate] = Field(
        default=None,
        description="Inline config to test (if config_id not provided)"
    )
    test_params: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Override params for testing"
    )
    test_body: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Override body for testing"
    )


class ApiConfigTestResponse(BaseModel):
    """Response from testing an API configuration"""
    success: bool
    status_code: Optional[int] = None
    response_time_ms: Optional[float] = None
    response_headers: Optional[Dict[str, str]] = None
    response_body: Optional[Any] = None
    error: Optional[str] = None
    ssl_info: Optional[Dict[str, Any]] = None


class ApiConfigCertUploadResponse(BaseModel):
    """Response from uploading a certificate"""
    gcs_path: str
    file_name: str
    cert_type: str
    uploaded_at: str
    expires_at: Optional[str] = None


# ============ Distribution List Models ============
class DistributionListType(str, Enum):
    """Types of distribution lists"""
    SCENARIO_REQUEST = "scenario_request"
    FEEDBACK = "feedback"
    SYSTEM_ALERT = "system_alert"
    CUSTOM = "custom"


class DistributionListCreate(BaseModel):
    """Create a new distribution list"""
    key: str = Field(..., description="Unique identifier for the distribution list")
    name: str = Field(..., description="Display name for the distribution list")
    description: Optional[str] = None
    type: DistributionListType = DistributionListType.CUSTOM
    emails: List[str] = Field(default_factory=list, description="List of email addresses")
    is_active: bool = True


class DistributionListUpdate(BaseModel):
    """Update an existing distribution list"""
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[DistributionListType] = None
    emails: Optional[List[str]] = None
    is_active: Optional[bool] = None


class DistributionListInDB(BaseModel):
    """Distribution list as stored in database"""
    id: Optional[str] = Field(None, alias="_id")
    key: str
    name: str
    description: Optional[str] = None
    type: str = "custom"
    emails: List[str] = []
    is_active: bool = True
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

    model_config = {"extra": "allow", "populate_by_name": True}


class DistributionListAddEmail(BaseModel):
    """Add email to distribution list"""
    email: str = Field(..., description="Email address to add")


class DistributionListRemoveEmail(BaseModel):
    """Remove email from distribution list"""
    email: str = Field(..., description="Email address to remove")
