"""Tests for Playboard Group-Level Access Control"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
from bson import ObjectId
from datetime import datetime, timezone

from easylifeauth.api.playboard_routes import (
    router,
    build_group_filter,
    check_group_access,
)
from easylifeauth.api.dependencies import get_db, get_user_service
from easylifeauth.security.access_control import get_current_user, require_super_admin
from mock_data import (
    MOCK_EMAIL_ADMIN_TEST, MOCK_EMAIL_USER_TEST,
    STR_DOMAIN1, STR_SCENARIO1, STR_SCENARIOKEY,
)

EXPECTED_TEST_PLAYBOARD = "Test Playboard"
STR_TEST_PLAYBOARD = "test-playboard"
GROUP_SALES = "sales-team"
GROUP_MANAGERS = "managers"
GROUP_ENGINEERING = "engineering"


def make_mock_user(email, roles, groups=None):
    """Create a mock user with given roles and groups."""
    user = MagicMock()
    user.email = email
    user.roles = roles
    user.groups = groups or []
    return user


def make_playboard(key, name, scenario_key, groups=None, status="A"):
    """Create a playboard dict."""
    return {
        "_id": ObjectId(),
        "key": key,
        "name": name,
        STR_SCENARIOKEY: scenario_key,
        "status": status,
        "groups": groups or [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
        "data": {},
    }


def make_cursor(playboards):
    """Create a mock async cursor for a list of playboards."""
    cursor = MagicMock()
    cursor.skip = MagicMock(return_value=cursor)
    cursor.limit = MagicMock(return_value=cursor)
    cursor.sort = MagicMock(return_value=cursor)

    items = [pb.copy() for pb in playboards]
    call_count = {"n": 0}

    async def anext_fn(self_ref):
        if call_count["n"] < len(items):
            item = items[call_count["n"]]
            call_count["n"] += 1
            return item
        raise StopAsyncIteration

    cursor.__aiter__ = lambda self: self
    cursor.__anext__ = anext_fn
    return cursor


# ────────────────────────────────────────────────────────
# Unit tests for helper functions
# ────────────────────────────────────────────────────────

class TestBuildGroupFilter:
    """Tests for build_group_filter helper."""

    def test_super_admin_returns_none(self):
        user = make_mock_user(MOCK_EMAIL_ADMIN_TEST, ["super-administrator"], [GROUP_SALES])
        result = build_group_filter(user)
        assert result is None

    def test_regular_user_with_groups(self):
        user = make_mock_user(MOCK_EMAIL_USER_TEST, ["user"], [GROUP_SALES, GROUP_MANAGERS])
        result = build_group_filter(user)
        assert result is not None
        assert "$or" in result
        conditions = result["$or"]
        assert len(conditions) == 3
        assert {"groups": {"$exists": False}} in conditions
        assert {"groups": {"$size": 0}} in conditions
        assert {"groups": {"$in": [GROUP_SALES, GROUP_MANAGERS]}} in conditions

    def test_regular_user_no_groups(self):
        user = make_mock_user(MOCK_EMAIL_USER_TEST, ["user"], [])
        result = build_group_filter(user)
        assert result is not None
        conditions = result["$or"]
        # Without user groups, only $exists and $size conditions (no $in)
        assert len(conditions) == 2
        assert {"groups": {"$exists": False}} in conditions
        assert {"groups": {"$size": 0}} in conditions

    def test_user_with_none_groups(self):
        user = make_mock_user(MOCK_EMAIL_USER_TEST, ["user"])
        user.groups = None
        result = build_group_filter(user)
        assert result is not None
        conditions = result["$or"]
        assert len(conditions) == 2


class TestCheckGroupAccess:
    """Tests for check_group_access helper."""

    def test_super_admin_bypasses_check(self):
        user = make_mock_user(MOCK_EMAIL_ADMIN_TEST, ["super-administrator"])
        pb = {"groups": [GROUP_SALES]}
        # Should not raise
        check_group_access(pb, user)

    def test_empty_groups_allows_all(self):
        user = make_mock_user(MOCK_EMAIL_USER_TEST, ["user"], [])
        pb = {"groups": []}
        check_group_access(pb, user)

    def test_no_groups_field_allows_all(self):
        user = make_mock_user(MOCK_EMAIL_USER_TEST, ["user"], [])
        pb = {}
        check_group_access(pb, user)

    def test_user_in_group_allowed(self):
        user = make_mock_user(MOCK_EMAIL_USER_TEST, ["user"], [GROUP_SALES])
        pb = {"groups": [GROUP_SALES, GROUP_MANAGERS]}
        check_group_access(pb, user)

    def test_user_not_in_group_denied(self):
        from fastapi import HTTPException
        user = make_mock_user(MOCK_EMAIL_USER_TEST, ["user"], [GROUP_ENGINEERING])
        pb = {"groups": [GROUP_SALES, GROUP_MANAGERS]}
        with pytest.raises(HTTPException) as exc_info:
            check_group_access(pb, user)
        assert exc_info.value.status_code == 403
        assert "not in required group" in exc_info.value.detail

    def test_user_no_groups_denied(self):
        from fastapi import HTTPException
        user = make_mock_user(MOCK_EMAIL_USER_TEST, ["user"], [])
        pb = {"groups": [GROUP_SALES]}
        with pytest.raises(HTTPException) as exc_info:
            check_group_access(pb, user)
        assert exc_info.value.status_code == 403

    def test_or_logic_any_group_match(self):
        """User in one of multiple playboard groups should be allowed."""
        user = make_mock_user(MOCK_EMAIL_USER_TEST, ["user"], [GROUP_MANAGERS])
        pb = {"groups": [GROUP_SALES, GROUP_MANAGERS, GROUP_ENGINEERING]}
        check_group_access(pb, user)


# ────────────────────────────────────────────────────────
# Integration tests with TestClient
# ────────────────────────────────────────────────────────

class TestPlayboardGroupAccessRoutes:
    """Tests for group access filtering in playboard routes."""

    @pytest.fixture
    def app(self):
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.playboards = MagicMock()
        db.domain_scenarios = MagicMock()
        db.users = MagicMock()
        return db

    @pytest.fixture
    def mock_user_service(self):
        service = MagicMock()
        service.resolve_user_domains = AsyncMock(return_value=[STR_DOMAIN1])
        return service

    @pytest.fixture
    def mock_super_admin(self):
        return make_mock_user(MOCK_EMAIL_ADMIN_TEST, ["super-administrator"], [GROUP_SALES])

    @pytest.fixture
    def mock_sales_user(self):
        return make_mock_user(MOCK_EMAIL_USER_TEST, ["user"], [GROUP_SALES])

    @pytest.fixture
    def mock_engineering_user(self):
        return make_mock_user(MOCK_EMAIL_USER_TEST, ["user"], [GROUP_ENGINEERING])

    @pytest.fixture
    def mock_no_group_user(self):
        return make_mock_user(MOCK_EMAIL_USER_TEST, ["user"], [])

    def _setup_client(self, app, mock_db, mock_user_service, user):
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[get_user_service] = lambda: mock_user_service
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[require_super_admin] = lambda: user
        return TestClient(app)

    def _setup_scenarios(self, mock_db):
        """Setup domain_scenarios find to return accessible scenarios."""
        scenario_cursor = MagicMock()
        scenario_cursor.__aiter__ = lambda self: self
        call_count = {"n": 0}

        async def scenario_anext(self_ref):
            if call_count["n"] == 0:
                call_count["n"] += 1
                return {"key": STR_SCENARIO1}
            raise StopAsyncIteration

        scenario_cursor.__anext__ = scenario_anext
        mock_db.domain_scenarios.find = MagicMock(return_value=scenario_cursor)
        mock_db.domain_scenarios.find_one = AsyncMock(
            return_value={"key": STR_SCENARIO1, "domainKey": STR_DOMAIN1}
        )

    # ── List endpoint tests ──

    def test_list_super_admin_sees_all(self, app, mock_db, mock_user_service, mock_super_admin):
        """Super-admin should see all playboards regardless of groups."""
        client = self._setup_client(app, mock_db, mock_user_service, mock_super_admin)
        pb1 = make_playboard("pb1", "Public", STR_SCENARIO1, groups=[])
        pb2 = make_playboard("pb2", "Restricted", STR_SCENARIO1, groups=[GROUP_MANAGERS])

        mock_db.playboards.count_documents = AsyncMock(return_value=2)
        mock_db.playboards.find = MagicMock(return_value=make_cursor([pb1, pb2]))

        mock_db.users.find_one = AsyncMock(return_value=None)

        response = client.get("/playboards?page=0&limit=25")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 2

    def test_list_user_group_filter_applied(self, app, mock_db, mock_user_service, mock_sales_user):
        """Regular user query should include group filter."""
        client = self._setup_client(app, mock_db, mock_user_service, mock_sales_user)
        self._setup_scenarios(mock_db)
        mock_db.users.find_one = AsyncMock(
            return_value={"email": MOCK_EMAIL_USER_TEST, "domains": [STR_DOMAIN1]}
        )

        # The important thing: count_documents and find are called with group filter
        mock_db.playboards.count_documents = AsyncMock(return_value=0)
        mock_db.playboards.find = MagicMock(return_value=make_cursor([]))

        response = client.get("/playboards?page=0&limit=25")
        assert response.status_code == 200

        # Verify the query passed to count_documents contains group filter
        call_args = mock_db.playboards.count_documents.call_args[0][0]
        assert "$and" in call_args or "$or" in call_args

    # ── Count endpoint tests ──

    def test_count_group_filter_applied(self, app, mock_db, mock_user_service, mock_sales_user):
        """Count endpoint should apply group filter for non-super-admins."""
        client = self._setup_client(app, mock_db, mock_user_service, mock_sales_user)
        self._setup_scenarios(mock_db)
        mock_db.users.find_one = AsyncMock(
            return_value={"email": MOCK_EMAIL_USER_TEST, "domains": [STR_DOMAIN1]}
        )
        mock_db.playboards.count_documents = AsyncMock(return_value=5)

        response = client.get("/playboards/count")
        assert response.status_code == 200

        call_args = mock_db.playboards.count_documents.call_args[0][0]
        assert "$and" in call_args or "$or" in call_args

    def test_count_super_admin_no_group_filter(self, app, mock_db, mock_user_service, mock_super_admin):
        """Super-admin count should not have group filter."""
        client = self._setup_client(app, mock_db, mock_user_service, mock_super_admin)
        mock_db.playboards.count_documents = AsyncMock(return_value=10)

        response = client.get("/playboards/count")
        assert response.status_code == 200
        assert response.json()["count"] == 10

    # ── Single fetch tests ──

    def test_get_playboard_group_member_allowed(self, app, mock_db, mock_user_service, mock_sales_user):
        """User in playboard group should be allowed to fetch it."""
        client = self._setup_client(app, mock_db, mock_user_service, mock_sales_user)
        pb = make_playboard("pb1", "Sales Board", STR_SCENARIO1, groups=[GROUP_SALES])
        mock_db.playboards.find_one = AsyncMock(return_value=pb)
        mock_db.domain_scenarios.find_one = AsyncMock(
            return_value={"key": STR_SCENARIO1, "domainKey": STR_DOMAIN1}
        )
        mock_db.users.find_one = AsyncMock(
            return_value={"email": MOCK_EMAIL_USER_TEST, "domains": [STR_DOMAIN1]}
        )

        response = client.get(f"/playboards/{pb['_id']}")
        assert response.status_code == 200

    def test_get_playboard_non_member_denied(self, app, mock_db, mock_user_service, mock_engineering_user):
        """User not in playboard group should get 403."""
        client = self._setup_client(app, mock_db, mock_user_service, mock_engineering_user)
        pb = make_playboard("pb1", "Sales Board", STR_SCENARIO1, groups=[GROUP_SALES])
        mock_db.playboards.find_one = AsyncMock(return_value=pb)
        mock_db.domain_scenarios.find_one = AsyncMock(
            return_value={"key": STR_SCENARIO1, "domainKey": STR_DOMAIN1}
        )
        mock_db.users.find_one = AsyncMock(
            return_value={"email": MOCK_EMAIL_USER_TEST, "domains": [STR_DOMAIN1]}
        )

        response = client.get(f"/playboards/{pb['_id']}")
        assert response.status_code == 403
        assert "not in required group" in response.json()["detail"]

    def test_get_playboard_no_groups_allows_all(self, app, mock_db, mock_user_service, mock_no_group_user):
        """Playboard with no groups should be accessible to any domain user."""
        client = self._setup_client(app, mock_db, mock_user_service, mock_no_group_user)
        pb = make_playboard("pb1", "Public Board", STR_SCENARIO1, groups=[])
        mock_db.playboards.find_one = AsyncMock(return_value=pb)
        mock_db.domain_scenarios.find_one = AsyncMock(
            return_value={"key": STR_SCENARIO1, "domainKey": STR_DOMAIN1}
        )
        mock_db.users.find_one = AsyncMock(
            return_value={"email": MOCK_EMAIL_USER_TEST, "domains": [STR_DOMAIN1]}
        )

        response = client.get(f"/playboards/{pb['_id']}")
        assert response.status_code == 200

    def test_get_playboard_super_admin_bypasses_groups(self, app, mock_db, mock_user_service, mock_super_admin):
        """Super-admin should bypass group check."""
        client = self._setup_client(app, mock_db, mock_user_service, mock_super_admin)
        pb = make_playboard("pb1", "Restricted", STR_SCENARIO1, groups=[GROUP_MANAGERS])
        mock_db.playboards.find_one = AsyncMock(return_value=pb)
        mock_db.domain_scenarios.find_one = AsyncMock(
            return_value={"key": STR_SCENARIO1, "domainKey": STR_DOMAIN1}
        )

        response = client.get(f"/playboards/{pb['_id']}")
        assert response.status_code == 200

    # ── Download endpoint tests ──

    def test_download_group_member_allowed(self, app, mock_db, mock_user_service, mock_sales_user):
        """User in group should be able to download."""
        client = self._setup_client(app, mock_db, mock_user_service, mock_sales_user)
        pb = make_playboard("pb1", "Sales Board", STR_SCENARIO1, groups=[GROUP_SALES])
        pb["data"] = {"some": "data"}
        mock_db.playboards.find_one = AsyncMock(return_value=pb)
        mock_db.domain_scenarios.find_one = AsyncMock(
            return_value={"key": STR_SCENARIO1, "domainKey": STR_DOMAIN1}
        )
        mock_db.users.find_one = AsyncMock(
            return_value={"email": MOCK_EMAIL_USER_TEST, "domains": [STR_DOMAIN1]}
        )

        response = client.get(f"/playboards/{pb['_id']}/download")
        assert response.status_code == 200

    def test_download_non_member_denied(self, app, mock_db, mock_user_service, mock_engineering_user):
        """User not in group should get 403 on download."""
        client = self._setup_client(app, mock_db, mock_user_service, mock_engineering_user)
        pb = make_playboard("pb1", "Sales Board", STR_SCENARIO1, groups=[GROUP_SALES])
        mock_db.playboards.find_one = AsyncMock(return_value=pb)
        mock_db.domain_scenarios.find_one = AsyncMock(
            return_value={"key": STR_SCENARIO1, "domainKey": STR_DOMAIN1}
        )
        mock_db.users.find_one = AsyncMock(
            return_value={"email": MOCK_EMAIL_USER_TEST, "domains": [STR_DOMAIN1]}
        )

        response = client.get(f"/playboards/{pb['_id']}/download")
        assert response.status_code == 403

    # ── Create endpoint tests ──

    def test_create_playboard_with_groups(self, app, mock_db, mock_user_service, mock_super_admin):
        """Groups field should be saved when creating a playboard."""
        client = self._setup_client(app, mock_db, mock_user_service, mock_super_admin)
        mock_db.playboards.find_one = AsyncMock(return_value=None)
        mock_db.domain_scenarios.find_one = AsyncMock(
            return_value={"key": STR_SCENARIO1, "domainKey": STR_DOMAIN1}
        )
        inserted_id = ObjectId()
        mock_db.playboards.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=inserted_id)
        )

        response = client.post("/playboards", json={
            "key": STR_TEST_PLAYBOARD,
            "name": EXPECTED_TEST_PLAYBOARD,
            "scenarioKey": STR_SCENARIO1,
            "groups": [GROUP_SALES, GROUP_MANAGERS],
        })
        assert response.status_code == 201
        # Verify groups was passed to insert_one
        insert_call = mock_db.playboards.insert_one.call_args[0][0]
        assert insert_call["groups"] == [GROUP_SALES, GROUP_MANAGERS]

    def test_create_playboard_without_groups(self, app, mock_db, mock_user_service, mock_super_admin):
        """Creating without groups should default to empty list."""
        client = self._setup_client(app, mock_db, mock_user_service, mock_super_admin)
        mock_db.playboards.find_one = AsyncMock(return_value=None)
        mock_db.domain_scenarios.find_one = AsyncMock(
            return_value={"key": STR_SCENARIO1, "domainKey": STR_DOMAIN1}
        )
        inserted_id = ObjectId()
        mock_db.playboards.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=inserted_id)
        )

        response = client.post("/playboards", json={
            "key": "pb-no-groups",
            "name": "No Groups Board",
            "scenarioKey": STR_SCENARIO1,
        })
        assert response.status_code == 201
        insert_call = mock_db.playboards.insert_one.call_args[0][0]
        assert insert_call["groups"] == []

    # ── Update endpoint tests ──

    def test_update_playboard_with_groups(self, app, mock_db, mock_user_service, mock_super_admin):
        """Groups field should be updated when provided."""
        client = self._setup_client(app, mock_db, mock_user_service, mock_super_admin)
        existing_id = ObjectId()
        existing = {
            "_id": existing_id,
            "key": STR_TEST_PLAYBOARD,
            "name": EXPECTED_TEST_PLAYBOARD,
            STR_SCENARIOKEY: STR_SCENARIO1,
            "status": "A",
            "groups": [],
        }
        updated = {**existing, "groups": [GROUP_SALES]}

        mock_db.playboards.find_one = AsyncMock(side_effect=[existing, updated])
        mock_db.playboards.update_one = AsyncMock()

        response = client.put(f"/playboards/{existing_id}", json={
            "groups": [GROUP_SALES],
        })
        assert response.status_code == 200

        # Verify $set includes groups
        update_call = mock_db.playboards.update_one.call_args
        set_data = update_call[0][1]["$set"]
        assert set_data.get("groups") == [GROUP_SALES]

    def test_update_playboard_without_groups_unchanged(self, app, mock_db, mock_user_service, mock_super_admin):
        """Not sending groups in update should not alter existing groups."""
        client = self._setup_client(app, mock_db, mock_user_service, mock_super_admin)
        existing_id = ObjectId()
        existing = {
            "_id": existing_id,
            "key": STR_TEST_PLAYBOARD,
            "name": EXPECTED_TEST_PLAYBOARD,
            STR_SCENARIOKEY: STR_SCENARIO1,
            "status": "A",
            "groups": [GROUP_SALES],
        }

        mock_db.playboards.find_one = AsyncMock(side_effect=[existing, existing])
        mock_db.playboards.update_one = AsyncMock()

        response = client.put(f"/playboards/{existing_id}", json={
            "name": "Updated Name",
        })
        assert response.status_code == 200

        # Verify $set does NOT include groups (not sent = not updated)
        update_call = mock_db.playboards.update_one.call_args
        set_data = update_call[0][1]["$set"]
        assert "groups" not in set_data

    # ── Backward compatibility tests ──

    def test_backward_compat_no_groups_field(self, app, mock_db, mock_user_service, mock_sales_user):
        """Playboard without groups field should be accessible (backward compat)."""
        client = self._setup_client(app, mock_db, mock_user_service, mock_sales_user)
        pb = {
            "_id": ObjectId(),
            "key": "old-pb",
            "name": "Old Playboard",
            STR_SCENARIOKEY: STR_SCENARIO1,
            "status": "A",
            # No "groups" field at all
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            "data": {},
        }
        mock_db.playboards.find_one = AsyncMock(return_value=pb)
        mock_db.domain_scenarios.find_one = AsyncMock(
            return_value={"key": STR_SCENARIO1, "domainKey": STR_DOMAIN1}
        )
        mock_db.users.find_one = AsyncMock(
            return_value={"email": MOCK_EMAIL_USER_TEST, "domains": [STR_DOMAIN1]}
        )

        response = client.get(f"/playboards/{pb['_id']}")
        assert response.status_code == 200
