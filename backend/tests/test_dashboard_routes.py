"""Tests for Dashboard Routes"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
from bson import ObjectId
from datetime import datetime, timedelta

from easylifeauth.api.dashboard_routes import router
from easylifeauth.api.dependencies import get_db
from easylifeauth.security.access_control import require_super_admin, require_group_admin


class TestDashboardRoutes:
    """Tests for dashboard API routes"""

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
        db.users = MagicMock()
        db.roles = MagicMock()
        db.groups = MagicMock()
        db.domains = MagicMock()
        db.domain_scenarios = MagicMock()
        db.playboards = MagicMock()
        db.customers = MagicMock()
        db.configurations = MagicMock()
        db.permissions = MagicMock()
        db.activity_logs = MagicMock()
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
        app.dependency_overrides[require_group_admin] = lambda: mock_super_admin
        return TestClient(app)

    def test_get_dashboard_stats(self, client, mock_db):
        """Test get dashboard stats endpoint"""
        # Mock count_documents for all collections
        mock_db.users.count_documents = AsyncMock(side_effect=[10, 8])  # total, active
        mock_db.roles.count_documents = AsyncMock(return_value=5)
        mock_db.groups.count_documents = AsyncMock(return_value=3)
        mock_db.domains.count_documents = AsyncMock(return_value=2)
        mock_db.domain_scenarios.count_documents = AsyncMock(return_value=4)
        mock_db.playboards.count_documents = AsyncMock(return_value=6)
        mock_db.customers.count_documents = AsyncMock(return_value=15)
        mock_db.configurations.count_documents = AsyncMock(return_value=8)
        mock_db.permissions.count_documents = AsyncMock(return_value=12)

        # Mock activity logs cursor
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.__aiter__ = lambda self: self
        mock_cursor.__anext__ = AsyncMock(side_effect=StopAsyncIteration)
        mock_db.activity_logs.find = MagicMock(return_value=mock_cursor)

        response = client.get("/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "active_users" in data
        assert "total_roles" in data

    def test_get_dashboard_stats_with_activity_logs(self, client, mock_db):
        """Test get dashboard stats with activity logs"""
        mock_db.users.count_documents = AsyncMock(side_effect=[10, 8])
        mock_db.roles.count_documents = AsyncMock(return_value=5)
        mock_db.groups.count_documents = AsyncMock(return_value=3)
        mock_db.domains.count_documents = AsyncMock(return_value=2)
        mock_db.domain_scenarios.count_documents = AsyncMock(return_value=4)
        mock_db.playboards.count_documents = AsyncMock(return_value=6)
        mock_db.customers.count_documents = AsyncMock(return_value=15)
        mock_db.configurations.count_documents = AsyncMock(return_value=8)
        mock_db.permissions.count_documents = AsyncMock(return_value=12)

        activity_log = {"_id": ObjectId(), "action": "login", "timestamp": datetime.utcnow()}
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.__aiter__ = lambda self: self
        mock_cursor.__anext__ = AsyncMock(side_effect=[activity_log.copy(), StopAsyncIteration])
        mock_db.activity_logs.find = MagicMock(return_value=mock_cursor)

        response = client.get("/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert "recent_activities" in data

    def test_get_summary(self, client, mock_db):
        """Test get summary endpoint"""
        # Mock all count_documents calls
        mock_db.users.count_documents = AsyncMock(side_effect=[5, 3])  # active, inactive
        mock_db.roles.count_documents = AsyncMock(side_effect=[4, 1])
        mock_db.groups.count_documents = AsyncMock(side_effect=[3, 0])
        mock_db.customers.count_documents = AsyncMock(side_effect=[10, 2])
        mock_db.domains.count_documents = AsyncMock(side_effect=[2, 0])
        mock_db.domain_scenarios.count_documents = AsyncMock(side_effect=[4, 1])
        mock_db.configurations.count_documents = AsyncMock(side_effect=[3, 2, 1, 0])
        mock_db.playboards.count_documents = AsyncMock(side_effect=[5, 1])
        mock_db.permissions.distinct = AsyncMock(return_value=["users", "admin"])
        mock_db.permissions.count_documents = AsyncMock(side_effect=[3, 2])

        response = client.get("/dashboard/summary")
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        assert "roles" in data
        assert "groups" in data
        assert "customers" in data
        assert "domains" in data
        assert "scenarios" in data
        assert "configurations" in data
        assert "playboards" in data
        assert "permissions_by_module" in data

    def test_get_recent_logins(self, client, mock_db):
        """Test get recent logins endpoint"""
        user = {
            "_id": ObjectId(),
            "email": "user@test.com",
            "full_name": "Test User",
            "last_login": datetime.utcnow()
        }

        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.__aiter__ = lambda self: self
        mock_cursor.__anext__ = AsyncMock(side_effect=[user.copy(), StopAsyncIteration])
        mock_db.users.find = MagicMock(return_value=mock_cursor)

        response = client.get("/dashboard/recent-logins")
        assert response.status_code == 200
        data = response.json()
        assert "recent_logins" in data
        assert len(data["recent_logins"]) == 1

    def test_get_recent_logins_with_limit(self, client, mock_db):
        """Test get recent logins with custom limit"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.__aiter__ = lambda self: self
        mock_cursor.__anext__ = AsyncMock(side_effect=StopAsyncIteration)
        mock_db.users.find = MagicMock(return_value=mock_cursor)

        response = client.get("/dashboard/recent-logins?limit=5")
        assert response.status_code == 200

    def test_get_analytics(self, client, mock_db):
        """Test get analytics endpoint"""
        # Mock aggregation results
        mock_aggregate = MagicMock()
        mock_aggregate.to_list = AsyncMock(return_value=[])
        mock_db.users.aggregate = MagicMock(return_value=mock_aggregate)
        mock_db.activity_logs.aggregate = MagicMock(return_value=mock_aggregate)
        mock_db.permissions.aggregate = MagicMock(return_value=mock_aggregate)

        # Mock users find for role distribution - needs to return async to_list
        mock_users_find_for_roles = MagicMock()
        mock_users_find_for_roles.to_list = AsyncMock(return_value=[
            {"roles": ["admin", "user"]},
            {"roles": ["user"]},
            {"roles": []}
        ])

        # Mock recent signups cursor
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.__aiter__ = lambda self: self
        mock_cursor.__anext__ = AsyncMock(side_effect=StopAsyncIteration)

        # Users.find is called twice - once with roles projection, once for recent signups
        def users_find_side_effect(*args, **kwargs):
            if len(args) > 1 and "roles" in args[1]:
                return mock_users_find_for_roles
            return mock_cursor

        mock_db.users.find = MagicMock(side_effect=users_find_side_effect)

        response = client.get("/dashboard/analytics")
        assert response.status_code == 200
        data = response.json()
        assert "user_growth" in data
        assert "activity_trend" in data
        assert "role_distribution" in data
        assert "top_active_users" in data
        assert "permission_distribution" in data
        assert "recent_signups" in data

    def test_get_analytics_with_data(self, client, mock_db):
        """Test get analytics with actual data"""
        # Mock user growth aggregation
        user_growth_results = [
            {"_id": "2024-01-01", "count": 5},
            {"_id": "2024-01-02", "count": 3}
        ]
        mock_user_aggregate = MagicMock()
        mock_user_aggregate.to_list = AsyncMock(return_value=user_growth_results)
        mock_db.users.aggregate = MagicMock(return_value=mock_user_aggregate)

        # Mock activity logs aggregation
        activity_results = [{"_id": "2024-01-01", "count": 10}]
        mock_activity_aggregate = MagicMock()
        mock_activity_aggregate.to_list = AsyncMock(return_value=activity_results)
        mock_db.activity_logs.aggregate = MagicMock(return_value=mock_activity_aggregate)

        # Mock permissions aggregation
        permissions_results = [{"_id": "users", "count": 5}]
        mock_permissions_aggregate = MagicMock()
        mock_permissions_aggregate.to_list = AsyncMock(return_value=permissions_results)
        mock_db.permissions.aggregate = MagicMock(return_value=mock_permissions_aggregate)

        # Mock users find for role distribution
        mock_users_find = MagicMock()
        mock_users_find.to_list = AsyncMock(return_value=[
            {"roles": ["admin", "user"]},
            {"roles": ["user"]}
        ])

        # Mock recent signups cursor
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.__aiter__ = lambda self: self
        mock_cursor.__anext__ = AsyncMock(side_effect=[
            {"email": "user@test.com", "full_name": "Test User", "created_at": datetime.utcnow()},
            StopAsyncIteration
        ])

        # Override find to return appropriate mock based on call
        def users_find_side_effect(*args, **kwargs):
            if len(args) > 1 and "roles" in args[1]:
                return mock_users_find
            return mock_cursor

        mock_db.users.find = MagicMock(side_effect=users_find_side_effect)

        response = client.get("/dashboard/analytics")
        assert response.status_code == 200


