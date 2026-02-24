"""Role-based route access tests.

Verifies that each critical endpoint enforces the correct role check:
- Admin endpoints return 403 for non-admin users
- Group-admin endpoints return 403 for regular users
- User endpoints allow authenticated users
- Covers domains, groups, scenarios, playboards routes
"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from bson import ObjectId

from easylifeauth.security.access_control import (
    CurrentUser,
    require_super_admin,
    require_admin,
    require_admin_or_editor,
    require_group_admin,
    get_current_user,
)
from easylifeauth.api import dependencies


# ---------------------------------------------------------------------------
# User fixtures for each role level
# ---------------------------------------------------------------------------

def _user(role: str, domains=None) -> CurrentUser:
    return CurrentUser(
        user_id="507f1f77bcf86cd799439011",
        email=f"{role}@example.com",
        roles=[role],
        groups=[],
        domains=domains or [],
    )


SUPER_ADMIN = _user("super-administrator", ["all"])
ADMIN = _user("administrator", ["all"])
GROUP_ADMIN = _user("group-administrator")
GROUP_EDITOR = _user("group-editor")
EDITOR = _user("editor")
REGULAR_USER = _user("user")
VIEWER = _user("viewer")


# ---------------------------------------------------------------------------
# Mock DB helpers
# ---------------------------------------------------------------------------

def _mock_db():
    db = MagicMock()
    # Common collection mocks
    for coll in ["domains", "groups", "users", "domain_scenarios",
                 "playboards", "roles", "permissions", "customers"]:
        setattr(db, coll, MagicMock())
        getattr(db, coll).find_one = AsyncMock(return_value=None)
        getattr(db, coll).find = MagicMock()
        getattr(db, coll).insert_one = AsyncMock()
        getattr(db, coll).update_one = AsyncMock()
        getattr(db, coll).delete_one = AsyncMock()
        getattr(db, coll).update_many = AsyncMock()
        getattr(db, coll).delete_many = AsyncMock()
        getattr(db, coll).count_documents = AsyncMock(return_value=0)
    return db


def _mock_user_service():
    svc = MagicMock()
    svc.resolve_user_domains = AsyncMock(return_value=[])
    return svc


def _mock_scenario_service():
    svc = MagicMock()
    svc.get = AsyncMock(return_value=None)
    svc.save = AsyncMock(return_value={})
    svc.update = AsyncMock(return_value={})
    svc.delete = AsyncMock(return_value={"message": "deleted"})
    return svc


def _mock_email_service():
    svc = MagicMock()
    svc.send_role_change_notification = AsyncMock()
    return svc


def _empty_cursor():
    async def gen():
        return
        yield
    return gen()


# ===========================================================================
# Domain routes – require_super_admin for most, get_current_user for /all
# ===========================================================================
class TestDomainRouteAccess:
    """Domain CRUD requires super-admin; /all allows any authenticated user."""

    @pytest.fixture
    def _app_for(self):
        """Returns a factory that creates an app with a given user override."""
        def factory(user: CurrentUser):
            from easylifeauth.api.domain_routes import router
            app = FastAPI()
            app.include_router(router)

            db = _mock_db()
            db.domains.count_documents = AsyncMock(return_value=0)
            mock_cursor = MagicMock()
            mock_cursor.skip.return_value = mock_cursor
            mock_cursor.limit.return_value = mock_cursor
            mock_cursor.sort.return_value = _empty_cursor()
            db.domains.find.return_value = mock_cursor

            app.dependency_overrides[require_super_admin] = lambda: user
            app.dependency_overrides[get_current_user] = lambda: user
            app.dependency_overrides[require_group_admin] = lambda: user
            app.dependency_overrides[dependencies.get_db] = lambda: db
            app.dependency_overrides[dependencies.get_user_service] = lambda: _mock_user_service()

            return TestClient(app), db
        return factory

    def test_list_domains_super_admin_ok(self, _app_for):
        client, _ = _app_for(SUPER_ADMIN)
        resp = client.get("/domains")
        assert resp.status_code == 200

    def test_get_all_domains_any_user_ok(self, _app_for):
        client, db = _app_for(REGULAR_USER)
        mock_cursor = MagicMock()
        mock_cursor.sort.return_value = _empty_cursor()
        db.domains.find.return_value = mock_cursor
        resp = client.get("/domains/all")
        assert resp.status_code == 200

    def test_count_domains_super_admin_ok(self, _app_for):
        client, _ = _app_for(SUPER_ADMIN)
        resp = client.get("/domains/count")
        assert resp.status_code == 200

    def test_create_domain_super_admin_ok(self, _app_for):
        client, db = _app_for(SUPER_ADMIN)
        db.domains.find_one = AsyncMock(return_value=None)
        db.domains.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        resp = client.post("/domains", json={
            "key": "test-domain", "name": "Test", "order": 1,
        })
        assert resp.status_code == 201

    def test_regular_user_cannot_create_domain(self):
        """Without super-admin override, a regular user gets 403."""
        from easylifeauth.api.domain_routes import router
        app = FastAPI()
        app.include_router(router)

        # Override get_current_user but NOT require_super_admin
        app.dependency_overrides[get_current_user] = lambda: REGULAR_USER
        app.dependency_overrides[dependencies.get_db] = lambda: _mock_db()
        # require_super_admin will call get_current_user -> REGULAR_USER -> 403
        app.dependency_overrides[require_super_admin] = lambda: (_ for _ in ()).throw(
            __import__("fastapi").HTTPException(status_code=403, detail="Forbidden")
        )

        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/domains", json={
            "key": "x", "name": "X", "order": 1,
        })
        assert resp.status_code == 403


# ===========================================================================
# Group routes – require_group_admin (group-admin, group-editor, admin, super)
# ===========================================================================
class TestGroupRouteAccess:
    """Group endpoints require group_admin role at minimum."""

    @pytest.fixture
    def _app_for(self):
        def factory(user: CurrentUser, should_allow: bool = True):
            from easylifeauth.api.groups_routes import router
            app = FastAPI()
            app.include_router(router)

            db = _mock_db()
            db.groups.count_documents = AsyncMock(return_value=0)
            mock_cursor = MagicMock()
            mock_cursor.skip.return_value = mock_cursor
            mock_cursor.limit.return_value = mock_cursor
            mock_cursor.sort.return_value = _empty_cursor()
            db.groups.find.return_value = mock_cursor

            if should_allow:
                app.dependency_overrides[require_group_admin] = lambda: user
                app.dependency_overrides[require_super_admin] = lambda: user
            else:
                from fastapi import HTTPException
                def _reject():
                    raise HTTPException(status_code=403, detail="Group Administrator access required")
                app.dependency_overrides[require_group_admin] = _reject
                app.dependency_overrides[require_super_admin] = _reject

            app.dependency_overrides[dependencies.get_db] = lambda: db
            app.dependency_overrides[dependencies.get_email_service] = lambda: _mock_email_service()

            return TestClient(app, raise_server_exceptions=False), db
        return factory

    def test_list_groups_group_admin_ok(self, _app_for):
        client, _ = _app_for(GROUP_ADMIN)
        assert client.get("/groups").status_code == 200

    def test_list_groups_admin_ok(self, _app_for):
        client, _ = _app_for(ADMIN)
        assert client.get("/groups").status_code == 200

    def test_list_groups_regular_user_rejected(self, _app_for):
        client, _ = _app_for(REGULAR_USER, should_allow=False)
        assert client.get("/groups").status_code == 403

    def test_list_groups_viewer_rejected(self, _app_for):
        client, _ = _app_for(VIEWER, should_allow=False)
        assert client.get("/groups").status_code == 403

    def test_count_groups_group_editor_ok(self, _app_for):
        client, _ = _app_for(GROUP_EDITOR)
        assert client.get("/groups/count").status_code == 200

    def test_create_group_super_admin_ok(self, _app_for):
        client, db = _app_for(SUPER_ADMIN)
        db.groups.find_one = AsyncMock(return_value=None)
        db.groups.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        resp = client.post("/groups", json={
            "groupId": "test-grp", "name": "Test Group",
            "description": "desc", "permissions": [],
            "status": "active", "priority": 1,
        })
        assert resp.status_code == 201

    def test_create_group_regular_user_rejected(self, _app_for):
        client, _ = _app_for(REGULAR_USER, should_allow=False)
        resp = client.post("/groups", json={
            "groupId": "test", "name": "N", "description": "d",
            "permissions": [], "status": "active", "priority": 1,
        })
        assert resp.status_code == 403


# ===========================================================================
# Scenario routes – require_admin_or_editor for CUD, get_current_user for read
# ===========================================================================
class TestScenarioRouteAccess:
    """Scenario create/update/delete needs editor+, read needs auth."""

    @pytest.fixture
    def _app_for(self):
        def factory(user: CurrentUser, allow_editor: bool = True):
            from easylifeauth.api.scenario_routes import router
            app = FastAPI()
            app.include_router(router)

            db = _mock_db()
            svc = _mock_scenario_service()
            user_svc = _mock_user_service()

            app.dependency_overrides[get_current_user] = lambda: user

            if allow_editor:
                app.dependency_overrides[require_admin_or_editor] = lambda: user
            else:
                from fastapi import HTTPException
                def _reject():
                    raise HTTPException(status_code=403, detail="Forbidden")
                app.dependency_overrides[require_admin_or_editor] = _reject

            app.dependency_overrides[dependencies.get_db] = lambda: db
            app.dependency_overrides[dependencies.get_scenario_service] = lambda: svc
            app.dependency_overrides[dependencies.get_user_service] = lambda: user_svc

            return TestClient(app, raise_server_exceptions=False), db, svc
        return factory

    def test_get_all_scenarios_any_user_ok(self, _app_for):
        client, db, _ = _app_for(REGULAR_USER, allow_editor=False)
        # Mock cursor for domain_scenarios
        mock_cursor = MagicMock()
        mock_cursor.sort.return_value = MagicMock()
        mock_cursor.sort.return_value.to_list = AsyncMock(return_value=[])
        db.domain_scenarios.find.return_value = mock_cursor
        resp = client.get("/scenarios/all")
        assert resp.status_code == 200

    def test_create_scenario_editor_ok(self, _app_for):
        client, _, svc = _app_for(EDITOR)
        svc.save = AsyncMock(return_value={
            "key": "sc1", "name": "Test", "dataDomain": "d1",
            "description": "desc", "status": "A",
        })
        resp = client.post("/scenarios", json={
            "key": "sc1", "name": "Test",
            "dataDomain": "d1", "description": "desc",
        })
        assert resp.status_code == 201

    def test_create_scenario_regular_user_rejected(self, _app_for):
        client, _, _ = _app_for(REGULAR_USER, allow_editor=False)
        resp = client.post("/scenarios", json={
            "key": "sc1", "name": "Test",
            "dataDomain": "d1", "description": "desc",
        })
        assert resp.status_code == 403

    def test_delete_scenario_viewer_rejected(self, _app_for):
        client, _, _ = _app_for(VIEWER, allow_editor=False)
        resp = client.delete("/scenarios/some-key")
        assert resp.status_code == 403


# ===========================================================================
# Playboard routes – require_super_admin for CUD, get_current_user for read
# ===========================================================================
class TestPlayboardRouteAccess:
    """Playboard CUD requires super_admin, read needs domain access."""

    @pytest.fixture
    def _app_for(self):
        def factory(user: CurrentUser, allow_super: bool = True):
            from easylifeauth.api.playboard_routes import router
            app = FastAPI()
            app.include_router(router)

            db = _mock_db()
            db.playboards.count_documents = AsyncMock(return_value=0)
            user_svc = _mock_user_service()

            app.dependency_overrides[get_current_user] = lambda: user

            if allow_super:
                app.dependency_overrides[require_super_admin] = lambda: user
            else:
                from fastapi import HTTPException
                def _reject():
                    raise HTTPException(status_code=403, detail="Forbidden")
                app.dependency_overrides[require_super_admin] = _reject

            app.dependency_overrides[dependencies.get_db] = lambda: db
            app.dependency_overrides[dependencies.get_user_service] = lambda: user_svc

            return TestClient(app, raise_server_exceptions=False), db
        return factory

    def test_list_playboards_any_user_ok(self, _app_for):
        client, db = _app_for(REGULAR_USER, allow_super=False)
        # Returns empty since no domains resolved
        resp = client.get("/playboards")
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"] == []

    def test_create_playboard_super_admin_ok(self, _app_for):
        client, db = _app_for(SUPER_ADMIN)
        db.playboards.find_one = AsyncMock(return_value=None)
        db.domain_scenarios.find_one = AsyncMock(return_value={
            "key": "sc1", "domainKey": "d1",
        })
        db.playboards.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        resp = client.post("/playboards", json={
            "key": "pb1", "name": "Playboard 1",
            "scenarioKey": "sc1",
        })
        assert resp.status_code == 201

    def test_create_playboard_regular_user_rejected(self, _app_for):
        client, _ = _app_for(REGULAR_USER, allow_super=False)
        resp = client.post("/playboards", json={
            "key": "pb1", "name": "Playboard 1",
            "scenarioKey": "sc1",
        })
        assert resp.status_code == 403

    def test_delete_playboard_admin_only_rejected(self, _app_for):
        """Even admin (non-super) should be rejected for playboard delete."""
        client, _ = _app_for(ADMIN, allow_super=False)
        resp = client.delete(f"/playboards/{ObjectId()}")
        assert resp.status_code == 403

    def test_toggle_status_super_admin_ok(self, _app_for):
        oid = ObjectId()
        client, db = _app_for(SUPER_ADMIN)
        db.playboards.find_one = AsyncMock(return_value={
            "_id": oid, "status": "active",
        })
        resp = client.post(f"/playboards/{oid}/toggle-status")
        assert resp.status_code == 200


# ===========================================================================
# Cross-role matrix test
# ===========================================================================
class TestCrossRoleMatrix:
    """Verify each role against each access-check function directly."""

    @pytest.mark.parametrize("role,fn,expected", [
        # require_admin
        ("super-administrator", require_admin, True),
        ("administrator", require_admin, True),
        ("group-administrator", require_admin, False),
        ("group-editor", require_admin, False),
        ("editor", require_admin, False),
        ("user", require_admin, False),
        ("viewer", require_admin, False),
        # require_super_admin
        ("super-administrator", require_super_admin, True),
        ("administrator", require_super_admin, False),
        ("group-administrator", require_super_admin, False),
        ("editor", require_super_admin, False),
        ("user", require_super_admin, False),
        # require_group_admin
        ("super-administrator", require_group_admin, True),
        ("administrator", require_group_admin, True),
        ("group-administrator", require_group_admin, True),
        ("group-editor", require_group_admin, True),
        ("editor", require_group_admin, False),
        ("user", require_group_admin, False),
        ("viewer", require_group_admin, False),
        # require_admin_or_editor
        ("super-administrator", require_admin_or_editor, True),
        ("administrator", require_admin_or_editor, True),
        ("group-administrator", require_admin_or_editor, True),
        ("group-editor", require_admin_or_editor, True),
        ("editor", require_admin_or_editor, True),
        ("user", require_admin_or_editor, False),
        ("viewer", require_admin_or_editor, False),
    ])
    def test_role_access_matrix(self, role, fn, expected):
        user = _make_user(role)
        if expected:
            assert fn(user) == user
        else:
            with pytest.raises(__import__("fastapi").HTTPException) as exc:
                fn(user)
            assert exc.value.status_code == 403


def _make_user(role: str) -> CurrentUser:
    return CurrentUser(
        user_id="uid-test", email=f"{role}@example.com",
        roles=[role], groups=[], domains=[],
    )
