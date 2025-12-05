"""
Pytest configuration and fixtures for testing.
"""
import pytest
import asyncio
from typing import AsyncGenerator, Generator
from httpx import AsyncClient, ASGITransport
from motor.motor_asyncio import AsyncIOMotorClient
from mongomock_motor import AsyncMongoMockClient
from datetime import datetime
from unittest.mock import patch, AsyncMock, MagicMock

# Patch motor client before importing app
import app.database as db_module


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def mock_db():
    """Create mock MongoDB database."""
    client = AsyncMongoMockClient()
    database = client["test_admin_panel"]
    
    # Patch the database module
    with patch.object(db_module, 'client', client):
        with patch.object(db_module, 'database', database):
            with patch.object(db_module, 'get_database', return_value=database):
                yield database
    
    # Cleanup
    for collection_name in await database.list_collection_names():
        await database[collection_name].delete_many({})


@pytest.fixture
async def app_client(mock_db) -> AsyncGenerator[AsyncClient, None]:
    """Create test client with mocked database."""
    from app.main import app
    from app.auth import get_password_hash
    
    # Create super admin user for tests
    admin_data = {
        "email": "admin@test.com",
        "username": "testadmin",
        "full_name": "Test Admin",
        "password_hash": get_password_hash("testpass123"),
        "roles": [],
        "groups": [],
        "customers": [],
        "is_active": True,
        "is_super_admin": True,
        "last_login": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await mock_db["users"].insert_one(admin_data)
    
    # Create regular user for tests
    user_data = {
        "email": "user@test.com",
        "username": "testuser",
        "full_name": "Test User",
        "password_hash": get_password_hash("userpass123"),
        "roles": ["user-role"],
        "groups": ["user-group"],
        "customers": ["customer-1"],
        "is_active": True,
        "is_super_admin": False,
        "last_login": None,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    await mock_db["users"].insert_one(user_data)
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
async def admin_token(app_client: AsyncClient) -> str:
    """Get admin authentication token."""
    response = await app_client.post(
        "/api/auth/login",
        json={"email": "admin@test.com", "password": "testpass123"}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
async def user_token(app_client: AsyncClient) -> str:
    """Get regular user authentication token."""
    response = await app_client.post(
        "/api/auth/login",
        json={"email": "user@test.com", "password": "userpass123"}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def admin_headers(admin_token: str) -> dict:
    """Get admin authorization headers."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def user_headers(user_token: str) -> dict:
    """Get user authorization headers."""
    return {"Authorization": f"Bearer {user_token}"}


@pytest.fixture
async def sample_role(mock_db) -> dict:
    """Create sample role for testing."""
    role_data = {
        "type": "custom",
        "roleId": "test-role-1",
        "name": "Test Role",
        "description": "A test role",
        "permissions": ["read", "write"],
        "domains": ["domain-1"],
        "status": "active",
        "priority": 1,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await mock_db["roles"].insert_one(role_data)
    role_data["_id"] = str(result.inserted_id)
    return role_data


@pytest.fixture
async def sample_group(mock_db) -> dict:
    """Create sample group for testing."""
    group_data = {
        "type": "custom",
        "groupId": "test-group-1",
        "name": "Test Group",
        "description": "A test group",
        "permissions": ["read"],
        "domains": ["domain-1"],
        "status": "active",
        "priority": 1,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await mock_db["groups"].insert_one(group_data)
    group_data["_id"] = str(result.inserted_id)
    return group_data


@pytest.fixture
async def sample_permission(mock_db) -> dict:
    """Create sample permission for testing."""
    perm_data = {
        "key": "test.read",
        "name": "Test Read Permission",
        "description": "Permission to read test data",
        "module": "test",
        "actions": ["read", "list"],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await mock_db["permissions"].insert_one(perm_data)
    perm_data["_id"] = str(result.inserted_id)
    return perm_data


@pytest.fixture
async def sample_customer(mock_db) -> dict:
    """Create sample customer for testing."""
    customer_data = {
        "customerId": "test-customer-1",
        "name": "Test Customer",
        "description": "A test customer",
        "status": "active",
        "settings": {"feature_x": True},
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await mock_db["customers"].insert_one(customer_data)
    customer_data["_id"] = str(result.inserted_id)
    return customer_data


@pytest.fixture
async def sample_domain(mock_db) -> dict:
    """Create sample domain for testing."""
    domain_data = {
        "type": "custom",
        "key": "test-domain-1",
        "name": "Test Domain",
        "description": "A test domain",
        "path": "/test-domain",
        "dataDomain": "test",
        "status": "active",
        "defaultSelected": False,
        "order": 1,
        "icon": "test-icon",
        "subDomains": [],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await mock_db["domains"].insert_one(domain_data)
    domain_data["_id"] = str(result.inserted_id)
    return domain_data


@pytest.fixture
async def sample_scenario(mock_db, sample_domain) -> dict:
    """Create sample domain scenario for testing."""
    scenario_data = {
        "type": "custom",
        "key": "test-scenario-1",
        "name": "Test Scenario",
        "description": "A test scenario",
        "path": "/test-scenario",
        "dataDomain": "test",
        "status": "active",
        "defaultSelected": False,
        "order": 1,
        "icon": "scenario-icon",
        "subDomains": [],
        "domainKey": sample_domain["key"],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await mock_db["domain_scenarios"].insert_one(scenario_data)
    scenario_data["_id"] = str(result.inserted_id)
    return scenario_data


@pytest.fixture
async def sample_playboard(mock_db, sample_scenario) -> dict:
    """Create sample playboard for testing."""
    playboard_data = {
        "name": "Test Playboard",
        "description": "A test playboard",
        "scenarioKey": sample_scenario["key"],
        "data": {"config": {"setting1": "value1"}, "items": [1, 2, 3]},
        "status": "active",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await mock_db["playboards"].insert_one(playboard_data)
    playboard_data["_id"] = str(result.inserted_id)
    return playboard_data


@pytest.fixture
def mock_email_service():
    """Mock email service to prevent actual email sending."""
    with patch('app.services.email_service.email_service') as mock:
        mock.send_email = AsyncMock(return_value=True)
        mock.send_welcome_email = AsyncMock(return_value=True)
        mock.send_password_reset_email = AsyncMock(return_value=True)
        mock.send_role_change_notification = AsyncMock(return_value=True)
        mock.send_customer_association_notification = AsyncMock(return_value=True)
        yield mock


@pytest.fixture
def mock_gcs_service():
    """Mock GCS service."""
    with patch('app.services.gcs_service.gcs_service') as mock:
        mock.is_configured = MagicMock(return_value=True)
        mock.download_file = AsyncMock(return_value=b"email,username,full_name\ntest@test.com,testuser,Test User")
        mock.upload_file = AsyncMock(return_value="gs://bucket/file.csv")
        mock.list_files = AsyncMock(return_value=[{"name": "test.csv", "size": 100}])
        yield mock


@pytest.fixture
async def sample_configuration(mock_db) -> dict:
    """Create sample configuration for testing."""
    config_data = {
        "config_id": "config_fixture123",
        "type": "process-config",
        "key": "fixture-process-config",
        "queries": {"query1": "SELECT * FROM table"},
        "logics": {"logic1": "some logic"},
        "operations": {"op1": "some operation"},
        "row_add_userid": "admin@test.com",
        "row_add_stp": datetime.utcnow().isoformat(),
        "row_update_userid": "admin@test.com",
        "row_update_stp": datetime.utcnow().isoformat(),
    }
    result = await mock_db["configurations"].insert_one(config_data)
    config_data["_id"] = str(result.inserted_id)
    return config_data
