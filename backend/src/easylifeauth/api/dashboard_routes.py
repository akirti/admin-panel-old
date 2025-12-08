"""
Dashboard and statistics API routes - from admin-panel-scratch-3.
"""
from fastapi import APIRouter, Depends, Query
from typing import Dict, Any, List
from datetime import datetime, timedelta

from easylifeauth.db.db_manager import DatabaseManager
from easylifeauth.api.dependencies import get_db
from easylifeauth.security.access_control import CurrentUser, require_super_admin
from easylifeauth.api.models import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
):
    """Get dashboard statistics."""
    # Count all entities
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({"is_active": True})
    total_roles = await db.roles.count_documents({})
    total_groups = await db.groups.count_documents({})
    total_domains = await db.domains.count_documents({})
    total_scenarios = await db.domain_scenarios.count_documents({})
    total_playboards = await db.playboards.count_documents({})

    # Get counts for new entities
    total_customers = 0
    total_configurations = 0
    total_permissions = 0

    if hasattr(db, 'customers') and db.customers is not None:
        total_customers = await db.customers.count_documents({})
    if hasattr(db, 'configurations') and db.configurations is not None:
        total_configurations = await db.configurations.count_documents({})
    if hasattr(db, 'permissions') and db.permissions is not None:
        total_permissions = await db.permissions.count_documents({})

    # Get recent activity logs
    recent_activities = []
    if hasattr(db, 'activity_logs') and db.activity_logs is not None:
        cursor = db.activity_logs.find().sort("timestamp", -1).limit(10)
        async for log in cursor:
            log["_id"] = str(log["_id"])
            recent_activities.append(log)

    return DashboardStats(
        total_users=total_users,
        active_users=active_users,
        total_roles=total_roles,
        total_groups=total_groups,
        total_customers=total_customers,
        total_domains=total_domains,
        total_scenarios=total_scenarios,
        total_configurations=total_configurations,
        total_playboards=total_playboards,
        recent_activities=recent_activities
    )


@router.get("/summary")
async def get_summary(
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
) -> Dict[str, Any]:
    """Get detailed summary of all entities."""
    # Users summary
    users_by_status = {
        "active": await db.users.count_documents({"is_active": True}),
        "inactive": await db.users.count_documents({"is_active": False}),
    }

    # Roles summary
    roles_by_status = {
        "active": await db.roles.count_documents({"status": "active"}),
        "inactive": await db.roles.count_documents({"status": "inactive"}),
    }

    # Groups summary
    groups_by_status = {
        "active": await db.groups.count_documents({"status": "active"}),
        "inactive": await db.groups.count_documents({"status": "inactive"}),
    }

    # Customers summary
    customers_by_status = {"active": 0, "inactive": 0}
    if hasattr(db, 'customers') and db.customers is not None:
        customers_by_status = {
            "active": await db.customers.count_documents({"status": "active"}),
            "inactive": await db.customers.count_documents({"status": "inactive"}),
        }

    # Domains summary
    domains_by_status = {
        "active": await db.domains.count_documents({"status": "active"}),
        "inactive": await db.domains.count_documents({"status": "inactive"}),
    }

    # Scenarios summary
    scenarios_by_status = {
        "active": await db.domain_scenarios.count_documents({"status": "active"}),
        "inactive": await db.domain_scenarios.count_documents({"status": "inactive"}),
    }

    # Configurations summary by type
    configurations_by_type = {
        "process-config": 0,
        "lookup-data": 0,
        "gcs-data": 0,
        "snapshot-data": 0,
    }
    if hasattr(db, 'configurations') and db.configurations is not None:
        configurations_by_type = {
            "process-config": await db.configurations.count_documents({"type": "process-config"}),
            "lookup-data": await db.configurations.count_documents({"type": "lookup-data"}),
            "gcs-data": await db.configurations.count_documents({"type": "gcs-data"}),
            "snapshot-data": await db.configurations.count_documents({"type": "snapshot-data"}),
        }

    # Playboards summary
    playboards_by_status = {
        "active": await db.playboards.count_documents({"status": "active"}),
        "inactive": await db.playboards.count_documents({"status": "inactive"}),
    }

    # Permissions by module
    permissions_by_module = {}
    if hasattr(db, 'permissions') and db.permissions is not None:
        permissions_modules = await db.permissions.distinct("module")
        for module in permissions_modules:
            permissions_by_module[module] = await db.permissions.count_documents({"module": module})

    return {
        "users": users_by_status,
        "roles": roles_by_status,
        "groups": groups_by_status,
        "customers": customers_by_status,
        "domains": domains_by_status,
        "scenarios": scenarios_by_status,
        "configurations": configurations_by_type,
        "playboards": playboards_by_status,
        "permissions_by_module": permissions_by_module,
    }


