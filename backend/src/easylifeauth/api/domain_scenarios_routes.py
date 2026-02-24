"""
Domain Scenario management API routes - Full CRUD from admin-panel-scratch-3.
"""
import re
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import math

from easylifeauth.api.models import (
    DomainScenarioCreate, DomainScenarioUpdate, DomainScenarioInDB,
    SubDomain, PaginationMeta
)
from easylifeauth.db.db_manager import DatabaseManager
from easylifeauth.api.dependencies import get_db, get_user_service
from easylifeauth.security.access_control import CurrentUser, require_super_admin, get_current_user
from easylifeauth.services.user_service import UserService

router = APIRouter(prefix="/domain-scenarios", tags=["Domain Scenarios"])


async def get_user_accessible_domains(
    current_user: CurrentUser,
    db: DatabaseManager,
    user_service: UserService
) -> List[str]:
    """Get list of domain keys the user can access."""
    # Super admin has access to all
    if "super-administrator" in current_user.roles:
        return ["all"]

    # Get user from database to resolve domains
    user = await db.users.find_one({"email": current_user.email})
    if not user:
        return []

    resolved_domains = await user_service.resolve_user_domains(user)
    return resolved_domains


def check_domain_access(user_domains: List[str], domain_key: str) -> bool:
    """Check if user has access to a specific domain."""
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
async def list_scenarios(
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    status_filter: Optional[str] = Query(None, alias="status"),
    domain_key: Optional[str] = None,
    search: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """
    List domain scenarios with pagination and filtering.
    Results are filtered based on user's accessible domains.

    - **page**: Page number (0-indexed)
    - **limit**: Maximum number of records to return
    - **status**: Filter by status (active/inactive)
    - **domain_key**: Filter by parent domain
    - **search**: Search by name or key
    """
    # Get user's accessible domains
    user_domains = await get_user_accessible_domains(current_user, db, user_service)

    if not user_domains:
        return {"data": [], "pagination": create_pagination_meta(0, page, limit)}

    query = {}

    # Filter by user's accessible domains (unless super admin)
    if "all" not in user_domains:
        query["domainKey"] = {"$in": user_domains}

    if status_filter:
        query["status"] = status_filter
    elif "super-administrator" not in current_user.roles:
        # Non-admins only see active scenarios
        query["status"] = "active"

    if domain_key:
        # Verify user has access to this domain
        if not check_domain_access(user_domains, domain_key):
            return {"data": [], "pagination": create_pagination_meta(0, page, limit)}
        query["domainKey"] = domain_key

    if search:
        safe_search = re.escape(search)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"key": {"$regex": safe_search, "$options": "i"}}
        ]

    # Get total count
    total = await db.domain_scenarios.count_documents(query)

    # Get paginated data
    skip = page * limit
    cursor = db.domain_scenarios.find(query).skip(skip).limit(limit).sort("order", 1)
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
    status_filter: Optional[str] = Query(None, alias="status"),
    domain_key: Optional[str] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Get total count of domain scenarios within user's accessible domains."""
    user_domains = await get_user_accessible_domains(current_user, db, user_service)

    if not user_domains:
        return {"count": 0}

    query = {}

    # Filter by user's accessible domains
    if "all" not in user_domains:
        query["domainKey"] = {"$in": user_domains}

    if status_filter:
        query["status"] = status_filter
    elif "super-administrator" not in current_user.roles:
        query["status"] = "active"

    if domain_key:
        if not check_domain_access(user_domains, domain_key):
            return {"count": 0}
        query["domainKey"] = domain_key

    count = await db.domain_scenarios.count_documents(query)
    return {"count": count}


@router.get("/{scenario_id}", response_model=DomainScenarioInDB)
async def get_scenario(
    scenario_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Get a specific domain scenario by ID or key (if user has domain access)."""
    try:
        scenario = await db.domain_scenarios.find_one({"_id": ObjectId(scenario_id)})
    except:
        scenario = await db.domain_scenarios.find_one({"key": scenario_id})

    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain scenario not found"
        )

    # Check domain access
    user_domains = await get_user_accessible_domains(current_user, db, user_service)
    if not check_domain_access(user_domains, scenario.get("domainKey", "")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this scenario's domain"
        )

    scenario["_id"] = str(scenario["_id"])
    return DomainScenarioInDB(**scenario)


@router.post("", response_model=DomainScenarioInDB, status_code=status.HTTP_201_CREATED)
async def create_scenario(
    scenario_data: DomainScenarioCreate,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Create a new domain scenario."""
    # Check if key already exists
    existing = await db.domain_scenarios.find_one({"key": scenario_data.key})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scenario key already exists"
        )

    # Verify parent domain exists
    domain = await db.domains.find_one({"key": scenario_data.domainKey})
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Parent domain not found"
        )

    scenario_dict = scenario_data.model_dump()
    scenario_dict["subDomains"] = [sd.model_dump() for sd in scenario_data.subDomains]
    scenario_dict["created_at"] = datetime.utcnow()
    scenario_dict["updated_at"] = datetime.utcnow()

    result = await db.domain_scenarios.insert_one(scenario_dict)
    scenario_dict["_id"] = str(result.inserted_id)

    return DomainScenarioInDB(**scenario_dict)


