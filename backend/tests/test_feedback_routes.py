"""Tests for Feedback Routes"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
from bson import ObjectId
from datetime import datetime

from easylifeauth.api.feedback_routes import router
from easylifeauth.api.dependencies import get_current_user, get_feedback_service
from easylifeauth.security.access_control import require_admin
from easylifeauth.errors.auth_error import AuthError


class TestFeedbackRoutes:
    """Tests for feedback API routes"""

    @pytest.fixture
    def app(self):
        """Create test app"""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_feedback_service(self):
        """Create mock feedback service"""
        return MagicMock()

    @pytest.fixture
    def mock_user(self):
        """Create mock user"""
        user = MagicMock()
        user.email = "user@test.com"
        user.user_id = "user_123"
        user.roles = ["user"]
        return user

    @pytest.fixture
    def mock_admin(self):
        """Create mock admin user"""
        user = MagicMock()
        user.email = "admin@test.com"
        user.user_id = "admin_123"
        user.roles = ["administrator"]
        return user

    @pytest.fixture
    def client(self, app, mock_feedback_service, mock_user):
        """Create test client with user dependencies"""
        app.dependency_overrides[get_feedback_service] = lambda: mock_feedback_service
        app.dependency_overrides[get_current_user] = lambda: mock_user
        return TestClient(app)

    @pytest.fixture
    def admin_client(self, app, mock_feedback_service, mock_admin):
        """Create test client with admin dependencies"""
        app.dependency_overrides[get_feedback_service] = lambda: mock_feedback_service
        app.dependency_overrides[get_current_user] = lambda: mock_admin
        app.dependency_overrides[require_admin] = lambda: mock_admin
        return TestClient(app)

    def test_create_public_feedback(self, client, mock_feedback_service):
        """Test create public feedback endpoint"""
        result = {
            "id": str(ObjectId()),
            "rating": 5,
            "feedback": "Great app!",
            "email": "anonymous@test.com"
        }
        mock_feedback_service.save_public = AsyncMock(return_value=result)

        feedback_data = {
            "rating": 5,
            "feedback": "Great app!",
            "email": "anonymous@test.com"
        }

        response = client.post("/feedback/public", json=feedback_data)
        assert response.status_code == 201

    def test_create_public_feedback_error(self, client, mock_feedback_service):
        """Test create public feedback with error"""
        mock_feedback_service.save_public = AsyncMock(side_effect=AuthError("Error"))

        feedback_data = {
            "rating": 5,
            "feedback": "Great app!",
            "email": "anonymous@test.com"
        }

        response = client.post("/feedback/public", json=feedback_data)
        assert response.status_code == 400

    def test_get_feedback_stats_admin(self, admin_client, mock_feedback_service):
        """Test get feedback stats as admin"""
        result = {
            "total_feedback": 100,
            "avg_rating": 4.5,
            "this_week_count": 10,
            "rating_distribution": {
                "1": 5,
                "2": 10,
                "3": 15,
                "4": 30,
                "5": 40
            }
        }
        mock_feedback_service.get_stats = AsyncMock(return_value=result)

        response = admin_client.get("/feedback/stats")
        assert response.status_code == 200
        data = response.json()
        assert "total_feedback" in data

    def test_get_feedback_stats_forbidden(self, client, mock_feedback_service):
        """Test get feedback stats without admin role"""
        response = client.get("/feedback/stats")
        assert response.status_code == 403
        assert "Administrator access required" in response.json()["detail"]

    def test_get_feedback_stats_error(self, admin_client, mock_feedback_service):
        """Test get feedback stats with error"""
        mock_feedback_service.get_stats = AsyncMock(side_effect=AuthError("Error"))

        response = admin_client.get("/feedback/stats")
        assert response.status_code == 400

    def test_get_all_feedback(self, client, mock_feedback_service, mock_user):
        """Test get all feedback endpoint"""
        result = [
            {"id": str(ObjectId()), "rating": 5, "feedback": "Great!"},
            {"id": str(ObjectId()), "rating": 4, "feedback": "Good!"}
        ]
        mock_feedback_service.get_all = AsyncMock(return_value=result)

        response = client.get("/feedback/all")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_get_all_feedback_error(self, client, mock_feedback_service):
        """Test get all feedback with error"""
        mock_feedback_service.get_all = AsyncMock(side_effect=AuthError("Error"))

        response = client.get("/feedback/all")
        assert response.status_code == 400

    def test_get_admin_feedback_list(self, admin_client, mock_feedback_service):
        """Test get admin feedback list with pagination"""
        result = {
            "data": [
                {"id": str(ObjectId()), "rating": 5, "feedback": "Great!"},
                {"id": str(ObjectId()), "rating": 4, "feedback": "Good!"}
            ],
            "pagination": {"total": 2, "page": 0, "limit": 25}
        }
        mock_feedback_service.get_paginated = AsyncMock(return_value=result)

        response = admin_client.get("/feedback/admin/list")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data

    def test_get_admin_feedback_list_with_filters(self, admin_client, mock_feedback_service):
        """Test get admin feedback list with filters"""
        result = {"data": [], "pagination": {"total": 0, "page": 0, "limit": 25}}
        mock_feedback_service.get_paginated = AsyncMock(return_value=result)

        response = admin_client.get(
            "/feedback/admin/list?page=1&limit=10&search=test&rating=5&sort_by=rating&sort_order=asc"
        )
        assert response.status_code == 200

    def test_get_admin_feedback_list_forbidden(self, client, mock_feedback_service):
        """Test get admin feedback list without admin role"""
        response = client.get("/feedback/admin/list")
        assert response.status_code == 403

    def test_get_admin_feedback_list_error(self, admin_client, mock_feedback_service):
        """Test get admin feedback list with error"""
        mock_feedback_service.get_paginated = AsyncMock(side_effect=AuthError("Error"))

        response = admin_client.get("/feedback/admin/list")
        assert response.status_code == 400

    def test_create_feedback(self, client, mock_feedback_service, mock_user):
        """Test create feedback (authenticated)"""
        result = {
            "id": str(ObjectId()),
            "rating": 5,
            "feedback": "Great app!",
            "user_id": "user_123",
            "email": "user@test.com"
        }
        mock_feedback_service.save = AsyncMock(return_value=result)

        feedback_data = {
            "rating": 5,
            "feedback": "Great app!"
        }

        response = client.post("/feedback", json=feedback_data)
        assert response.status_code == 201

    def test_create_feedback_error(self, client, mock_feedback_service):
        """Test create feedback with error"""
        mock_feedback_service.save = AsyncMock(side_effect=AuthError("Error"))

        feedback_data = {
            "rating": 5,
            "feedback": "Great app!"
        }

        response = client.post("/feedback", json=feedback_data)
        assert response.status_code == 400

    def test_update_feedback(self, client, mock_feedback_service, mock_user):
        """Test update feedback endpoint"""
        feedback_id = str(ObjectId())
        result = {
            "id": feedback_id,
            "rating": 4,
            "improvements": "Updated improvements"
        }
        mock_feedback_service.get = AsyncMock(return_value={
            "id": feedback_id, "user_id": mock_user.user_id, "email": mock_user.email
        })
        mock_feedback_service.update = AsyncMock(return_value=result)

        response = client.put(
            f"/feedback/{feedback_id}",
            json={"feedback_id": feedback_id, "rating": 4, "improvements": "Updated improvements"}
        )
        assert response.status_code == 200

    def test_update_feedback_error(self, client, mock_feedback_service, mock_user):
        """Test update feedback with error"""
        feedback_id = str(ObjectId())
        mock_feedback_service.get = AsyncMock(return_value={
            "id": feedback_id, "user_id": mock_user.user_id, "email": mock_user.email
        })
        mock_feedback_service.update = AsyncMock(side_effect=AuthError("Not found", 404))

        response = client.put(
            f"/feedback/{feedback_id}",
            json={"feedback_id": feedback_id, "rating": 4}
        )
        assert response.status_code == 404

    def test_get_feedback_by_id(self, client, mock_feedback_service):
        """Test get feedback by ID"""
        feedback_id = str(ObjectId())
        result = {
            "id": feedback_id,
            "rating": 5,
            "feedback": "Great!"
        }
        mock_feedback_service.get = AsyncMock(return_value=result)

        response = client.get(f"/feedback/{feedback_id}")
        assert response.status_code == 200

    def test_get_feedback_by_id_error(self, client, mock_feedback_service):
        """Test get feedback by ID with error"""
        mock_feedback_service.get = AsyncMock(side_effect=AuthError("Not found", 404))

        response = client.get(f"/feedback/{ObjectId()}")
        assert response.status_code == 404


class TestFeedbackRoutesSuperAdmin:
    """Tests for feedback routes with super admin user"""

    @pytest.fixture
    def app(self):
        """Create test app"""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_feedback_service(self):
        """Create mock feedback service"""
        return MagicMock()

    @pytest.fixture
    def mock_super_admin(self):
        """Create mock super admin user"""
        user = MagicMock()
        user.email = "superadmin@test.com"
        user.user_id = "superadmin_123"
        user.roles = ["super-administrator"]
        return user

    @pytest.fixture
    def client(self, app, mock_feedback_service, mock_super_admin):
        """Create test client with super admin"""
        app.dependency_overrides[get_feedback_service] = lambda: mock_feedback_service
        app.dependency_overrides[get_current_user] = lambda: mock_super_admin
        app.dependency_overrides[require_admin] = lambda: mock_super_admin
        return TestClient(app)

    def test_get_feedback_stats_super_admin(self, client, mock_feedback_service):
        """Test get feedback stats as super admin"""
        result = {"total": 50, "average_rating": 4.0}
        mock_feedback_service.get_stats = AsyncMock(return_value=result)

        response = client.get("/feedback/stats")
        assert response.status_code == 200

    def test_get_admin_feedback_list_super_admin(self, client, mock_feedback_service):
        """Test get admin feedback list as super admin"""
        result = {"data": [], "pagination": {"total": 0}}
        mock_feedback_service.get_paginated = AsyncMock(return_value=result)

        response = client.get("/feedback/admin/list")
        assert response.status_code == 200
