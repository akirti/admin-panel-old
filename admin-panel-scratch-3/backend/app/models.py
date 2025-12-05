"""
Pydantic models for request/response validation.
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any, Generic, TypeVar
from datetime import datetime
from enum import Enum


# ============ Enums ============

class StatusEnum(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"


class TypeEnum(str, Enum):
    SYSTEM = "system"
    CUSTOM = "custom"


# ============ Base Models ============

class PyObjectId(str):
    """Custom ObjectId type for MongoDB."""
    pass


class TimestampMixin(BaseModel):
    """Mixin for timestamp fields."""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ============ Pagination Models ============

T = TypeVar('T')


class PaginationMeta(BaseModel):
    """Pagination metadata."""
    total: int = Field(..., description="Total number of items")
    page: int = Field(..., description="Current page number (0-indexed)")
    limit: int = Field(..., description="Items per page")
    pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there are more pages")
    has_prev: bool = Field(..., description="Whether there are previous pages")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response."""
    data: List[T] = Field(..., description="List of items")
    pagination: PaginationMeta = Field(..., description="Pagination metadata")


# ============ Permission Models ============

class PermissionBase(BaseModel):
    """Base permission model."""
    key: str = Field(..., description="Unique permission key")
    name: str = Field(..., description="Permission name")
    description: Optional[str] = None
    module: str = Field(..., description="Module this permission belongs to")
    actions: List[str] = Field(default=["read"], description="Allowed actions")


class PermissionCreate(PermissionBase):
    """Permission creation model."""
    pass


class PermissionUpdate(BaseModel):
    """Permission update model."""
    name: Optional[str] = None
    description: Optional[str] = None
    module: Optional[str] = None
    actions: Optional[List[str]] = None


class PermissionInDB(PermissionBase, TimestampMixin):
    """Permission model in database."""
    id: Optional[str] = Field(None, alias="_id")
    
    class Config:
        populate_by_name = True


# ============ Role Models ============

class RoleBase(BaseModel):
    """Base role model."""
    type: TypeEnum = TypeEnum.CUSTOM
    roleId: str = Field(..., description="Unique role identifier")
    name: str = Field(..., description="Role name")
    description: Optional[str] = None
    permissions: List[str] = Field(default=[], description="List of permission keys")
    domains: List[str] = Field(default=[], description="Accessible domain keys")
    status: StatusEnum = StatusEnum.ACTIVE
    priority: int = Field(default=0, ge=0, description="Role priority")


class RoleCreate(RoleBase):
    """Role creation model."""
    pass


class RoleUpdate(BaseModel):
    """Role update model."""
    type: Optional[TypeEnum] = None
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    domains: Optional[List[str]] = None
    status: Optional[StatusEnum] = None
    priority: Optional[int] = None


class RoleInDB(RoleBase, TimestampMixin):
    """Role model in database."""
    id: Optional[str] = Field(None, alias="_id")
    
    class Config:
        populate_by_name = True


# ============ Group Models ============

class GroupBase(BaseModel):
    """Base group model."""
    type: TypeEnum = TypeEnum.CUSTOM
    groupId: str = Field(..., description="Unique group identifier")
    name: str = Field(..., description="Group name")
    description: Optional[str] = None
    permissions: List[str] = Field(default=[], description="List of permission keys")
    domains: List[str] = Field(default=[], description="Accessible domain keys")
    status: StatusEnum = StatusEnum.ACTIVE
    priority: int = Field(default=0, ge=0, description="Group priority")


class GroupCreate(GroupBase):
    """Group creation model."""
    pass


class GroupUpdate(BaseModel):
    """Group update model."""
    type: Optional[TypeEnum] = None
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None
    domains: Optional[List[str]] = None
    status: Optional[StatusEnum] = None
    priority: Optional[int] = None


class GroupInDB(GroupBase, TimestampMixin):
    """Group model in database."""
    id: Optional[str] = Field(None, alias="_id")
    
    class Config:
        populate_by_name = True


# ============ Customer Models ============

