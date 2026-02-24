"""Domain access control tests.

Tests cover:
- Domain filtering returns only user's domains
- Scenario filtering by domain access
- Playboard access requires domain access
- "all" domain grants full access
- Empty domains returns nothing
- resolve_user_domains aggregation from roles + groups
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from bson import ObjectId

from easylifeauth.security.access_control import (
    CurrentUser, require_super_admin, get_current_user, require_group_admin,
)
from easylifeauth.api import dependencies
from easylifeauth.api.domain_routes import check_domain_access, get_user_accessible_domains
from easylifeauth.api.scenario_routes import (
    check_domain_access as scenario_check_domain_access,
    get_user_accessible_domains as scenario_get_user_accessible_domains,
)
from easylifeauth.api.playboard_routes import (
    check_domain_access as playboard_check_domain_access,
    get_scenario_domain_key,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _user(role="user", domains=None) -> CurrentUser:
    return CurrentUser(
        user_id="507f1f77bcf86cd799439011",
        email=f"{role}@example.com",
        roles=[role],
        groups=[],
        domains=domains or [],
    )


def _mock_db():
    db = MagicMock()
    for coll in ["domains", "groups", "users", "domain_scenarios",
                 "playboards", "roles", "permissions"]:
        setattr(db, coll, MagicMock())
        getattr(db, coll).find_one = AsyncMock(return_value=None)
        getattr(db, coll).find = MagicMock()
        getattr(db, coll).count_documents = AsyncMock(return_value=0)
        getattr(db, coll).insert_one = AsyncMock()
        getattr(db, coll).update_one = AsyncMock()
        getattr(db, coll).delete_one = AsyncMock()
        getattr(db, coll).update_many = AsyncMock()
        getattr(db, coll).delete_many = AsyncMock()
    return db


def _mock_user_service(resolved_domains=None):
    svc = MagicMock()
    svc.resolve_user_domains = AsyncMock(return_value=resolved_domains or [])
    return svc


def _empty_cursor():
    async def gen():
        return
        yield
    return gen()


# ===========================================================================
# 1. check_domain_access utility
# ===========================================================================
class TestCheckDomainAccess:
    """Unit tests for domain access checking helper."""

    def test_all_grants_any_domain(self):
        assert check_domain_access(["all"], "finance") is True
        assert check_domain_access(["all"], "hr") is True
        assert check_domain_access(["all"], "any_random_domain") is True

    def test_specific_domain_match(self):
        assert check_domain_access(["finance", "hr"], "finance") is True
        assert check_domain_access(["finance", "hr"], "hr") is True

    def test_specific_domain_no_match(self):
        assert check_domain_access(["finance", "hr"], "marketing") is False

    def test_empty_domains_denies_all(self):
        assert check_domain_access([], "finance") is False
        assert check_domain_access([], "") is False

    def test_single_domain(self):
        assert check_domain_access(["finance"], "finance") is True
        assert check_domain_access(["finance"], "hr") is False

    def test_case_sensitive(self):
        assert check_domain_access(["Finance"], "finance") is False
        assert check_domain_access(["finance"], "Finance") is False


# ===========================================================================
# 2. get_user_accessible_domains (domain_routes)
# ===========================================================================
class TestGetUserAccessibleDomains:
    """Tests for the domain_routes get_user_accessible_domains."""

    @pytest.mark.asyncio
    async def test_super_admin_gets_all(self):
        user = _user("super-administrator")
        db = _mock_db()
        svc = _mock_user_service()
        result = await get_user_accessible_domains(user, db, svc)
        assert result == ["all"]

    @pytest.mark.asyncio
    async def test_regular_user_with_domains(self):
        user = _user("user")
        db = _mock_db()
        db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId(), "email": "user@example.com",
            "domains": ["finance"],
        })
        svc = _mock_user_service(resolved_domains=["finance", "hr"])
        result = await get_user_accessible_domains(user, db, svc)
        assert result == ["finance", "hr"]

    @pytest.mark.asyncio
    async def test_user_not_found_returns_empty(self):
        user = _user("user")
        db = _mock_db()
        db.users.find_one = AsyncMock(return_value=None)
        svc = _mock_user_service()
        result = await get_user_accessible_domains(user, db, svc)
        assert result == []

    @pytest.mark.asyncio
    async def test_admin_without_super_gets_resolved(self):
        user = _user("administrator")
        db = _mock_db()
        db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId(), "email": "administrator@example.com",
        })
        svc = _mock_user_service(resolved_domains=["all"])
        result = await get_user_accessible_domains(user, db, svc)
        assert "all" in result


# ===========================================================================
# 3. Domain route: /domains/all filters by user access
# ===========================================================================
class TestDomainAllRoute:
    """GET /domains/all returns only domains the user can access."""

    @pytest.fixture
    def _app(self):
        def factory(user, db=None, user_svc=None):
            from easylifeauth.api.domain_routes import router
            app = FastAPI()
            app.include_router(router)

            if db is None:
                db = _mock_db()
            if user_svc is None:
                user_svc = _mock_user_service()

            app.dependency_overrides[get_current_user] = lambda: user
            app.dependency_overrides[require_super_admin] = lambda: user
            app.dependency_overrides[require_group_admin] = lambda: user
            app.dependency_overrides[dependencies.get_db] = lambda: db
            app.dependency_overrides[dependencies.get_user_service] = lambda: user_svc

            return TestClient(app), db
        return factory

    def test_super_admin_sees_all_active(self, _app):
        user = _user("super-administrator")
        db = _mock_db()

        async def cursor_gen():
            yield {
                "_id": ObjectId(), "key": "finance", "name": "Finance",
                "status": "active", "order": 1,
            }
            yield {
                "_id": ObjectId(), "key": "hr", "name": "HR",
                "status": "active", "order": 2,
            }

        mock_cursor = MagicMock()
        mock_cursor.sort.return_value = cursor_gen()
        db.domains.find.return_value = mock_cursor

        client, _ = _app(user, db=db)
        resp = client.get("/domains/all")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

    def test_regular_user_sees_only_their_domains(self, _app):
        user = _user("user")
        db = _mock_db()
        db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId(), "email": "user@example.com",
        })
        user_svc = _mock_user_service(resolved_domains=["finance"])

        async def cursor_gen():
            yield {
                "_id": ObjectId(), "key": "finance", "name": "Finance",
                "status": "active", "order": 1,
            }

        mock_cursor = MagicMock()
        mock_cursor.sort.return_value = cursor_gen()
        db.domains.find.return_value = mock_cursor

        client, _ = _app(user, db=db, user_svc=user_svc)
        resp = client.get("/domains/all")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["key"] == "finance"

    def test_user_with_no_domains_gets_empty(self, _app):
        user = _user("user")
        db = _mock_db()
        db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId(), "email": "user@example.com",
        })
        user_svc = _mock_user_service(resolved_domains=[])

        client, _ = _app(user, db=db, user_svc=user_svc)
        resp = client.get("/domains/all")
        assert resp.status_code == 200
        data = resp.json()
        assert data == []

    def test_user_not_found_gets_empty(self, _app):
        user = _user("user")
        db = _mock_db()
        db.users.find_one = AsyncMock(return_value=None)
        user_svc = _mock_user_service()

        client, _ = _app(user, db=db, user_svc=user_svc)
        resp = client.get("/domains/all")
        assert resp.status_code == 200
        data = resp.json()
        assert data == []


# ===========================================================================
# 4. Domain route: GET /{domain_id} checks domain access
# ===========================================================================
class TestDomainGetByIdAccess:
    """GET /domains/{id} enforces domain-level access control."""

    @pytest.fixture
    def _app(self):
        def factory(user, db=None, user_svc=None):
            from easylifeauth.api.domain_routes import router
            app = FastAPI()
            app.include_router(router)

            if db is None:
                db = _mock_db()
            if user_svc is None:
                user_svc = _mock_user_service()

            app.dependency_overrides[get_current_user] = lambda: user
            app.dependency_overrides[require_super_admin] = lambda: user
            app.dependency_overrides[require_group_admin] = lambda: user
            app.dependency_overrides[dependencies.get_db] = lambda: db
            app.dependency_overrides[dependencies.get_user_service] = lambda: user_svc

            return TestClient(app, raise_server_exceptions=False), db
        return factory

    def test_user_with_matching_domain_allowed(self, _app):
        user = _user("user")
        db = _mock_db()
        oid = ObjectId()
        db.domains.find_one = AsyncMock(return_value={
            "_id": oid, "key": "finance", "name": "Finance",
            "status": "active", "order": 1,
        })
        db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId(), "email": "user@example.com",
        })
        user_svc = _mock_user_service(resolved_domains=["finance"])

        client, _ = _app(user, db=db, user_svc=user_svc)
        resp = client.get(f"/domains/{oid}")
        assert resp.status_code == 200

    def test_user_without_matching_domain_denied(self, _app):
        user = _user("user")
        db = _mock_db()
        oid = ObjectId()
        db.domains.find_one = AsyncMock(return_value={
            "_id": oid, "key": "hr", "name": "HR",
            "status": "active", "order": 1,
        })
        db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId(), "email": "user@example.com",
        })
        user_svc = _mock_user_service(resolved_domains=["finance"])

        client, _ = _app(user, db=db, user_svc=user_svc)
        resp = client.get(f"/domains/{oid}")
        assert resp.status_code == 403

    def test_super_admin_allowed_any_domain(self, _app):
        user = _user("super-administrator")
        db = _mock_db()
        oid = ObjectId()
        db.domains.find_one = AsyncMock(return_value={
            "_id": oid, "key": "secret", "name": "Secret",
            "status": "active", "order": 1,
        })

        client, _ = _app(user, db=db)
        resp = client.get(f"/domains/{oid}")
        assert resp.status_code == 200


# ===========================================================================
# 5. Scenario domain access filtering
# ===========================================================================
class TestScenarioDomainAccess:
    """Scenario routes filter by domain access."""

    def test_scenario_check_domain_access_all(self):
        assert scenario_check_domain_access(["all"], "finance") is True

    def test_scenario_check_domain_access_specific(self):
        assert scenario_check_domain_access(["finance"], "finance") is True
        assert scenario_check_domain_access(["finance"], "hr") is False

    def test_scenario_check_domain_access_empty(self):
        assert scenario_check_domain_access([], "finance") is False

    @pytest.mark.asyncio
    async def test_scenario_get_user_accessible_domains_super(self):
        user = _user("super-administrator")
        result = await scenario_get_user_accessible_domains(user, _mock_db(), _mock_user_service())
        assert result == ["all"]

    @pytest.mark.asyncio
    async def test_scenario_get_user_accessible_domains_regular(self):
        user = _user("user")
        db = _mock_db()
        db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId(), "email": "user@example.com",
        })
        svc = _mock_user_service(resolved_domains=["marketing"])
        result = await scenario_get_user_accessible_domains(user, db, svc)
        assert result == ["marketing"]

    @pytest.fixture
    def _app(self):
        def factory(user, user_domains=None):
            from easylifeauth.api.scenario_routes import router
            from easylifeauth.security.access_control import require_admin_or_editor
            app = FastAPI()
            app.include_router(router)

            db = _mock_db()
            db.users.find_one = AsyncMock(return_value={
                "_id": ObjectId(), "email": user.email,
            })

            svc = _mock_user_service(resolved_domains=user_domains or [])
            scenario_svc = MagicMock()
            scenario_svc.get = AsyncMock(return_value=None)
            scenario_svc.save = AsyncMock()
            scenario_svc.update = AsyncMock()
            scenario_svc.delete = AsyncMock()

            app.dependency_overrides[get_current_user] = lambda: user
            app.dependency_overrides[require_admin_or_editor] = lambda: user
            app.dependency_overrides[dependencies.get_db] = lambda: db
            app.dependency_overrides[dependencies.get_user_service] = lambda: svc
            app.dependency_overrides[dependencies.get_scenario_service] = lambda: scenario_svc

            return TestClient(app, raise_server_exceptions=False), db, scenario_svc
        return factory

    def test_get_all_scenarios_filters_by_domain(self, _app):
        user = _user("user")
        client, db, _ = _app(user, user_domains=["finance"])

        mock_cursor = MagicMock()
        mock_cursor.sort.return_value = MagicMock()
        mock_cursor.sort.return_value.to_list = AsyncMock(return_value=[
            {"key": "sc1", "dataDomain": "finance", "status": "A"},
        ])
        db.domain_scenarios.find.return_value = mock_cursor

        resp = client.get("/scenarios/all")
        assert resp.status_code == 200

    def test_get_all_scenarios_no_domains_returns_empty(self, _app):
        user = _user("user")
        client, db, _ = _app(user, user_domains=[])

        mock_cursor = MagicMock()
        mock_cursor.sort.return_value = MagicMock()
        mock_cursor.sort.return_value.to_list = AsyncMock(return_value=[])
        db.domain_scenarios.find.return_value = mock_cursor

        resp = client.get("/scenarios/all")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_get_scenario_by_domain_denied(self, _app):
        user = _user("user")
        client, db, _ = _app(user, user_domains=["finance"])

        resp = client.get("/scenarios/all/hr")
        assert resp.status_code == 403

    def test_get_scenario_by_domain_allowed(self, _app):
        user = _user("user")
        client, db, _ = _app(user, user_domains=["finance"])

        mock_cursor = MagicMock()
        mock_cursor.sort.return_value = MagicMock()
        mock_cursor.sort.return_value.to_list = AsyncMock(return_value=[
            {"key": "sc1", "dataDomain": "finance", "status": "A"},
        ])
        db.domain_scenarios.find.return_value = mock_cursor

        resp = client.get("/scenarios/all/finance")
        assert resp.status_code == 200


# ===========================================================================
# 6. Playboard domain access
# ===========================================================================
class TestPlayboardDomainAccess:
    """Playboard routes check domain access via parent scenario."""

    def test_playboard_check_domain_access_with_all(self):
        assert playboard_check_domain_access(["all"], "finance") is True

    def test_playboard_check_domain_access_match(self):
        assert playboard_check_domain_access(["finance"], "finance") is True

    def test_playboard_check_domain_access_no_match(self):
        assert playboard_check_domain_access(["finance"], "hr") is False

    def test_playboard_check_domain_access_empty(self):
        assert playboard_check_domain_access([], "finance") is False

    def test_playboard_check_domain_access_none_domain_key(self):
        """Playboard variant returns False for None/empty domain_key."""
        assert playboard_check_domain_access(["finance"], "") is False
        assert playboard_check_domain_access(["finance"], None) is False

    @pytest.mark.asyncio
    async def test_get_scenario_domain_key_found(self):
        db = _mock_db()
        db.domain_scenarios.find_one = AsyncMock(return_value={
            "key": "sc1", "domainKey": "finance",
        })
        result = await get_scenario_domain_key(db, "sc1")
        assert result == "finance"

    @pytest.mark.asyncio
    async def test_get_scenario_domain_key_not_found(self):
        db = _mock_db()
        db.domain_scenarios.find_one = AsyncMock(return_value=None)
        result = await get_scenario_domain_key(db, "nonexistent")
        assert result is None

    @pytest.fixture
    def _app(self):
        def factory(user, user_domains=None):
            from easylifeauth.api.playboard_routes import router
            app = FastAPI()
            app.include_router(router)

            db = _mock_db()
            db.users.find_one = AsyncMock(return_value={
                "_id": ObjectId(), "email": user.email,
            })
            user_svc = _mock_user_service(resolved_domains=user_domains or [])

            app.dependency_overrides[get_current_user] = lambda: user
            app.dependency_overrides[require_super_admin] = lambda: user
            app.dependency_overrides[dependencies.get_db] = lambda: db
            app.dependency_overrides[dependencies.get_user_service] = lambda: user_svc

            return TestClient(app, raise_server_exceptions=False), db
        return factory

    def test_get_playboard_denied_no_domain_access(self, _app):
        user = _user("user")
        client, db = _app(user, user_domains=["finance"])

        oid = ObjectId()
        db.playboards.find_one = AsyncMock(return_value={
            "_id": oid, "scenarioKey": "sc-hr", "status": "active",
        })
        db.domain_scenarios.find_one = AsyncMock(return_value={
            "key": "sc-hr", "domainKey": "hr",
        })

        resp = client.get(f"/playboards/{oid}")
        assert resp.status_code == 403

    def test_get_playboard_allowed_with_domain_access(self, _app):
        user = _user("user")
        client, db = _app(user, user_domains=["finance"])

        oid = ObjectId()
        db.playboards.find_one = AsyncMock(return_value={
            "_id": oid, "key": "pb1", "scenarioKey": "sc-fin",
            "status": "active", "dataDomain": "finance",
        })
        db.domain_scenarios.find_one = AsyncMock(return_value={
            "key": "sc-fin", "domainKey": "finance",
        })

        resp = client.get(f"/playboards/{oid}")
        assert resp.status_code == 200

    def test_list_playboards_no_domains_returns_empty(self, _app):
        user = _user("user")
        client, db = _app(user, user_domains=[])

        resp = client.get("/playboards")
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"] == []

    def test_list_playboards_with_all_domain(self, _app):
        user = _user("super-administrator")
        client, db = _app(user, user_domains=["all"])

        # Mock scenario keys lookup
        async def sc_cursor():
            yield {"key": "sc1"}
        db.domain_scenarios.find.return_value = sc_cursor()
        db.playboards.count_documents = AsyncMock(return_value=0)

        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = _empty_cursor()
        db.playboards.find.return_value = mock_cursor

        resp = client.get("/playboards")
        assert resp.status_code == 200


# ===========================================================================
# 7. resolve_user_domains (UserService)
# ===========================================================================
class TestResolveUserDomains:
    """Tests for UserService.resolve_user_domains aggregation."""

    @pytest.mark.asyncio
    async def test_direct_domains(self):
        from easylifeauth.services.user_service import UserService

        db = _mock_db()
        db.roles.find.return_value = _empty_cursor()
        db.groups.find.return_value = _empty_cursor()

        tm = MagicMock()
        svc = UserService(db, tm)

        user = {"domains": ["finance", "hr"], "roles": [], "groups": []}
        result = await svc.resolve_user_domains(user)
        assert set(result) == {"finance", "hr"}

    @pytest.mark.asyncio
    async def test_domains_from_roles(self):
        from easylifeauth.services.user_service import UserService

        db = _mock_db()

        async def roles_cursor():
            yield {"roleId": "admin-role", "domains": ["marketing", "sales"], "status": "active"}

        db.roles.find.return_value = roles_cursor()
        db.groups.find.return_value = _empty_cursor()

        tm = MagicMock()
        svc = UserService(db, tm)

        user = {"domains": ["finance"], "roles": ["admin-role"], "groups": []}
        result = await svc.resolve_user_domains(user)
        assert "finance" in result
        assert "marketing" in result
        assert "sales" in result

    @pytest.mark.asyncio
    async def test_domains_from_groups(self):
        from easylifeauth.services.user_service import UserService

        db = _mock_db()
        db.roles.find.return_value = _empty_cursor()

        async def groups_cursor():
            yield {"groupId": "team-a", "domains": ["hr", "legal"], "status": "active"}

        db.groups.find.return_value = groups_cursor()

        tm = MagicMock()
        svc = UserService(db, tm)

        user = {"domains": [], "roles": [], "groups": ["team-a"]}
        result = await svc.resolve_user_domains(user)
        assert set(result) == {"hr", "legal"}

    @pytest.mark.asyncio
    async def test_combined_deduplication(self):
        from easylifeauth.services.user_service import UserService

        db = _mock_db()

        async def roles_cursor():
            yield {"roleId": "r1", "domains": ["finance", "hr"], "status": "active"}

        async def groups_cursor():
            yield {"groupId": "g1", "domains": ["hr", "legal"], "status": "active"}

        db.roles.find.return_value = roles_cursor()
        db.groups.find.return_value = groups_cursor()

        tm = MagicMock()
        svc = UserService(db, tm)

        user = {"domains": ["finance"], "roles": ["r1"], "groups": ["g1"]}
        result = await svc.resolve_user_domains(user)
        # finance (direct + role), hr (role + group), legal (group) — deduplicated
        assert set(result) == {"finance", "hr", "legal"}

    @pytest.mark.asyncio
    async def test_empty_user(self):
        from easylifeauth.services.user_service import UserService

        db = _mock_db()
        db.roles.find.return_value = _empty_cursor()
        db.groups.find.return_value = _empty_cursor()

        tm = MagicMock()
        svc = UserService(db, tm)

        user = {"domains": [], "roles": [], "groups": []}
        result = await svc.resolve_user_domains(user)
        assert result == []

    @pytest.mark.asyncio
    async def test_all_domain_propagation(self):
        from easylifeauth.services.user_service import UserService

        db = _mock_db()

        async def groups_cursor():
            yield {"groupId": "all-access", "domains": ["all"], "status": "active"}

        db.roles.find.return_value = _empty_cursor()
        db.groups.find.return_value = groups_cursor()

        tm = MagicMock()
        svc = UserService(db, tm)

        user = {"domains": [], "roles": [], "groups": ["all-access"]}
        result = await svc.resolve_user_domains(user)
        assert "all" in result
