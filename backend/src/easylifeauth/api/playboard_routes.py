"""
Playboard management API routes - Full CRUD with JSON file upload from admin-panel-scratch-3.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import json
import math

from easylifeauth.api.models import (
    PlayboardCreate, PlayboardUpdate, PlayboardInDB, PaginationMeta
)
from easylifeauth.db.db_manager import DatabaseManager
from easylifeauth.api.dependencies import get_db, get_user_service
from easylifeauth.security.access_control import CurrentUser, require_super_admin, get_current_user
from easylifeauth.services.user_service import UserService

router = APIRouter(prefix="/playboards", tags=["Playboards"])


async def get_user_accessible_domains(
    current_user: CurrentUser,
    db: DatabaseManager,
    user_service: UserService
) -> List[str]:
    """Get list of domain keys the user can access."""
    if "super-administrator" in current_user.roles:
        return ["all"]

    user = await db.users.find_one({"email": current_user.email})
    if not user:
        return []

    resolved_domains = await user_service.resolve_user_domains(user)
    return resolved_domains


async def get_scenario_domain_key(db: DatabaseManager, scenario_key: str) -> Optional[str]:
    """Get the domain key for a scenario."""
    scenario = await db.domain_scenarios.find_one({"key": scenario_key})
    if scenario:
        return scenario.get("domainKey")
    return None


def check_domain_access(user_domains: List[str], domain_key: str) -> bool:
    """Check if user has access to a specific domain."""
    if not domain_key:
        return False
    if "all" in user_domains:
        return True
    return domain_key in user_domains


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
async def list_playboards(
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    status_filter: Optional[str] = Query(None, alias="status"),
    scenario_key: Optional[str] = None,
    search: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """
    List playboards with pagination and filtering.
    Results are filtered based on user's accessible domains.

    - **page**: Page number (0-indexed)
    - **limit**: Maximum number of records to return
    - **status**: Filter by status (active/inactive)
    - **scenario_key**: Filter by parent scenario
    - **search**: Search by name
    """
    user_domains = await get_user_accessible_domains(current_user, db, user_service)

    if not user_domains:
        return {"data": [], "pagination": create_pagination_meta(0, page, limit)}

    # Get scenarios in user's accessible domains
    scenario_query = {}
    if "all" not in user_domains:
        scenario_query["domainKey"] = {"$in": user_domains}

    # Get list of accessible scenario keys
    accessible_scenario_keys = []
    async for scenario in db.domain_scenarios.find(scenario_query, {"key": 1}):
        accessible_scenario_keys.append(scenario["key"])

    if not accessible_scenario_keys and "all" not in user_domains:
        return {"data": [], "pagination": create_pagination_meta(0, page, limit)}

    query = {}

    # Filter by accessible scenarios (unless super admin)
    if "all" not in user_domains:
        query["scenarioKey"] = {"$in": accessible_scenario_keys}

    if status_filter:
        query["status"] = status_filter
    elif "super-administrator" not in current_user.roles:
        query["status"] = "active"

    if scenario_key:
        # Verify user has access to this scenario's domain
        domain_key = await get_scenario_domain_key(db, scenario_key)
        if not check_domain_access(user_domains, domain_key):
            return {"data": [], "pagination": create_pagination_meta(0, page, limit)}
        query["scenarioKey"] = scenario_key

    if search:
        query["name"] = {"$regex": search, "$options": "i"}

    # Get total count
    total = await db.playboards.count_documents(query)

    # Get paginated data
    skip = page * limit
    cursor = db.playboards.find(query).skip(skip).limit(limit).sort("created_at", -1)
    playboards = []
    async for pb in cursor:
        pb["_id"] = str(pb["_id"])
        playboards.append(PlayboardInDB(**pb))

    return {
        "data": playboards,
        "pagination": create_pagination_meta(total, page, limit)
    }


@router.get("/count")
async def count_playboards(
    status_filter: Optional[str] = Query(None, alias="status"),
    scenario_key: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Get total count of playboards within user's accessible domains."""
    user_domains = await get_user_accessible_domains(current_user, db, user_service)

    if not user_domains:
        return {"count": 0}

    # Get accessible scenario keys
    scenario_query = {}
    if "all" not in user_domains:
        scenario_query["domainKey"] = {"$in": user_domains}

    accessible_scenario_keys = []
    async for scenario in db.domain_scenarios.find(scenario_query, {"key": 1}):
        accessible_scenario_keys.append(scenario["key"])

    if not accessible_scenario_keys and "all" not in user_domains:
        return {"count": 0}

    query = {}

    if "all" not in user_domains:
        query["scenarioKey"] = {"$in": accessible_scenario_keys}

    if status_filter:
        query["status"] = status_filter
    elif "super-administrator" not in current_user.roles:
        query["status"] = "active"

    if scenario_key:
        domain_key = await get_scenario_domain_key(db, scenario_key)
        if not check_domain_access(user_domains, domain_key):
            return {"count": 0}
        query["scenarioKey"] = scenario_key

    count = await db.playboards.count_documents(query)
    return {"count": count}