class CustomerBase(BaseModel):
    """Base customer model."""
    customerId: str = Field(..., description="Unique customer identifier")
    name: str = Field(..., description="Customer name")
    description: Optional[str] = None
    status: StatusEnum = StatusEnum.ACTIVE
    settings: dict = Field(default={}, description="Customer-specific settings")


class CustomerCreate(CustomerBase):
    """Customer creation model."""
    pass


class CustomerUpdate(BaseModel):
    """Customer update model."""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[StatusEnum] = None
    settings: Optional[dict] = None


class CustomerInDB(CustomerBase, TimestampMixin):
    """Customer model in database."""
    id: Optional[str] = Field(None, alias="_id")
    
    class Config:
        populate_by_name = True


# ============ User Models ============

class UserBase(BaseModel):
    """Base user model."""
    email: EmailStr = Field(..., description="User email")
    username: str = Field(..., min_length=3, max_length=50, description="Username")
    full_name: str = Field(..., description="Full name")
    roles: List[str] = Field(default=[], description="List of role IDs")
    groups: List[str] = Field(default=[], description="List of group IDs")
    customers: List[str] = Field(default=[], description="List of customer IDs")
    is_active: bool = Field(default=True, description="User active status")


class UserCreate(UserBase):
    """User creation model."""
    password: str = Field(..., min_length=8, description="User password")
    send_password_email: bool = Field(default=True, description="Send password reset email")


class UserUpdate(BaseModel):
    """User update model."""
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    roles: Optional[List[str]] = None
    groups: Optional[List[str]] = None
    customers: Optional[List[str]] = None
    is_active: Optional[bool] = None


class UserPasswordChange(BaseModel):
    """Password change model."""
    current_password: str
    new_password: str = Field(..., min_length=8)


class UserPasswordReset(BaseModel):
    """Password reset request model."""
    email: EmailStr
    send_email: bool = Field(default=True, description="Send password reset email")


class UserInDB(UserBase, TimestampMixin):
    """User model in database."""
    id: Optional[str] = Field(None, alias="_id")
    password_hash: str
    last_login: Optional[datetime] = None
    is_super_admin: bool = False
    
    class Config:
        populate_by_name = True


class UserResponse(UserBase, TimestampMixin):
    """User response model (without password)."""
    id: Optional[str] = Field(None, alias="_id")
    last_login: Optional[datetime] = None
    is_super_admin: bool = False
    
    class Config:
        populate_by_name = True


# ============ Domain Models ============

class SubDomain(BaseModel):
    """Sub-domain model."""
    key: str
    name: str
    description: Optional[str] = None
    path: str
    status: StatusEnum = StatusEnum.ACTIVE
    order: int = 0
    icon: Optional[str] = None


class DomainBase(BaseModel):
    """Base domain model."""
    type: TypeEnum = TypeEnum.CUSTOM
    key: str = Field(..., description="Unique domain key")
    name: str = Field(..., description="Domain name")
    description: Optional[str] = None
    path: str = Field(..., description="Domain path/route")
    dataDomain: Optional[str] = None
    status: StatusEnum = StatusEnum.ACTIVE
    defaultSelected: bool = False
    order: int = Field(default=0, ge=0)
    icon: Optional[str] = None
    subDomains: List[SubDomain] = Field(default=[])


class DomainCreate(DomainBase):
    """Domain creation model."""
    pass


class DomainUpdate(BaseModel):
    """Domain update model."""
    type: Optional[TypeEnum] = None
    name: Optional[str] = None
    description: Optional[str] = None
    path: Optional[str] = None
    dataDomain: Optional[str] = None
    status: Optional[StatusEnum] = None
    defaultSelected: Optional[bool] = None
    order: Optional[int] = None
    icon: Optional[str] = None
    subDomains: Optional[List[SubDomain]] = None


class DomainInDB(DomainBase, TimestampMixin):
    """Domain model in database."""
    id: Optional[str] = Field(None, alias="_id")
    
    class Config:
        populate_by_name = True


