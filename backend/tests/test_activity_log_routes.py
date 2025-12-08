"""Tests for Activity Log Routes"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
from bson import ObjectId
from datetime import datetime

from easylifeauth.api.activity_log_routes import router, create_pagination_meta
from easylifeauth.api.dependencies import get_db
from easylifeauth.security.access_control import require_super_admin


class TestHelperFunctions:
    """Tests for helper functions"""

    def test_create_pagination_meta(self):
        """Test create_pagination_meta"""
        meta = create_pagination_meta(100, 0, 25)
        assert meta["total"] == 100
        assert meta["page"] == 0
        assert meta["limit"] == 25
        assert meta["pages"] == 4
        assert meta["has_next"] is True
        assert meta["has_prev"] is False

    def test_create_pagination_meta_last_page(self):
        """Test create_pagination_meta on last page"""
        meta = create_pagination_meta(100, 3, 25)
        assert meta["has_next"] is False
        assert meta["has_prev"] is True

    def test_create_pagination_meta_zero_limit(self):
        """Test create_pagination_meta with zero limit"""
        meta = create_pagination_meta(100, 0, 0)
        assert meta["pages"] == 0


class TestActivityLogRoutes:
    """Tests for activity log API routes"""

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
                yield doc.copy()

        mock_cursor = MagicMock()
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.__aiter__ = lambda self: async_iter()
        return mock_cursor

    def test_list_activity_logs(self, client, mock_db):
        """Test list activity logs endpoint"""
        logs = [
            {
                "_id": ObjectId(),
                "action": "create",
                "entity_type": "user",
                "user_email": "admin@test.com",
                "timestamp": datetime.utcnow()
            }
        ]

        mock_collection = MagicMock()
        mock_collection.count_documents = AsyncMock(return_value=1)
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(logs))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/activity-logs")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data

    def test_list_activity_logs_with_filters(self, client, mock_db):
        """Test list activity logs with filters"""
        logs = []

        mock_collection = MagicMock()
        mock_collection.count_documents = AsyncMock(return_value=0)
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(logs))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get(
            "/activity-logs?entity_type=user&action=create&user_email=admin@test.com&entity_id=123&days=7"
        )
        assert response.status_code == 200

    def test_list_activity_logs_no_collection(self, app, mock_super_admin):
        """Test list activity logs when collection doesn't exist"""
        mock_db = MagicMock(spec=[])  # No db attribute

        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        client = TestClient(app)

        response = client.get("/activity-logs")
        assert response.status_code == 200
        data = response.json()
        assert data["data"] == []

    def test_get_activity_stats(self, client, mock_db):
        """Test get activity stats endpoint"""
        action_stats = [{"_id": "create", "count": 10}]
        entity_stats = [{"_id": "user", "count": 5}]
        user_stats = [{"_id": "admin@test.com", "count": 15}]
        timeline = [{"_id": "2024-01-01", "count": 3}]

        mock_aggregate_action = MagicMock()
        mock_aggregate_action.to_list = AsyncMock(return_value=action_stats)

        mock_aggregate_entity = MagicMock()
        mock_aggregate_entity.to_list = AsyncMock(return_value=entity_stats)

        mock_aggregate_user = MagicMock()
        mock_aggregate_user.to_list = AsyncMock(return_value=user_stats)

        mock_aggregate_timeline = MagicMock()
        mock_aggregate_timeline.to_list = AsyncMock(return_value=timeline)

        mock_collection = MagicMock()
        mock_collection.aggregate = MagicMock(side_effect=[
            mock_aggregate_action,
            mock_aggregate_entity,
            mock_aggregate_user,
            mock_aggregate_timeline
        ])
        mock_collection.count_documents = AsyncMock(return_value=100)
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/activity-logs/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_activities" in data
        assert "actions" in data
        assert "entities" in data
        assert "top_users" in data
        assert "timeline" in data

    def test_get_activity_stats_with_days(self, client, mock_db):
        """Test get activity stats with days parameter"""
        mock_aggregate = MagicMock()
        mock_aggregate.to_list = AsyncMock(return_value=[])

        mock_collection = MagicMock()
        mock_collection.aggregate = MagicMock(return_value=mock_aggregate)
        mock_collection.count_documents = AsyncMock(return_value=0)
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/activity-logs/stats?days=30")
        assert response.status_code == 200

    def test_get_activity_stats_no_collection(self, app, mock_super_admin):
        """Test get activity stats when collection doesn't exist"""
        mock_db = MagicMock(spec=[])

        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        client = TestClient(app)

        response = client.get("/activity-logs/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_activities"] == 0

    def test_get_entity_history(self, client, mock_db):
        """Test get entity history endpoint"""
        logs = [
            {
                "_id": ObjectId(),
                "action": "create",
                "entity_type": "user",
                "entity_id": "user_123"
            },
            {
                "_id": ObjectId(),
                "action": "update",
                "entity_type": "user",
                "entity_id": "user_123"
            }
        ]

        mock_collection = MagicMock()
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(logs))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/activity-logs/entity/user/user_123")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "total" in data
        assert data["total"] == 2

    def test_get_entity_history_no_collection(self, app, mock_super_admin):
        """Test get entity history when collection doesn't exist"""
        mock_db = MagicMock(spec=[])

        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        client = TestClient(app)

        response = client.get("/activity-logs/entity/user/user_123")
        assert response.status_code == 200
        data = response.json()
        assert data["data"] == []
        assert data["total"] == 0

    def test_get_user_activity(self, client, mock_db):
        """Test get user activity endpoint"""
        logs = [
            {
                "_id": ObjectId(),
                "action": "login",
                "user_email": "user@test.com"
            }
        ]

        mock_collection = MagicMock()
        mock_collection.count_documents = AsyncMock(return_value=1)
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(logs))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/activity-logs/user/user@test.com")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data

    def test_get_user_activity_with_pagination(self, client, mock_db):
        """Test get user activity with pagination"""
        logs = []

        mock_collection = MagicMock()
        mock_collection.count_documents = AsyncMock(return_value=0)
        mock_collection.find = MagicMock(return_value=self._create_mock_cursor(logs))
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/activity-logs/user/user@test.com?page=1&limit=10")
        assert response.status_code == 200

    def test_get_user_activity_no_collection(self, app, mock_super_admin):
        """Test get user activity when collection doesn't exist"""
        mock_db = MagicMock(spec=[])

        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        client = TestClient(app)

        response = client.get("/activity-logs/user/user@test.com")
        assert response.status_code == 200
        data = response.json()
        assert data["data"] == []

    def test_cleanup_old_logs(self, client, mock_db):
        """Test cleanup old logs endpoint"""
        mock_result = MagicMock()
        mock_result.deleted_count = 50

        mock_collection = MagicMock()
        mock_collection.delete_many = AsyncMock(return_value=mock_result)
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.delete("/activity-logs/cleanup?days=90")
        assert response.status_code == 200
        data = response.json()
        assert "deleted_count" in data
        assert data["deleted_count"] == 50

    def test_cleanup_old_logs_no_collection(self, app, mock_super_admin):
        """Test cleanup old logs when collection doesn't exist"""
        mock_db = MagicMock(spec=[])

        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        client = TestClient(app)

        response = client.delete("/activity-logs/cleanup?days=90")
        assert response.status_code == 200
        data = response.json()
        assert data["deleted_count"] == 0

    def test_get_available_actions(self, client, mock_db):
        """Test get available actions endpoint"""
        mock_collection = MagicMock()
        mock_collection.distinct = AsyncMock(return_value=["create", "update", "delete"])
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/activity-logs/actions")
        assert response.status_code == 200
        data = response.json()
        assert "actions" in data
        assert len(data["actions"]) == 3

    def test_get_available_actions_no_collection(self, app, mock_super_admin):
        """Test get available actions when collection doesn't exist"""
        mock_db = MagicMock(spec=[])

        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        client = TestClient(app)

        response = client.get("/activity-logs/actions")
        assert response.status_code == 200
        data = response.json()
        assert data["actions"] == []

    def test_get_available_entity_types(self, client, mock_db):
        """Test get available entity types endpoint"""
        mock_collection = MagicMock()
        mock_collection.distinct = AsyncMock(return_value=["user", "role", "group"])
        mock_db.db.__getitem__ = MagicMock(return_value=mock_collection)

        response = client.get("/activity-logs/entity-types")
        assert response.status_code == 200
        data = response.json()
        assert "entity_types" in data
        assert len(data["entity_types"]) == 3

    def test_get_available_entity_types_no_collection(self, app, mock_super_admin):
        """Test get available entity types when collection doesn't exist"""
        mock_db = MagicMock(spec=[])

        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        client = TestClient(app)

        response = client.get("/activity-logs/entity-types")
        assert response.status_code == 200
        data = response.json()
        assert data["entity_types"] == []
