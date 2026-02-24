"""
Domain management API routes - Full CRUD from admin-panel-scratch-3.
"""
import re
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import math

from easylifeauth.api.models import (
    DomainCreate, DomainUpdate, DomainInDB, SubDomain, PaginationMeta
)
from easylifeauth.db.db_manager import DatabaseManager
from easylifeauth.api.dependencies import get_db, get_user_service
from easylifeauth.security.access_control import CurrentUser, require_super_admin, require_group_admin, get_current_user
from easylifeauth.services.user_service import UserService
from easylifeauth.db.lookup import DomainTypes

router = APIRouter(prefix="/domains", tags=["Domains"])


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


# IMPORTANT: Static routes (/all, /types) must come BEFORE /{domain_id} route
@router.get("/types")
async def get_domain_types(
    current_user: CurrentUser = Depends(require_group_admin)
):
    """Get available domain types from DomainTypes enum."""
    return [{"value": t.value, "label": t.value.title()} for t in DomainTypes]


@router.get("/all")
async def get_all_domains(
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
) -> List[DomainInDB]:
    """
    Get all domains the user has access to.

    - Super admins see all domains
    - Regular users see only domains assigned to them via roles/groups
    """
    # Check if user is super admin - they see all domains
    is_super_admin = "super-administrator" in current_user.roles

    if is_super_admin:
        # Super admin sees all domains
        cursor = db.domains.find({"status": "active"}).sort("order", 1)
    else:
        # Regular user - get their resolved domains from roles/groups
        user = await db.users.find_one({"email": current_user.email})
        if not user:
            return []

        resolved_domains = await user_service.resolve_user_domains(user)

        if not resolved_domains:
            return []

        # If user has 'all' in their domains, show all active domains
        if "all" in resolved_domains:
            cursor = db.domains.find({"status": "active"}).sort("order", 1)
        else:
            # Filter domains by user's resolved domain keys
            cursor = db.domains.find({
                "key": {"$in": resolved_domains},
                "status": "active"
            }).sort("order", 1)

    domains = []
    async for domain in cursor:
        domain["_id"] = str(domain["_id"])
        domains.append(DomainInDB(**domain))
    return domains


@router.get("/admin/all")
async def get_all_domains_admin(
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
) -> List[DomainInDB]:
    """Get all domains without pagination (admin only, includes inactive)."""
    cursor = db.domains.find({}).sort("order", 1)
    domains = []
    async for domain in cursor:
        domain["_id"] = str(domain["_id"])
        domains.append(DomainInDB(**domain))
    return domains


@router.get("")
async def list_domains(
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=1000, description="Items per page"),
    status_filter: Optional[str] = Query(None, alias="status"),
    search: Optional[str] = None,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """
    List all domains with pagination and filtering.

    - **page**: Page number (0-indexed)
    - **limit**: Maximum number of records to return
    - **status**: Filter by status (active/inactive)
    - **search**: Search by name or key
    """
    query = {}
    if status_filter:
        query["status"] = status_filter
    if search:
        safe_search = re.escape(search)
        query["$or"] = [
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"key": {"$regex": safe_search, "$options": "i"}}
        ]

    # Get total count
    total = await db.domains.count_documents(query)

    # Get paginated data
    skip = page * limit
    cursor = db.domains.find(query).skip(skip).limit(limit).sort("order", 1)
    domains = []
    async for domain in cursor:
        domain["_id"] = str(domain["_id"])
        domains.append(DomainInDB(**domain))

    return {
        "data": domains,
        "pagination": create_pagination_meta(total, page, limit)
    }


@router.get("/count")
async def count_domains(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get total count of domains."""
    query = {}
    if status_filter:
        query["status"] = status_filter
    count = await db.domains.count_documents(query)
    return {"count": count}


@router.get("/{domain_id}", response_model=DomainInDB)
async def get_domain(
    domain_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db),
    user_service: UserService = Depends(get_user_service)
):
    """Get a specific domain by ID or key (if user has access)."""
    try:
        domain = await db.domains.find_one({"_id": ObjectId(domain_id)})
    except:
        domain = await db.domains.find_one({"key": domain_id})

    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )

    # Check domain access
    user_domains = await get_user_accessible_domains(current_user, db, user_service)
    if not check_domain_access(user_domains, domain.get("key", "")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this domain"
        )

    domain["_id"] = str(domain["_id"])
    return DomainInDB(**domain)


@router.post("", response_model=DomainInDB, status_code=status.HTTP_201_CREATED)
async def create_domain(
    domain_data: DomainCreate,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Create a new domain."""
    # Check if key already exists
    existing = await db.domains.find_one({"key": domain_data.key})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Domain key already exists"
        )

    domain_dict = domain_data.model_dump()
    # Ensure subDomains is a list (use provided value or default to empty list)
    if domain_dict.get("subDomains") is None:
        domain_dict["subDomains"] = []
    # Ensure type has a default value if None
    if domain_dict.get("type") is None:
        domain_dict["type"] = "custom"
    # Ensure status has a default value if None
    if domain_dict.get("status") is None:
        domain_dict["status"] = "active"
    # Ensure path has a default value if None
    if domain_dict.get("path") is None:
        domain_dict["path"] = f"/{domain_dict['key']}"
    domain_dict["created_at"] = datetime.utcnow()
    domain_dict["updated_at"] = datetime.utcnow()

    result = await db.domains.insert_one(domain_dict)
    domain_dict["_id"] = str(result.inserted_id)

    return DomainInDB(**domain_dict)


