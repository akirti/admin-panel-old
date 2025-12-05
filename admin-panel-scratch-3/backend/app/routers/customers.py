"""
Customer management API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from bson import ObjectId
import math
from app.models import CustomerCreate, CustomerUpdate, CustomerInDB, UserInDB, PaginationMeta
from app.auth import get_super_admin_user
from app.database import get_database, COLLECTIONS
from app.services.email_service import email_service

router = APIRouter(prefix="/customers", tags=["Customers"])


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
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """
    List all customers with pagination and filtering.
    
    - **page**: Page number (0-indexed)
    - **limit**: Maximum number of records to return
    - **status**: Filter by status (active/inactive)
    - **search**: Search by name or customerId
    """
    db = get_database()
    
    query = {}
    if status:
        query["status"] = status
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"customerId": {"$regex": search, "$options": "i"}}
        ]
    
    # Get total count
    total = await db[COLLECTIONS["customers"]].count_documents(query)
    
    # Get paginated data
    skip = page * limit
    cursor = db[COLLECTIONS["customers"]].find(query).skip(skip).limit(limit).sort("name", 1)
    customers = []
    async for customer in cursor:
        customer["_id"] = str(customer["_id"])
        customers.append(CustomerInDB(**customer))
    
    return {
        "data": customers,
        "pagination": create_pagination_meta(total, page, limit)
    }


@router.get("/count")
async def count_customers(
    status: Optional[str] = None,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get total count of customers."""
    db = get_database()
    query = {}
    if status:
        query["status"] = status
    count = await db[COLLECTIONS["customers"]].count_documents(query)
    return {"count": count}


@router.get("/{customer_id}", response_model=CustomerInDB)
async def get_customer(
    customer_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get a specific customer by ID or customerId."""
    db = get_database()
    
    try:
        customer = await db[COLLECTIONS["customers"]].find_one({"_id": ObjectId(customer_id)})
    except:
        customer = await db[COLLECTIONS["customers"]].find_one({"customerId": customer_id})
    
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
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Create a new customer."""
    db = get_database()
    
    # Check if customerId already exists
    existing = await db[COLLECTIONS["customers"]].find_one({"customerId": customer_data.customerId})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer ID already exists"
        )
    
    customer_dict = customer_data.model_dump()
    customer_dict["created_at"] = datetime.utcnow()
    customer_dict["updated_at"] = datetime.utcnow()
    
    result = await db[COLLECTIONS["customers"]].insert_one(customer_dict)
    customer_dict["_id"] = str(result.inserted_id)
    
    return CustomerInDB(**customer_dict)


