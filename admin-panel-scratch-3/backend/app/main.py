"""
Admin Panel API - Main Application Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection, init_collections, get_database, COLLECTIONS
from app.auth import get_password_hash
from app.routers import (
    auth, users, roles, groups, permissions,
    customers, domains, domain_scenarios,
    playboards, bulk_upload, dashboard, activity_logs, export
)
from app.routers.configurations import router as configurations_router
from datetime import datetime


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    await connect_to_mongo()
    await init_collections()
    await create_default_super_admin()
    yield
    # Shutdown
    await close_mongo_connection()


async def create_default_super_admin():
    """Create default super admin user if not exists."""
    db = get_database()
    
    # Check if super admin exists
    admin = await db[COLLECTIONS["users"]].find_one({"is_super_admin": True})
    if not admin:
        admin_data = {
            "email": "admin@example.com",
            "username": "superadmin",
            "full_name": "Super Administrator",
            "password_hash": get_password_hash("admin123"),
            "roles": [],
            "groups": [],
            "customers": [],
            "is_active": True,
            "is_super_admin": True,
            "last_login": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        await db[COLLECTIONS["users"]].insert_one(admin_data)
        print("Default super admin created: admin@example.com / admin123")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="""
    ## Admin Panel API
    
    A comprehensive administration panel for managing users, roles, groups, 
    permissions, customers, domains, and scenarios.
    
    ### Features
    
    - **Authentication**: JWT-based authentication with role-based access control
    - **User Management**: Create, update, delete, enable/disable users
    - **Role Management**: Define roles with permissions and domain access
    - **Group Management**: Organize users into groups with shared permissions
    - **Permission Management**: Granular permission system by module
    - **Customer Management**: Multi-tenant customer association
    - **Domain Management**: Hierarchical domain structure with sub-domains
    - **Domain Scenarios**: Configure scenarios for each domain
    - **Playboards**: Upload JSON playboard configurations
    - **Bulk Operations**: Import/export data via CSV/Excel files
    - **GCS Integration**: Read bulk data from Google Cloud Storage
    - **Email Notifications**: Automatic notifications for account changes
    
    ### Authentication
    
    All endpoints (except `/auth/login`) require a valid JWT token in the 
    Authorization header: `Bearer <token>`
    
    Admin endpoints require super-admin privileges.
    
    ### Default Credentials
    
    - **Email**: admin@example.com
    - **Password**: admin123
    
    **Important**: Change the default password after first login!
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security middleware
from app.middleware import RateLimitMiddleware, SecurityHeadersMiddleware, RequestValidationMiddleware

# Add security headers
app.add_middleware(SecurityHeadersMiddleware, enable_hsts=False)  # Set to True in production with HTTPS

# Add request validation
app.add_middleware(RequestValidationMiddleware, max_body_size=10 * 1024 * 1024)

# Add rate limiting (can be disabled by setting enabled=False)
# Note: Development-friendly settings - adjust for production
app.add_middleware(
    RateLimitMiddleware,
    requests_per_minute=120,  # Increased for development
    requests_per_hour=2000,
    auth_requests_per_minute=20,  # Increased from 5 to allow development testing
    enabled=True  # Set to False to disable rate limiting
)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(roles.router, prefix="/api")
app.include_router(groups.router, prefix="/api")
app.include_router(permissions.router, prefix="/api")
app.include_router(customers.router, prefix="/api")
app.include_router(domains.router, prefix="/api")
app.include_router(domain_scenarios.router, prefix="/api")
app.include_router(playboards.router, prefix="/api")
app.include_router(bulk_upload.router, prefix="/api")
app.include_router(configurations_router, prefix="/api")
app.include_router(activity_logs.router, prefix="/api")
app.include_router(export.router, prefix="/api")


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint - API health check."""
    return {
        "message": "Admin Panel API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.post("/api/seed", tags=["Dev"])
async def seed_database_endpoint():
    """
    Seed the database with test data.
    
    Run the seed_database.py script instead for full seeding:
    ```
    cd backend
    python seed_database.py
    ```
    
    Or use this endpoint for quick seeding via API.
    """
    import subprocess
    import sys
    
    try:
        result = subprocess.run(
            [sys.executable, "seed_database.py"],
            capture_output=True,
            text=True,
            cwd="/app"
        )
        return {
            "status": "success" if result.returncode == 0 else "error",
            "output": result.stdout,
            "error": result.stderr if result.returncode != 0 else None
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}
