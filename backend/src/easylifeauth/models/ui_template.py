"""UI Template Pydantic Models"""
from typing import List, Optional, Dict
from datetime import datetime, timezone
from pydantic import BaseModel, Field


class WidgetAttribute(BaseModel):
    """Key-value attribute for a widget"""
    key: str
    value: str
    description: Optional[str] = None

    model_config = {"extra": "allow"}


class WidgetOverride(BaseModel):
    """Override set for a widget, keyed by custom key"""
    attributes: List[WidgetAttribute] = []

    model_config = {"extra": "allow"}


class Widget(BaseModel):
    """Single widget in a UI template"""
    key: str
    datakey: Optional[str] = None
    displayName: str
    index: int
    value: Optional[str] = None
    attributes: List[WidgetAttribute] = []
    overrides: Dict[str, WidgetOverride] = {}

    model_config = {"extra": "allow"}


class TemplateComment(BaseModel):
    """Comment on a UI template, requires Jira ticket reference"""
    comment: str
    author: str
    timestamp: Optional[str] = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    reason: List[str] = []  # Jira ticket keys e.g. ["PROJ-123"]

    model_config = {"extra": "allow"}


class UITemplateCreate(BaseModel):
    """Create a new UI template"""
    version: str = "1.0.0"
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    author: Optional[str] = None
    page: str = Field(..., min_length=1)
    component: Optional[str] = None
    componentType: Optional[str] = None
    usage: List[str] = []
    status: str = "Y"
    accessLevel: str = "USR"
    widgets: List[Widget] = []
    comments: List[TemplateComment] = []

    model_config = {"extra": "allow"}


class UITemplateUpdate(BaseModel):
    """Update an existing UI template (all fields optional)"""
    name: Optional[str] = None
    description: Optional[str] = None
    author: Optional[str] = None
    page: Optional[str] = None
    component: Optional[str] = None
    componentType: Optional[str] = None
    usage: Optional[List[str]] = None
    status: Optional[str] = None
    accessLevel: Optional[str] = None
    widgets: Optional[List[Widget]] = None

    model_config = {"extra": "allow"}


class UITemplateVersionBump(BaseModel):
    """Version bump request — creates a full document copy"""
    version: str = Field(..., min_length=1)
    comment: TemplateComment

    model_config = {"extra": "allow"}
