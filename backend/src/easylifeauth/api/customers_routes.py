"""
Customer management API routes - Full CRUD from admin-panel-scratch-3.
"""
import re
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import math

from pydantic import BaseModel, Field
from easylifeauth.db.db_manager import DatabaseManager
from easylifeauth.api.dependencies import get_db
from easylifeauth.security.access_control import CurrentUser, require_super_admin, require_group_admin

router = APIRouter(prefix="/customers", tags=["Customers"])


# Pydantic models for customers
class CustomerCreate(BaseModel):
    customerId: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    description: Optional[str] = None
    status: str = Field(default="active")
    metadata: Optional[dict] = Field(default_factory=dict)


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    metadata: Optional[dict] = None


class CustomerInDB(BaseModel):
    _id: Optional[str] = None
    customerId: str
    name: str
    description: Optional[str] = None
    status: str = "active"
    metadata: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaginationMeta(BaseModel):
    total: int
    page: int
    limit: int
    pages: int
    has_next: bool
    has_prev: bool


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
async def list_customers(
    page: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=1000),
    search: Optional[str] = None,
    status: Optional[str] = None,
    tag: Optional[str] = None,
    location: Optional[str] = None,
    unit: Optional[str] = None,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """List all customers with pagination and filtering."""
    query = {}

    if search:
        safe_search = re.escape(search)
        query["$or"] = [
            {"customerId": {"$regex": safe_search, "$options": "i"}},
            {"name": {"$regex": safe_search, "$options": "i"}},
            {"description": {"$regex": safe_search, "$options": "i"}}
        ]

    if status:
        query["status"] = status

    if tag:
        query["tags"] = tag

    if location:
        query["location"] = {"$regex": f"^{re.escape(location)}$", "$options": "i"}

    if unit:
        query["unit"] = {"$regex": f"^{re.escape(unit)}$", "$options": "i"}

    total = await db.customers.count_documents(query)
    cursor = db.customers.find(query).skip(page * limit).limit(limit).sort("created_at", -1)
    customers = await cursor.to_list(length=limit)

    for c in customers:
        c["_id"] = str(c["_id"])

    return {
        "data": customers,
        "pagination": create_pagination_meta(total, page, limit).model_dump()
    }


