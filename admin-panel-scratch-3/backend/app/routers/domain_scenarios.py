"""
Domain Scenario management API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import math
from app.models import (
    DomainScenarioCreate, DomainScenarioUpdate, DomainScenarioInDB, 
    SubDomain, UserInDB, PaginationMeta
)
from app.auth import get_super_admin_user
from app.database import get_database, COLLECTIONS

router = APIRouter(prefix="/domain-scenarios", tags=["Domain Scenarios"])


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
async def list_scenarios(
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    status: Optional[str] = None,
    domain_key: Optional[str] = None,
    search: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """
    List all domain scenarios with pagination and filtering.
    
    - **page**: Page number (0-indexed)
    - **limit**: Maximum number of records to return
    - **status**: Filter by status (active/inactive)
    - **domain_key**: Filter by parent domain
    - **search**: Search by name or key
    """
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    if domain_key:
        query["domainKey"] = domain_key
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"key": {"$regex": search, "$options": "i"}}
        ]
    
    # Get total count
    total = await db[COLLECTIONS["domain_scenarios"]].count_documents(query)
    
    # Get paginated data
    skip = page * limit
    cursor = db[COLLECTIONS["domain_scenarios"]].find(query).skip(skip).limit(limit).sort("order", 1)
    scenarios = []
    async for scenario in cursor:
        scenario["_id"] = str(scenario["_id"])
        scenarios.append(DomainScenarioInDB(**scenario))
    
    return {
        "data": scenarios,
        "pagination": create_pagination_meta(total, page, limit)
    }


@router.get("/count")
async def count_scenarios(
    status: Optional[str] = None,
    domain_key: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get total count of domain scenarios."""
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    if domain_key:
        query["domainKey"] = domain_key
    count = await db[COLLECTIONS["domain_scenarios"]].count_documents(query)
    return {"count": count}


@router.get("/{scenario_id}", response_model=DomainScenarioInDB)
async def get_scenario(
    scenario_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get a specific domain scenario by ID or key."""
    db = get_database()
    
    try:
        scenario = await db[COLLECTIONS["domain_scenarios"]].find_one({"_id": ObjectId(scenario_id)})
    except:
        scenario = await db[COLLECTIONS["domain_scenarios"]].find_one({"key": scenario_id})
    
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain scenario not found"
        )
    
    scenario["_id"] = str(scenario["_id"])
    return DomainScenarioInDB(**scenario)


@router.post("", response_model=DomainScenarioInDB, status_code=status.HTTP_201_CREATED)
async def create_scenario(
    scenario_data: DomainScenarioCreate,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Create a new domain scenario."""
    db = get_database()
    
    # Check if key already exists
    existing = await db[COLLECTIONS["domain_scenarios"]].find_one({"key": scenario_data.key})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scenario key already exists"
        )
    
    # Verify parent domain exists
    domain = await db[COLLECTIONS["domains"]].find_one({"key": scenario_data.domainKey})
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent domain not found"
        )
    
    scenario_dict = scenario_data.model_dump()
    scenario_dict["subDomains"] = [sd.model_dump() for sd in scenario_data.subDomains]
    scenario_dict["created_at"] = datetime.utcnow()
    scenario_dict["updated_at"] = datetime.utcnow()
    
    result = await db[COLLECTIONS["domain_scenarios"]].insert_one(scenario_dict)
    scenario_dict["_id"] = str(result.inserted_id)
    
    return DomainScenarioInDB(**scenario_dict)


