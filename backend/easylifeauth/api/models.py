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
    rating: Optional[int] = None
    improvements: Optional[str] = None
    suggestions: Optional[str] = None
    email: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    
    class Config:
        extra = "allow"


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
