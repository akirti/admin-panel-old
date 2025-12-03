"""API Routes module"""
from .auth_routes import router as auth_router
from .admin_routes import router as admin_router
from .domain_routes import router as domain_router
from .scenario_routes import router as scenario_router
from .playboard_routes import router as playboard_router
from .feedback_routes import router as feedback_router
from .scenario_request_routes import router as scenario_request_router
from .health_routes import router as health_router

__all__ = [
    "auth_router",
    "admin_router", 
    "domain_router",
    "scenario_router",
    "playboard_router",
    "feedback_router",
    "scenario_request_router",
    "health_router"
]