@router.put("/{scenario_id}", response_model=DomainScenarioInDB)
async def update_scenario(
    scenario_id: str,
    scenario_data: DomainScenarioUpdate,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Update a domain scenario."""
    db = get_database()
    
    try:
        existing = await db[COLLECTIONS["domain_scenarios"]].find_one({"_id": ObjectId(scenario_id)})
    except:
        existing = await db[COLLECTIONS["domain_scenarios"]].find_one({"key": scenario_id})
    
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain scenario not found"
        )
    
    update_data = scenario_data.model_dump(exclude_unset=True)
    
    # Verify parent domain if being changed
    if "domainKey" in update_data:
        domain = await db[COLLECTIONS["domains"]].find_one({"key": update_data["domainKey"]})
        if not domain:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent domain not found"
            )
    
    if "subDomains" in update_data:
        update_data["subDomains"] = [sd.model_dump() if hasattr(sd, 'model_dump') else sd for sd in update_data["subDomains"]]
    update_data["updated_at"] = datetime.utcnow()
    
    await db[COLLECTIONS["domain_scenarios"]].update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )
    
    updated = await db[COLLECTIONS["domain_scenarios"]].find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return DomainScenarioInDB(**updated)


@router.delete("/{scenario_id}")
async def delete_scenario(
    scenario_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Delete a domain scenario."""
    db = get_database()
    
    try:
        scenario = await db[COLLECTIONS["domain_scenarios"]].find_one({"_id": ObjectId(scenario_id)})
    except:
        scenario = await db[COLLECTIONS["domain_scenarios"]].find_one({"key": scenario_id})
    
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain scenario not found"
        )
    
    scenario_key = scenario["key"]
    
    await db[COLLECTIONS["domain_scenarios"]].delete_one({"_id": scenario["_id"]})
    
    # Delete associated playboards
    await db[COLLECTIONS["playboards"]].delete_many({"scenarioKey": scenario_key})
    
    return {"message": "Domain scenario deleted successfully"}


@router.post("/{scenario_id}/toggle-status")
async def toggle_scenario_status(
    scenario_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Enable or disable a domain scenario."""
    db = get_database()
    
    try:
        scenario = await db[COLLECTIONS["domain_scenarios"]].find_one({"_id": ObjectId(scenario_id)})
    except:
        scenario = await db[COLLECTIONS["domain_scenarios"]].find_one({"key": scenario_id})
    
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain scenario not found"
        )
    
    new_status = "inactive" if scenario.get("status") == "active" else "active"
    await db[COLLECTIONS["domain_scenarios"]].update_one(
        {"_id": scenario["_id"]},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"Scenario status changed to {new_status}", "status": new_status}


@router.post("/{scenario_id}/subdomains", response_model=DomainScenarioInDB)
async def add_subdomain(
    scenario_id: str,
    subdomain_data: SubDomain,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Add a subdomain to a scenario."""
    db = get_database()
    
    try:
        scenario = await db[COLLECTIONS["domain_scenarios"]].find_one({"_id": ObjectId(scenario_id)})
    except:
        scenario = await db[COLLECTIONS["domain_scenarios"]].find_one({"key": scenario_id})
    
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain scenario not found"
        )
    
    # Check if subdomain key already exists
    for sd in scenario.get("subDomains", []):
        if sd["key"] == subdomain_data.key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Subdomain key already exists"
            )
    
    await db[COLLECTIONS["domain_scenarios"]].update_one(
        {"_id": scenario["_id"]},
        {
            "$push": {"subDomains": subdomain_data.model_dump()},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    updated = await db[COLLECTIONS["domain_scenarios"]].find_one({"_id": scenario["_id"]})
    updated["_id"] = str(updated["_id"])
    return DomainScenarioInDB(**updated)


@router.delete("/{scenario_id}/subdomains/{subdomain_key}")
async def remove_subdomain(
    scenario_id: str,
    subdomain_key: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Remove a subdomain from a scenario."""
    db = get_database()
    
    try:
        scenario = await db[COLLECTIONS["domain_scenarios"]].find_one({"_id": ObjectId(scenario_id)})
    except:
        scenario = await db[COLLECTIONS["domain_scenarios"]].find_one({"key": scenario_id})
    
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain scenario not found"
        )
    
    await db[COLLECTIONS["domain_scenarios"]].update_one(
        {"_id": scenario["_id"]},
        {
            "$pull": {"subDomains": {"key": subdomain_key}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return {"message": "Subdomain removed successfully"}


@router.get("/{scenario_id}/playboards", response_model=List[dict])
async def get_scenario_playboards(
    scenario_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get all playboards for a specific scenario."""
    db = get_database()
    
    try:
        scenario = await db[COLLECTIONS["domain_scenarios"]].find_one({"_id": ObjectId(scenario_id)})
    except:
        scenario = await db[COLLECTIONS["domain_scenarios"]].find_one({"key": scenario_id})
    
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain scenario not found"
        )
    
    cursor = db[COLLECTIONS["playboards"]].find({"scenarioKey": scenario["key"]})
    
    playboards = []
    async for pb in cursor:
        pb["_id"] = str(pb["_id"])
        playboards.append(pb)
    
    return playboards
