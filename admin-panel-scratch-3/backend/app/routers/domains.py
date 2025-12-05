"""
Domain management API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import math
from app.models import DomainCreate, DomainUpdate, DomainInDB, SubDomain, UserInDB, PaginationMeta
from app.auth import get_super_admin_user
from app.database import get_database, COLLECTIONS

router = APIRouter(prefix="/domains", tags=["Domains"])


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
async def list_domains(
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """
    List all domains with pagination and filtering.
    
    - **page**: Page number (0-indexed)
    - **limit**: Maximum number of records to return
    - **status**: Filter by status (active/inactive)
    - **search**: Search by name or key
    """
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"key": {"$regex": search, "$options": "i"}}
        ]
    
    # Get total count
    total = await db[COLLECTIONS["domains"]].count_documents(query)
    
    # Get paginated data
    skip = page * limit
    cursor = db[COLLECTIONS["domains"]].find(query).skip(skip).limit(limit).sort("order", 1)
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
    status: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get total count of domains."""
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    count = await db[COLLECTIONS["domains"]].count_documents(query)
    return {"count": count}


@router.get("/{domain_id}", response_model=DomainInDB)
async def get_domain(
    domain_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get a specific domain by ID or key."""
    db = get_database()
    
    try:
        domain = await db[COLLECTIONS["domains"]].find_one({"_id": ObjectId(domain_id)})
    except:
        domain = await db[COLLECTIONS["domains"]].find_one({"key": domain_id})
    
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )
    
    domain["_id"] = str(domain["_id"])
    return DomainInDB(**domain)


@router.post("", response_model=DomainInDB, status_code=status.HTTP_201_CREATED)
async def create_domain(
    domain_data: DomainCreate,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Create a new domain."""
    db = get_database()
    
    # Check if key already exists
    existing = await db[COLLECTIONS["domains"]].find_one({"key": domain_data.key})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Domain key already exists"
        )
    
    domain_dict = domain_data.model_dump()
    domain_dict["subDomains"] = [sd.model_dump() for sd in domain_data.subDomains]
    domain_dict["created_at"] = datetime.utcnow()
    domain_dict["updated_at"] = datetime.utcnow()
    
    result = await db[COLLECTIONS["domains"]].insert_one(domain_dict)
    domain_dict["_id"] = str(result.inserted_id)
    
    return DomainInDB(**domain_dict)


@router.put("/{domain_id}", response_model=DomainInDB)
async def update_domain(
    domain_id: str,
    domain_data: DomainUpdate,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Update a domain."""
    db = get_database()
    
    try:
        existing = await db[COLLECTIONS["domains"]].find_one({"_id": ObjectId(domain_id)})
    except:
        existing = await db[COLLECTIONS["domains"]].find_one({"key": domain_id})
    
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )
    
    update_data = domain_data.model_dump(exclude_unset=True)
    if "subDomains" in update_data:
        update_data["subDomains"] = [sd.model_dump() if hasattr(sd, 'model_dump') else sd for sd in update_data["subDomains"]]
    update_data["updated_at"] = datetime.utcnow()
    
    await db[COLLECTIONS["domains"]].update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )
    
    updated = await db[COLLECTIONS["domains"]].find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return DomainInDB(**updated)


@router.delete("/{domain_id}")
async def delete_domain(
    domain_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Delete a domain."""
    db = get_database()
    
    try:
        domain = await db[COLLECTIONS["domains"]].find_one({"_id": ObjectId(domain_id)})
    except:
        domain = await db[COLLECTIONS["domains"]].find_one({"key": domain_id})
    
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )
    
    domain_key = domain["key"]
    
    await db[COLLECTIONS["domains"]].delete_one({"_id": domain["_id"]})
    
    # Remove domain from all roles
    await db[COLLECTIONS["roles"]].update_many(
        {"domains": domain_key},
        {"$pull": {"domains": domain_key}}
    )
    
    # Remove domain from all groups
    await db[COLLECTIONS["groups"]].update_many(
        {"domains": domain_key},
        {"$pull": {"domains": domain_key}}
    )
    
    # Delete associated scenarios
    await db[COLLECTIONS["domain_scenarios"]].delete_many({"domainKey": domain_key})
    
    return {"message": "Domain deleted successfully"}


@router.post("/{domain_id}/toggle-status")
async def toggle_domain_status(
    domain_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Enable or disable a domain."""
    db = get_database()
    
    try:
        domain = await db[COLLECTIONS["domains"]].find_one({"_id": ObjectId(domain_id)})
    except:
        domain = await db[COLLECTIONS["domains"]].find_one({"key": domain_id})
    
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )
    
    new_status = "inactive" if domain.get("status") == "active" else "active"
    await db[COLLECTIONS["domains"]].update_one(
        {"_id": domain["_id"]},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": f"Domain status changed to {new_status}", "status": new_status}


@router.post("/{domain_id}/subdomains", response_model=DomainInDB)
async def add_subdomain(
    domain_id: str,
    subdomain_data: SubDomain,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Add a subdomain to a domain."""
    db = get_database()
    
    try:
        domain = await db[COLLECTIONS["domains"]].find_one({"_id": ObjectId(domain_id)})
    except:
        domain = await db[COLLECTIONS["domains"]].find_one({"key": domain_id})
    
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
    
    await db[COLLECTIONS["domains"]].update_one(
        {"_id": domain["_id"]},
        {
            "$push": {"subDomains": subdomain_data.model_dump()},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    updated = await db[COLLECTIONS["domains"]].find_one({"_id": domain["_id"]})
    updated["_id"] = str(updated["_id"])
    return DomainInDB(**updated)


@router.delete("/{domain_id}/subdomains/{subdomain_key}")
async def remove_subdomain(
    domain_id: str,
    subdomain_key: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Remove a subdomain from a domain."""
    db = get_database()
    
    try:
        domain = await db[COLLECTIONS["domains"]].find_one({"_id": ObjectId(domain_id)})
    except:
        domain = await db[COLLECTIONS["domains"]].find_one({"key": domain_id})
    
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )
    
    await db[COLLECTIONS["domains"]].update_one(
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
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get all scenarios for a specific domain."""
    db = get_database()
    
    try:
        domain = await db[COLLECTIONS["domains"]].find_one({"_id": ObjectId(domain_id)})
    except:
        domain = await db[COLLECTIONS["domains"]].find_one({"key": domain_id})
    
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Domain not found"
        )
    
    cursor = db[COLLECTIONS["domain_scenarios"]].find({"domainKey": domain["key"]})
    
    scenarios = []
    async for scenario in cursor:
        scenario["_id"] = str(scenario["_id"])
        scenarios.append(scenario)
    
    return scenarios