class TestDashboardRoutesWithoutOptionalCollections:
    """Tests for dashboard routes when optional collections don't exist"""

    @pytest.fixture
    def app(self):
        """Create test app"""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_db_minimal(self):
        """Create mock database without optional collections"""
        db = MagicMock()
        db.users = MagicMock()
        db.roles = MagicMock()
        db.groups = MagicMock()
        db.domains = MagicMock()
        db.domain_scenarios = MagicMock()
        db.playboards = MagicMock()
        # Don't add customers, configurations, permissions, activity_logs
        del db.customers
        del db.configurations
        del db.permissions
        del db.activity_logs
        return db

    @pytest.fixture
    def mock_super_admin(self):
        """Create mock super admin user"""
        user = MagicMock()
        user.email = "admin@test.com"
        user.roles = ["super-administrator"]
        return user

    @pytest.fixture
    def client(self, app, mock_db_minimal, mock_super_admin):
        """Create test client with minimal db"""
        app.dependency_overrides[get_db] = lambda: mock_db_minimal
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        app.dependency_overrides[require_group_admin] = lambda: mock_super_admin
        return TestClient(app)

    def test_get_dashboard_stats_minimal(self, client, mock_db_minimal):
        """Test get dashboard stats without optional collections"""
        mock_db_minimal.users.count_documents = AsyncMock(side_effect=[10, 8])
        mock_db_minimal.roles.count_documents = AsyncMock(return_value=5)
        mock_db_minimal.groups.count_documents = AsyncMock(return_value=3)
        mock_db_minimal.domains.count_documents = AsyncMock(return_value=2)
        mock_db_minimal.domain_scenarios.count_documents = AsyncMock(return_value=4)
        mock_db_minimal.playboards.count_documents = AsyncMock(return_value=6)

        response = client.get("/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total_customers"] == 0
        assert data["total_configurations"] == 0

    def test_get_summary_minimal(self, client, mock_db_minimal):
        """Test get summary without optional collections"""
        mock_db_minimal.users.count_documents = AsyncMock(side_effect=[5, 3])
        mock_db_minimal.roles.count_documents = AsyncMock(side_effect=[4, 1])
        mock_db_minimal.groups.count_documents = AsyncMock(side_effect=[3, 0])
        mock_db_minimal.domains.count_documents = AsyncMock(side_effect=[2, 0])
        mock_db_minimal.domain_scenarios.count_documents = AsyncMock(side_effect=[4, 1])
        mock_db_minimal.playboards.count_documents = AsyncMock(side_effect=[5, 1])

        response = client.get("/dashboard/summary")
        assert response.status_code == 200
        data = response.json()
        assert data["customers"] == {"active": 0, "inactive": 0}

    def test_get_analytics_minimal(self, client, mock_db_minimal):
        """Test get analytics without optional collections"""
        mock_aggregate = MagicMock()
        mock_aggregate.to_list = AsyncMock(return_value=[])
        mock_db_minimal.users.aggregate = MagicMock(return_value=mock_aggregate)

        mock_users_find = MagicMock()
        mock_users_find.to_list = AsyncMock(return_value=[])

        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.__aiter__ = lambda self: self
        mock_cursor.__anext__ = AsyncMock(side_effect=StopAsyncIteration)

        def users_find_side_effect(*args, **kwargs):
            if len(args) > 1 and "roles" in args[1]:
                return mock_users_find
            return mock_cursor

        mock_db_minimal.users.find = MagicMock(side_effect=users_find_side_effect)

        response = client.get("/dashboard/analytics")
        assert response.status_code == 200
        data = response.json()
        assert data["activity_trend"] == []
        assert data["top_active_users"] == []
        assert data["permission_distribution"] == []
