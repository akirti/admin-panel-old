"""Tests for Distribution List Routes"""
import pytest
from unittest.mock import AsyncMock, MagicMock, PropertyMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
from bson import ObjectId
from datetime import datetime

from easylifeauth.api.distribution_list_routes import (
    router,
    get_distribution_list_service,
)
from easylifeauth.api.dependencies import get_db
from easylifeauth.security.access_control import (
    get_current_user,
    require_super_admin,
    require_group_admin,
)


# --- Sample data factories ---

def make_dist_list_dict(**overrides):
    """Return a minimal distribution list dict suitable for DistributionListInDB."""
    base = {
        "_id": str(ObjectId()),
        "key": "test-list",
        "name": "Test Distribution List",
        "description": "A test distribution list",
        "type": "custom",
        "emails": ["user1@test.com", "user2@test.com"],
        "is_active": True,
        "created_at": datetime.utcnow().isoformat(),
        "created_by": "admin@test.com",
        "updated_at": None,
        "updated_by": None,
    }
    base.update(overrides)
    return base


def make_create_payload(**overrides):
    """Return a valid payload for creating a distribution list."""
    base = {
        "key": "new-list",
        "name": "New Distribution List",
        "description": "A new list",
        "type": "custom",
        "emails": ["new1@test.com", "new2@test.com"],
        "is_active": True,
    }
    base.update(overrides)
    return base


class _AsyncCursorMock:
    """Helper to mock an async MongoDB cursor that supports chaining and async iteration."""

    def __init__(self, items):
        self._items = items
        self._index = 0

    def skip(self, n):
        return self

    def limit(self, n):
        return self

    def sort(self, *args, **kwargs):
        return self

    def __aiter__(self):
        self._index = 0
        return self

    async def __anext__(self):
        if self._index >= len(self._items):
            raise StopAsyncIteration
        item = self._items[self._index]
        self._index += 1
        return item