# ============ Domain Scenario Models ============

class DomainScenarioBase(BaseModel):
    """Base domain scenario model."""
    type: TypeEnum = TypeEnum.CUSTOM
    key: str = Field(..., description="Unique scenario key")
    name: str = Field(..., description="Scenario name")
    description: Optional[str] = None
    path: str = Field(..., description="Scenario path/route")
    dataDomain: Optional[str] = None
    status: StatusEnum = StatusEnum.ACTIVE
    defaultSelected: bool = False
    order: int = Field(default=0, ge=0)
    icon: Optional[str] = None
    subDomains: List[SubDomain] = Field(default=[])
    domainKey: str = Field(..., description="Associated domain key")


class DomainScenarioCreate(DomainScenarioBase):
    """Domain scenario creation model."""
    pass


class DomainScenarioUpdate(BaseModel):
    """Domain scenario update model."""
    type: Optional[TypeEnum] = None
    name: Optional[str] = None
    description: Optional[str] = None
    path: Optional[str] = None
    dataDomain: Optional[str] = None
    status: Optional[StatusEnum] = None
    defaultSelected: Optional[bool] = None
    order: Optional[int] = None
    icon: Optional[str] = None
    subDomains: Optional[List[SubDomain]] = None
    domainKey: Optional[str] = None


class DomainScenarioInDB(DomainScenarioBase, TimestampMixin):
    """Domain scenario model in database."""
    id: Optional[str] = Field(None, alias="_id")
    
    class Config:
        populate_by_name = True


# ============ Playboard Models ============

class PlayboardBase(BaseModel):
    """Base playboard model."""
    name: str = Field(..., description="Playboard name")
    description: Optional[str] = None
    scenarioKey: str = Field(..., description="Associated scenario key")
    data: dict = Field(..., description="JSON playboard data")
    status: StatusEnum = StatusEnum.ACTIVE


class PlayboardCreate(PlayboardBase):
    """Playboard creation model."""
    pass


class PlayboardUpdate(BaseModel):
    """Playboard update model."""
    name: Optional[str] = None
    description: Optional[str] = None
    scenarioKey: Optional[str] = None
    data: Optional[dict] = None
    status: Optional[StatusEnum] = None


class PlayboardInDB(PlayboardBase, TimestampMixin):
    """Playboard model in database."""
    id: Optional[str] = Field(None, alias="_id")
    
    class Config:
        populate_by_name = True


# ============ Auth Models ============

class Token(BaseModel):
    """JWT token response model."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Token payload data."""
    user_id: Optional[str] = None
    email: Optional[str] = None
    is_super_admin: bool = False


class LoginRequest(BaseModel):
    """Login request model."""
    email: EmailStr
    password: str


# ============ Bulk Upload Models ============

class BulkUploadResult(BaseModel):
    """Bulk upload result model."""
    total: int
    successful: int
    failed: int
    errors: List[dict] = []


class GCSUploadRequest(BaseModel):
    """GCS file upload request model."""
    bucket_name: Optional[str] = None
    file_path: str = Field(..., description="Path to file in GCS bucket")
    entity_type: str = Field(..., description="Type of entity to upload (users, roles, etc.)")


# ============ Audit Log Models ============

class AuditLogBase(BaseModel):
    """Audit log model."""
    action: str
    entity_type: str
    entity_id: str
    user_id: str
    user_email: str
    changes: dict = {}
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class AuditLogInDB(AuditLogBase):
    """Audit log in database."""
    id: Optional[str] = Field(None, alias="_id")
    
    class Config:
        populate_by_name = True


# ============ Dashboard Models ============

class DashboardStats(BaseModel):
    """Dashboard statistics model."""
    total_users: int = 0
    active_users: int = 0
    total_roles: int = 0
    total_groups: int = 0
    total_customers: int = 0
    total_domains: int = 0
    total_scenarios: int = 0
    total_configurations: int = 0
    total_playboards: int = 0
    recent_activities: List[dict] = []
