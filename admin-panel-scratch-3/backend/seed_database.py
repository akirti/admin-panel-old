"""
Database seeding script for development.
Run this after starting the application to seed test data.

Usage:
    python seed_database.py

Or via API:
    POST /api/seed (if enabled in dev mode)
"""
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://admin:admin123@localhost:27017/admin_panel?authSource=admin")
DATABASE_NAME = os.getenv("DATABASE_NAME", "admin_panel")


async def seed_database():
    """Seed the database with test data."""
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    # Generate password hash for "password123"
    password_hash = pwd_context.hash("password123")
    print(f"Generated password hash: {password_hash[:20]}...")
    
    now = datetime.utcnow()
    
    # ============================================
    # PERMISSIONS
    # ============================================
    permissions = [
        # Users module
        {"key": "users.view", "name": "View Users", "module": "users", "description": "Can view user list", "actions": ["read"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "users.create", "name": "Create Users", "module": "users", "description": "Can create new users", "actions": ["create"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "users.edit", "name": "Edit Users", "module": "users", "description": "Can edit users", "actions": ["update"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "users.delete", "name": "Delete Users", "module": "users", "description": "Can delete users", "actions": ["delete"], "status": "active", "created_at": now, "updated_at": now},
        # Roles module
        {"key": "roles.view", "name": "View Roles", "module": "roles", "description": "Can view roles", "actions": ["read"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "roles.create", "name": "Create Roles", "module": "roles", "description": "Can create roles", "actions": ["create"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "roles.edit", "name": "Edit Roles", "module": "roles", "description": "Can edit roles", "actions": ["update"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "roles.delete", "name": "Delete Roles", "module": "roles", "description": "Can delete roles", "actions": ["delete"], "status": "active", "created_at": now, "updated_at": now},
        # Groups module
        {"key": "groups.view", "name": "View Groups", "module": "groups", "description": "Can view groups", "actions": ["read"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "groups.create", "name": "Create Groups", "module": "groups", "description": "Can create groups", "actions": ["create"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "groups.edit", "name": "Edit Groups", "module": "groups", "description": "Can edit groups", "actions": ["update"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "groups.delete", "name": "Delete Groups", "module": "groups", "description": "Can delete groups", "actions": ["delete"], "status": "active", "created_at": now, "updated_at": now},
        # Domains module
        {"key": "domains.view", "name": "View Domains", "module": "domains", "description": "Can view domains", "actions": ["read"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "domains.create", "name": "Create Domains", "module": "domains", "description": "Can create domains", "actions": ["create"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "domains.edit", "name": "Edit Domains", "module": "domains", "description": "Can edit domains", "actions": ["update"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "domains.delete", "name": "Delete Domains", "module": "domains", "description": "Can delete domains", "actions": ["delete"], "status": "active", "created_at": now, "updated_at": now},
        # Scenarios module
        {"key": "scenarios.view", "name": "View Scenarios", "module": "scenarios", "description": "Can view scenarios", "actions": ["read"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "scenarios.create", "name": "Create Scenarios", "module": "scenarios", "description": "Can create scenarios", "actions": ["create"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "scenarios.edit", "name": "Edit Scenarios", "module": "scenarios", "description": "Can edit scenarios", "actions": ["update"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "scenarios.delete", "name": "Delete Scenarios", "module": "scenarios", "description": "Can delete scenarios", "actions": ["delete"], "status": "active", "created_at": now, "updated_at": now},
        # Playboards module
        {"key": "playboards.view", "name": "View Playboards", "module": "playboards", "description": "Can view playboards", "actions": ["read"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "playboards.create", "name": "Create Playboards", "module": "playboards", "description": "Can create playboards", "actions": ["create"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "playboards.edit", "name": "Edit Playboards", "module": "playboards", "description": "Can edit playboards", "actions": ["update"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "playboards.delete", "name": "Delete Playboards", "module": "playboards", "description": "Can delete playboards", "actions": ["delete"], "status": "active", "created_at": now, "updated_at": now},
        # Configurations module
        {"key": "configurations.view", "name": "View Configurations", "module": "configurations", "description": "Can view configurations", "actions": ["read"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "configurations.create", "name": "Create Configurations", "module": "configurations", "description": "Can create configurations", "actions": ["create"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "configurations.edit", "name": "Edit Configurations", "module": "configurations", "description": "Can edit configurations", "actions": ["update"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "configurations.delete", "name": "Delete Configurations", "module": "configurations", "description": "Can delete configurations", "actions": ["delete"], "status": "active", "created_at": now, "updated_at": now},
        # Dashboard & Admin
        {"key": "dashboard.view", "name": "View Dashboard", "module": "dashboard", "description": "Can view dashboard", "actions": ["read"], "status": "active", "created_at": now, "updated_at": now},
        {"key": "admin.full", "name": "Full Admin Access", "module": "admin", "description": "Full administrative access", "actions": ["read", "create", "update", "delete"], "status": "active", "created_at": now, "updated_at": now},
    ]
    
    # Clear and insert permissions
    await db.permissions.delete_many({})
    await db.permissions.insert_many(permissions)
    print(f"Inserted {len(permissions)} permissions")
    
    # Get all permission keys
    all_permissions = [p["key"] for p in permissions]
    view_permissions = [p["key"] for p in permissions if "read" in p["actions"]]
    
    # ============================================
    # CUSTOMERS
    # ============================================
    customers = [
        {"customerId": "customer-001", "name": "Acme Corporation", "description": "Main enterprise customer", "status": "active", "created_at": now, "updated_at": now},
        {"customerId": "customer-002", "name": "TechStart Inc", "description": "Technology startup", "status": "active", "created_at": now, "updated_at": now},
        {"customerId": "customer-003", "name": "Global Retail Ltd", "description": "Retail chain company", "status": "active", "created_at": now, "updated_at": now},
        {"customerId": "customer-004", "name": "HealthCare Plus", "description": "Healthcare provider", "status": "active", "created_at": now, "updated_at": now},
        {"customerId": "customer-005", "name": "EduLearn Academy", "description": "Educational institution", "status": "inactive", "created_at": now, "updated_at": now},
    ]
    
    await db.customers.delete_many({})
    await db.customers.insert_many(customers)
    print(f"Inserted {len(customers)} customers")
    
    # ============================================
    # DOMAINS
    # ============================================
    domains = [
        {"key": "sales", "name": "Sales", "description": "Sales and revenue management", "path": "/sales", "dataDomain": "sales", "icon": "chart-line", "order": 1, "status": "active", "defaultSelected": True, "type": "custom", "created_at": now, "updated_at": now},
        {"key": "inventory", "name": "Inventory", "description": "Inventory and stock management", "path": "/inventory", "dataDomain": "inventory", "icon": "box", "order": 2, "status": "active", "defaultSelected": False, "type": "custom", "created_at": now, "updated_at": now},
        {"key": "hr", "name": "Human Resources", "description": "HR and employee management", "path": "/hr", "dataDomain": "hr", "icon": "users", "order": 3, "status": "active", "defaultSelected": False, "type": "custom", "created_at": now, "updated_at": now},
        {"key": "finance", "name": "Finance", "description": "Financial management and reporting", "path": "/finance", "dataDomain": "finance", "icon": "dollar-sign", "order": 4, "status": "active", "defaultSelected": False, "type": "custom", "created_at": now, "updated_at": now},
        {"key": "operations", "name": "Operations", "description": "Operations and logistics", "path": "/operations", "dataDomain": "operations", "icon": "cog", "order": 5, "status": "active", "defaultSelected": False, "type": "custom", "created_at": now, "updated_at": now},
        {"key": "analytics", "name": "Analytics", "description": "Business analytics and insights", "path": "/analytics", "dataDomain": "analytics", "icon": "chart-bar", "order": 6, "status": "active", "defaultSelected": False, "type": "custom", "created_at": now, "updated_at": now},
    ]
    
    await db.domains.delete_many({})
    await db.domains.insert_many(domains)
    print(f"Inserted {len(domains)} domains")
    
    all_domains = [d["key"] for d in domains]
    
    # ============================================
    # ROLES
    # ============================================
    roles = [
        {"roleId": "super-admin", "name": "Super Administrator", "description": "Full system access with all permissions", "permissions": all_permissions, "domains": all_domains, "status": "active", "priority": 1, "type": "system", "created_at": now, "updated_at": now},
        {"roleId": "admin", "name": "Administrator", "description": "Administrative access", "permissions": ["users.view", "users.create", "users.edit", "roles.view", "groups.view", "domains.view", "scenarios.view", "playboards.view", "configurations.view", "dashboard.view"], "domains": all_domains, "status": "active", "priority": 2, "type": "system", "created_at": now, "updated_at": now},
        {"roleId": "editor", "name": "Editor", "description": "Can view and edit most resources", "permissions": ["users.view", "domains.view", "domains.edit", "scenarios.view", "scenarios.create", "scenarios.edit", "playboards.view", "playboards.create", "playboards.edit", "configurations.view", "dashboard.view"], "domains": ["sales", "inventory", "analytics"], "status": "active", "priority": 3, "type": "custom", "created_at": now, "updated_at": now},
        {"roleId": "viewer", "name": "Viewer", "description": "Read-only access", "permissions": view_permissions, "domains": all_domains, "status": "active", "priority": 4, "type": "custom", "created_at": now, "updated_at": now},
        {"roleId": "sales-manager", "name": "Sales Manager", "description": "Sales domain manager", "permissions": ["domains.view", "scenarios.view", "scenarios.create", "scenarios.edit", "playboards.view", "dashboard.view"], "domains": ["sales"], "status": "active", "priority": 5, "type": "custom", "created_at": now, "updated_at": now},
    ]
    
    await db.roles.delete_many({})
    await db.roles.insert_many(roles)
    print(f"Inserted {len(roles)} roles")
    
    # ============================================
    # GROUPS
    # ============================================
    groups = [
        {"groupId": "administrators", "name": "Administrators", "description": "System administrators group", "permissions": all_permissions, "domains": all_domains, "status": "active", "priority": 1, "type": "system", "created_at": now, "updated_at": now},
        {"groupId": "managers", "name": "Managers", "description": "Department managers", "permissions": ["users.view", "domains.view", "scenarios.view", "scenarios.edit", "playboards.view", "playboards.edit", "dashboard.view"], "domains": all_domains, "status": "active", "priority": 2, "type": "custom", "created_at": now, "updated_at": now},
        {"groupId": "analysts", "name": "Analysts", "description": "Data analysts", "permissions": ["domains.view", "scenarios.view", "playboards.view", "configurations.view", "dashboard.view"], "domains": ["analytics", "sales", "finance"], "status": "active", "priority": 3, "type": "custom", "created_at": now, "updated_at": now},
        {"groupId": "sales-team", "name": "Sales Team", "description": "Sales department team", "permissions": ["domains.view", "scenarios.view", "playboards.view", "dashboard.view"], "domains": ["sales"], "status": "active", "priority": 4, "type": "custom", "created_at": now, "updated_at": now},
        {"groupId": "hr-team", "name": "HR Team", "description": "Human resources team", "permissions": ["users.view", "domains.view", "dashboard.view"], "domains": ["hr"], "status": "active", "priority": 5, "type": "custom", "created_at": now, "updated_at": now},
    ]
    
    await db.groups.delete_many({})
    await db.groups.insert_many(groups)
    print(f"Inserted {len(groups)} groups")
    
    # ============================================
    # USERS (with proper password hash)
    # ============================================
    users = [
        {"email": "admin@example.com", "username": "admin", "full_name": "System Administrator", "password_hash": password_hash, "roles": ["super-admin"], "groups": ["administrators"], "customers": ["customer-001", "customer-002", "customer-003", "customer-004", "customer-005"], "is_active": True, "is_super_admin": True, "email_verified": True, "created_at": now, "updated_at": now, "last_login": None},
        {"email": "manager@example.com", "username": "manager", "full_name": "John Manager", "password_hash": password_hash, "roles": ["admin"], "groups": ["managers"], "customers": ["customer-001", "customer-002"], "is_active": True, "is_super_admin": False, "email_verified": True, "created_at": now, "updated_at": now, "last_login": None},
        {"email": "editor@example.com", "username": "editor", "full_name": "Jane Editor", "password_hash": password_hash, "roles": ["editor"], "groups": ["analysts"], "customers": ["customer-001"], "is_active": True, "is_super_admin": False, "email_verified": True, "created_at": now, "updated_at": now, "last_login": None},
        {"email": "viewer@example.com", "username": "viewer", "full_name": "Bob Viewer", "password_hash": password_hash, "roles": ["viewer"], "groups": ["sales-team"], "customers": ["customer-001"], "is_active": True, "is_super_admin": False, "email_verified": True, "created_at": now, "updated_at": now, "last_login": None},
        {"email": "sales@example.com", "username": "salesuser", "full_name": "Sales User", "password_hash": password_hash, "roles": ["sales-manager"], "groups": ["sales-team"], "customers": ["customer-001", "customer-003"], "is_active": True, "is_super_admin": False, "email_verified": True, "created_at": now, "updated_at": now, "last_login": None},
        {"email": "inactive@example.com", "username": "inactive", "full_name": "Inactive User", "password_hash": password_hash, "roles": ["viewer"], "groups": [], "customers": [], "is_active": False, "is_super_admin": False, "email_verified": False, "created_at": now, "updated_at": now, "last_login": None},
    ]
    
    await db.users.delete_many({})
    await db.users.insert_many(users)
    print(f"Inserted {len(users)} users")
    
    # ============================================
    # DOMAIN SCENARIOS
    # ============================================
    scenarios = [
        {"key": "sales-overview", "name": "Sales Overview", "description": "Overview of sales performance", "dataDomain": "sales", "domainKey": "sales", "path": "/sales/overview", "icon": "chart-pie", "order": 1, "status": "active", "defaultSelected": True, "type": "custom", "created_at": now, "updated_at": now},
        {"key": "sales-by-region", "name": "Sales by Region", "description": "Regional sales breakdown", "dataDomain": "sales", "domainKey": "sales", "path": "/sales/by-region", "icon": "map", "order": 2, "status": "active", "defaultSelected": False, "type": "custom", "created_at": now, "updated_at": now},
        {"key": "sales-trends", "name": "Sales Trends", "description": "Historical sales trends", "dataDomain": "sales", "domainKey": "sales", "path": "/sales/trends", "icon": "trending-up", "order": 3, "status": "active", "defaultSelected": False, "type": "custom", "created_at": now, "updated_at": now},
        {"key": "inventory-stock", "name": "Stock Levels", "description": "Current inventory stock levels", "dataDomain": "inventory", "domainKey": "inventory", "path": "/inventory/stock", "icon": "package", "order": 1, "status": "active", "defaultSelected": True, "type": "custom", "created_at": now, "updated_at": now},
        {"key": "inventory-movement", "name": "Stock Movement", "description": "Inventory movement tracking", "dataDomain": "inventory", "domainKey": "inventory", "path": "/inventory/movement", "icon": "truck", "order": 2, "status": "active", "defaultSelected": False, "type": "custom", "created_at": now, "updated_at": now},
        {"key": "hr-employees", "name": "Employee Directory", "description": "Employee information", "dataDomain": "hr", "domainKey": "hr", "path": "/hr/employees", "icon": "users", "order": 1, "status": "active", "defaultSelected": True, "type": "custom", "created_at": now, "updated_at": now},
        {"key": "hr-attendance", "name": "Attendance", "description": "Employee attendance tracking", "dataDomain": "hr", "domainKey": "hr", "path": "/hr/attendance", "icon": "clock", "order": 2, "status": "active", "defaultSelected": False, "type": "custom", "created_at": now, "updated_at": now},
        {"key": "finance-reports", "name": "Financial Reports", "description": "Financial statements and reports", "dataDomain": "finance", "domainKey": "finance", "path": "/finance/reports", "icon": "file-text", "order": 1, "status": "active", "defaultSelected": True, "type": "custom", "created_at": now, "updated_at": now},
        {"key": "finance-budgets", "name": "Budget Management", "description": "Budget planning and tracking", "dataDomain": "finance", "domainKey": "finance", "path": "/finance/budgets", "icon": "calculator", "order": 2, "status": "active", "defaultSelected": False, "type": "custom", "created_at": now, "updated_at": now},
        {"key": "analytics-dashboard", "name": "Analytics Dashboard", "description": "Business intelligence dashboard", "dataDomain": "analytics", "domainKey": "analytics", "path": "/analytics/dashboard", "icon": "activity", "order": 1, "status": "active", "defaultSelected": True, "type": "custom", "created_at": now, "updated_at": now},
    ]
    
    await db.domain_scenarios.delete_many({})
    await db.domain_scenarios.insert_many(scenarios)
    print(f"Inserted {len(scenarios)} domain scenarios")
    
    # ============================================
    # PLAYBOARDS
    # ============================================
    playboards = [
        {
            "key": "sales-overview-board",
            "name": "Sales Overview Board",
            "description": "Main sales dashboard playboard",
            "scenarioKey": "sales-overview",
            "status": "active",
            "data": {
                "dataDomain": "sales",
                "scenerioKey": "sales-overview",
                "order": 1,
                "status": "A",
                "widgets": {
                    "filters": [
                        {"name": "dateRange", "dataKey": "date_range", "displayName": "Date Range", "type": "daterange", "visible": True, "index": 0},
                        {"name": "region", "dataKey": "region", "displayName": "Region", "type": "select", "visible": True, "index": 1}
                    ],
                    "grid": {"layout": {"columns": ["date", "region", "amount", "quantity"], "headers": ["Date", "Region", "Amount", "Quantity"], "ispaginated": True, "defaultSize": 25}, "actions": {"rowActions": {"renderAs": "button", "attributes": [], "events": []}}},
                    "pagination": [{"name": "limit", "dataKey": "limit", "displayName": "Page Size", "index": 0, "visible": True}]
                }
            },
            "created_at": now,
            "updated_at": now
        },
        {
            "key": "inventory-stock-board",
            "name": "Inventory Stock Board",
            "description": "Stock levels playboard",
            "scenarioKey": "inventory-stock",
            "status": "active",
            "data": {
                "dataDomain": "inventory",
                "scenerioKey": "inventory-stock",
                "order": 1,
                "status": "A",
                "widgets": {
                    "filters": [
                        {"name": "warehouse", "dataKey": "warehouse", "displayName": "Warehouse", "type": "select", "visible": True, "index": 0},
                        {"name": "category", "dataKey": "category", "displayName": "Category", "type": "select", "visible": True, "index": 1}
                    ],
                    "grid": {"layout": {"columns": ["sku", "name", "quantity", "warehouse"], "headers": ["SKU", "Product Name", "Quantity", "Warehouse"], "ispaginated": True, "defaultSize": 25}, "actions": {"rowActions": {"renderAs": "button", "attributes": [], "events": []}}},
                    "pagination": [{"name": "limit", "dataKey": "limit", "displayName": "Page Size", "index": 0, "visible": True}]
                }
            },
            "created_at": now,
            "updated_at": now
        },
    ]
    
    await db.playboards.delete_many({})
    await db.playboards.insert_many(playboards)
    print(f"Inserted {len(playboards)} playboards")
    
    # ============================================
    # CONFIGURATIONS
    # ============================================
    configurations = [
        {"config_id": "config-process-001", "key": "sales-etl-process", "type": "process-config", "queries": {"extract": "SELECT * FROM sales WHERE date >= :start_date", "transform": "AGGREGATE BY region, product", "load": "INSERT INTO sales_summary"}, "logics": {"validation": ["check_nulls", "check_duplicates"], "transformation": ["normalize_amounts", "calculate_totals"]}, "operations": {"schedule": "daily", "retry_count": 3, "timeout": 3600}, "lookups": {}, "data": {}, "row_add_stp": now, "row_update_stp": now},
        {"config_id": "config-lookup-001", "key": "region-codes", "type": "lookup-config", "queries": {}, "logics": {}, "operations": {}, "lookups": {"NA": "North America", "EU": "Europe", "APAC": "Asia Pacific", "LATAM": "Latin America", "MEA": "Middle East & Africa"}, "data": {}, "row_add_stp": now, "row_update_stp": now},
        {"config_id": "config-app-001", "key": "app-settings", "type": "app-config", "queries": {}, "logics": {}, "operations": {}, "lookups": {}, "data": {"theme": "light", "language": "en", "timezone": "UTC", "date_format": "YYYY-MM-DD", "currency": "USD", "pagination_size": 25}, "row_add_stp": now, "row_update_stp": now},
    ]
    
    await db.configurations.delete_many({})
    await db.configurations.insert_many(configurations)
    print(f"Inserted {len(configurations)} configurations")
    
    # ============================================
    # CREATE INDEXES
    # ============================================
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.roles.create_index("roleId", unique=True)
    await db.groups.create_index("groupId", unique=True)
    await db.permissions.create_index("key", unique=True)
    await db.customers.create_index("customerId", unique=True)
    await db.domains.create_index("key", unique=True)
    await db.domain_scenarios.create_index("key", unique=True)
    await db.playboards.create_index("key", unique=True)
    await db.configurations.create_index("config_id", unique=True)
    print("Created indexes")
    
    # ============================================
    # SUMMARY
    # ============================================
    print("\n" + "=" * 50)
    print("DATABASE SEEDING COMPLETE")
    print("=" * 50)
    print("\nTest Users (password: password123):")
    print("  - admin@example.com (Super Admin)")
    print("  - manager@example.com (Admin)")
    print("  - editor@example.com (Editor)")
    print("  - viewer@example.com (Viewer)")
    print("  - sales@example.com (Sales Manager)")
    print("  - inactive@example.com (Inactive)")
    print("=" * 50)
    
    client.close()


if __name__ == "__main__":
    asyncio.run(seed_database())