@router.put("/{customer_id}", response_model=CustomerInDB)
async def update_customer(
    customer_id: str,
    customer_data: CustomerUpdate,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Update a customer."""
    db = get_database()
    
    try:
        existing = await db[COLLECTIONS["customers"]].find_one({"_id": ObjectId(customer_id)})
    except:
        existing = await db[COLLECTIONS["customers"]].find_one({"customerId": customer_id})
    
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    update_data = customer_data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    
    # Check for status change
    if "status" in update_data and update_data["status"] != existing.get("status"):
        # Notify all users associated with this customer
        cursor = db[COLLECTIONS["users"]].find({"customers": existing["customerId"]})
        async for user in cursor:
            await email_service.send_role_change_notification(
                user["email"],
                user["full_name"],
                "customer association",
                {"customer_status": {"old": existing.get("status"), "new": update_data["status"]}}
            )
    
    await db[COLLECTIONS["customers"]].update_one(
        {"_id": existing["_id"]},
        {"$set": update_data}
    )
    
    updated = await db[COLLECTIONS["customers"]].find_one({"_id": existing["_id"]})
    updated["_id"] = str(updated["_id"])
    return CustomerInDB(**updated)


@router.delete("/{customer_id}")
async def delete_customer(
    customer_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Delete a customer."""
    db = get_database()
    
    try:
        customer = await db[COLLECTIONS["customers"]].find_one({"_id": ObjectId(customer_id)})
    except:
        customer = await db[COLLECTIONS["customers"]].find_one({"customerId": customer_id})
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    customer_key = customer["customerId"]
    
    await db[COLLECTIONS["customers"]].delete_one({"_id": customer["_id"]})
    
    # Remove customer from all users
    await db[COLLECTIONS["users"]].update_many(
        {"customers": customer_key},
        {"$pull": {"customers": customer_key}}
    )
    
    # Remove customer from all roles
    await db[COLLECTIONS["roles"]].update_many(
        {"customers": customer_key},
        {"$pull": {"customers": customer_key}}
    )
    
    # Remove customer from all groups
    await db[COLLECTIONS["groups"]].update_many(
        {"customers": customer_key},
        {"$pull": {"customers": customer_key}}
    )
    
    return {"message": "Customer deleted successfully"}


@router.post("/{customer_id}/toggle-status")
async def toggle_customer_status(
    customer_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Enable or disable a customer."""
    db = get_database()
    
    try:
        customer = await db[COLLECTIONS["customers"]].find_one({"_id": ObjectId(customer_id)})
    except:
        customer = await db[COLLECTIONS["customers"]].find_one({"customerId": customer_id})
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    new_status = "inactive" if customer.get("status") == "active" else "active"
    await db[COLLECTIONS["customers"]].update_one(
        {"_id": customer["_id"]},
        {"$set": {"status": new_status, "updated_at": datetime.utcnow()}}
    )
    
    # Notify all users associated with this customer
    cursor = db[COLLECTIONS["users"]].find({"customers": customer["customerId"]})
    async for user in cursor:
        await email_service.send_role_change_notification(
            user["email"],
            user["full_name"],
            "customer status",
            {"status": {"old": customer.get("status"), "new": new_status}}
        )
    
    return {"message": f"Customer status changed to {new_status}", "status": new_status}


@router.get("/{customer_id}/users", response_model=List[dict])
async def get_customer_users(
    customer_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get all users associated with a specific customer."""
    db = get_database()
    
    try:
        customer = await db[COLLECTIONS["customers"]].find_one({"_id": ObjectId(customer_id)})
    except:
        customer = await db[COLLECTIONS["customers"]].find_one({"customerId": customer_id})
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    cursor = db[COLLECTIONS["users"]].find(
        {"customers": customer["customerId"]},
        {"password_hash": 0}
    )
    
    users = []
    async for user in cursor:
        user["_id"] = str(user["_id"])
        users.append(user)
    
    return users


@router.post("/{customer_id}/assign-users")
async def assign_users_to_customer(
    customer_id: str,
    user_ids: List[str],
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Assign multiple users to a customer."""
    db = get_database()
    
    try:
        customer = await db[COLLECTIONS["customers"]].find_one({"_id": ObjectId(customer_id)})
    except:
        customer = await db[COLLECTIONS["customers"]].find_one({"customerId": customer_id})
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    customer_key = customer["customerId"]
    assigned_count = 0
    
    for user_id in user_ids:
        try:
            user = await db[COLLECTIONS["users"]].find_one({"_id": ObjectId(user_id)})
        except:
            user = await db[COLLECTIONS["users"]].find_one({"email": user_id})
        
        if user and customer_key not in user.get("customers", []):
            await db[COLLECTIONS["users"]].update_one(
                {"_id": user["_id"]},
                {"$addToSet": {"customers": customer_key}}
            )
            assigned_count += 1
            
            # Send notification
            await email_service.send_customer_association_notification(
                user["email"],
                user["full_name"],
                [customer["name"]],
                []
            )
    
    return {"message": f"Assigned {assigned_count} users to customer"}


@router.post("/{customer_id}/remove-users")
async def remove_users_from_customer(
    customer_id: str,
    user_ids: List[str],
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Remove multiple users from a customer."""
    db = get_database()
    
    try:
        customer = await db[COLLECTIONS["customers"]].find_one({"_id": ObjectId(customer_id)})
    except:
        customer = await db[COLLECTIONS["customers"]].find_one({"customerId": customer_id})
    
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    
    customer_key = customer["customerId"]
    removed_count = 0
    
    for user_id in user_ids:
        try:
            user = await db[COLLECTIONS["users"]].find_one({"_id": ObjectId(user_id)})
        except:
            user = await db[COLLECTIONS["users"]].find_one({"email": user_id})
        
        if user and customer_key in user.get("customers", []):
            await db[COLLECTIONS["users"]].update_one(
                {"_id": user["_id"]},
                {"$pull": {"customers": customer_key}}
            )
            removed_count += 1
            
            # Send notification
            await email_service.send_customer_association_notification(
                user["email"],
                user["full_name"],
                [],
                [customer["name"]]
            )
    
    return {"message": f"Removed {removed_count} users from customer"}