@router.put("/{scenario_id}", response_model=DomainScenarioInDB)
async def update_scenario(
    scenario_id: str,
    scenario_data: DomainScenarioUpdate,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Update a domain scenario."""
    try:
        existing = await db.domain_scenarios.find_one({"_id": ObjectId(scenario_id)})
    except:
        existing = await db.domain_scenarios.find_one({"key": scenario_id})

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain scenario not found"
        )

    update_data = scenario_data.model_dump(exclude_unset=True)

    # Verify parent domain if being changed
    if "domainKey" in update_data:
        domain = await db.domains.find_one({"key": update_data["domainKey"]})
        if not domain:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Parent domain not found"
            )

    if "subDomains" in update_data:
        update_data["subDomains"] = [
            sd.model_dump() if hasattr(sd, 'model_dump') else sd
            for sd in update_data["subDomains"]
        ]
    update_data["updated_at"] = datetime.utcnow()

    await db.domain_scenarios.update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )

    updated = await db.domain_scenarios.find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return DomainScenarioInDB(**updated)


@router.delete("/{scenario_id}")
async def delete_scenario(
    scenario_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Delete a domain scenario."""
    try:
        scenario = await db.domain_scenarios.find_one({"_id": ObjectId(scenario_id)})
    except:
        scenario = await db.domain_scenarios.find_one({"key": scenario_id})

    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain scenario not found"
        )

    scenario_key = scenario["key"]

    await db.domain_scenarios.delete_one({"_id": scenario["_id"]})

    # Delete associated playboards
    await db.playboards.delete_many({"scenarioKey": scenario_key})

    return {"message": "Domain scenario deleted successfully"}


@router.post("/{scenario_id}/toggle-status")
async def toggle_scenario_status(
    scenario_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Enable or disable a domain scenario."""
    try:
        scenario = await db.domain_scenarios.find_one({"_id": ObjectId(scenario_id)})
    except:
        scenario = await db.domain_scenarios.find_one({"key": scenario_id})

    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain scenario not found"
        )

    new_status = "inactive" if scenario.get("status") == "active" else "active"
    await db.domain_scenarios.update_one(
        {"_id": scenario["_id"]},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )

    return {"message": f"Scenario status changed to {new_status}", "status": new_status}


@router.post("/{scenario_id}/subdomains", response_model=DomainScenarioInDB)
async def add_subdomain(
    scenario_id: str,
    subdomain_data: SubDomain,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Add a subdomain to a scenario."""
    try:
        scenario = await db.domain_scenarios.find_one({"_id": ObjectId(scenario_id)})
    except:
        scenario = await db.domain_scenarios.find_one({"key": scenario_id})

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

    await db.domain_scenarios.update_one(
        {"_id": scenario["_id"]},
        {
            "$push": {"subDomains": subdomain_data.model_dump()},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    updated = await db.domain_scenarios.find_one({"_id": scenario["_id"]})
    updated["_id"] = str(updated["_id"])
    return DomainScenarioInDB(**updated)


@router.delete("/{scenario_id}/subdomains/{subdomain_key}")
async def remove_subdomain(
    scenario_id: str,
    subdomain_key: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Remove a subdomain from a scenario."""
    try:
        scenario = await db.domain_scenarios.find_one({"_id": ObjectId(scenario_id)})
    except:
        scenario = await db.domain_scenarios.find_one({"key": scenario_id})

    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain scenario not found"
        )

    await db.domain_scenarios.update_one(
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
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Get all playboards for a specific scenario (if user has domain access)."""
    try:
        scenario = await db.domain_scenarios.find_one({"_id": ObjectId(scenario_id)})
    except:
        scenario = await db.domain_scenarios.find_one({"key": scenario_id})

    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain scenario not found"
        )

    # Check domain access
    user_domains = await get_user_accessible_domains(current_user, db, user_service)
    if not check_domain_access(user_domains, scenario.get("domainKey", "")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this scenario's domain"
        )

    # Non-admins only see active playboards
    query = {"scenarioKey": scenario["key"]}
    if "super-administrator" not in current_user.roles:
        query["status"] = "active"

    cursor = db.playboards.find(query)

    playboards = []
    async for pb in cursor:
        pb["_id"] = str(pb["_id"])
        playboards.append(pb)

    return playboards
