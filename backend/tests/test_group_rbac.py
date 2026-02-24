"""Group integration RBAC tests.

Tests cover:
- Group creation with permissions/domains/customers resolution
- resolve_permissions, resolve_domains, resolve_customers
- Group assignment affects user's domain access
- Inactive group exclusion from domain resolution
- Group CRUD operations with role checks
"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from bson import ObjectId

from easylifeauth.api.groups_routes import (
    router,
    resolve_permissions,
    resolve_domains,
    resolve_customers,
    notify_users_of_group_change,
)
from easylifeauth.api import dependencies
from easylifeauth.security.access_control import (
    CurrentUser, require_super_admin, require_group_admin,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_db():
    db = MagicMock()
    for coll in ["domains", "groups", "users", "roles",
                 "permissions", "customers", "domain_scenarios"]:
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


def _empty_cursor():
    async def gen():
        return
        yield
    return gen()


def _user(role="super-administrator") -> CurrentUser:
    return CurrentUser(
        user_id="507f1f77bcf86cd799439011",
        email=f"{role}@example.com",
        roles=[role],
        groups=[],
        domains=[],
    )


def _mock_email_service():
    svc = MagicMock()
    svc.send_role_change_notification = AsyncMock()
    return svc


# ===========================================================================
# 1. resolve_permissions
# ===========================================================================
class TestResolvePermissions:
    """Test resolution of permission refs (ObjectId or key) to keys."""

    @pytest.mark.asyncio
    async def test_empty_list(self):
        db = _mock_db()
        result = await resolve_permissions(db, [])
        assert result == []

    @pytest.mark.asyncio
    async def test_by_permission_id_key(self):
        db = _mock_db()
        db.permissions.find_one = AsyncMock(side_effect=[
            None,  # ObjectId lookup fails
            {"permissionId": "can-read", "_id": ObjectId()},  # key lookup
        ])
        result = await resolve_permissions(db, ["can-read"])
        assert result == ["can-read"]

    @pytest.mark.asyncio
    async def test_by_object_id(self):
        oid = ObjectId()
        db = _mock_db()
        db.permissions.find_one = AsyncMock(return_value={
            "_id": oid, "permissionId": "can-write",
        })
        result = await resolve_permissions(db, [str(oid)])
        assert result == ["can-write"]

    @pytest.mark.asyncio
    async def test_unknown_kept(self):
        db = _mock_db()
        db.permissions.find_one = AsyncMock(return_value=None)
        result = await resolve_permissions(db, ["unknown-perm"])
        assert result == ["unknown-perm"]

    @pytest.mark.asyncio
    async def test_mixed_refs(self):
        oid = ObjectId()
        db = _mock_db()
        db.permissions.find_one = AsyncMock(side_effect=[
            {"_id": oid, "permissionId": "read"},       # by OID
            None,                                         # OID check for "write" fails (not valid OID)
            {"permissionId": "write", "_id": ObjectId()}, # by key
        ])
        result = await resolve_permissions(db, [str(oid), "write"])
        assert result == ["read", "write"]


# ===========================================================================
# 2. resolve_domains
# ===========================================================================
class TestResolveDomains:
    """Test resolution of domain refs to domain keys."""

    @pytest.mark.asyncio
    async def test_empty_list(self):
        db = _mock_db()
        result = await resolve_domains(db, [])
        assert result == []

    @pytest.mark.asyncio
    async def test_by_domain_key(self):
        db = _mock_db()
        db.domains.find_one = AsyncMock(side_effect=[
            None,  # OID check
            {"domainId": "finance", "_id": ObjectId()},  # key
        ])
        result = await resolve_domains(db, ["finance"])
        assert result == ["finance"]

    @pytest.mark.asyncio
    async def test_by_object_id(self):
        oid = ObjectId()
        db = _mock_db()
        db.domains.find_one = AsyncMock(return_value={
            "_id": oid, "key": "hr",
        })
        result = await resolve_domains(db, [str(oid)])
        assert result == ["hr"]

    @pytest.mark.asyncio
    async def test_unknown_kept(self):
        db = _mock_db()
        db.domains.find_one = AsyncMock(return_value=None)
        result = await resolve_domains(db, ["nonexistent"])
        assert result == ["nonexistent"]


# ===========================================================================
# 3. resolve_customers
# ===========================================================================
class TestResolveCustomers:
    """Test resolution of customer refs to customer keys."""

    @pytest.mark.asyncio
    async def test_empty_list(self):
        db = _mock_db()
        result = await resolve_customers(db, [])
        assert result == []

    @pytest.mark.asyncio
    async def test_by_customer_key(self):
        db = _mock_db()
        db.customers.find_one = AsyncMock(side_effect=[
            None,  # OID check
            {"customerId": "acme", "_id": ObjectId()},  # key
        ])
        result = await resolve_customers(db, ["acme"])
        assert result == ["acme"]

    @pytest.mark.asyncio
    async def test_by_object_id(self):
        oid = ObjectId()
        db = _mock_db()
        db.customers.find_one = AsyncMock(return_value={
            "_id": oid, "customerId": "globex",
        })
        result = await resolve_customers(db, [str(oid)])
        assert result == ["globex"]

    @pytest.mark.asyncio
    async def test_unknown_kept(self):
        db = _mock_db()
        db.customers.find_one = AsyncMock(return_value=None)
        result = await resolve_customers(db, ["unknown-cust"])
        assert result == ["unknown-cust"]


# ===========================================================================
# 4. notify_users_of_group_change
# ===========================================================================
class TestNotifyUsersOfGroupChange:

    @pytest.mark.asyncio
    async def test_no_email_service(self):
        db = _mock_db()
        # Should not raise
        await notify_users_of_group_change(db, "grp1", {"status": "changed"}, None)

    @pytest.mark.asyncio
    async def test_sends_to_group_members(self):
        db = _mock_db()
        email_svc = _mock_email_service()

        async def user_gen():
            yield {"_id": ObjectId(), "email": "u1@ex.com", "full_name": "U1"}
            yield {"_id": ObjectId(), "email": "u2@ex.com", "full_name": "U2"}

        db.users.find.return_value = user_gen()

        await notify_users_of_group_change(db, "grp1", {"status": "changed"}, email_svc)
        assert email_svc.send_role_change_notification.call_count == 2

    @pytest.mark.asyncio
    async def test_handles_email_failure(self):
        db = _mock_db()
        email_svc = _mock_email_service()
        email_svc.send_role_change_notification = AsyncMock(side_effect=Exception("SMTP error"))

        async def user_gen():
            yield {"_id": ObjectId(), "email": "u1@ex.com", "full_name": "U1"}

        db.users.find.return_value = user_gen()

        # Should not raise, failures are silently caught
        await notify_users_of_group_change(db, "grp1", {}, email_svc)


# ===========================================================================
# 5. Group CRUD with role checks
# ===========================================================================
class TestGroupCRUDIntegration:
    """Integration tests for group endpoints with proper mocking."""

    @pytest.fixture
    def _app(self):
        def factory(user=None, allow=True):
            if user is None:
                user = _user("super-administrator")

            app = FastAPI()
            app.include_router(router)
            db = _mock_db()
            email_svc = _mock_email_service()

            if allow:
                app.dependency_overrides[require_group_admin] = lambda: user
                app.dependency_overrides[require_super_admin] = lambda: user
            else:
                from fastapi import HTTPException
                def _reject():
                    raise HTTPException(status_code=403, detail="Forbidden")
                app.dependency_overrides[require_group_admin] = _reject
                app.dependency_overrides[require_super_admin] = _reject

            app.dependency_overrides[dependencies.get_db] = lambda: db
            app.dependency_overrides[dependencies.get_email_service] = lambda: email_svc

            return TestClient(app, raise_server_exceptions=False), db, email_svc
        return factory

    def test_create_group_with_permissions_resolution(self, _app):
        client, db, _ = _app()
        db.groups.find_one = AsyncMock(return_value=None)
        db.groups.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        # Permissions resolution: "can-read" found by key
        db.permissions.find_one = AsyncMock(side_effect=[
            None,  # OID check for "can-read"
            {"permissionId": "can-read", "_id": ObjectId()},  # key check
        ])
        # Domain resolution not needed for empty domains
        db.domains.find_one = AsyncMock(return_value=None)

        resp = client.post("/groups", json={
            "groupId": "editors", "name": "Editors",
            "description": "Editor group",
            "permissions": ["can-read"],
            "domains": [],
            "status": "active", "priority": 2,
        })
        assert resp.status_code == 201

    def test_create_group_with_domain_resolution(self, _app):
        client, db, _ = _app()
        db.groups.find_one = AsyncMock(return_value=None)
        db.groups.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )

        oid = ObjectId()
        # Domain resolved by OID
        db.domains.find_one = AsyncMock(return_value={
            "_id": oid, "domainId": "finance",
        })

        resp = client.post("/groups", json={
            "groupId": "fin-team", "name": "Finance Team",
            "description": "desc",
            "permissions": [],
            "domains": [str(oid)],
            "status": "active", "priority": 1,
        })
        assert resp.status_code == 201

    def test_create_group_with_customer_resolution(self, _app):
        client, db, _ = _app()
        db.groups.find_one = AsyncMock(return_value=None)
        db.groups.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        db.customers.find_one = AsyncMock(side_effect=[
            None,  # OID check
            {"customerId": "acme", "_id": ObjectId()},  # key check
        ])

        resp = client.post("/groups", json={
            "groupId": "acme-grp", "name": "Acme Group",
            "description": "desc",
            "permissions": [], "domains": [],
            "customers": ["acme"],
            "status": "active", "priority": 1,
        })
        assert resp.status_code == 201

    def test_create_group_duplicate_rejected(self, _app):
        client, db, _ = _app()
        db.groups.find_one = AsyncMock(return_value={"groupId": "editors"})

        resp = client.post("/groups", json={
            "groupId": "editors", "name": "Editors",
            "description": "desc", "permissions": [],
            "status": "active", "priority": 1,
        })
        assert resp.status_code == 400
        assert "Group ID already exists" in resp.json()["detail"]

    def test_update_group_triggers_notification(self, _app):
        client, db, email_svc = _app()
        oid = ObjectId()
        existing = {
            "_id": oid, "groupId": "editors", "name": "Editors",
            "description": "old", "permissions": ["read"],
            "status": "active", "priority": 2,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        db.groups.find_one = AsyncMock(side_effect=[existing, existing])
        db.users.find.return_value = _empty_cursor()

        resp = client.put(f"/groups/{oid}", json={
            "permissions": ["read", "write"],
        })
        assert resp.status_code == 200

    def test_delete_group_removes_from_users(self, _app):
        client, db, _ = _app()
        oid = ObjectId()
        db.groups.find_one = AsyncMock(return_value={
            "_id": oid, "groupId": "editors",
        })
        db.groups.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))

        resp = client.delete(f"/groups/{oid}")
        assert resp.status_code == 200
        assert "deleted successfully" in resp.json()["message"]
        db.users.update_many.assert_called_once()

    def test_toggle_group_status(self, _app):
        client, db, email_svc = _app()
        oid = ObjectId()
        db.groups.find_one = AsyncMock(return_value={
            "_id": oid, "groupId": "editors", "status": "active",
        })
        db.users.find.return_value = _empty_cursor()

        resp = client.post(f"/groups/{oid}/toggle-status")
        assert resp.status_code == 200
        assert resp.json()["status"] == "inactive"

    def test_toggle_inactive_to_active(self, _app):
        client, db, email_svc = _app()
        oid = ObjectId()
        db.groups.find_one = AsyncMock(return_value={
            "_id": oid, "groupId": "editors", "status": "inactive",
        })
        db.users.find.return_value = _empty_cursor()

        resp = client.post(f"/groups/{oid}/toggle-status")
        assert resp.status_code == 200
        assert resp.json()["status"] == "active"


# ===========================================================================
# 6. Group assignment affects user domain access
# ===========================================================================
class TestGroupDomainAssignment:
    """Verify that group membership correctly propagates domain access."""

    @pytest.mark.asyncio
    async def test_user_gets_group_domains(self):
        from easylifeauth.services.user_service import UserService

        db = _mock_db()
        db.roles.find.return_value = _empty_cursor()

        async def groups_cursor():
            yield {
                "groupId": "finance-team",
                "domains": ["finance", "accounting"],
                "status": "active",
            }

        db.groups.find.return_value = groups_cursor()

        svc = UserService(db, MagicMock())
        user = {"domains": [], "roles": [], "groups": ["finance-team"]}
        result = await svc.resolve_user_domains(user)
        assert set(result) == {"finance", "accounting"}

    @pytest.mark.asyncio
    async def test_multiple_groups_combine_domains(self):
        from easylifeauth.services.user_service import UserService

        db = _mock_db()
        db.roles.find.return_value = _empty_cursor()

        async def groups_cursor():
            yield {"groupId": "team-a", "domains": ["finance"], "status": "active"}
            yield {"groupId": "team-b", "domains": ["hr", "legal"], "status": "active"}

        db.groups.find.return_value = groups_cursor()

        svc = UserService(db, MagicMock())
        user = {"domains": [], "roles": [], "groups": ["team-a", "team-b"]}
        result = await svc.resolve_user_domains(user)
        assert set(result) == {"finance", "hr", "legal"}

    @pytest.mark.asyncio
    async def test_group_with_all_domain(self):
        from easylifeauth.services.user_service import UserService

        db = _mock_db()
        db.roles.find.return_value = _empty_cursor()

        async def groups_cursor():
            yield {"groupId": "super-group", "domains": ["all"], "status": "active"}

        db.groups.find.return_value = groups_cursor()

        svc = UserService(db, MagicMock())
        user = {"domains": [], "roles": [], "groups": ["super-group"]}
        result = await svc.resolve_user_domains(user)
        assert "all" in result

    @pytest.mark.asyncio
    async def test_direct_domains_plus_group_domains(self):
        from easylifeauth.services.user_service import UserService

        db = _mock_db()
        db.roles.find.return_value = _empty_cursor()

        async def groups_cursor():
            yield {"groupId": "team-a", "domains": ["hr"], "status": "active"}

        db.groups.find.return_value = groups_cursor()

        svc = UserService(db, MagicMock())
        user = {"domains": ["finance"], "roles": [], "groups": ["team-a"]}
        result = await svc.resolve_user_domains(user)
        assert set(result) == {"finance", "hr"}


# ===========================================================================
# 7. Inactive group exclusion
# ===========================================================================
class TestInactiveGroupExclusion:
    """Inactive groups should not contribute domains to users."""

    @pytest.mark.asyncio
    async def test_only_active_groups_queried(self):
        """resolve_user_domains queries status=active groups only."""
        from easylifeauth.services.user_service import UserService

        db = _mock_db()
        db.roles.find.return_value = _empty_cursor()

        # Only active groups are returned by the query (status filter in query)
        async def groups_cursor():
            # This group is active - should be included
            yield {"groupId": "active-grp", "domains": ["finance"], "status": "active"}

        db.groups.find.return_value = groups_cursor()

        svc = UserService(db, MagicMock())
        user = {"domains": [], "roles": [], "groups": ["active-grp", "inactive-grp"]}
        result = await svc.resolve_user_domains(user)

        # Should only have domains from active group
        assert "finance" in result

        # Verify the query included status filter
        call_args = db.groups.find.call_args
        query = call_args[0][0] if call_args[0] else call_args[1].get("filter", {})
        assert query.get("status") == "active"

    @pytest.mark.asyncio
    async def test_no_active_groups_returns_empty(self):
        from easylifeauth.services.user_service import UserService

        db = _mock_db()
        db.roles.find.return_value = _empty_cursor()
        db.groups.find.return_value = _empty_cursor()

        svc = UserService(db, MagicMock())
        user = {"domains": [], "roles": [], "groups": ["inactive-grp"]}
        result = await svc.resolve_user_domains(user)
        assert result == []


# ===========================================================================
# 8. resolve_user_permissions (UserService)
# ===========================================================================
class TestResolveUserPermissions:
    """Tests for UserService.resolve_user_permissions."""

    @pytest.mark.asyncio
    async def test_permissions_from_roles(self):
        from easylifeauth.services.user_service import UserService

        db = _mock_db()

        async def roles_cursor():
            yield {"roleId": "r1", "permissions": ["read", "write"], "status": "active"}

        db.roles.find.return_value = roles_cursor()
        db.groups.find.return_value = _empty_cursor()

        svc = UserService(db, MagicMock())
        user = {"roles": ["r1"], "groups": []}
        result = await svc.resolve_user_permissions(user)
        assert set(result) == {"read", "write"}

    @pytest.mark.asyncio
    async def test_permissions_from_groups(self):
        from easylifeauth.services.user_service import UserService

        db = _mock_db()
        db.roles.find.return_value = _empty_cursor()

        async def groups_cursor():
            yield {"groupId": "g1", "permissions": ["read", "export"], "status": "active"}

        db.groups.find.return_value = groups_cursor()

        svc = UserService(db, MagicMock())
        user = {"roles": [], "groups": ["g1"]}
        result = await svc.resolve_user_permissions(user)
        assert set(result) == {"read", "export"}

    @pytest.mark.asyncio
    async def test_combined_permissions_deduplicated(self):
        from easylifeauth.services.user_service import UserService

        db = _mock_db()

        async def roles_cursor():
            yield {"roleId": "r1", "permissions": ["read", "write"], "status": "active"}

        async def groups_cursor():
            yield {"groupId": "g1", "permissions": ["read", "delete"], "status": "active"}

        db.roles.find.return_value = roles_cursor()
        db.groups.find.return_value = groups_cursor()

        svc = UserService(db, MagicMock())
        user = {"roles": ["r1"], "groups": ["g1"]}
        result = await svc.resolve_user_permissions(user)
        assert set(result) == {"read", "write", "delete"}

    @pytest.mark.asyncio
    async def test_empty_user_no_permissions(self):
        from easylifeauth.services.user_service import UserService

        db = _mock_db()
        db.roles.find.return_value = _empty_cursor()
        db.groups.find.return_value = _empty_cursor()

        svc = UserService(db, MagicMock())
        user = {"roles": [], "groups": []}
        result = await svc.resolve_user_permissions(user)
        assert result == []


# ===========================================================================
# 9. Group types endpoint
# ===========================================================================
class TestGroupTypesEndpoint:

    def test_get_group_types(self):
        app = FastAPI()
        app.include_router(router)

        user = _user("group-administrator")
        app.dependency_overrides[require_group_admin] = lambda: user
        app.dependency_overrides[require_super_admin] = lambda: user
        app.dependency_overrides[dependencies.get_db] = lambda: _mock_db()
        app.dependency_overrides[dependencies.get_email_service] = lambda: _mock_email_service()

        client = TestClient(app)
        resp = client.get("/groups/types")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert all("value" in item and "label" in item for item in data)


# ===========================================================================
# 10. Get group users endpoint
# ===========================================================================
class TestGetGroupUsers:

    @pytest.fixture
    def _app(self):
        def factory():
            app = FastAPI()
            app.include_router(router)
            db = _mock_db()
            user = _user("super-administrator")

            app.dependency_overrides[require_group_admin] = lambda: user
            app.dependency_overrides[require_super_admin] = lambda: user
            app.dependency_overrides[dependencies.get_db] = lambda: db
            app.dependency_overrides[dependencies.get_email_service] = lambda: _mock_email_service()

            return TestClient(app, raise_server_exceptions=False), db
        return factory

    def test_get_users_of_group(self, _app):
        client, db = _app()
        oid = ObjectId()
        db.groups.find_one = AsyncMock(return_value={
            "_id": oid, "groupId": "editors",
        })

        async def user_cursor():
            yield {"_id": ObjectId(), "email": "u1@ex.com", "full_name": "U1", "groups": ["editors"]}
            yield {"_id": ObjectId(), "email": "u2@ex.com", "full_name": "U2", "groups": ["editors"]}

        db.users.find.return_value = user_cursor()

        resp = client.get(f"/groups/{oid}/users")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2

    def test_get_users_group_not_found(self, _app):
        client, db = _app()
        db.groups.find_one = AsyncMock(return_value=None)

        resp = client.get("/groups/nonexistent/users")
        assert resp.status_code == 404