@router.get("/{playboard_id}", response_model=PlayboardInDB)
async def get_playboard(
    playboard_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """
    Get a specific playboard by ID or scenarioKey (if user has domain access).

    - If playboard_id is a valid ObjectId, search by _id
    - Otherwise, search by scenarioKey
    """
    playboard = None

    # Try to find by ObjectId first
    try:
        obj_id = ObjectId(playboard_id)
        playboard = await db.playboards.find_one({"_id": obj_id})
    except Exception:
        # Not a valid ObjectId, will search by scenarioKey below
        pass

    # If not found by ObjectId, search by scenarioKey
    if not playboard:
        playboard = await db.playboards.find_one({"scenarioKey": playboard_id})

    if not playboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playboard not found"
        )

    # Check domain access via scenario
    user_domains = await get_user_accessible_domains(current_user, db, user_service)
    domain_key = await get_scenario_domain_key(db, playboard.get("scenarioKey", ""))
    if not check_domain_access(user_domains, domain_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this playboard's domain"
        )

    playboard["_id"] = str(playboard["_id"])
    return PlayboardInDB(**playboard)


@router.post("", response_model=PlayboardInDB, status_code=status.HTTP_201_CREATED)
async def create_playboard(
    playboard_data: PlayboardCreate,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """
    Create a new playboard with JSON data.

    Fields can be provided at the top level OR inside the 'data' object.
    Values in 'data' are used as fallback if not provided at top level.
    """
    # Extract data object for fallback values
    data_obj = playboard_data.data or {}

    # Resolve key: top-level > data.key
    final_key = playboard_data.key or data_obj.get("key")
    if not final_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Playboard key is required (provide at top level or in data.key)"
        )

    # Resolve scenarioKey: top-level > data.scenarioKey > data.scenerioKey (typo fallback)
    final_scenario_key = (
        playboard_data.scenarioKey or
        data_obj.get("scenarioKey") or
        data_obj.get("scenerioKey")
    )
    if not final_scenario_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scenario key is required (provide at top level or in data.scenarioKey)"
        )

    # Check for duplicate key
    existing = await db.playboards.find_one({"key": final_key})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Playboard with key '{final_key}' already exists"
        )

    # Verify parent scenario exists
    scenario = await db.domain_scenarios.find_one({"key": final_scenario_key})
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Parent scenario '{final_scenario_key}' not found"
        )

    # Resolve dataDomain: top-level > data.dataDomain > scenario.domainKey
    final_data_domain = (
        playboard_data.dataDomain or
        data_obj.get("dataDomain") or
        scenario.get("domainKey", "")
    )

    # Build playboard document with resolved values
    playboard_dict = {
        "key": final_key,
        "name": playboard_data.name,
        "description": playboard_data.description or data_obj.get("description"),
        "scenarioKey": final_scenario_key,
        "dataDomain": final_data_domain,
        "widgets": playboard_data.widgets or data_obj.get("widgets"),
        "order": playboard_data.order if playboard_data.order != 0 else data_obj.get("order", 0),
        "program_key": playboard_data.program_key or data_obj.get("program_key"),
        "addon_configurations": playboard_data.addon_configurations or data_obj.get("addon_configurations"),
        "scenarioDescription": playboard_data.scenarioDescription or data_obj.get("scenarioDescription"),
        "data": data_obj,  # Store the full data object
        "status": playboard_data.status if playboard_data.status != "active" else data_obj.get("status", "active"),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": current_user.email,
        "updated_by": current_user.email,
    }

    # Remove None values
    playboard_dict = {k: v for k, v in playboard_dict.items() if v is not None}

    result = await db.playboards.insert_one(playboard_dict)
    playboard_dict["_id"] = str(result.inserted_id)

    return PlayboardInDB(**playboard_dict)


