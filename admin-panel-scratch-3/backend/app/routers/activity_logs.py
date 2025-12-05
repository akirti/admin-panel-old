"""
Activity Logs / Audit Trail API routes.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional
from datetime import datetime, timedelta
from bson import ObjectId
import math
from app.models import AuditLogInDB, UserInDB, PaginationMeta
from app.auth import get_super_admin_user
from app.database import get_database, COLLECTIONS

router = APIRouter(prefix="/activity-logs", tags=["Activity Logs"])


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
async def list_activity_logs(
    page: int = Query(0, ge=0, description="Page number (0-indexed)"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
    entity_type: Optional[str] = None,
    action: Optional[str] = None,
    user_email: Optional[str] = None,
    entity_id: Optional[str] = None,
    days: Optional[int] = Query(None, ge=1, le=365, description="Filter logs from last N days"),
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """
    List all activity logs with pagination and filtering.

    - **page**: Page number (0-indexed)
    - **limit**: Maximum number of records to return
    - **entity_type**: Filter by entity type (users, roles, groups, etc.)
    - **action**: Filter by action (create, update, delete, etc.)
    - **user_email**: Filter by user who performed the action
    - **entity_id**: Filter by specific entity ID
    - **days**: Filter logs from last N days
    """
    db = get_database()

    query = {}

    if entity_type:
        query["entity_type"] = entity_type

    if action:
        query["action"] = action

    if user_email:
        query["user_email"] = {"$regex": user_email, "$options": "i"}

    if entity_id:
        query["entity_id"] = entity_id

    if days:
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        query["timestamp"] = {"$gte": cutoff_date}

    # Get total count
    total = await db[COLLECTIONS["audit_logs"]].count_documents(query)

    # Get paginated data
    skip = page * limit
    cursor = db[COLLECTIONS["audit_logs"]].find(query).skip(skip).limit(limit).sort("timestamp", -1)
    logs = []
    async for log in cursor:
        log["_id"] = str(log["_id"])
        logs.append(AuditLogInDB(**log))

    return {
        "data": logs,
        "pagination": create_pagination_meta(total, page, limit)
    }


@router.get("/stats")
async def get_activity_stats(
    days: int = Query(7, ge=1, le=365, description="Get stats for last N days"),
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get activity statistics."""
    db = get_database()

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Count by action type
    action_pipeline = [
        {"$match": {"timestamp": {"$gte": cutoff_date}}},
        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    action_stats = await db[COLLECTIONS["audit_logs"]].aggregate(action_pipeline).to_list(100)

    # Count by entity type
    entity_pipeline = [
        {"$match": {"timestamp": {"$gte": cutoff_date}}},
        {"$group": {"_id": "$entity_type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    entity_stats = await db[COLLECTIONS["audit_logs"]].aggregate(entity_pipeline).to_list(100)

    # Count by user
    user_pipeline = [
        {"$match": {"timestamp": {"$gte": cutoff_date}}},
        {"$group": {"_id": "$user_email", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    user_stats = await db[COLLECTIONS["audit_logs"]].aggregate(user_pipeline).to_list(10)

    # Activity timeline (daily counts)
    timeline_pipeline = [
        {"$match": {"timestamp": {"$gte": cutoff_date}}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}
                },
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    timeline = await db[COLLECTIONS["audit_logs"]].aggregate(timeline_pipeline).to_list(365)

    total_activities = await db[COLLECTIONS["audit_logs"]].count_documents(
        {"timestamp": {"$gte": cutoff_date}}
    )

    return {
        "total_activities": total_activities,
        "actions": [{"action": stat["_id"], "count": stat["count"]} for stat in action_stats],
        "entities": [{"entity_type": stat["_id"], "count": stat["count"]} for stat in entity_stats],
        "top_users": [{"user_email": stat["_id"], "count": stat["count"]} for stat in user_stats],
        "timeline": [{"date": item["_id"], "count": item["count"]} for item in timeline],
        "period_days": days
    }


@router.get("/entity/{entity_type}/{entity_id}")
async def get_entity_history(
    entity_type: str,
    entity_id: str,
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get complete history for a specific entity."""
    db = get_database()

    cursor = db[COLLECTIONS["audit_logs"]].find({
        "entity_type": entity_type,
        "entity_id": entity_id
    }).sort("timestamp", -1)

    logs = []
    async for log in cursor:
        log["_id"] = str(log["_id"])
        logs.append(AuditLogInDB(**log))

    return {"data": logs, "total": len(logs)}


@router.get("/user/{user_email}")
async def get_user_activity(
    user_email: str,
    page: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=100),
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get all activities performed by a specific user."""
    db = get_database()

    query = {"user_email": user_email}

    total = await db[COLLECTIONS["audit_logs"]].count_documents(query)
    skip = page * limit

    cursor = db[COLLECTIONS["audit_logs"]].find(query).skip(skip).limit(limit).sort("timestamp", -1)
    logs = []
    async for log in cursor:
        log["_id"] = str(log["_id"])
        logs.append(AuditLogInDB(**log))

    return {
        "data": logs,
        "pagination": create_pagination_meta(total, page, limit)
    }


@router.delete("/cleanup")
async def cleanup_old_logs(
    days: int = Query(90, ge=1, description="Delete logs older than N days"),
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Delete activity logs older than specified days."""
    db = get_database()

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    result = await db[COLLECTIONS["audit_logs"]].delete_many({
        "timestamp": {"$lt": cutoff_date}
    })

    return {
        "message": f"Deleted {result.deleted_count} activity logs older than {days} days",
        "deleted_count": result.deleted_count,
        "cutoff_date": cutoff_date.isoformat()
    }


@router.get("/actions")
async def get_available_actions(
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get list of all available action types."""
    db = get_database()
    actions = await db[COLLECTIONS["audit_logs"]].distinct("action")
    return {"actions": sorted(actions)}


@router.get("/entity-types")
async def get_available_entity_types(
    current_user: UserInDB = Depends(get_super_admin_user)
):
    """Get list of all available entity types."""
    db = get_database()
    entity_types = await db[COLLECTIONS["audit_logs"]].distinct("entity_type")
    return {"entity_types": sorted(entity_types)}
