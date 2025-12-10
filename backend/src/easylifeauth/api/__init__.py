"""API Routes module"""
from .auth_routes import router as auth_router
from .admin_routes import router as admin_router
from .domain_routes import router as domain_router
from .scenario_routes import router as scenario_router
from .domain_scenarios_routes import router as domain_scenarios_router
from .playboard_routes import router as playboard_router
from .feedback_routes import router as feedback_router
from .scenario_request_routes import router as scenario_request_router
from .health_routes import router as health_router
from .bulk_upload_routes import router as bulk_upload_router
from .activity_log_routes import router as activity_log_router
from .export_routes import router as export_router
from .dashboard_routes import router as dashboard_router
from .users_routes import router as users_router
from .roles_routes import router as roles_router
from .groups_routes import router as groups_router
from .permissions_routes import router as permissions_router
from .configurations_routes import router as configurations_router
from .customers_routes import router as customers_router
from .jira_routes import router as jira_router
from .api_config_routes import router as api_config_router

__all__ = [
    "auth_router",
    "admin_router",
    "domain_router",
    "scenario_router",
    "domain_scenarios_router",
    "playboard_router",
    "feedback_router",
    "scenario_request_router",
    "health_router",
    "bulk_upload_router",
    "activity_log_router",
    "export_router",
    "dashboard_router",
    "users_router",
    "roles_router",
    "groups_router",
    "permissions_router",
    "configurations_router",
    "customers_router",
    "jira_router",
    "api_config_router",
]
