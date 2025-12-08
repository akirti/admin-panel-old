"""Pytest configuration and fixtures"""
import pytest
import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Dict, Any, List

from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

# Mock Motor before importing app
import sys
from unittest.mock import MagicMock

# Create mock motor module
mock_motor = MagicMock()
mock_motor.motor_asyncio = MagicMock()
sys.modules['motor'] = mock_motor
sys.modules['motor.motor_asyncio'] = mock_motor.motor_asyncio


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests"""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_db():
    """Mock database manager"""
    db = MagicMock()
    
    # Mock collections
    db.users = AsyncMock()
    db.tokens = AsyncMock()
    db.reset_tokens = AsyncMock()
    db.domains = AsyncMock()
    db.domain_scenarios = AsyncMock()
    db.playboards = AsyncMock()
    db.feedbacks = AsyncMock()
    db.scenario_requests = AsyncMock()
    
    # Mock ping
    db.ping = AsyncMock(return_value=True)
    db.close = MagicMock()
    
    return db


@pytest.fixture
def sample_user_data() -> Dict[str, Any]:
    """Sample user data for testing"""
    return {
        "_id": "507f1f77bcf86cd799439011",
        "user_id": "507f1f77bcf86cd799439011",
        "email": "test@example.com",
        "username": "testuser",
        "password_hash": "hashed_password",
        "full_name": "Test User",
        "roles": ["user"],
        "groups": ["viewer"],
        "domains": [],
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "last_login": None
    }


@pytest.fixture
def sample_admin_data() -> Dict[str, Any]:
    """Sample admin user data"""
    return {
        "_id": "507f1f77bcf86cd799439012",
        "user_id": "507f1f77bcf86cd799439012",
        "email": "admin@example.com",
        "username": "admin",
        "password_hash": "hashed_password",
        "full_name": "Admin User",
        "roles": ["administrator"],
        "groups": ["administrator"],
        "domains": ["all"],
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "last_login": None
    }


@pytest.fixture
def sample_domain_data() -> Dict[str, Any]:
    """Sample domain data"""
    return {
        "_id": "507f1f77bcf86cd799439013",
        "key": "test-domain",
        "name": "Test Domain",
        "description": "A test domain",
        "path": "/test",
        "icon": "test-icon",
        "order": 1,
        "defaultSelected": False,
        "actions": ["view", "edit"],
        "type": "standard",
        "subDomain": [],
        "status": "A"
    }


@pytest.fixture
def sample_scenario_data() -> Dict[str, Any]:
    """Sample scenario data"""
    return {
        "_id": "507f1f77bcf86cd799439014",
        "key": "test-scenario",
        "name": "Test Scenario",
        "dataDomain": "test-domain",
        "description": "A test scenario",
        "fullDescription": "Full description of test scenario",
        "path": "/test/scenario",
        "icon": "scenario-icon",
        "order": 1,
        "defaultSelected": False,
        "actions": ["run"],
        "status": "A"
    }


@pytest.fixture
def sample_playboard_data() -> Dict[str, Any]:
    """Sample playboard data"""
    return {
        "_id": "507f1f77bcf86cd799439015",
        "dataDomain": "test-domain",
        "scenerioKey": "test-scenario",
        "widgets": [{"type": "chart", "config": {}}],
        "order": 1,
        "program_key": "test-program",
        "addon_configurations": {},
        "status": "A"
    }


@pytest.fixture
def sample_feedback_data() -> Dict[str, Any]:
    """Sample feedback data"""
    return {
        "_id": "507f1f77bcf86cd799439016",
        "rating": 5,
        "improvements": "None needed",
        "suggestions": "Great work!",
        "email": "test@example.com",
        "createdAt": "2024-01-01 12:00:00 PM",
        "updatedAt": None
    }


@pytest.fixture
def sample_scenario_request_data() -> Dict[str, Any]:
    """Sample scenario request data"""
    return {
        "_id": "507f1f77bcf86cd799439017",
        "requestId": "REQ-SCR-0001",
        "scenarioName": "New Scenario",
        "description": "Description of new scenario",
        "dataDomain": "test-domain",
        "databases": ["db1", "db2"],
        "steps": ["Step 1", "Step 2"],
        "stepQueries": ["SELECT 1", "SELECT 2"],
        "resultSize": 100,
        "filters": ["filter1"],
        "status": "S",
        "user_id": "507f1f77bcf86cd799439011",
        "email": "test@example.com",
        "name": "Test User",
        "rowAddStp": datetime.now(timezone.utc),
        "rowUpdateStp": datetime.now(timezone.utc)
    }


@pytest.fixture
def mock_token_manager():
    """Mock token manager"""
    tm = MagicMock()
    tm.generate_tokens = AsyncMock(return_value={
        "access_token": "test_access_token",
        "refresh_token": "test_refresh_token",
        "expires_in": 900
    })
    tm.verify_token = MagicMock(return_value={
        "user_id": "507f1f77bcf86cd799439011",
        "email": "test@example.com",
        "roles": ["user"]
    })
    tm.refresh_access_token = AsyncMock(return_value={
        "access_token": "new_access_token",
        "refresh_token": "new_refresh_token",
        "expires_in": 900
    })
    tm.sync_access_token = AsyncMock()
    tm.validate_backend_token = AsyncMock(return_value={
        "user_id": "507f1f77bcf86cd799439011",
        "email": "test@example.com",
        "token_hash": "test_access_token",
        "refresh_token_hash": "test_refresh_token",
        "expires_at": datetime.now(timezone.utc)
    })
    return tm


@pytest.fixture
def mock_email_service():
    """Mock email service"""
    es = MagicMock()
    es.send_reset_email = AsyncMock()
    es.send_feedback_email = AsyncMock()
    es.send_scenario_email = AsyncMock()
    return es


@pytest.fixture
def auth_headers() -> Dict[str, str]:
    """Auth headers for authenticated requests"""
    return {"Authorization": "Bearer test_access_token"}


@pytest.fixture
def admin_auth_headers() -> Dict[str, str]:
    """Auth headers for admin requests"""
    return {"Authorization": "Bearer admin_access_token"}
