"""
Configuration models for the Admin Panel application.
"""
from pydantic import BaseModel, Field
from typing import Optional, Any, List, Dict
from enum import Enum
from datetime import datetime, timezone


def _now_iso() -> str:
    """Return current UTC timestamp in ISO format."""
    return datetime.now(timezone.utc).isoformat()


class DbConfigurationTypes(str, Enum):
    """Configuration type enumeration."""
    PROCESS_TYPE = "process-config"
    LOOKUP_DATA_TYPE = "lookup-data"
    GCS_DATA_TYPE = "gcs-data"
    SNAP_SHOT_TYPE = "snapshot-data"


class GcpFileInfo(BaseModel):
    """GCS File Information."""
    bucket: Optional[str] = None
    file_name: str
    gcs_key: str
    version: Optional[int] = None
    content_type: str
    size: float
    upload_date: str = Field(default_factory=_now_iso)


class GcpUploadInfo(BaseModel):
    """GCS Upload Information with versioning."""
    bucket: Optional[str] = None
    file_name: str
    gcs_key: str
    version: Optional[int] = None
    content_type: str
    size: float
    upload_date: str = Field(default_factory=_now_iso)
    current_version: Optional[int] = None
    current_gcs_key: Optional[str] = None
    versioned: bool = True
    versions: Optional[List[GcpFileInfo]] = None


class ConfigBase(BaseModel):
    """Configuration Base Model."""
    config_id: Optional[str] = None
    type: DbConfigurationTypes
    key: str
    row_add_userid: Optional[str] = None
    row_add_stp: Optional[str] = Field(default_factory=_now_iso)
    row_update_userid: Optional[str] = None
    row_update_stp: Optional[str] = Field(default_factory=_now_iso)


class GcpUploadDocument(ConfigBase):
    """GCS Data Configuration Document."""
    type: DbConfigurationTypes = DbConfigurationTypes.GCS_DATA_TYPE
    gcs: Optional[GcpUploadInfo] = None


class LookupDocument(ConfigBase):
    """Lookup Data Configuration Document."""
    type: DbConfigurationTypes = DbConfigurationTypes.LOOKUP_DATA_TYPE
    lookups: Optional[Dict[str, Any]] = None


class ProcessDocument(ConfigBase):
    """Process Configuration Document."""
    type: DbConfigurationTypes = DbConfigurationTypes.PROCESS_TYPE
    queries: Optional[Dict[str, Any]] = None
    logics: Optional[Dict[str, Any]] = None
    operations: Optional[Dict[str, Any]] = None


class SnapShotDocument(ConfigBase):
    """Snapshot Data Configuration Document."""
    type: DbConfigurationTypes = DbConfigurationTypes.SNAP_SHOT_TYPE
    data: Optional[Dict[str, Any]] = None


class ConfigurationDocument(BaseModel):
    """
    Unified Configuration Document that can represent any configuration type.
    """
    id: Optional[str] = Field(None, alias="_id")
    config_id: Optional[str] = None
    type: DbConfigurationTypes
    key: str
    
    # GCS fields
    gcs: Optional[GcpUploadInfo] = None
    
    # Lookup fields
    lookups: Optional[Dict[str, Any]] = None
    
    # Process fields
    queries: Optional[Dict[str, Any]] = None
    logics: Optional[Dict[str, Any]] = None
    operations: Optional[Dict[str, Any]] = None
    
    # Snapshot fields
    data: Optional[Dict[str, Any]] = None
    
    # Audit fields
    row_add_userid: Optional[str] = None
    row_add_stp: Optional[str] = Field(default_factory=_now_iso)
    row_update_userid: Optional[str] = None
    row_update_stp: Optional[str] = Field(default_factory=_now_iso)

    class Config:
        populate_by_name = True
        use_enum_values = True


# Request/Response Models
class ConfigurationCreate(BaseModel):
    """Create configuration request."""
    key: str
    type: DbConfigurationTypes
    lookups: Optional[Dict[str, Any]] = None
    queries: Optional[Dict[str, Any]] = None
    logics: Optional[Dict[str, Any]] = None
    operations: Optional[Dict[str, Any]] = None
    data: Optional[Dict[str, Any]] = None


class ConfigurationUpdate(BaseModel):
    """Update configuration request."""
    key: Optional[str] = None
    type: Optional[DbConfigurationTypes] = None
    lookups: Optional[Dict[str, Any]] = None
    queries: Optional[Dict[str, Any]] = None
    logics: Optional[Dict[str, Any]] = None
    operations: Optional[Dict[str, Any]] = None
    data: Optional[Dict[str, Any]] = None


class ConfigurationResponse(BaseModel):
    """Configuration response model."""
    id: str
    config_id: str
    type: str
    key: str
    gcs: Optional[GcpUploadInfo] = None
    lookups: Optional[Dict[str, Any]] = None
    queries: Optional[Dict[str, Any]] = None
    logics: Optional[Dict[str, Any]] = None
    operations: Optional[Dict[str, Any]] = None
    data: Optional[Dict[str, Any]] = None
    row_add_userid: Optional[str] = None
    row_add_stp: Optional[str] = None
    row_update_userid: Optional[str] = None
    row_update_stp: Optional[str] = None


class FileUploadResponse(BaseModel):
    """File upload response."""
    message: str
    config_id: str
    key: str
    gcs_key: str
    version: int
    file_name: str