class TestDistributionListRoutesSuperAdmin:
    """Tests for distribution list routes requiring super admin access."""

    @pytest.fixture
    def app(self):
        """Create test FastAPI app."""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_service(self):
        """Create mock DistributionListService."""
        return MagicMock()

    @pytest.fixture
    def mock_db(self):
        """Create mock DatabaseManager with distribution_lists collection."""
        db = MagicMock()
        db.distribution_lists = MagicMock()
        return db

    @pytest.fixture
    def mock_super_admin(self):
        """Create a mock super admin user."""
        user = MagicMock()
        user.email = "superadmin@test.com"
        user.user_id = "superadmin_123"
        user.roles = ["super-administrator"]
        return user

    @pytest.fixture
    def client(self, app, mock_service, mock_db, mock_super_admin):
        """Create test client with super admin dependencies."""
        app.dependency_overrides[get_distribution_list_service] = lambda: mock_service
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        app.dependency_overrides[require_group_admin] = lambda: mock_super_admin
        app.dependency_overrides[get_current_user] = lambda: mock_super_admin
        return TestClient(app)

    # ---- GET /distribution-lists (list) ----

    def test_list_distribution_lists_success(self, client, mock_db):
        """Test listing distribution lists with default pagination."""
        items = [make_dist_list_dict(), make_dist_list_dict(key="second-list")]
        mock_db.distribution_lists.count_documents = AsyncMock(return_value=2)
        mock_db.distribution_lists.find = MagicMock(
            return_value=_AsyncCursorMock(items)
        )

        response = client.get("/distribution-lists")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data
        assert data["pagination"]["total"] == 2
        assert len(data["data"]) == 2

    def test_list_distribution_lists_with_search(self, client, mock_db):
        """Test listing distribution lists with search filter."""
        mock_db.distribution_lists.count_documents = AsyncMock(return_value=0)
        mock_db.distribution_lists.find = MagicMock(
            return_value=_AsyncCursorMock([])
        )

        response = client.get("/distribution-lists?search=feedback")
        assert response.status_code == 200
        # Verify $or query was built for search
        call_args = mock_db.distribution_lists.count_documents.call_args[0][0]
        assert "$or" in call_args

    def test_list_distribution_lists_with_type_filter(self, client, mock_db):
        """Test listing distribution lists with type filter."""
        mock_db.distribution_lists.count_documents = AsyncMock(return_value=0)
        mock_db.distribution_lists.find = MagicMock(
            return_value=_AsyncCursorMock([])
        )

        response = client.get("/distribution-lists?type=feedback")
        assert response.status_code == 200
        call_args = mock_db.distribution_lists.count_documents.call_args[0][0]
        assert call_args["type"] == "feedback"

    def test_list_distribution_lists_include_inactive(self, client, mock_db):
        """Test listing including inactive lists."""
        mock_db.distribution_lists.count_documents = AsyncMock(return_value=0)
        mock_db.distribution_lists.find = MagicMock(
            return_value=_AsyncCursorMock([])
        )

        response = client.get("/distribution-lists?include_inactive=true")
        assert response.status_code == 200
        call_args = mock_db.distribution_lists.count_documents.call_args[0][0]
        assert "is_active" not in call_args

    def test_list_distribution_lists_exclude_inactive_default(self, client, mock_db):
        """Test default behavior excludes inactive lists."""
        mock_db.distribution_lists.count_documents = AsyncMock(return_value=0)
        mock_db.distribution_lists.find = MagicMock(
            return_value=_AsyncCursorMock([])
        )

        response = client.get("/distribution-lists")
        assert response.status_code == 200
        call_args = mock_db.distribution_lists.count_documents.call_args[0][0]
        assert call_args.get("is_active") is True

    def test_list_distribution_lists_pagination(self, client, mock_db):
        """Test pagination metadata calculation."""
        mock_db.distribution_lists.count_documents = AsyncMock(return_value=50)
        mock_db.distribution_lists.find = MagicMock(
            return_value=_AsyncCursorMock([])
        )

        response = client.get("/distribution-lists?page=2&limit=10")
        assert response.status_code == 200
        pagination = response.json()["pagination"]
        assert pagination["total"] == 50
        assert pagination["pages"] == 5
        assert pagination["page"] == 2
        assert pagination["limit"] == 10
        assert pagination["has_next"] is True
        assert pagination["has_prev"] is True

    def test_list_distribution_lists_first_page(self, client, mock_db):
        """Test first page has_prev is False."""
        mock_db.distribution_lists.count_documents = AsyncMock(return_value=30)
        mock_db.distribution_lists.find = MagicMock(
            return_value=_AsyncCursorMock([])
        )

        response = client.get("/distribution-lists?page=0&limit=10")
        pagination = response.json()["pagination"]
        assert pagination["has_prev"] is False
        assert pagination["has_next"] is True

    def test_list_distribution_lists_last_page(self, client, mock_db):
        """Test last page has_next is False."""
        mock_db.distribution_lists.count_documents = AsyncMock(return_value=30)
        mock_db.distribution_lists.find = MagicMock(
            return_value=_AsyncCursorMock([])
        )

        response = client.get("/distribution-lists?page=2&limit=10")
        pagination = response.json()["pagination"]
        assert pagination["has_next"] is False
        assert pagination["has_prev"] is True

    # ---- POST /distribution-lists (create) ----

    def test_create_distribution_list_success(self, client, mock_service):
        """Test creating a new distribution list."""
        payload = make_create_payload()
        created = make_dist_list_dict(**payload)
        mock_service.create = AsyncMock(return_value=created)

        response = client.post("/distribution-lists", json=payload)
        assert response.status_code == 201
        data = response.json()
        assert data["key"] == payload["key"]
        assert data["name"] == payload["name"]

    def test_create_distribution_list_duplicate_key(self, client, mock_service):
        """Test 400 when creating with duplicate key."""
        mock_service.create = AsyncMock(
            side_effect=ValueError("Distribution list with key 'dup-key' already exists")
        )

        response = client.post(
            "/distribution-lists", json=make_create_payload(key="dup-key")
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    # ---- PUT /distribution-lists/{list_id} (update) ----

    def test_update_distribution_list_success(self, client, mock_service):
        """Test updating a distribution list."""
        list_id = str(ObjectId())
        updated = make_dist_list_dict(_id=list_id, name="Updated Name")
        mock_service.update = AsyncMock(return_value=updated)

        response = client.put(
            f"/distribution-lists/{list_id}",
            json={"name": "Updated Name"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    def test_update_distribution_list_not_found(self, client, mock_service):
        """Test 404 when updating nonexistent list."""
        mock_service.update = AsyncMock(return_value=None)

        response = client.put(
            f"/distribution-lists/{ObjectId()}",
            json={"name": "Updated"},
        )
        assert response.status_code == 404

    def test_update_distribution_list_value_error(self, client, mock_service):
        """Test 400 when update raises ValueError."""
        mock_service.update = AsyncMock(
            side_effect=ValueError("Invalid email format")
        )

        response = client.put(
            f"/distribution-lists/{ObjectId()}",
            json={"emails": ["bad-email"]},
        )
        assert response.status_code == 400
        assert "Invalid email format" in response.json()["detail"]

    # ---- POST /distribution-lists/{list_id}/emails (add email) ----

    def test_add_email_to_list_success(self, client, mock_service):
        """Test adding an email to a distribution list."""
        list_id = str(ObjectId())
        updated = make_dist_list_dict(
            _id=list_id,
            emails=["user1@test.com", "user2@test.com", "new@test.com"],
        )
        mock_service.add_email = AsyncMock(return_value=updated)

        response = client.post(
            f"/distribution-lists/{list_id}/emails",
            json={"email": "new@test.com"},
        )
        assert response.status_code == 200
        assert "new@test.com" in response.json()["emails"]

    def test_add_email_to_list_not_found(self, client, mock_service):
        """Test 404 when adding email to nonexistent list."""
        mock_service.add_email = AsyncMock(return_value=None)

        response = client.post(
            f"/distribution-lists/{ObjectId()}/emails",
            json={"email": "new@test.com"},
        )
        assert response.status_code == 404

    # ---- DELETE /distribution-lists/{list_id}/emails (remove email) ----

    def test_remove_email_from_list_success(self, client, mock_service):
        """Test removing an email from a distribution list."""
        list_id = str(ObjectId())
        updated = make_dist_list_dict(_id=list_id, emails=["user1@test.com"])
        mock_service.remove_email = AsyncMock(return_value=updated)

        response = client.request(
            "DELETE",
            f"/distribution-lists/{list_id}/emails",
            json={"email": "user2@test.com"},
        )
        assert response.status_code == 200
        assert "user2@test.com" not in response.json()["emails"]

    def test_remove_email_from_list_not_found(self, client, mock_service):
        """Test 404 when removing email from nonexistent list."""
        mock_service.remove_email = AsyncMock(return_value=None)

        response = client.request(
            "DELETE",
            f"/distribution-lists/{ObjectId()}/emails",
            json={"email": "user@test.com"},
        )
        assert response.status_code == 404

    # ---- DELETE /distribution-lists/{list_id} ----

    def test_delete_distribution_list_soft(self, client, mock_service):
        """Test soft deleting a distribution list (default)."""
        mock_service.delete = AsyncMock(return_value=True)

        response = client.delete(f"/distribution-lists/{ObjectId()}")
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]
        mock_service.delete.assert_called_once()

    def test_delete_distribution_list_hard(self, client, mock_service):
        """Test hard deleting a distribution list."""
        mock_service.hard_delete = AsyncMock(return_value=True)

        response = client.delete(
            f"/distribution-lists/{ObjectId()}?hard_delete=true"
        )
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]
        mock_service.hard_delete.assert_called_once()

    def test_delete_distribution_list_not_found(self, client, mock_service):
        """Test 404 when deleting nonexistent list."""
        mock_service.delete = AsyncMock(return_value=False)

        response = client.delete(f"/distribution-lists/{ObjectId()}")
        assert response.status_code == 404

    def test_delete_distribution_list_hard_not_found(self, client, mock_service):
        """Test 404 when hard deleting nonexistent list."""
        mock_service.hard_delete = AsyncMock(return_value=False)

        response = client.delete(
            f"/distribution-lists/{ObjectId()}?hard_delete=true"
        )
        assert response.status_code == 404

    # ---- POST /distribution-lists/{list_id}/toggle-status ----

    def test_toggle_status_activate(self, client, mock_service):
        """Test toggling status from inactive to active."""
        list_id = str(ObjectId())
        inactive_list = make_dist_list_dict(_id=list_id, is_active=False)
        mock_service.get_by_id = AsyncMock(return_value=inactive_list)
        mock_service.update = AsyncMock(
            return_value=make_dist_list_dict(_id=list_id, is_active=True)
        )

        response = client.post(f"/distribution-lists/{list_id}/toggle-status")
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is True
        assert "activated" in data["message"]

    def test_toggle_status_deactivate(self, client, mock_service):
        """Test toggling status from active to inactive."""
        list_id = str(ObjectId())
        active_list = make_dist_list_dict(_id=list_id, is_active=True)
        mock_service.get_by_id = AsyncMock(return_value=active_list)
        mock_service.update = AsyncMock(
            return_value=make_dist_list_dict(_id=list_id, is_active=False)
        )

        response = client.post(f"/distribution-lists/{list_id}/toggle-status")
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False
        assert "deactivated" in data["message"]

    def test_toggle_status_not_found(self, client, mock_service):
        """Test 404 when toggling status of nonexistent list."""
        mock_service.get_by_id = AsyncMock(return_value=None)

        response = client.post(f"/distribution-lists/{ObjectId()}/toggle-status")
        assert response.status_code == 404


class TestDistributionListRoutesGroupAdmin:
    """Tests for distribution list routes requiring group admin access."""

    @pytest.fixture
    def app(self):
        """Create test FastAPI app."""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_service(self):
        """Create mock DistributionListService."""
        return MagicMock()

    @pytest.fixture
    def mock_db(self):
        """Create mock DatabaseManager."""
        db = MagicMock()
        db.distribution_lists = MagicMock()
        return db

    @pytest.fixture
    def mock_group_admin(self):
        """Create a mock group admin user."""
        user = MagicMock()
        user.email = "groupadmin@test.com"
        user.user_id = "groupadmin_123"
        user.roles = ["group-administrator"]
        return user

    @pytest.fixture
    def client(self, app, mock_service, mock_db, mock_group_admin):
        """Create test client with group admin dependencies."""
        app.dependency_overrides[get_distribution_list_service] = lambda: mock_service
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_group_admin] = lambda: mock_group_admin
        app.dependency_overrides[get_current_user] = lambda: mock_group_admin
        # Do NOT override require_super_admin so super-admin-only routes reject
        return TestClient(app)

    # ---- GET /distribution-lists/types ----

    def test_get_types(self, client):
        """Test getting distribution list types."""
        response = client.get("/distribution-lists/types")
        assert response.status_code == 200
        data = response.json()
        assert "types" in data
        type_values = [t["value"] for t in data["types"]]
        assert "scenario_request" in type_values
        assert "feedback" in type_values
        assert "system_alert" in type_values
        assert "custom" in type_values
        assert "system_notification" in type_values
        assert "configuration_update" in type_values
        assert "no_reply" in type_values
        assert "support" in type_values

    # ---- GET /distribution-lists/by-key/{key} ----

    def test_get_by_key_success(self, client, mock_service):
        """Test getting a distribution list by key."""
        dist_list = make_dist_list_dict(key="feedback-list")
        mock_service.get_by_key = AsyncMock(return_value=dist_list)

        response = client.get("/distribution-lists/by-key/feedback-list")
        assert response.status_code == 200
        assert response.json()["key"] == "feedback-list"

    def test_get_by_key_not_found(self, client, mock_service):
        """Test 404 when key not found."""
        mock_service.get_by_key = AsyncMock(return_value=None)

        response = client.get("/distribution-lists/by-key/nonexistent")
        assert response.status_code == 404
        assert "nonexistent" in response.json()["detail"]

    # ---- GET /distribution-lists/by-type/{list_type} ----

    def test_get_by_type_success(self, client, mock_service):
        """Test getting distribution lists by type."""
        lists = [
            make_dist_list_dict(type="feedback"),
            make_dist_list_dict(key="feedback-2", type="feedback"),
        ]
        mock_service.get_by_type = AsyncMock(return_value=lists)

        response = client.get("/distribution-lists/by-type/feedback")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 2

    def test_get_by_type_empty(self, client, mock_service):
        """Test getting distribution lists by type with no results."""
        mock_service.get_by_type = AsyncMock(return_value=[])

        response = client.get("/distribution-lists/by-type/nonexistent")
        assert response.status_code == 200
        assert response.json()["data"] == []

    # ---- GET /distribution-lists/emails/{key} ----

    def test_get_emails_by_key_success(self, client, mock_service):
        """Test getting emails by key."""
        mock_service.get_emails_by_key = AsyncMock(
            return_value=["user1@test.com", "user2@test.com"]
        )

        response = client.get("/distribution-lists/emails/feedback-list")
        assert response.status_code == 200
        data = response.json()
        assert "emails" in data
        assert len(data["emails"]) == 2

    def test_get_emails_by_key_empty(self, client, mock_service):
        """Test getting emails from a list with no emails."""
        mock_service.get_emails_by_key = AsyncMock(return_value=[])

        response = client.get("/distribution-lists/emails/empty-list")
        assert response.status_code == 200
        assert response.json()["emails"] == []

    # ---- GET /distribution-lists/{list_id} ----

    def test_get_by_id_success(self, client, mock_service):
        """Test getting a distribution list by ID."""
        list_id = str(ObjectId())
        dist_list = make_dist_list_dict(_id=list_id)
        mock_service.get_by_id = AsyncMock(return_value=dist_list)

        response = client.get(f"/distribution-lists/{list_id}")
        assert response.status_code == 200
        assert response.json()["key"] == "test-list"

    def test_get_by_id_not_found(self, client, mock_service):
        """Test 404 when list not found by ID."""
        mock_service.get_by_id = AsyncMock(return_value=None)

        response = client.get(f"/distribution-lists/{ObjectId()}")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    # ---- Group admin cannot access super-admin-only routes ----

    def test_create_requires_super_admin(self, client):
        """Test that creating a list requires super admin."""
        response = client.post(
            "/distribution-lists",
            json=make_create_payload(),
        )
        assert response.status_code == 403
        assert "Super Administrator access required" in response.json()["detail"]

    def test_update_requires_super_admin(self, client):
        """Test that updating a list requires super admin."""
        response = client.put(
            f"/distribution-lists/{ObjectId()}",
            json={"name": "Updated"},
        )
        assert response.status_code == 403

    def test_delete_requires_super_admin(self, client):
        """Test that deleting a list requires super admin."""
        response = client.delete(f"/distribution-lists/{ObjectId()}")
        assert response.status_code == 403

    def test_add_email_requires_super_admin(self, client):
        """Test that adding an email requires super admin."""
        response = client.post(
            f"/distribution-lists/{ObjectId()}/emails",
            json={"email": "new@test.com"},
        )
        assert response.status_code == 403

    def test_remove_email_requires_super_admin(self, client):
        """Test that removing an email requires super admin."""
        response = client.request(
            "DELETE",
            f"/distribution-lists/{ObjectId()}/emails",
            json={"email": "user@test.com"},
        )
        assert response.status_code == 403

    def test_toggle_status_requires_super_admin(self, client):
        """Test that toggling status requires super admin."""
        response = client.post(
            f"/distribution-lists/{ObjectId()}/toggle-status"
        )
        assert response.status_code == 403


