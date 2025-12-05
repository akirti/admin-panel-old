"""
Playboard management API routes - JSON file upload to MongoDB.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import json
import math
from app.models import PlayboardCreate, PlayboardUpdate, PlayboardInDB, UserInDB, PaginationMeta
from app.auth import get_super_admin_user
from app.database import get_database, COLLECTIONS

router = APIRouter(prefix="/playboards", tags=["Playboards"])


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
    status: Optional[str] = None,
    scenario_key: Optional[str] = None,
    search: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """
    List all playboards with pagination and filtering.
    
    - **page**: Page number (0-indexed)
    - **limit**: Maximum number of records to return
    - **status**: Filter by status (active/inactive)
    - **scenario_key**: Filter by parent scenario
    - **search**: Search by name
    """
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    if scenario_key:
        query["scenarioKey"] = scenario_key
    if search:
        query["name"] = {"$regex": search, "$options": "i"}
    
    # Get total count
    total = await db[COLLECTIONS["playboards"]].count_documents(query)
    
    # Get paginated data
    skip = page * limit
    cursor = db[COLLECTIONS["playboards"]].find(query).skip(skip).limit(limit).sort("created_at", -1)
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
    status: Optional[str] = None,
    scenario_key: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get total count of playboards."""
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    if scenario_key:
        query["scenarioKey"] = scenario_key
    count = await db[COLLECTIONS["playboards"]].count_documents(query)
    return {"count": count}


@router.get("/{playboard_id}", response_model=PlayboardInDB)
async def get_playboard(
    playboard_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get a specific playboard by ID."""
    db = get_database()
    
    try:
        playboard = await db[COLLECTIONS["playboards"]].find_one({"_id": ObjectId(playboard_id)})
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
    
    playboard["_id"] = str(playboard["_id"])
    return PlayboardInDB(**playboard)


@router.post("", response_model=PlayboardInDB, status_code=status.HTTP_201_CREATED)
async def create_playboard(
    playboard_data: PlayboardCreate,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Create a new playboard with JSON data."""
    db = get_database()
    
    # Verify parent scenario exists
    scenario = await db[COLLECTIONS["domain_scenarios"]].find_one({"key": playboard_data.scenarioKey})
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent scenario not found"
        )
    
    playboard_dict = playboard_data.model_dump()
    playboard_dict["created_at"] = datetime.utcnow()
    playboard_dict["updated_at"] = datetime.utcnow()
    
    result = await db[COLLECTIONS["playboards"]].insert_one(playboard_dict)
    playboard_dict["_id"] = str(result.inserted_id)
    
    return PlayboardInDB(**playboard_dict)


@router.post("/upload", response_model=PlayboardInDB, status_code=status.HTTP_201_CREATED)
async def upload_playboard_json(
    file: UploadFile = File(...),
    name: str = Query(..., description="Playboard name"),
    scenario_key: str = Query(..., description="Parent scenario key"),
    description: Optional[str] = Query(None, description="Playboard description"),
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """
    Upload a JSON file as a playboard document.
    
    - **file**: JSON file to upload
    - **name**: Name for the playboard
    - **scenario_key**: Key of the parent scenario
    - **description**: Optional description
    """
    db = get_database()
    
    # Verify parent scenario exists
    scenario = await db[COLLECTIONS["domain_scenarios"]].find_one({"key": scenario_key})
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent scenario not found"
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
    
    # Create playboard document
    playboard_dict = {
        "name": name,
        "description": description,
        "scenarioKey": scenario_key,
        "data": json_data,
        "status": "active",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    
    result = await db[COLLECTIONS["playboards"]].insert_one(playboard_dict)
    playboard_dict["_id"] = str(result.inserted_id)
    
    return PlayboardInDB(**playboard_dict)


@router.put("/{playboard_id}", response_model=PlayboardInDB)
async def update_playboard(
    playboard_id: str,
    playboard_data: PlayboardUpdate,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Update a playboard."""
    db = get_database()
    
    try:
        existing = await db[COLLECTIONS["playboards"]].find_one({"_id": ObjectId(playboard_id)})
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
        scenario = await db[COLLECTIONS["domain_scenarios"]].find_one({"key": update_data["scenarioKey"]})
        if not scenario:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent scenario not found"
            )
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db[COLLECTIONS["playboards"]].update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )
    
    updated = await db[COLLECTIONS["playboards"]].find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return PlayboardInDB(**updated)


@router.put("/{playboard_id}/upload", response_model=PlayboardInDB)
async def update_playboard_json(
    playboard_id: str,
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """
    Update a playboard's JSON data by uploading a new file.
    
    - **file**: JSON file to upload
    """
    db = get_database()
    
    try:
        existing = await db[COLLECTIONS["playboards"]].find_one({"_id": ObjectId(playboard_id)})
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
    
    await db[COLLECTIONS["playboards"]].update_one(
        {"_id": existing["_id"]},
        {"$set": {"data": json_data, "updated_at": datetime.utcnow()}}
    )
    
    updated = await db[COLLECTIONS["playboards"]].find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return PlayboardInDB(**updated)


@router.delete("/{playboard_id}")
async def delete_playboard(
    playboard_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Delete a playboard."""
    db = get_database()
    
    try:
        result = await db[COLLECTIONS["playboards"]].delete_one({"_id": ObjectId(playboard_id)})
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
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Enable or disable a playboard."""
    db = get_database()
    
    try:
        playboard = await db[COLLECTIONS["playboards"]].find_one({"_id": ObjectId(playboard_id)})
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
    await db[COLLECTIONS["playboards"]].update_one(
        {"_id": playboard["_id"]},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"Playboard status changed to {new_status}", "status": new_status}


@router.get("/{playboard_id}/download")
async def download_playboard_json(
    playboard_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Download playboard data as JSON."""
    db = get_database()
    
    try:
        playboard = await db[COLLECTIONS["playboards"]].find_one({"_id": ObjectId(playboard_id)})
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
    
    return playboard.get("data", {})