@router.post("/upload", response_model=PlayboardInDB, status_code=status.HTTP_201_CREATED)
async def upload_playboard_json(
    file: UploadFile = File(...),
    key: Optional[str] = Query(None, description="Playboard key (auto-detected from JSON if not provided)"),
    name: Optional[str] = Query(None, description="Playboard name (auto-detected from JSON if not provided)"),
    scenario_key: Optional[str] = Query(None, description="Parent scenario key (auto-detected from JSON if not provided)"),
    data_domain: Optional[str] = Query(None, description="Data domain (auto-detected from scenario if not provided)"),
    description: Optional[str] = Query(None, description="Playboard description"),
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """
    Upload a JSON file as a playboard document.
    The JSON structure should match the playboard data format with key, scenarioKey, widgets, etc.

    - **file**: JSON file to upload
    - **key**: Unique key for the playboard (optional, auto-detected from JSON)
    - **name**: Name for the playboard (optional, auto-detected from JSON)
    - **scenario_key**: Key of the parent scenario (optional, auto-detected from JSON scenarioKey field)
    - **data_domain**: Data domain (optional, auto-detected from scenario)
    - **description**: Optional description
    """
    # Validate file type, MIME type, and magic bytes
    from ..utils.file_validation import validate_upload
    content = await file.read()
    validate_upload(file, {".json"}, content=content)

    # Parse JSON
    try:
        json_data = json.loads(content.decode('utf-8'))
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid JSON file: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error reading file: {str(e)}"
        )

    # Extract values from JSON if not provided as query params
    final_key = key or json_data.get("key") or file.filename.replace(".json", "")
    final_name = name or json_data.get("name") or final_key
    final_scenario_key = scenario_key or json_data.get("scenarioKey") or json_data.get("scenerioKey")

    if not final_scenario_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scenario key is required. Provide it as query parameter or include 'scenarioKey' in JSON file."
        )

    # Check for duplicate key
    existing = await db.playboards.find_one({"key": final_key})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Playboard with key '{final_key}' already exists"
        )

    # Verify parent scenario exists and get domain
    scenario = await db.domain_scenarios.find_one({"key": final_scenario_key})
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Parent scenario '{final_scenario_key}' not found"
        )

    final_data_domain = data_domain or json_data.get("dataDomain") or scenario.get("domainKey", "")

    # Create playboard document matching PlayboardInDB structure
    playboard_dict = {
        "key": final_key,
        "name": final_name,
        "description": description or json_data.get("description"),
        "scenarioKey": final_scenario_key,
        "dataDomain": final_data_domain,
        "widgets": json_data.get("widgets"),
        "order": json_data.get("order", 0),
        "program_key": json_data.get("program_key"),
        "addon_configurations": json_data.get("addon_configurations"),
        "scenarioDescription": json_data.get("scenarioDescription"),
        "data": json_data,  # Store the full JSON data
        "status": "active",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "created_by": current_user.email,
        "updated_by": current_user.email,
    }

    # Remove None values
    playboard_dict = {k: v for k, v in playboard_dict.items() if v is not None}

    result = await db.playboards.insert_one(playboard_dict)
    playboard_dict["_id"] = str(result.inserted_id)

    return PlayboardInDB(**playboard_dict)