class TestDistributionListRoutesAuthEnforcement:
    """Tests to verify auth dependency enforcement -- regular user cannot access."""

    @pytest.fixture
    def app(self):
        """Create test FastAPI app."""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_service(self):
        """Create mock DistributionListService."""
        return MagicMock()

    @pytest.fixture
    def mock_db(self):
        """Create mock DatabaseManager."""
        db = MagicMock()
        db.distribution_lists = MagicMock()
        return db

    @pytest.fixture
    def mock_regular_user(self):
        """Create a mock regular user (not admin)."""
        user = MagicMock()
        user.email = "user@test.com"
        user.user_id = "user_123"
        user.roles = ["user"]
        return user

    @pytest.fixture
    def client(self, app, mock_service, mock_db, mock_regular_user):
        """Create client with regular user -- no admin overrides."""
        app.dependency_overrides[get_distribution_list_service] = lambda: mock_service
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_current_user] = lambda: mock_regular_user
        # Do NOT override require_super_admin or require_group_admin
        return TestClient(app)

    def test_list_requires_super_admin(self, client):
        """Test that listing requires super admin."""
        response = client.get("/distribution-lists")
        assert response.status_code == 403

    def test_types_requires_group_admin(self, client):
        """Test that types endpoint requires group admin."""
        response = client.get("/distribution-lists/types")
        assert response.status_code == 403
        assert "Group Administrator access required" in response.json()["detail"]

    def test_get_by_key_requires_group_admin(self, client):
        """Test that get by key requires group admin."""
        response = client.get("/distribution-lists/by-key/test")
        assert response.status_code == 403

    def test_get_by_type_requires_group_admin(self, client):
        """Test that get by type requires group admin."""
        response = client.get("/distribution-lists/by-type/feedback")
        assert response.status_code == 403

    def test_get_emails_requires_group_admin(self, client):
        """Test that get emails requires group admin."""
        response = client.get("/distribution-lists/emails/test")
        assert response.status_code == 403

    def test_get_by_id_requires_group_admin(self, client):
        """Test that get by ID requires group admin."""
        response = client.get(f"/distribution-lists/{ObjectId()}")
        assert response.status_code == 403

    def test_create_requires_super_admin(self, client):
        """Test that create requires super admin."""
        response = client.post(
            "/distribution-lists",
            json=make_create_payload(),
        )
        assert response.status_code == 403

    def test_update_requires_super_admin(self, client):
        """Test that update requires super admin."""
        response = client.put(
            f"/distribution-lists/{ObjectId()}",
            json={"name": "Updated"},
        )
        assert response.status_code == 403

    def test_delete_requires_super_admin(self, client):
        """Test that delete requires super admin."""
        response = client.delete(f"/distribution-lists/{ObjectId()}")
        assert response.status_code == 403

    def test_toggle_status_requires_super_admin(self, client):
        """Test that toggle status requires super admin."""
        response = client.post(
            f"/distribution-lists/{ObjectId()}/toggle-status"
        )
        assert response.status_code == 403
