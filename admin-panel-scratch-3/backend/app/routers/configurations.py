"""
Configurations router for managing configuration documents.
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone
import json
import uuid
import math

from app.database import get_database, COLLECTIONS
from app.auth import get_current_super_admin
from app.models import UserInDB, PaginationMeta
from app.models_config.configurations import (
    DbConfigurationTypes,
    ConfigurationCreate,
    ConfigurationUpdate,
    ConfigurationResponse,
    GcpUploadInfo,
    GcpFileInfo,
    FileUploadResponse,
)
from app.services.gcs_service import gcs_service
from app.config import settings

router = APIRouter(prefix="/configurations", tags=["Configurations"])


def generate_config_id() -> str:
    """Generate unique configuration ID."""
    return f"config_{uuid.uuid4().hex[:12]}"


def serialize_config(config: dict) -> dict:
    """Serialize configuration document for response."""
    if config.get("_id"):
        config["id"] = str(config["_id"])
        del config["_id"]
    if not config.get("config_id"):
        config["config_id"] = config.get("id", "")
    return config


def create_pagination_meta(total: int, page: int, limit: int) -> PaginationMeta:
    """Create pagination metadata."""
    pages = math.ceil(total / limit) if limit > 0 else 0
    return PaginationMeta(
        total=total,
        page=page,
        limit=limit,
        pages=pages,
        has_next=page < pages - 1,
        has_prev=page > 0
    )


@router.get("")
async def list_configurations(
    type: Optional[DbConfigurationTypes] = None,
    search: Optional[str] = None,
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    current_user: UserInDB = Depends(get_current_super_admin)
):
    """List all configurations with optional filtering and pagination."""
    db = get_database()
    query = {}
    
    if type:
        query["type"] = type.value
    
    if search:
        query["$or"] = [
            {"key": {"$regex": search, "$options": "i"}},
            {"config_id": {"$regex": search, "$options": "i"}},
        ]
    
    # Get total count
    total = await db[COLLECTIONS["configurations"]].count_documents(query)
    
    # Get paginated data
    skip = page * limit
    cursor = db[COLLECTIONS["configurations"]].find(query).skip(skip).limit(limit).sort("row_update_stp", -1)
    configs = await cursor.to_list(length=limit)
    
    return {
        "data": [serialize_config(config) for config in configs],
        "pagination": create_pagination_meta(total, page, limit)
    }


@router.get("/count")
async def count_configurations(
    type: Optional[DbConfigurationTypes] = None,
    current_user: UserInDB = Depends(get_current_super_admin)
):
    """Get count of configurations."""
    db = get_database()
    query = {}
    if type:
        query["type"] = type.value
    
    count = await db[COLLECTIONS["configurations"]].count_documents(query)
    return {"count": count}


@router.get("/types")
async def get_configuration_types(
    current_user: UserInDB = Depends(get_current_super_admin)
):
    """Get available configuration types."""
    return {
        "types": [
            {"value": t.value, "label": t.name.replace("_", " ").title()}
            for t in DbConfigurationTypes
        ]
    }


@router.get("/{config_id}", response_model=ConfigurationResponse)
async def get_configuration(
    config_id: str,
    current_user: UserInDB = Depends(get_current_super_admin)
):
    """Get a specific configuration by ID."""
    db = get_database()
    
    # Try to find by config_id first, then by _id
    config = await db[COLLECTIONS["configurations"]].find_one({"config_id": config_id})
    if not config:
        try:
            config = await db[COLLECTIONS["configurations"]].find_one({"_id": ObjectId(config_id)})
        except:
            pass
    
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    return serialize_config(config)


@router.post("", response_model=ConfigurationResponse)
async def create_configuration(
    config_data: ConfigurationCreate,
    current_user: UserInDB = Depends(get_current_super_admin)
):
    """Create a new configuration."""
    db = get_database()
    
    # Check for duplicate key
    existing = await db[COLLECTIONS["configurations"]].find_one({"key": config_data.key})
    if existing:
        raise HTTPException(status_code=400, detail="Configuration with this key already exists")
    
    now = datetime.now(timezone.utc).isoformat()
    config_id = generate_config_id()
    
    config_doc = {
        "config_id": config_id,
        "type": config_data.type.value,
        "key": config_data.key,
        "row_add_userid": current_user.email,
        "row_add_stp": now,
        "row_update_userid": current_user.email,
        "row_update_stp": now,
    }
    
    # Add type-specific fields
    if config_data.type == DbConfigurationTypes.LOOKUP_DATA_TYPE:
        config_doc["lookups"] = config_data.lookups or {}
    elif config_data.type == DbConfigurationTypes.PROCESS_TYPE:
        config_doc["queries"] = config_data.queries or {}
        config_doc["logics"] = config_data.logics or {}
        config_doc["operations"] = config_data.operations or {}
    elif config_data.type == DbConfigurationTypes.SNAP_SHOT_TYPE:
        config_doc["data"] = config_data.data or {}
    elif config_data.type == DbConfigurationTypes.GCS_DATA_TYPE:
        config_doc["gcs"] = None
    
    result = await db[COLLECTIONS["configurations"]].insert_one(config_doc)
    config_doc["_id"] = result.inserted_id
    
    return serialize_config(config_doc)


@router.put("/{config_id}", response_model=ConfigurationResponse)
async def update_configuration(
    config_id: str,
    config_data: ConfigurationUpdate,
    current_user: UserInDB = Depends(get_current_super_admin)
):
    """Update a configuration."""
    db = get_database()
    
    # Find existing config
    config = await db[COLLECTIONS["configurations"]].find_one({"config_id": config_id})
    if not config:
        try:
            config = await db[COLLECTIONS["configurations"]].find_one({"_id": ObjectId(config_id)})
        except:
            pass
    
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    # Check for duplicate key if key is being changed
    if config_data.key and config_data.key != config.get("key"):
        existing = await db[COLLECTIONS["configurations"]].find_one({"key": config_data.key})
        if existing:
            raise HTTPException(status_code=400, detail="Configuration with this key already exists")
    
    now = datetime.now(timezone.utc).isoformat()
    
    update_doc = {
        "row_update_userid": current_user.email,
        "row_update_stp": now,
    }
    
    # Update provided fields
    if config_data.key:
        update_doc["key"] = config_data.key
    if config_data.type:
        update_doc["type"] = config_data.type.value
    if config_data.lookups is not None:
        update_doc["lookups"] = config_data.lookups
    if config_data.queries is not None:
        update_doc["queries"] = config_data.queries
    if config_data.logics is not None:
        update_doc["logics"] = config_data.logics
    if config_data.operations is not None:
        update_doc["operations"] = config_data.operations
    if config_data.data is not None:
        update_doc["data"] = config_data.data
    
    await db[COLLECTIONS["configurations"]].update_one(
        {"_id": config["_id"]},
        {"$set": update_doc}
    )
    
    updated_config = await db[COLLECTIONS["configurations"]].find_one({"_id": config["_id"]})
    return serialize_config(updated_config)


@router.delete("/{config_id}")
async def delete_configuration(
    config_id: str,
    current_user: UserInDB = Depends(get_current_super_admin)
):
    """Delete a configuration."""
    db = get_database()
    
    # Find existing config
    config = await db[COLLECTIONS["configurations"]].find_one({"config_id": config_id})
    if not config:
        try:
            config = await db[COLLECTIONS["configurations"]].find_one({"_id": ObjectId(config_id)})
        except:
            pass
    
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    # Delete associated GCS files if any
    if config.get("gcs") and config["gcs"].get("versions"):
        for version in config["gcs"]["versions"]:
            try:
                await gcs_service.delete_file(version.get("gcs_key"))
            except Exception as e:
                print(f"Failed to delete GCS file: {e}")
    
    await db[COLLECTIONS["configurations"]].delete_one({"_id": config["_id"]})
    
    return {"message": "Configuration deleted successfully", "config_id": config_id}


@router.post("/upload", response_model=FileUploadResponse)
async def upload_configuration_file(
    file: UploadFile = File(...),
    key: str = Form(...),
    config_type: str = Form(None),
    current_user: UserInDB = Depends(get_current_super_admin)
):
    """
    Upload a configuration file (JSON, XLSX, CSV).
    - For JSON files: Parses content and stores in appropriate fields based on type
    - For XLSX/CSV files: Stores as GCS data type with file in GCS bucket
    - Supports versioning for updates
    """
    db = get_database()
    now = datetime.now(timezone.utc).isoformat()
    
    # Validate file type
    allowed_extensions = {".json", ".xlsx", ".xls", ".csv"}
    file_ext = "." + file.filename.split(".")[-1].lower() if "." in file.filename else ""
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}"
        )
    
    # Read file content
    file_content = await file.read()
    file_size = len(file_content)
    
    # Check if configuration with this key exists
    existing_config = await db[COLLECTIONS["configurations"]].find_one({"key": key})
    
    # Determine configuration type
    if file_ext == ".json":
        # Parse JSON and determine type from content or parameter
        try:
            json_data = json.loads(file_content.decode("utf-8"))
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON file: {str(e)}")
        
        # Determine type from JSON structure or parameter
        if config_type:
            determined_type = config_type
        elif "queries" in json_data or "logics" in json_data or "operations" in json_data:
            determined_type = DbConfigurationTypes.PROCESS_TYPE.value
        elif "lookups" in json_data:
            determined_type = DbConfigurationTypes.LOOKUP_DATA_TYPE.value
        elif "data" in json_data:
            determined_type = DbConfigurationTypes.SNAP_SHOT_TYPE.value
        else:
            # Default to snapshot with full JSON as data
            determined_type = DbConfigurationTypes.SNAP_SHOT_TYPE.value
            json_data = {"data": json_data}
        
        # Try to save versioned copy to GCS if configured
        gcs_key = ""
        gcs_info = None
        version = 1
        
        if gcs_service.is_configured():
            # Calculate version
            if existing_config:
                existing_gcs = existing_config.get("gcs", {})
                current_version = existing_gcs.get("current_version", 0) if existing_gcs else 0
                version = current_version + 1
            
            gcs_folder = f"configurations/{key}"
            gcs_key = f"{gcs_folder}/v{version}_{file.filename}"
            
            # Upload JSON to GCS
            gcs_url = await gcs_service.upload_file(
                file_content=file_content,
                destination_path=gcs_key,
                content_type="application/json"
            )
            
            if gcs_url:
                # Build GCS info
                file_info = {
                    "bucket": settings.GCS_BUCKET_NAME,
                    "file_name": file.filename,
                    "gcs_key": gcs_key,
                    "version": version,
                    "content_type": "application/json",
                    "size": file_size,
                    "upload_date": now,
                }
                
                if existing_config:
                    existing_gcs = existing_config.get("gcs", {})
                    versions = existing_gcs.get("versions", []) if existing_gcs else []
                    versions.append(file_info)
                else:
                    versions = [file_info]
                
                gcs_info = {
                    "bucket": settings.GCS_BUCKET_NAME,
                    "file_name": file.filename,
                    "gcs_key": gcs_key,
                    "version": version,
                    "content_type": "application/json",
                    "size": file_size,
                    "upload_date": now,
                    "current_version": version,
                    "current_gcs_key": gcs_key,
                    "versioned": True,
                    "versions": versions,
                }
        
        if existing_config:
            # Update existing configuration
            update_doc = {
                "row_update_userid": current_user.email,
                "row_update_stp": now,
                "type": determined_type,
            }
            
            # Update type-specific fields from JSON
            if determined_type == DbConfigurationTypes.PROCESS_TYPE.value:
                update_doc["queries"] = json_data.get("queries", {})
                update_doc["logics"] = json_data.get("logics", {})
                update_doc["operations"] = json_data.get("operations", {})
            elif determined_type == DbConfigurationTypes.LOOKUP_DATA_TYPE.value:
                update_doc["lookups"] = json_data.get("lookups", json_data)
            elif determined_type == DbConfigurationTypes.SNAP_SHOT_TYPE.value:
                update_doc["data"] = json_data.get("data", json_data)
            
            # Add GCS info if available
            if gcs_info:
                update_doc["gcs"] = gcs_info
            
            await db[COLLECTIONS["configurations"]].update_one(
                {"_id": existing_config["_id"]},
                {"$set": update_doc}
            )
            
            config_id = existing_config.get("config_id", str(existing_config["_id"]))
            
            return FileUploadResponse(
                message=f"Configuration updated from JSON file{' (version ' + str(version) + ' saved to GCS)' if gcs_info else ''}",
                config_id=config_id,
                key=key,
                gcs_key=gcs_key,
                version=version,
                file_name=file.filename
            )
        else:
            # Create new configuration from JSON
            config_id = generate_config_id()
            config_doc = {
                "config_id": config_id,
                "type": determined_type,
                "key": key,
                "row_add_userid": current_user.email,
                "row_add_stp": now,
                "row_update_userid": current_user.email,
                "row_update_stp": now,
            }
            
            if determined_type == DbConfigurationTypes.PROCESS_TYPE.value:
                config_doc["queries"] = json_data.get("queries", {})
                config_doc["logics"] = json_data.get("logics", {})
                config_doc["operations"] = json_data.get("operations", {})
            elif determined_type == DbConfigurationTypes.LOOKUP_DATA_TYPE.value:
                config_doc["lookups"] = json_data.get("lookups", json_data)
            elif determined_type == DbConfigurationTypes.SNAP_SHOT_TYPE.value:
                config_doc["data"] = json_data.get("data", json_data)
            
            # Add GCS info if available
            if gcs_info:
                config_doc["gcs"] = gcs_info
            
            await db[COLLECTIONS["configurations"]].insert_one(config_doc)
            
            return FileUploadResponse(
                message=f"Configuration created from JSON file{' (version ' + str(version) + ' saved to GCS)' if gcs_info else ''}",
                config_id=config_id,
                key=key,
                gcs_key=gcs_key,
                version=version,
                file_name=file.filename
            )
    
    else:
        # XLSX, CSV files - store in GCS
        if not gcs_service.is_configured():
            raise HTTPException(
                status_code=400,
                detail="GCS is not configured. Cannot upload binary files."
            )
        
        # Generate GCS path
        version = 1
        gcs_folder = f"configurations/{key}"
        
        if existing_config:
            # Get current version and increment
            gcs_info = existing_config.get("gcs", {})
            current_version = gcs_info.get("current_version", 0) if gcs_info else 0
            version = current_version + 1
        
        gcs_key = f"{gcs_folder}/v{version}_{file.filename}"
        
        # Upload to GCS
        gcs_url = await gcs_service.upload_file(
            file_content=file_content,
            destination_path=gcs_key,
            content_type=file.content_type or "application/octet-stream"
        )
        
        if not gcs_url:
            raise HTTPException(status_code=500, detail="Failed to upload file to GCS")
        
        # Create file info for this version
        file_info = {
            "bucket": settings.GCS_BUCKET_NAME,
            "file_name": file.filename,
            "gcs_key": gcs_key,
            "version": version,
            "content_type": file.content_type or "application/octet-stream",
            "size": file_size,
            "upload_date": now,
        }
        
        if existing_config:
            # Update existing configuration with new version
            gcs_info = existing_config.get("gcs", {})
            versions = gcs_info.get("versions", []) if gcs_info else []
            versions.append(file_info)
            
            update_doc = {
                "type": DbConfigurationTypes.GCS_DATA_TYPE.value,
                "row_update_userid": current_user.email,
                "row_update_stp": now,
                "gcs": {
                    "bucket": settings.GCS_BUCKET_NAME,
                    "file_name": file.filename,
                    "gcs_key": gcs_key,
                    "version": version,
                    "content_type": file.content_type or "application/octet-stream",
                    "size": file_size,
                    "upload_date": now,
                    "current_version": version,
                    "current_gcs_key": gcs_key,
                    "versioned": True,
                    "versions": versions,
                }
            }
            
            await db[COLLECTIONS["configurations"]].update_one(
                {"_id": existing_config["_id"]},
                {"$set": update_doc}
            )
            
            config_id = existing_config.get("config_id", str(existing_config["_id"]))
        else:
            # Create new GCS configuration
            config_id = generate_config_id()
            config_doc = {
                "config_id": config_id,
                "type": DbConfigurationTypes.GCS_DATA_TYPE.value,
                "key": key,
                "row_add_userid": current_user.email,
                "row_add_stp": now,
                "row_update_userid": current_user.email,
                "row_update_stp": now,
                "gcs": {
                    "bucket": settings.GCS_BUCKET_NAME,
                    "file_name": file.filename,
                    "gcs_key": gcs_key,
                    "version": version,
                    "content_type": file.content_type or "application/octet-stream",
                    "size": file_size,
                    "upload_date": now,
                    "current_version": version,
                    "current_gcs_key": gcs_key,
                    "versioned": True,
                    "versions": [file_info],
                }
            }
            
            await db[COLLECTIONS["configurations"]].insert_one(config_doc)
        
        return FileUploadResponse(
            message=f"File uploaded successfully (version {version})",
            config_id=config_id,
            key=key,
            gcs_key=gcs_key,
            version=version,
            file_name=file.filename
        )


@router.get("/{config_id}/download")
async def download_configuration_file(
    config_id: str,
    version: Optional[int] = None,
    current_user: UserInDB = Depends(get_current_super_admin)
):
    """Download configuration file from GCS."""
    db = get_database()
    
    config = await db[COLLECTIONS["configurations"]].find_one({"config_id": config_id})
    if not config:
        try:
            config = await db[COLLECTIONS["configurations"]].find_one({"_id": ObjectId(config_id)})
        except:
            pass
    
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    if config.get("type") != DbConfigurationTypes.GCS_DATA_TYPE.value:
        # Return JSON data for non-GCS types
        config_data = {}
        if config.get("type") == DbConfigurationTypes.PROCESS_TYPE.value:
            config_data = {
                "queries": config.get("queries", {}),
                "logics": config.get("logics", {}),
                "operations": config.get("operations", {}),
            }
        elif config.get("type") == DbConfigurationTypes.LOOKUP_DATA_TYPE.value:
            config_data = {"lookups": config.get("lookups", {})}
        elif config.get("type") == DbConfigurationTypes.SNAP_SHOT_TYPE.value:
            config_data = {"data": config.get("data", {})}
        
        return config_data
    
    # GCS type - download file
    gcs_info = config.get("gcs")
    if not gcs_info:
        raise HTTPException(status_code=404, detail="No file associated with this configuration")
    
    # Get specific version or current
    if version:
        versions = gcs_info.get("versions", [])
        version_info = next((v for v in versions if v.get("version") == version), None)
        if not version_info:
            raise HTTPException(status_code=404, detail=f"Version {version} not found")
        gcs_key = version_info.get("gcs_key")
    else:
        gcs_key = gcs_info.get("current_gcs_key") or gcs_info.get("gcs_key")
    
    if not gcs_key:
        raise HTTPException(status_code=404, detail="File not found in GCS")
    
    # Download from GCS
    file_content = await gcs_service.download_file(gcs_key)
    if not file_content:
        raise HTTPException(status_code=404, detail="Failed to download file from GCS")
    
    from fastapi.responses import Response
    
    return Response(
        content=file_content,
        media_type=gcs_info.get("content_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f'attachment; filename="{gcs_info.get("file_name", "download")}"'
        }
    )


@router.get("/{config_id}/versions")
async def get_configuration_versions(
    config_id: str,
    current_user: UserInDB = Depends(get_current_super_admin)
):
    """Get all versions of a GCS configuration file."""
    db = get_database()
    
    config = await db[COLLECTIONS["configurations"]].find_one({"config_id": config_id})
    if not config:
        try:
            config = await db[COLLECTIONS["configurations"]].find_one({"_id": ObjectId(config_id)})
        except:
            pass
    
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    if config.get("type") != DbConfigurationTypes.GCS_DATA_TYPE.value:
        return {"versions": [], "message": "This configuration type does not support versioning"}
    
    gcs_info = config.get("gcs", {})
    versions = gcs_info.get("versions", []) if gcs_info else []
    
    return {
        "config_id": config.get("config_id"),
        "key": config.get("key"),
        "current_version": gcs_info.get("current_version") if gcs_info else None,
        "versions": versions
    }
