"""Tests for Export Routes"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
from bson import ObjectId
from datetime import datetime

from easylifeauth.api.export_routes import (
    router,
    serialize_document,
    flatten_dict,
    create_csv_response,
    create_json_response
)
from easylifeauth.api.dependencies import get_db
from easylifeauth.security.access_control import require_super_admin


class TestHelperFunctions:
    """Tests for helper functions"""

    def test_serialize_document_dict(self):
        """Test serialize_document with dict"""
        doc = {"name": "Test", "value": 123}
        result = serialize_document(doc)
        assert result["name"] == "Test"
        assert result["value"] == 123

    def test_serialize_document_datetime(self):
        """Test serialize_document with datetime"""
        now = datetime.utcnow()
        doc = {"timestamp": now}
        result = serialize_document(doc)
        assert result["timestamp"] == now.isoformat()

    def test_serialize_document_list(self):
        """Test serialize_document with list"""
        doc = {"items": [1, 2, 3]}
        result = serialize_document(doc)
        assert result["items"] == [1, 2, 3]

    def test_serialize_document_nested(self):
        """Test serialize_document with nested structure"""
        doc = {"outer": {"inner": "value"}}
        result = serialize_document(doc)
        assert result["outer"]["inner"] == "value"

    def test_serialize_document_objectid(self):
        """Test serialize_document with ObjectId"""
        # ObjectId has __dict__ attribute, so serialize_document converts using str()
        # But the actual function doesn't handle ObjectId specially - it remains unchanged
        # The conversion happens in get_collection_data, not serialize_document
        obj_id = ObjectId()
        doc = {"_id": obj_id}
        result = serialize_document(doc)
        # serialize_document doesn't convert ObjectId - it only handles dict, list, datetime
        # ObjectId doesn't match any condition and passes through unchanged
        # The actual ObjectId conversion happens in get_collection_data
        assert result["_id"] == obj_id  # ObjectId passes through unchanged

    def test_flatten_dict_simple(self):
        """Test flatten_dict with simple dict"""
        doc = {"name": "Test", "value": 123}
        result = flatten_dict(doc)
        assert result["name"] == "Test"
        assert result["value"] == 123

    def test_flatten_dict_nested(self):
        """Test flatten_dict with nested dict"""
        doc = {"outer": {"inner": "value"}}
        result = flatten_dict(doc)
        assert result["outer_inner"] == "value"

    def test_flatten_dict_list(self):
        """Test flatten_dict with list"""
        doc = {"items": [1, 2, 3]}
        result = flatten_dict(doc)
        assert result["items"] == "1, 2, 3"

    def test_flatten_dict_deeply_nested(self):
        """Test flatten_dict with deeply nested structure"""
        doc = {"level1": {"level2": {"level3": "value"}}}
        result = flatten_dict(doc)
        assert result["level1_level2_level3"] == "value"

    def test_create_csv_response(self):
        """Test create_csv_response"""
        documents = [
            {"name": "Test1", "value": 1},
            {"name": "Test2", "value": 2}
        ]
        response = create_csv_response(documents, "test.csv")
        assert response.media_type == "text/csv"
        assert "test.csv" in response.headers["content-disposition"]

    def test_create_csv_response_empty(self):
        """Test create_csv_response with empty list"""
        with pytest.raises(Exception):  # HTTPException
            create_csv_response([], "test.csv")

    def test_create_json_response(self):
        """Test create_json_response"""
        documents = [
            {"name": "Test1", "value": 1},
            {"name": "Test2", "value": 2}
        ]
        response = create_json_response(documents, "test.json")
        assert response.media_type == "application/json"
        assert "test.json" in response.headers["content-disposition"]

    def test_create_json_response_empty(self):
        """Test create_json_response with empty list"""
        with pytest.raises(Exception):  # HTTPException
            create_json_response([], "test.json")


class TestExportRoutes:
    """Tests for export API routes"""

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
        db.db = MagicMock()
        return db

    @pytest.fixture
    def mock_super_admin(self):
        """Create mock super admin user"""
        user = MagicMock()
        user.email = "admin@test.com"
        user.roles = ["super-administrator"]
        return user

    @pytest.fixture
    def client(self, app, mock_db, mock_super_admin):
        """Create test client with overridden dependencies"""
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        return TestClient(app)

    def _create_mock_cursor(self, documents):
        """Helper to create async cursor mock"""
        async def async_iter():
            for doc in documents:
                yield doc

        mock_cursor = MagicMock()
        mock_cursor.__aiter__ = lambda self: async_iter()
        return mock_cursor

    def test_export_users_csv(self, client, mock_db):
        """Test export users to CSV"""
        users = [
            {"_id": ObjectId(), "email": "user1@test.com", "name": "User 1"},
            {"_id": ObjectId(), "email": "user2@test.com", "name": "User 2"}
        ]

        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(users))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/users/csv")
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]

    def test_export_users_csv_with_filter(self, client, mock_db):
        """Test export users to CSV with filter"""
        users = [{"_id": ObjectId(), "email": "user1@test.com", "is_active": True}]

        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(users))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/users/csv?is_active=true")
        assert response.status_code == 200

    def test_export_users_json(self, client, mock_db):
        """Test export users to JSON"""
        users = [
            {"_id": ObjectId(), "email": "user1@test.com", "name": "User 1"},
            {"_id": ObjectId(), "email": "user2@test.com", "name": "User 2"}
        ]

        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(users))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/users/json")
        assert response.status_code == 200
        assert "application/json" in response.headers["content-type"]

    def test_export_roles_csv(self, client, mock_db):
        """Test export roles to CSV"""
        roles = [{"_id": ObjectId(), "name": "Admin", "status": "A"}]

        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(roles))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/roles/csv")
        assert response.status_code == 200

    def test_export_roles_json(self, client, mock_db):
        """Test export roles to JSON"""
        roles = [{"_id": ObjectId(), "name": "Admin", "status": "A"}]

        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(roles))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/roles/json")
        assert response.status_code == 200

    def test_export_groups_csv(self, client, mock_db):
        """Test export groups to CSV"""
        groups = [{"_id": ObjectId(), "name": "Dev Team", "status": "A"}]

        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(groups))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/groups/csv")
        assert response.status_code == 200

    def test_export_groups_json(self, client, mock_db):
        """Test export groups to JSON"""
        groups = [{"_id": ObjectId(), "name": "Dev Team", "status": "A"}]

        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(groups))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/groups/json")
        assert response.status_code == 200

    def test_export_domains_csv(self, client, mock_db):
        """Test export domains to CSV"""
        domains = [{"_id": ObjectId(), "key": "sales", "name": "Sales Domain"}]

        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(domains))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/domains/csv")
        assert response.status_code == 200

    def test_export_domains_json(self, client, mock_db):
        """Test export domains to JSON"""
        domains = [{"_id": ObjectId(), "key": "sales", "name": "Sales Domain"}]

        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(domains))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/domains/json")
        assert response.status_code == 200

    def test_export_scenarios_csv(self, client, mock_db):
        """Test export scenarios to CSV"""
        scenarios = [{"_id": ObjectId(), "key": "scenario-1", "name": "Test Scenario"}]

        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(scenarios))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/scenarios/csv")
        assert response.status_code == 200

    def test_export_scenarios_json(self, client, mock_db):
        """Test export scenarios to JSON"""
        scenarios = [{"_id": ObjectId(), "key": "scenario-1", "name": "Test Scenario"}]

        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(scenarios))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/scenarios/json")
        assert response.status_code == 200

    def test_export_scenarios_with_filters(self, client, mock_db):
        """Test export scenarios with filters"""
        scenarios = [{"_id": ObjectId(), "key": "scenario-1", "domainKey": "sales"}]

        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(scenarios))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/scenarios/csv?status=A&domain_key=sales")
        assert response.status_code == 200

    def test_export_activity_logs_csv(self, client, mock_db):
        """Test export activity logs to CSV"""
        logs = [{"_id": ObjectId(), "action": "create", "entity_type": "user"}]

        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(logs))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/activity-logs/csv")
        assert response.status_code == 200

    def test_export_activity_logs_json(self, client, mock_db):
        """Test export activity logs to JSON"""
        logs = [{"_id": ObjectId(), "action": "create", "entity_type": "user"}]

        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(logs))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/activity-logs/json")
        assert response.status_code == 200

    def test_export_activity_logs_with_days_filter(self, client, mock_db):
        """Test export activity logs with days filter"""
        logs = [{"_id": ObjectId(), "action": "create", "entity_type": "user"}]

        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(logs))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/activity-logs/csv?days=7")
        assert response.status_code == 200

    def test_export_no_db_attribute(self, app, mock_super_admin):
        """Test export when db has no db attribute"""
        mock_db = MagicMock(spec=[])  # No attributes

        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        client = TestClient(app)

        response = client.get("/export/users/csv")
        assert response.status_code == 404  # No data to export


class TestExportRoutesEmptyData:
    """Tests for export routes with empty data"""

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
        db.db = MagicMock()
        return db

    @pytest.fixture
    def mock_super_admin(self):
        """Create mock super admin user"""
        user = MagicMock()
        user.email = "admin@test.com"
        user.roles = ["super-administrator"]
        return user

    @pytest.fixture
    def client(self, app, mock_db, mock_super_admin):
        """Create test client with overridden dependencies"""
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        return TestClient(app)

    def _create_empty_cursor(self):
        """Helper to create empty async cursor mock"""
        async def async_iter():
            return
            yield

        mock_cursor = MagicMock()
        mock_cursor.__aiter__ = lambda self: async_iter()
        return mock_cursor

    def test_export_empty_users_csv(self, client, mock_db):
        """Test export empty users to CSV"""
        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_empty_cursor())
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/users/csv")
        assert response.status_code == 404
        assert "No data to export" in response.json()["detail"]

    def test_export_empty_roles_json(self, client, mock_db):
        """Test export empty roles to JSON"""
        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_empty_cursor())
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/export/roles/json")
        assert response.status_code == 404