@router.get("/count")
async def count_customers(
    search: Optional[str] = None,
    status: Optional[str] = None,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get total customer count."""
    query = {}
    if search:
        safe_search = re.escape(search)
        query["$or"] = [
            {"customerId": {"$regex": safe_search, "$options": "i"}},
            {"name": {"$regex": safe_search, "$options": "i"}}
        ]
    if status:
        query["status"] = status

    count = await db.customers.count_documents(query)
    return {"count": count}


@router.get("/filters")
async def get_customer_filters(
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get distinct tags, locations, and units for filtering."""
    # Get distinct tags (unwind the array and get unique values)
    tags_pipeline = [
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags"}},
        {"$sort": {"_id": 1}}
    ]
    tags_cursor = db.customers.aggregate(tags_pipeline)
    tags_result = await tags_cursor.to_list(length=None)
    tags = [t["_id"] for t in tags_result if t["_id"]]

    # Get distinct locations
    locations = await db.customers.distinct("location")
    locations = [loc for loc in locations if loc]  # Filter out None/empty
    locations.sort()

    # Get distinct units
    units = await db.customers.distinct("unit")
    units = [u for u in units if u]  # Filter out None/empty
    units.sort()

    return {
        "tags": tags,
        "locations": locations,
        "units": units
    }


@router.get("/{customer_id}", response_model=CustomerInDB)
async def get_customer(
    customer_id: str,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get a single customer by ID."""
    try:
        customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    except:
        customer = await db.customers.find_one({"customerId": customer_id})

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    customer["_id"] = str(customer["_id"])
    return CustomerInDB(**customer)


@router.post("", response_model=CustomerInDB, status_code=status.HTTP_201_CREATED)
async def create_customer(
    customer_data: CustomerCreate,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Create a new customer."""
    # Check if customerId already exists
    existing = await db.customers.find_one({"customerId": customer_data.customerId})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer ID already exists"
        )

    customer_dict = customer_data.model_dump()
    customer_dict["created_at"] = datetime.utcnow()
    customer_dict["updated_at"] = datetime.utcnow()

    result = await db.customers.insert_one(customer_dict)
    customer_dict["_id"] = str(result.inserted_id)

    return CustomerInDB(**customer_dict)


@router.put("/{customer_id}", response_model=CustomerInDB)
async def update_customer(
    customer_id: str,
    customer_data: CustomerUpdate,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Update a customer."""
    try:
        existing = await db.customers.find_one({"_id": ObjectId(customer_id)})
    except:
        existing = await db.customers.find_one({"customerId": customer_id})

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    update_data = customer_data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()

    await db.customers.update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )

    updated = await db.customers.find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return CustomerInDB(**updated)


@router.delete("/{customer_id}")
async def delete_customer(
    customer_id: str,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Delete a customer and remove from all users."""
    try:
        result = await db.customers.delete_one({"_id": ObjectId(customer_id)})
        customer_id_str = customer_id
    except:
        customer = await db.customers.find_one({"customerId": customer_id})
        if customer:
            result = await db.customers.delete_one({"_id": customer["_id"]})
            customer_id_str = customer["customerId"]
        else:
            result = type('obj', (object,), {'deleted_count': 0})()

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    # Remove customer from all users
    await db.users.update_many(
        {"customers": customer_id_str},
        {"$pull": {"customers": customer_id_str}}
    )

    # Remove customer from all groups
    await db.groups.update_many(
        {"customers": customer_id_str},
        {"$pull": {"customers": customer_id_str}}
    )

    return {"message": "Customer deleted successfully"}


@router.post("/{customer_id}/toggle-status")
async def toggle_customer_status(
    customer_id: str,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Toggle customer status between active and inactive."""
    try:
        customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    except:
        customer = await db.customers.find_one({"customerId": customer_id})

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    new_status = "inactive" if customer.get("status") == "active" else "active"
    await db.customers.update_one(
        {"_id": customer["_id"]},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )

    return {"message": f"Customer status changed to {new_status}", "status": new_status}


@router.get("/{customer_id}/users")
async def get_customer_users(
    customer_id: str,
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get all users assigned to a customer."""
    # Verify customer exists
    try:
        customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    except:
        customer = await db.customers.find_one({"customerId": customer_id})

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    customer_id_str = customer.get("customerId", customer_id)

    # Find users with this customer
    cursor = db.users.find({"customers": customer_id_str})
    users = await cursor.to_list(length=None)

    result = []
    for user in users:
        result.append({
            "_id": str(user.get("_id")),
            "email": user.get("email"),
            "username": user.get("username"),
            "full_name": user.get("full_name"),
            "is_active": user.get("is_active", True)
        })

    return result


@router.post("/{customer_id}/assign-users")
async def assign_users_to_customer(
    customer_id: str,
    user_ids: List[str],
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Assign users to a customer."""
    # Verify customer exists
    try:
        customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    except:
        customer = await db.customers.find_one({"customerId": customer_id})

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    customer_id_str = customer.get("customerId", customer_id)

    # Add customer to each user (support both _id and email lookup)
    updated_count = 0
    for user_id in user_ids:
        # Try to find user by _id first, then by email
        user_filter = None
        try:
            user_filter = {"_id": ObjectId(user_id)}
        except:
            user_filter = {"email": user_id}

        result = await db.users.update_one(
            user_filter,
            {"$addToSet": {"customers": customer_id_str}}
        )
        if result.modified_count > 0:
            updated_count += 1

    return {"message": f"Assigned {updated_count} users to customer", "assigned": updated_count}


@router.post("/{customer_id}/remove-users")
async def remove_users_from_customer(
    customer_id: str,
    user_ids: List[str],
    current_user: CurrentUser = Depends(require_group_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Remove users from a customer."""
    # Verify customer exists
    try:
        customer = await db.customers.find_one({"_id": ObjectId(customer_id)})
    except:
        customer = await db.customers.find_one({"customerId": customer_id})

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    customer_id_str = customer.get("customerId", customer_id)

    # Remove customer from each user (support both _id and email lookup)
    removed_count = 0
    for user_id in user_ids:
        # Try to find user by _id first, then by email
        user_filter = None
        try:
            user_filter = {"_id": ObjectId(user_id)}
        except:
            user_filter = {"email": user_id}

        result = await db.users.update_one(
            user_filter,
            {"$pull": {"customers": customer_id_str}}
        )
        if result.modified_count > 0:
            removed_count += 1

    return {"message": f"Removed {removed_count} users from customer", "removed": removed_count}
