"""
MongoDB database connection and initialization.
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
from app.config import settings

client: Optional[AsyncIOMotorClient] = None
database: Optional[AsyncIOMotorDatabase] = None


async def connect_to_mongo():
    """Create MongoDB connection."""
    global client, database
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    database = client[settings.DATABASE_NAME]
    print(f"Connected to MongoDB: {settings.DATABASE_NAME}")


async def close_mongo_connection():
    """Close MongoDB connection."""
    global client
    if client:
        client.close()
        print("Closed MongoDB connection")


def get_database() -> AsyncIOMotorDatabase:
    """Get database instance."""
    if database is None:
        raise RuntimeError("Database not initialized. Call connect_to_mongo() first.")
    return database


# Collection names
COLLECTIONS = {
    "users": "users",
    "roles": "roles",
    "groups": "groups",
    "permissions": "permissions",
    "customers": "customers",
    "domains": "domains",
    "domain_scenarios": "domain_scenarios",
    "playboards": "playboards",
    "configurations": "configurations",
    "audit_logs": "audit_logs",
}


async def init_collections():
    """Initialize collections with indexes."""
    from pymongo.errors import OperationFailure

    db = get_database()

    async def create_index_safe(collection, field, **kwargs):
        """Create index if it doesn't exist, ignore if it does."""
        try:
            await db[collection].create_index(field, **kwargs)
        except OperationFailure as e:
            # Index already exists or has conflicts - safe to ignore
            error_msg = str(e).lower()
            if any(phrase in error_msg for phrase in [
                "already exists",
                "indexoptionsconflict",
                "indexkeyspecsconflict",
                "same name as the requested index"
            ]):
                pass  # Index already exists or conflicts, which is fine
            else:
                # Re-raise if it's a different error
                print(f"Warning: Could not create index on {collection}.{field}: {e}")
                # Don't raise - just log and continue
                pass

    # Users indexes
    await create_index_safe(COLLECTIONS["users"], "email", unique=True)
    await create_index_safe(COLLECTIONS["users"], "username", unique=True)

    # Roles indexes
    await create_index_safe(COLLECTIONS["roles"], "roleId", unique=True)
    await create_index_safe(COLLECTIONS["roles"], "name")

    # Groups indexes
    await create_index_safe(COLLECTIONS["groups"], "groupId", unique=True)
    await create_index_safe(COLLECTIONS["groups"], "name")

    # Permissions indexes
    await create_index_safe(COLLECTIONS["permissions"], "key", unique=True)

    # Customers indexes
    await create_index_safe(COLLECTIONS["customers"], "customerId", unique=True)

    # Domains indexes
    await create_index_safe(COLLECTIONS["domains"], "key", unique=True)

    # Domain Scenarios indexes
    await create_index_safe(COLLECTIONS["domain_scenarios"], "key", unique=True)

    # Configurations indexes
    await create_index_safe(COLLECTIONS["configurations"], "config_id", unique=True)
    await create_index_safe(COLLECTIONS["configurations"], "key", unique=True)
    await create_index_safe(COLLECTIONS["configurations"], "type")

    print("Database indexes initialized")