@router.get("/recent-logins")
async def get_recent_logins(
    limit: int = Query(10, ge=1, le=50),
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
) -> Dict[str, List[Dict[str, Any]]]:
    """Get recent user logins."""
    cursor = db.users.find(
        {"last_login": {"$ne": None}},
        {"password_hash": 0}
    ).sort("last_login", -1).limit(limit)

    users = []
    async for user in cursor:
        user["_id"] = str(user["_id"])
        users.append({
            "email": user.get("email"),
            "full_name": user.get("full_name", user.get("name", "")),
            "last_login": user.get("last_login")
        })

    return {"recent_logins": users}


@router.get("/analytics")
async def get_analytics(
    current_user: CurrentUser = Depends(require_super_admin),
    db: DatabaseManager = Depends(get_db)
) -> Dict[str, Any]:
    """Get dashboard analytics and trends."""
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)

    # User growth over last 30 days
    user_growth_pipeline = [
        {"$match": {"created_at": {"$gte": thirty_days_ago}}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}
                },
                "count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    user_growth = await db.users.aggregate(user_growth_pipeline).to_list(30)

    # Activity trends (last 7 days)
    activity_trend = []
    if hasattr(db, 'activity_logs') and db.activity_logs is not None:
        activity_pipeline = [
            {"$match": {"timestamp": {"$gte": seven_days_ago}}},
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
        activity_trend = await db.activity_logs.aggregate(activity_pipeline).to_list(7)

    # Role distribution (users per role)
    all_users = await db.users.find({}, {"roles": 1}).to_list(1000)
    role_distribution = {}
    for user in all_users:
        for role in user.get("roles", []):
            role_distribution[role] = role_distribution.get(role, 0) + 1

    # Top active users (by activity logs)
    top_active_users = []
    if hasattr(db, 'activity_logs') and db.activity_logs is not None:
        top_users_pipeline = [
            {"$match": {"timestamp": {"$gte": seven_days_ago}}},
            {"$group": {"_id": "$user_email", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ]
        top_active_users = await db.activity_logs.aggregate(top_users_pipeline).to_list(5)

    # Permission distribution by module
    permission_distribution = []
    if hasattr(db, 'permissions') and db.permissions is not None:
        permissions_by_module_pipeline = [
            {"$group": {"_id": "$module", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        permission_distribution = await db.permissions.aggregate(permissions_by_module_pipeline).to_list(20)

    # Recent user signups (last 5)
    recent_signups_cursor = db.users.find(
        {},
        {"email": 1, "full_name": 1, "created_at": 1}
    ).sort("created_at", -1).limit(5)
    recent_signups = []
    async for user in recent_signups_cursor:
        recent_signups.append({
            "email": user.get("email"),
            "full_name": user.get("full_name", "N/A"),
            "created_at": user.get("created_at")
        })

    return {
        "user_growth": [{"date": item["_id"], "count": item["count"]} for item in user_growth],
        "activity_trend": [{"date": item["_id"], "count": item["count"]} for item in activity_trend],
        "role_distribution": [{"role": k, "count": v} for k, v in role_distribution.items()],
        "top_active_users": [{"user_email": item["_id"], "activities": item["count"]} for item in top_active_users],
        "permission_distribution": [{"module": item["_id"], "count": item["count"]} for item in permission_distribution],
        "recent_signups": recent_signups
    }