@router.put("/{domain_id}", response_model=DomainInDB)
async def update_domain(
    domain_id: str,
    domain_data: DomainUpdate,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Update a domain."""
    try:
        existing = await db.domains.find_one({"_id": ObjectId(domain_id)})
    except:
        existing = await db.domains.find_one({"key": domain_id})

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )

    update_data = domain_data.model_dump(exclude_unset=True)
    if "subDomains" in update_data:
        update_data["subDomains"] = [
            sd.model_dump() if hasattr(sd, 'model_dump') else sd
            for sd in update_data["subDomains"]
        ]
    update_data["updated_at"] = datetime.utcnow()

    await db.domains.update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )

    updated = await db.domains.find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return DomainInDB(**updated)


@router.delete("/{domain_id}")
async def delete_domain(
    domain_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Delete a domain."""
    try:
        domain = await db.domains.find_one({"_id": ObjectId(domain_id)})
    except:
        domain = await db.domains.find_one({"key": domain_id})

    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )

    domain_key = domain["key"]

    await db.domains.delete_one({"_id": domain["_id"]})

    # Remove domain from all roles
    await db.roles.update_many(
        {"domains": domain_key},
        {"$pull": {"domains": domain_key}}
    )

    # Remove domain from all groups
    await db.groups.update_many(
        {"domains": domain_key},
        {"$pull": {"domains": domain_key}}
    )

    # Remove domain from all users
    await db.users.update_many(
        {"domains": domain_key},
        {"$pull": {"domains": domain_key}}
    )

    # Delete associated scenarios
    await db.domain_scenarios.delete_many({"domainKey": domain_key})

    return {"message": "Domain deleted successfully"}


@router.post("/{domain_id}/toggle-status")
async def toggle_domain_status(
    domain_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Enable or disable a domain."""
    try:
        domain = await db.domains.find_one({"_id": ObjectId(domain_id)})
    except:
        domain = await db.domains.find_one({"key": domain_id})

    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )

    new_status = "inactive" if domain.get("status") == "active" else "active"
    await db.domains.update_one(
        {"_id": domain["_id"]},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )

    return {"message": f"Domain status changed to {new_status}", "status": new_status}


@router.post("/{domain_id}/subdomains", response_model=DomainInDB)
async def add_subdomain(
    domain_id: str,
    subdomain_data: SubDomain,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Add a subdomain to a domain."""
    try:
        domain = await db.domains.find_one({"_id": ObjectId(domain_id)})
    except:
        domain = await db.domains.find_one({"key": domain_id})

    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )

    # Check if subdomain key already exists
    for sd in domain.get("subDomains", []):
        if sd["key"] == subdomain_data.key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Subdomain key already exists"
            )

    await db.domains.update_one(
        {"_id": domain["_id"]},
        {
            "$push": {"subDomains": subdomain_data.model_dump()},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    updated = await db.domains.find_one({"_id": domain["_id"]})
    updated["_id"] = str(updated["_id"])
    return DomainInDB(**updated)


@router.delete("/{domain_id}/subdomains/{subdomain_key}")
async def remove_subdomain(
    domain_id: str,
    subdomain_key: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Remove a subdomain from a domain."""
    try:
        domain = await db.domains.find_one({"_id": ObjectId(domain_id)})
    except:
        domain = await db.domains.find_one({"key": domain_id})

    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )

    await db.domains.update_one(
        {"_id": domain["_id"]},
        {
            "$pull": {"subDomains": {"key": subdomain_key}},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )

    return {"message": "Subdomain removed successfully"}


@router.get("/{domain_id}/scenarios", response_model=List[dict])
async def get_domain_scenarios(
    domain_id: str,
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get all scenarios for a specific domain."""
    try:
        domain = await db.domains.find_one({"_id": ObjectId(domain_id)})
    except:
        domain = await db.domains.find_one({"key": domain_id})

    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )

    cursor = db.domain_scenarios.find({"domainKey": domain["key"]})

    scenarios = []
    async for scenario in cursor:
        scenario["_id"] = str(scenario["_id"])
        scenarios.append(scenario)

    return scenarios