@router.put("/{playboard_id}", response_model=PlayboardInDB)
async def update_playboard(
    playboard_id: str,
    playboard_data: PlayboardUpdate,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Update a playboard."""
    try:
        existing = await db.playboards.find_one({"_id": ObjectId(playboard_id)})
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid playboard ID"
        )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playboard not found"
        )

    update_data = playboard_data.model_dump(exclude_unset=True)

    # Remove _id from update data if present
    update_data.pop("id", None)
    update_data.pop("_id", None)

    # If key is being changed, check for duplicates
    if "key" in update_data and update_data["key"] != existing.get("key"):
        duplicate = await db.playboards.find_one({"key": update_data["key"]})
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Playboard with key '{update_data['key']}' already exists"
            )

    # Verify parent scenario if being changed
    if "scenarioKey" in update_data:
        scenario = await db.domain_scenarios.find_one({"key": update_data["scenarioKey"]})
        if not scenario:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent scenario not found"
            )

    update_data["updated_at"] = datetime.utcnow()
    update_data["updated_by"] = current_user.email

    await db.playboards.update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )

    updated = await db.playboards.find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return PlayboardInDB(**updated)


@router.put("/{playboard_id}/upload", response_model=PlayboardInDB)
async def update_playboard_json(
    playboard_id: str,
    file: UploadFile = File(...),
    update_metadata: bool = Query(False, description="Also update metadata (widgets, scenarioDescription, etc.) from JSON"),
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """
    Update a playboard's JSON data by uploading a new file.

    - **file**: JSON file to upload
    - **update_metadata**: If true, also update widgets, scenarioDescription, etc. from the JSON file
    """
    try:
        existing = await db.playboards.find_one({"_id": ObjectId(playboard_id)})
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid playboard ID"
        )

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playboard not found"
        )

    # Validate file type, MIME type, and magic bytes
    from ..utils.file_validation import validate_upload
    content = await file.read()
    validate_upload(file, {".json"}, content=content)

    # Parse JSON
    try:
        json_data = json.loads(content.decode('utf-8'))
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid JSON file: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error reading file: {str(e)}"
        )

    update_fields = {
        "data": json_data,
        "updated_at": datetime.utcnow(),
        "updated_by": current_user.email,
    }

    # Optionally update metadata from JSON
    if update_metadata:
        if "widgets" in json_data:
            update_fields["widgets"] = json_data["widgets"]
        if "scenarioDescription" in json_data:
            update_fields["scenarioDescription"] = json_data["scenarioDescription"]
        if "name" in json_data:
            update_fields["name"] = json_data["name"]
        if "description" in json_data:
            update_fields["description"] = json_data["description"]
        if "order" in json_data:
            update_fields["order"] = json_data["order"]
        if "addon_configurations" in json_data:
            update_fields["addon_configurations"] = json_data["addon_configurations"]
        if "program_key" in json_data:
            update_fields["program_key"] = json_data["program_key"]

    await db.playboards.update_one(
        {"_id": existing["_id"]},
        {"$set": update_fields}
    )

    updated = await db.playboards.find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return PlayboardInDB(**updated)


@router.delete("/{playboard_id}")
async def delete_playboard(
    playboard_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Delete a playboard."""
    try:
        result = await db.playboards.delete_one({"_id": ObjectId(playboard_id)})
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid playboard ID"
        )

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playboard not found"
        )

    return {"message": "Playboard deleted successfully"}


@router.post("/{playboard_id}/toggle-status")
async def toggle_playboard_status(
    playboard_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Enable or disable a playboard."""
    try:
        playboard = await db.playboards.find_one({"_id": ObjectId(playboard_id)})
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid playboard ID"
        )

    if not playboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playboard not found"
        )

    new_status = "inactive" if playboard.get("status") == "active" else "active"
    await db.playboards.update_one(
        {"_id": playboard["_id"]},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )

    return {"message": f"Playboard status changed to {new_status}", "status": new_status}


@router.get("/{playboard_id}/download")
async def download_playboard_json(
    playboard_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Download playboard data as JSON (if user has domain access)."""
    try:
        playboard = await db.playboards.find_one({"_id": ObjectId(playboard_id)})
    except:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid playboard ID"
        )

    if not playboard:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playboard not found"
        )

    # Check domain access
    user_domains = await get_user_accessible_domains(current_user, db, user_service)
    domain_key = await get_scenario_domain_key(db, playboard.get("scenarioKey", ""))
    if not check_domain_access(user_domains, domain_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this playboard's domain"
        )

    return playboard.get("data", {})
