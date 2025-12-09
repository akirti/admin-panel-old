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
    """Get a specific playboard by ID (if user has domain access)."""
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
    """Create a new playboard with JSON data."""
    # Verify parent scenario exists
    scenario = await db.domain_scenarios.find_one({"key": playboard_data.scenarioKey})
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent scenario not found"
        )

    playboard_dict = playboard_data.model_dump()
    playboard_dict["created_at"] = datetime.utcnow()
    playboard_dict["updated_at"] = datetime.utcnow()

    result = await db.playboards.insert_one(playboard_dict)
    playboard_dict["_id"] = str(result.inserted_id)

    return PlayboardInDB(**playboard_dict)


@router.post("/upload", response_model=PlayboardInDB, status_code=status.HTTP_201_CREATED)
async def upload_playboard_json(
    file: UploadFile = File(...),
    name: Optional[str] = Query(None, description="Playboard name (auto-detected from JSON if not provided)"),
    scenario_key: Optional[str] = Query(None, description="Parent scenario key (auto-detected from JSON if not provided)"),
    description: Optional[str] = Query(None, description="Playboard description"),
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """
    Upload a JSON file as a playboard document.
    The JSON structure should match the playboard data format with key, scenarioKey, widgets, etc.

    - **file**: JSON file to upload
    - **name**: Name for the playboard (optional, auto-detected from JSON key field)
    - **scenario_key**: Key of the parent scenario (optional, auto-detected from JSON scenarioKey field)
    - **description**: Optional description
    """
    # Validate file type
    if not file.filename.endswith('.json'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JSON files are allowed"
        )

    # Read and parse JSON
    try:
        content = await file.read()
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
    final_name = name or json_data.get("key") or json_data.get("name") or file.filename.replace(".json", "")
    final_scenario_key = scenario_key or json_data.get("scenarioKey") or json_data.get("scenerioKey")

    if not final_scenario_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scenario key is required. Provide it as query parameter or include 'scenarioKey' in JSON file."
        )

    # Verify parent scenario exists
    scenario = await db.domain_scenarios.find_one({"key": final_scenario_key})
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Parent scenario '{final_scenario_key}' not found"
        )

    # Create playboard document with the same structure as form create
    # The JSON file content goes directly into the 'data' field
    playboard_dict = {
        "name": final_name,
        "description": description or json_data.get("description"),
        "scenarioKey": final_scenario_key,
        "data": json_data,
        "status": "active",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

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

    # Verify parent scenario if being changed
    if "scenarioKey" in update_data:
        scenario = await db.domain_scenarios.find_one({"key": update_data["scenarioKey"]})
        if not scenario:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent scenario not found"
            )

    update_data["updated_at"] = datetime.utcnow()

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
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """
    Update a playboard's JSON data by uploading a new file.

    - **file**: JSON file to upload
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

    # Validate file type
    if not file.filename.endswith('.json'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only JSON files are allowed"
        )

    # Read and parse JSON
    try:
        content = await file.read()
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

    await db.playboards.update_one(
        {"_id": existing["_id"]},
        {"$set": {"data": json_data, "updated_at": datetime.utcnow()}}
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
