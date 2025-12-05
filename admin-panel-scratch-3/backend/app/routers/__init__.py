"""
Routers package initialization.
"""
from app.routers import (
    auth,
    users,
    roles,
    groups,
    permissions,
    customers,
    domains,
    domain_scenarios,
    playboards,
    bulk_upload,
    dashboard,
    activity_logs,
    export
)

__all__ = [
    "auth",
    "users",
    "roles",
    "groups",
    "permissions",
    "customers",
    "domains",
    "domain_scenarios",
    "playboards",
    "bulk_upload",
    "dashboard",
    "activity_logs",
    "export"
]
