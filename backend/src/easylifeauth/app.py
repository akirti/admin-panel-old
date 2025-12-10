"""
EasyLife Auth - FastAPI Application (Async with Motor)
Main application entry point
"""
from typing import Optional, Dict, Any
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from . import API_VERSION, API_BASE_ROUTE
from .api import (
    auth_router,
    admin_router,
    domain_router,
    scenario_router,
    domain_scenarios_router,
    playboard_router,
    feedback_router,
    scenario_request_router,
    health_router,
    bulk_upload_router,
    activity_log_router,
    export_router,
    dashboard_router,
    users_router,
    roles_router,
    groups_router,
    permissions_router,
    configurations_router,
    customers_router,
    jira_router,
    api_config_router,
)
from .api.dependencies import init_dependencies
from .db.db_manager import DatabaseManager
from .services.token_manager import TokenManager
from .services.email_service import EmailService
from .errors.auth_error import AuthError
from .middleware.csrf import CSRFProtectMiddleware
from .middleware.rate_limit import RateLimitMiddleware
from .middleware.security import SecurityHeadersMiddleware, RequestValidationMiddleware


def create_app(
    db_config: Optional[Dict[str, Any]] = None,
    token_secret: Optional[str] = None,
    smtp_config: Optional[Dict[str, Any]] = None,
    jira_config: Optional[Dict[str, Any]] = None,
    file_storage_config: Optional[Dict[str, Any]] = None,
    gcs_config: Optional[Dict[str, Any]] = None,
    cors_origins: list = None,
    title: str = "EasyLife Auth API",
    description: str = "Authentication and Authorization API for EasyLife"
) -> FastAPI:
    """Create and configure FastAPI application

    Args:
        db_config: MongoDB configuration
        token_secret: JWT secret key
        smtp_config: SMTP email configuration
        jira_config: Jira integration config (base_url, email, api_token, project_key)
        file_storage_config: File storage config (type: 'local' or 'gcs', bucket_name, base_path)
        gcs_config: GCS config for bulk operations (credentials_json, bucket_name)
        cors_origins: CORS allowed origins
        title: API title
        description: API description
    """
    
    # Store references for cleanup
    db_manager: Optional[DatabaseManager] = None
    
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        nonlocal db_manager
        
        # Startup
        if db_config and token_secret:
            # Initialize database with Motor (async)
            db_manager = DatabaseManager(config=db_config)
            
            # Test connection
            try:
                is_connected = await db_manager.ping()
                if is_connected:
                    print("✓ Connected to MongoDB")
                else:
                    print("✗ Failed to connect to MongoDB")
            except Exception as e:
                print(f"✗ MongoDB connection error: {e}")
            
            # Initialize token manager
            token_manager = TokenManager(
                secret_key=token_secret,
                db=db_manager
            )
            
            # Initialize email service (optional)
            email_service = None
            if smtp_config and all(k in smtp_config for k in ["smtp_server", "smtp_port", "email"]):
                email_service = EmailService(smtp_config)
                print("✓ Email service configured")
            
            # Initialize all dependencies with new services
            init_dependencies(
                db_manager,
                token_manager,
                email_service,
                jira_config=jira_config,
                file_storage_config=file_storage_config,
                gcs_config=gcs_config
            )
            print("✓ Services initialized")
        
        yield
        
        # Shutdown
        if db_manager:
            db_manager.close()
            print("✓ Database connection closed")
    
    app = FastAPI(
        title=title,
        description=description,
        version=API_VERSION,
        lifespan=lifespan,
        docs_url=f"{API_BASE_ROUTE}/docs",
        redoc_url=f"{API_BASE_ROUTE}/redoc",
        openapi_url=f"{API_BASE_ROUTE}/openapi.json"
    )
    
    
    
    # CORS middleware
    if cors_origins is None:
        cors_origins = ["*"]
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Determine environment once for all middleware config
    import os
    is_dev = os.environ.get("ENV", "production") == "development"

    # CSRF Protection middleware
    if token_secret:
        app.add_middleware(
            CSRFProtectMiddleware,
            secret_key=token_secret,
            cookie_name="csrf_token",
            header_name="X-CSRF-Token",
            cookie_secure=not is_dev,  # False in dev, True in production
            cookie_samesite="lax",
            exempt_paths={
                "/api/v1/auth/*",  # All auth endpoints are exempt (login, register, refresh, profile, etc.)
            }
        )

    # Rate limiting middleware
    app.add_middleware(
        RateLimitMiddleware,
        requests_per_minute=120 if is_dev else 60,  # More lenient in dev
        requests_per_hour=2000 if is_dev else 1000,
        auth_requests_per_minute=10 if is_dev else 5,  # Stricter for auth endpoints
        enabled=not is_dev  # Disabled in dev mode for easier testing
    )

    # Security headers middleware (enabled in production only)
    if not is_dev:
        app.add_middleware(
            SecurityHeadersMiddleware,
            enable_hsts=True,
            enable_csp=True
        )
        # Add request validation
        app.add_middleware(RequestValidationMiddleware,
                            max_body_size=10 * 1024 * 1024)


    # Exception handlers
    @app.exception_handler(AuthError)
    async def auth_error_handler(request: Request, exc: AuthError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.message}
        )
    
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.detail}
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        # Log the error for debugging
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )
    
    # Include routers with API base route prefix
    app.include_router(auth_router, prefix=API_BASE_ROUTE)
    app.include_router(admin_router, prefix=API_BASE_ROUTE)
    app.include_router(domain_router, prefix=API_BASE_ROUTE)
    app.include_router(scenario_router, prefix=API_BASE_ROUTE)
    app.include_router(domain_scenarios_router, prefix=API_BASE_ROUTE)
    app.include_router(playboard_router, prefix=API_BASE_ROUTE)
    app.include_router(feedback_router, prefix=API_BASE_ROUTE)
    app.include_router(scenario_request_router, prefix=API_BASE_ROUTE)
    app.include_router(health_router, prefix=API_BASE_ROUTE)
    app.include_router(bulk_upload_router, prefix=API_BASE_ROUTE)
    app.include_router(activity_log_router, prefix=API_BASE_ROUTE)
    app.include_router(export_router, prefix=API_BASE_ROUTE)
    app.include_router(dashboard_router, prefix=API_BASE_ROUTE)
    app.include_router(users_router, prefix=API_BASE_ROUTE)
    app.include_router(roles_router, prefix=API_BASE_ROUTE)
    app.include_router(groups_router, prefix=API_BASE_ROUTE)
    app.include_router(permissions_router, prefix=API_BASE_ROUTE)
    app.include_router(configurations_router, prefix=API_BASE_ROUTE)
    app.include_router(customers_router, prefix=API_BASE_ROUTE)
    app.include_router(jira_router, prefix=API_BASE_ROUTE)
    app.include_router(api_config_router, prefix=API_BASE_ROUTE)

    # Root endpoint
    @app.get("/")
    async def root():
        return {
            "message": "EasyLife Auth API",
            "version": API_VERSION,
            "docs": f"{API_BASE_ROUTE}/docs"
        }
    
    return app


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("easylifeauth.app:app", host="0.0.0.0", port=8000, reload=True)
