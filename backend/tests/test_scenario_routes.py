"""Tests for Scenario Routes"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI
from bson import ObjectId

from easylifeauth.api.scenario_routes import (
    router,
    get_user_accessible_domains,
    check_domain_access
)
from easylifeauth.api.dependencies import (
    get_db,
    get_current_user,
    get_scenario_service,
    get_user_service
)
from easylifeauth.security.access_control import require_admin_or_editor
from easylifeauth.errors.scenario_error import ScenarioNotFoundError, ScenarioError, ScenarioBadError


class TestHelperFunctions:
    """Tests for helper functions"""

    def test_check_domain_access_all(self):
        """Test check_domain_access with 'all' access"""
        assert check_domain_access(["all"], "any-domain") is True

    def test_check_domain_access_specific(self):
        """Test check_domain_access with specific domain"""
        assert check_domain_access(["domain-a", "domain-b"], "domain-a") is True
        assert check_domain_access(["domain-a", "domain-b"], "domain-c") is False

    def test_check_domain_access_empty(self):
        """Test check_domain_access with empty list"""
        assert check_domain_access([], "any-domain") is False


class TestGetUserAccessibleDomains:
    """Tests for get_user_accessible_domains function"""

    @pytest.mark.asyncio
    async def test_super_admin_gets_all(self):
        """Test super admin gets 'all' access"""
        mock_user = MagicMock()
        mock_user.roles = ["super-administrator"]
        mock_user.email = "admin@test.com"

        mock_db = MagicMock()
        mock_user_service = MagicMock()

        result = await get_user_accessible_domains(mock_user, mock_db, mock_user_service)
        assert result == ["all"]

    @pytest.mark.asyncio
    async def test_regular_user_gets_resolved_domains(self):
        """Test regular user gets resolved domains"""
        mock_user = MagicMock()
        mock_user.roles = ["user"]
        mock_user.email = "user@test.com"

        mock_db = MagicMock()
        mock_db.users.find_one = AsyncMock(return_value={"email": "user@test.com"})

        mock_user_service = MagicMock()
        mock_user_service.resolve_user_domains = AsyncMock(return_value=["domain-a", "domain-b"])

        result = await get_user_accessible_domains(mock_user, mock_db, mock_user_service)
        assert result == ["domain-a", "domain-b"]

    @pytest.mark.asyncio
    async def test_user_not_found_returns_empty(self):
        """Test user not found returns empty list"""
        mock_user = MagicMock()
        mock_user.roles = ["user"]
        mock_user.email = "user@test.com"

        mock_db = MagicMock()
        mock_db.users.find_one = AsyncMock(return_value=None)

        mock_user_service = MagicMock()

        result = await get_user_accessible_domains(mock_user, mock_db, mock_user_service)
        assert result == []


class TestScenarioRoutes:
    """Tests for scenario API routes"""

    @pytest.fixture
    def app(self):
        """Create test app"""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_db(self):
        """Create mock database"""
        db = MagicMock()
        db.domain_scenarios = MagicMock()
        db.users = MagicMock()
        return db

    @pytest.fixture
    def mock_scenario_service(self):
        """Create mock scenario service"""
        return MagicMock()

    @pytest.fixture
    def mock_user_service(self):
        """Create mock user service"""
        return MagicMock()

    @pytest.fixture
    def mock_super_admin(self):
        """Create mock super admin user"""
        user = MagicMock()
        user.email = "admin@test.com"
        user.user_id = "user_123"
        user.roles = ["super-administrator"]
        return user

    @pytest.fixture
    def mock_regular_user(self):
        """Create mock regular user"""
        user = MagicMock()
        user.email = "user@test.com"
        user.user_id = "user_456"
        user.roles = ["user"]
        return user

    @pytest.fixture
    def mock_editor(self):
        """Create mock editor user"""
        user = MagicMock()
        user.email = "editor@test.com"
        user.user_id = "user_789"
        user.roles = ["administrator"]
        return user

    @pytest.fixture
    def client(self, app, mock_db, mock_scenario_service, mock_user_service, mock_super_admin):
        """Create test client with overridden dependencies"""
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_scenario_service] = lambda: mock_scenario_service
        app.dependency_overrides[get_user_service] = lambda: mock_user_service
        app.dependency_overrides[get_current_user] = lambda: mock_super_admin
        app.dependency_overrides[require_admin_or_editor] = lambda: mock_super_admin
        return TestClient(app)

    def test_get_all_scenarios_super_admin(self, client, mock_db):
        """Test get all scenarios as super admin"""
        scenarios = [
            {"key": "scenario-1", "dataDomain": "domain-a", "status": "A"},
            {"key": "scenario-2", "dataDomain": "domain-b", "status": "active"}
        ]

        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=scenarios)
        mock_db.domain_scenarios.find = MagicMock(return_value=mock_cursor)

        response = client.get("/scenarios/all")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_all_scenarios_regular_user(self, app, mock_db, mock_scenario_service, mock_user_service, mock_regular_user):
        """Test get all scenarios as regular user"""
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_scenario_service] = lambda: mock_scenario_service
        app.dependency_overrides[get_user_service] = lambda: mock_user_service
        app.dependency_overrides[get_current_user] = lambda: mock_regular_user

        # User is found and has domain access
        mock_db.users.find_one = AsyncMock(return_value={"email": "user@test.com"})
        mock_user_service.resolve_user_domains = AsyncMock(return_value=["domain-a"])

        scenarios = [{"key": "scenario-1", "dataDomain": "domain-a", "status": "A"}]
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=scenarios)
        mock_db.domain_scenarios.find = MagicMock(return_value=mock_cursor)

        client = TestClient(app)
        response = client.get("/scenarios/all")
        assert response.status_code == 200

    def test_get_all_scenarios_no_domains(self, app, mock_db, mock_scenario_service, mock_user_service, mock_regular_user):
        """Test get all scenarios with no accessible domains"""
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_scenario_service] = lambda: mock_scenario_service
        app.dependency_overrides[get_user_service] = lambda: mock_user_service
        app.dependency_overrides[get_current_user] = lambda: mock_regular_user

        # User not found
        mock_db.users.find_one = AsyncMock(return_value=None)

        client = TestClient(app)
        response = client.get("/scenarios/all")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_scenarios_by_domain(self, client, mock_db):
        """Test get scenarios by domain"""
        scenarios = [{"key": "scenario-1", "dataDomain": "domain-a", "status": "A"}]

        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=scenarios)
        mock_db.domain_scenarios.find = MagicMock(return_value=mock_cursor)

        response = client.get("/scenarios/all/domain-a")
        assert response.status_code == 200

    def test_get_scenarios_by_domain_no_access(self, app, mock_db, mock_scenario_service, mock_user_service, mock_regular_user):
        """Test get scenarios by domain when user has no access"""
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_scenario_service] = lambda: mock_scenario_service
        app.dependency_overrides[get_user_service] = lambda: mock_user_service
        app.dependency_overrides[get_current_user] = lambda: mock_regular_user

        mock_db.users.find_one = AsyncMock(return_value={"email": "user@test.com"})
        mock_user_service.resolve_user_domains = AsyncMock(return_value=["domain-b"])  # Has access to domain-b

        client = TestClient(app)
        response = client.get("/scenarios/all/domain-a")  # Requesting domain-a
        assert response.status_code == 403

    def test_get_scenarios_by_domain_empty_domains(self, app, mock_db, mock_scenario_service, mock_user_service, mock_regular_user):
        """Test get scenarios by domain with empty user domains"""
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_scenario_service] = lambda: mock_scenario_service
        app.dependency_overrides[get_user_service] = lambda: mock_user_service
        app.dependency_overrides[get_current_user] = lambda: mock_regular_user

        mock_db.users.find_one = AsyncMock(return_value=None)

        client = TestClient(app)
        response = client.get("/scenarios/all/domain-a")
        assert response.status_code == 200
        assert response.json() == []

    def test_create_scenario(self, client, mock_scenario_service):
        """Test create scenario endpoint"""
        result = {
            "key": "new-scenario",
            "name": "New Scenario",
            "dataDomain": "domain-a",
            "status": "A"
        }
        mock_scenario_service.save = AsyncMock(return_value=result)

        # ScenarioCreate requires: key, name, dataDomain
        scenario_data = {
            "key": "new-scenario",
            "name": "New Scenario",
            "dataDomain": "domain-a"
        }

        response = client.post("/scenarios", json=scenario_data)
        assert response.status_code == 201

    def test_create_scenario_error(self, client, mock_scenario_service):
        """Test create scenario with error"""
        mock_scenario_service.save = AsyncMock(side_effect=ScenarioError("Test error"))

        scenario_data = {
            "key": "new-scenario",
            "name": "New Scenario",
            "dataDomain": "domain-a"
        }

        response = client.post("/scenarios", json=scenario_data)
        assert response.status_code == 400

    def test_create_scenario_bad_error(self, client, mock_scenario_service):
        """Test create scenario with bad error"""
        mock_scenario_service.save = AsyncMock(side_effect=ScenarioBadError("Bad request"))

        scenario_data = {
            "key": "new-scenario",
            "name": "New Scenario",
            "dataDomain": "domain-a"
        }

        response = client.post("/scenarios", json=scenario_data)
        assert response.status_code == 400

    def test_update_scenario(self, client, mock_scenario_service):
        """Test update scenario endpoint"""
        result = {
            "key": "test-scenario",
            "name": "Test Scenario",
            "dataDomain": "domain-a",
            "status": "A"
        }
        mock_scenario_service.update = AsyncMock(return_value=result)

        response = client.put("/scenarios/test-scenario", json={"status": "active"})
        assert response.status_code == 200

    def test_update_scenario_id_mismatch(self, client, mock_scenario_service):
        """Test update scenario with id mismatch"""
        response = client.put("/scenarios/test-scenario", json={"id": "different-id"})
        assert response.status_code == 400
        assert "ID mismatch" in response.json()["detail"]

    def test_update_scenario_not_found(self, client, mock_scenario_service):
        """Test update scenario not found"""
        mock_scenario_service.update = AsyncMock(side_effect=ScenarioNotFoundError("Not found"))

        response = client.put("/scenarios/nonexistent", json={"status": "active"})
        assert response.status_code == 404

    def test_update_scenario_error(self, client, mock_scenario_service):
        """Test update scenario with error"""
        mock_scenario_service.update = AsyncMock(side_effect=ScenarioError("Update error"))

        response = client.put("/scenarios/test-scenario", json={"status": "active"})
        assert response.status_code == 400

    def test_get_scenario_by_key(self, client, mock_scenario_service, mock_db, mock_user_service):
        """Test get scenario by key"""
        result = {
            "key": "test-scenario",
            "name": "Test Scenario",
            "dataDomain": "domain-a",
            "status": "A"
        }
        mock_scenario_service.get = AsyncMock(return_value=result)

        response = client.get("/scenarios/test-scenario")
        assert response.status_code == 200

    def test_get_scenario_not_found(self, client, mock_scenario_service):
        """Test get scenario not found"""
        mock_scenario_service.get = AsyncMock(return_value=None)

        response = client.get("/scenarios/nonexistent")
        assert response.status_code == 404

    def test_get_scenario_domain_denied(self, app, mock_db, mock_scenario_service, mock_user_service, mock_regular_user):
        """Test get scenario when domain access denied"""
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_scenario_service] = lambda: mock_scenario_service
        app.dependency_overrides[get_user_service] = lambda: mock_user_service
        app.dependency_overrides[get_current_user] = lambda: mock_regular_user

        result = {
            "key": "test-scenario",
            "name": "Test Scenario",
            "dataDomain": "domain-a",
            "status": "A"
        }
        mock_scenario_service.get = AsyncMock(return_value=result)

        mock_db.users.find_one = AsyncMock(return_value={"email": "user@test.com"})
        mock_user_service.resolve_user_domains = AsyncMock(return_value=["domain-b"])

        client = TestClient(app)
        response = client.get("/scenarios/test-scenario")
        assert response.status_code == 403

    def test_get_scenario_service_not_found_error(self, client, mock_scenario_service):
        """Test get scenario raises ScenarioNotFoundError"""
        mock_scenario_service.get = AsyncMock(side_effect=ScenarioNotFoundError("Not found"))

        response = client.get("/scenarios/test-scenario")
        assert response.status_code == 404

    def test_delete_scenario(self, client, mock_scenario_service):
        """Test delete scenario endpoint"""
        mock_scenario_service.delete = AsyncMock(return_value={"message": "Scenario deleted"})

        response = client.delete("/scenarios/test-scenario")
        assert response.status_code == 200

    def test_delete_scenario_not_found(self, client, mock_scenario_service):
        """Test delete scenario not found"""
        mock_scenario_service.delete = AsyncMock(side_effect=ScenarioNotFoundError("Not found"))

        response = client.delete("/scenarios/nonexistent")
        assert response.status_code == 404

    def test_delete_scenario_error(self, client, mock_scenario_service):
        """Test delete scenario with error"""
        mock_scenario_service.delete = AsyncMock(side_effect=ScenarioError("Delete error"))

        response = client.delete("/scenarios/test-scenario")
        assert response.status_code == 400
