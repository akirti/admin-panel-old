"""
Extended tests for Roles API Routes.

Covers uncovered lines in roles_routes.py:
  - resolve_permissions (lines 27, 33-36, 41)
  - resolve_domains (lines 55-75)
  - notify_users_of_role_change exception handling (lines 104-105)
  - list_roles with domain/permission filters (lines 130, 132, 142-143)
  - count_roles with status filter (line 160)
  - create_role with permissions/domains resolution (lines 206-208)
  - update_role with permissions/domains resolution + notification (lines 245-247)
  - delete_role roleId fallback not-found path (lines 285-286)
"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from bson import ObjectId

from easylifeauth.api.roles_routes import (
    router,
    resolve_permissions,
    resolve_domains,
    notify_users_of_role_change,
)
from easylifeauth.api import dependencies
from easylifeauth.security.access_control import CurrentUser, require_group_admin


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_OID = "507f1f77bcf86cd799439011"
VALID_OID_2 = "607f1f77bcf86cd799439022"


def _make_role(
    oid=VALID_OID,
    role_id="editor",
    name="Editor",
    description="Editor role",
    permissions=None,
    domains=None,
    status="active",
    priority=2,
):
    """Return a role document dict suitable for mongo mock returns."""
    return {
        "_id": ObjectId(oid),
        "roleId": role_id,
        "name": name,
        "description": description,
        "permissions": permissions or ["read"],
        "domains": domains or [],
        "status": status,
        "priority": priority,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }


async def _empty_async_gen():
    """Async generator that yields nothing."""
    return
    yield  # noqa: unreachable – required to make this an async generator


# ---------------------------------------------------------------------------
# Unit tests for resolve_permissions
# ---------------------------------------------------------------------------


class TestResolvePermissions:
    """Direct unit tests for the resolve_permissions helper."""

    @pytest.mark.asyncio
    async def test_empty_list_returns_empty(self):
        """Line 27: empty permission_refs returns [] immediately."""
        db = MagicMock()
        result = await resolve_permissions(db, [])
        assert result == []

    @pytest.mark.asyncio
    async def test_valid_object_id_resolves(self):
        """Lines 33-36: A valid ObjectId string is looked up by _id and resolved to its permissionId key."""
        db = MagicMock()
        db.permissions = MagicMock()
        db.permissions.find_one = AsyncMock(
            return_value={"_id": ObjectId(VALID_OID), "permissionId": "perm.read"}
        )

        result = await resolve_permissions(db, [VALID_OID])
        assert result == ["perm.read"]
        # Should have been called with an ObjectId filter
        db.permissions.find_one.assert_called_once_with({"_id": ObjectId(VALID_OID)})

    @pytest.mark.asyncio
    async def test_permission_id_key_resolves(self):
        """Line 41: A non-ObjectId string is looked up by permissionId key."""
        db = MagicMock()
        db.permissions = MagicMock()
        # First call (ObjectId.is_valid("perm.read") is False so this path is skipped)
        # The function goes straight to find_one({"permissionId": ref})
        db.permissions.find_one = AsyncMock(
            return_value={"_id": ObjectId(VALID_OID), "permissionId": "perm.read"}
        )

        result = await resolve_permissions(db, ["perm.read"])
        assert result == ["perm.read"]
        db.permissions.find_one.assert_called_once_with({"permissionId": "perm.read"})

    @pytest.mark.asyncio
    async def test_unknown_ref_kept_as_is(self):
        """Lines 43-44: When a ref is not found by either lookup, the original value is kept."""
        db = MagicMock()
        db.permissions = MagicMock()
        db.permissions.find_one = AsyncMock(return_value=None)

        result = await resolve_permissions(db, ["unknown.perm"])
        assert result == ["unknown.perm"]

    @pytest.mark.asyncio
    async def test_valid_oid_not_found_falls_through_to_key_lookup(self):
        """When a valid ObjectId is not found by _id, it falls through to permissionId lookup."""
        db = MagicMock()
        db.permissions = MagicMock()

        async def side_effect(query):
            if "_id" in query:
                return None  # Not found by _id
            if "permissionId" in query:
                return {"_id": ObjectId(VALID_OID_2), "permissionId": VALID_OID}
            return None

        db.permissions.find_one = AsyncMock(side_effect=side_effect)

        result = await resolve_permissions(db, [VALID_OID])
        assert result == [VALID_OID]
        assert db.permissions.find_one.call_count == 2

    @pytest.mark.asyncio
    async def test_mixed_refs(self):
        """Multiple refs of different types in a single call."""
        db = MagicMock()
        db.permissions = MagicMock()

        oid = VALID_OID

        async def side_effect(query):
            if "_id" in query:
                return {"_id": ObjectId(oid), "permissionId": "perm.admin"}
            if "permissionId" in query:
                key = query["permissionId"]
                if key == "perm.write":
                    return {"_id": ObjectId(VALID_OID_2), "permissionId": "perm.write"}
                return None  # unknown
            return None

        db.permissions.find_one = AsyncMock(side_effect=side_effect)

        result = await resolve_permissions(db, [oid, "perm.write", "unknown.x"])
        assert result == ["perm.admin", "perm.write", "unknown.x"]


# ---------------------------------------------------------------------------
# Unit tests for resolve_domains
# ---------------------------------------------------------------------------


class TestResolveDomains:
    """Direct unit tests for the resolve_domains helper."""

    @pytest.mark.asyncio
    async def test_empty_list_returns_empty(self):
        """Line 55: empty domain_refs returns [] immediately."""
        db = MagicMock()
        result = await resolve_domains(db, [])
        assert result == []

    @pytest.mark.asyncio
    async def test_valid_object_id_resolves(self):
        """Lines 61-65: A valid ObjectId string is looked up by _id in data_domains."""
        db = MagicMock()
        db.data_domains = MagicMock()
        db.data_domains.find_one = AsyncMock(
            return_value={"_id": ObjectId(VALID_OID), "domainId": "domain.finance"}
        )

        result = await resolve_domains(db, [VALID_OID])
        assert result == ["domain.finance"]
        db.data_domains.find_one.assert_called_once_with({"_id": ObjectId(VALID_OID)})

    @pytest.mark.asyncio
    async def test_domain_id_key_resolves(self):
        """Lines 68-70: A non-ObjectId string is looked up by domainId key."""
        db = MagicMock()
        db.data_domains = MagicMock()
        db.data_domains.find_one = AsyncMock(
            return_value={"_id": ObjectId(VALID_OID), "domainId": "domain.hr"}
        )

        result = await resolve_domains(db, ["domain.hr"])
        assert result == ["domain.hr"]
        db.data_domains.find_one.assert_called_once_with({"domainId": "domain.hr"})

    @pytest.mark.asyncio
    async def test_unknown_ref_kept_as_is(self):
        """Lines 71-73: When a domain ref is not found, the original value is kept."""
        db = MagicMock()
        db.data_domains = MagicMock()
        db.data_domains.find_one = AsyncMock(return_value=None)

        result = await resolve_domains(db, ["unknown.domain"])
        assert result == ["unknown.domain"]

    @pytest.mark.asyncio
    async def test_valid_oid_not_found_falls_through(self):
        """Valid ObjectId not found by _id falls through to domainId lookup, then not found."""
        db = MagicMock()
        db.data_domains = MagicMock()
        db.data_domains.find_one = AsyncMock(return_value=None)

        result = await resolve_domains(db, [VALID_OID])
        # Not found by _id, not found by domainId either -> kept as-is
        assert result == [VALID_OID]
        assert db.data_domains.find_one.call_count == 2

    @pytest.mark.asyncio
    async def test_mixed_domain_refs(self):
        """Multiple domain refs of different types resolved correctly."""
        db = MagicMock()
        db.data_domains = MagicMock()

        oid = VALID_OID

        async def side_effect(query):
            if "_id" in query:
                return {"_id": ObjectId(oid), "domainId": "domain.resolved"}
            if "domainId" in query:
                key = query["domainId"]
                if key == "domain.sales":
                    return {"_id": ObjectId(VALID_OID_2), "domainId": "domain.sales"}
                return None
            return None

        db.data_domains.find_one = AsyncMock(side_effect=side_effect)

        result = await resolve_domains(db, [oid, "domain.sales", "nope"])
        assert result == ["domain.resolved", "domain.sales", "nope"]


# ---------------------------------------------------------------------------
# Unit tests for notify_users_of_role_change (exception path)
# ---------------------------------------------------------------------------


class TestNotifyUsersOfRoleChangeExtended:
    """Additional tests for notify_users_of_role_change."""

    @pytest.mark.asyncio
    async def test_no_email_service_returns_early(self):
        """Line 93-94: When email_service is None, returns immediately without querying users."""
        db = MagicMock()
        await notify_users_of_role_change(db, "role1", {"status": "changed"}, None)
        db.users.find.assert_not_called()

    @pytest.mark.asyncio
    async def test_email_exception_is_swallowed(self):
        """Lines 104-105: Exception during email send is caught and does not propagate."""
        db = MagicMock()
        email_service = MagicMock()
        email_service.send_role_change_notification = AsyncMock(
            side_effect=Exception("SMTP failure")
        )

        async def user_gen():
            yield {"_id": ObjectId(), "email": "u@example.com", "full_name": "User"}

        db.users.find.return_value = user_gen()

        # Should NOT raise
        await notify_users_of_role_change(
            db, "role1", {"permissions": "changed"}, email_service
        )
        email_service.send_role_change_notification.assert_called_once()

    @pytest.mark.asyncio
    async def test_user_without_full_name_falls_back_to_email(self):
        """Line 100: user.get('full_name', user['email']) falls back to email when full_name absent."""
        db = MagicMock()
        email_service = MagicMock()
        email_service.send_role_change_notification = AsyncMock()

        async def user_gen():
            yield {"_id": ObjectId(), "email": "nofullname@example.com"}

        db.users.find.return_value = user_gen()

        await notify_users_of_role_change(
            db, "role1", {"status": "changed"}, email_service
        )
        email_service.send_role_change_notification.assert_called_once_with(
            "nofullname@example.com",
            "nofullname@example.com",  # fallback
            "role",
            {"status": "changed"},
        )


# ---------------------------------------------------------------------------
# Route-level tests using TestClient
# ---------------------------------------------------------------------------


class TestRolesRoutesExtended:
    """Extended route tests targeting uncovered lines."""

    @pytest.fixture
    def mock_user(self):
        return CurrentUser(
            user_id="507f1f77bcf86cd799439011",
            email="admin@example.com",
            roles=["super-administrator"],
            groups=["administrator"],
            domains=["all"],
        )

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.roles = MagicMock()
        db.roles.find_one = AsyncMock()
        mock_roles_cursor = MagicMock()
        mock_roles_cursor.to_list = AsyncMock(return_value=[])
        db.roles.find = MagicMock(return_value=mock_roles_cursor)
        db.roles.insert_one = AsyncMock()
        db.roles.update_one = AsyncMock()
        db.roles.delete_one = AsyncMock()
        db.roles.count_documents = AsyncMock(return_value=0)
        db.users = MagicMock()
        mock_users_cursor = MagicMock()
        mock_users_cursor.to_list = AsyncMock(return_value=[])
        db.users.find = MagicMock(return_value=mock_users_cursor)
        db.users.update_many = AsyncMock()
        db.permissions = MagicMock()
        db.permissions.find_one = AsyncMock(return_value=None)
        db.data_domains = MagicMock()
        db.data_domains.find_one = AsyncMock(return_value=None)
        return db

    @pytest.fixture
    def mock_email_service(self):
        service = MagicMock()
        service.send_role_change_notification = AsyncMock()
        return service

    @pytest.fixture
    def app(self, mock_user, mock_db, mock_email_service):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[require_group_admin] = lambda: mock_user
        app.dependency_overrides[dependencies.get_db] = lambda: mock_db
        app.dependency_overrides[dependencies.get_email_service] = lambda: mock_email_service
        return app

    @pytest.fixture
    def client(self, app):
        return TestClient(app)

    # -----------------------------------------------------------------------
    # list_roles with domain and permission filters (lines 130, 132, 142-143)
    # -----------------------------------------------------------------------

    def test_list_roles_with_domain_filter(self, client, mock_db):
        """Line 130: domain query parameter adds 'domains' to the mongo query."""
        role = _make_role(domains=["domain.finance"])

        async def role_gen():
            yield role

        mock_db.roles.count_documents = AsyncMock(return_value=1)
        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = role_gen()
        mock_db.roles.find.return_value = mock_cursor

        response = client.get("/roles?domain=domain.finance")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 1
        assert data["data"][0]["roleId"] == "editor"

        # Verify the query dict passed to find included the domain filter
        call_args = mock_db.roles.find.call_args
        query_used = call_args[0][0] if call_args[0] else call_args[1].get("filter", {})
        assert query_used.get("domains") == "domain.finance"

    def test_list_roles_with_permission_filter(self, client, mock_db):
        """Line 132: permission query parameter adds 'permissions' to the mongo query."""
        role = _make_role(permissions=["perm.write"])

        async def role_gen():
            yield role

        mock_db.roles.count_documents = AsyncMock(return_value=1)
        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = role_gen()
        mock_db.roles.find.return_value = mock_cursor

        response = client.get("/roles?permission=perm.write")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 1

        call_args = mock_db.roles.find.call_args
        query_used = call_args[0][0] if call_args[0] else call_args[1].get("filter", {})
        assert query_used.get("permissions") == "perm.write"

    def test_list_roles_with_domain_and_permission_filters(self, client, mock_db):
        """Both domain and permission filters applied together."""
        mock_db.roles.count_documents = AsyncMock(return_value=0)
        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = _empty_async_gen()
        mock_db.roles.find.return_value = mock_cursor

        response = client.get("/roles?domain=d1&permission=p1&status=active")
        assert response.status_code == 200

        call_args = mock_db.roles.find.call_args
        query_used = call_args[0][0] if call_args[0] else call_args[1].get("filter", {})
        assert query_used["domains"] == "d1"
        assert query_used["permissions"] == "p1"
        assert query_used["status"] == "active"

    def test_list_roles_iterates_cursor_and_builds_role_objects(self, client, mock_db):
        """Lines 142-143: Each role document is transformed (str(_id)) and appended."""
        roles = [
            _make_role(oid=VALID_OID, role_id="role-a"),
            _make_role(oid=VALID_OID_2, role_id="role-b"),
        ]

        async def role_gen():
            for r in roles:
                yield r

        mock_db.roles.count_documents = AsyncMock(return_value=2)
        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = role_gen()
        mock_db.roles.find.return_value = mock_cursor

        response = client.get("/roles")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 2
        assert data["data"][0]["roleId"] == "role-a"
        assert data["data"][1]["roleId"] == "role-b"

    # -----------------------------------------------------------------------
    # count_roles with status filter (line 160)
    # -----------------------------------------------------------------------

    def test_count_roles_with_status_filter(self, client, mock_db):
        """Line 160: status query param adds 'status' to count query."""
        mock_db.roles.count_documents = AsyncMock(return_value=3)

        response = client.get("/roles/count?status=active")
        assert response.status_code == 200
        assert response.json()["count"] == 3

        # Verify the query included the status filter
        mock_db.roles.count_documents.assert_called_once_with({"status": "active"})

    def test_count_roles_without_status_filter(self, client, mock_db):
        """Without status param, count query is empty dict."""
        mock_db.roles.count_documents = AsyncMock(return_value=10)

        response = client.get("/roles/count")
        assert response.status_code == 200
        assert response.json()["count"] == 10
        mock_db.roles.count_documents.assert_called_once_with({})

    # -----------------------------------------------------------------------
    # create_role with permission/domain resolution (lines 206-208)
    # -----------------------------------------------------------------------

    def test_create_role_resolves_permissions(self, client, mock_db):
        """Line 206: permissions list is resolved via resolve_permissions."""
        mock_db.roles.find_one.return_value = None  # no duplicate
        mock_db.roles.insert_one.return_value = MagicMock(
            inserted_id=ObjectId(VALID_OID)
        )
        # resolve_permissions will look up each ref
        mock_db.permissions.find_one = AsyncMock(
            return_value={"_id": ObjectId(VALID_OID), "permissionId": "perm.resolved"}
        )

        response = client.post(
            "/roles",
            json={
                "roleId": "new-role",
                "name": "New Role",
                "description": "A new role",
                "permissions": ["perm.resolved"],
                "status": "active",
                "priority": 5,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["roleId"] == "new-role"
        # The permission should have been resolved (looked up by permissionId key)
        assert "perm.resolved" in data["permissions"]

    def test_create_role_resolves_domains(self, client, mock_db):
        """Line 208: domains list is resolved via resolve_domains."""
        mock_db.roles.find_one.return_value = None
        mock_db.roles.insert_one.return_value = MagicMock(
            inserted_id=ObjectId(VALID_OID)
        )
        mock_db.data_domains.find_one = AsyncMock(
            return_value={"_id": ObjectId(VALID_OID), "domainId": "domain.sales"}
        )

        response = client.post(
            "/roles",
            json={
                "roleId": "sales-role",
                "name": "Sales Role",
                "description": "Role for sales",
                "permissions": [],
                "domains": ["domain.sales"],
                "status": "active",
                "priority": 3,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "domain.sales" in data["domains"]

    def test_create_role_resolves_permissions_with_objectid(self, client, mock_db):
        """Permissions containing a valid ObjectId string are resolved by _id lookup."""
        mock_db.roles.find_one.return_value = None
        mock_db.roles.insert_one.return_value = MagicMock(
            inserted_id=ObjectId(VALID_OID)
        )
        mock_db.permissions.find_one = AsyncMock(
            return_value={
                "_id": ObjectId(VALID_OID_2),
                "permissionId": "perm.from_oid",
            }
        )

        response = client.post(
            "/roles",
            json={
                "roleId": "oid-role",
                "name": "OID Role",
                "description": "Role with OID permission",
                "permissions": [VALID_OID_2],
                "status": "active",
                "priority": 1,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "perm.from_oid" in data["permissions"]

    def test_create_role_resolves_domains_with_objectid(self, client, mock_db):
        """Domains containing a valid ObjectId string are resolved by _id lookup."""
        mock_db.roles.find_one.return_value = None
        mock_db.roles.insert_one.return_value = MagicMock(
            inserted_id=ObjectId(VALID_OID)
        )
        mock_db.data_domains.find_one = AsyncMock(
            return_value={
                "_id": ObjectId(VALID_OID_2),
                "domainId": "domain.from_oid",
            }
        )

        response = client.post(
            "/roles",
            json={
                "roleId": "oid-domain-role",
                "name": "OID Domain Role",
                "description": "Role with OID domain",
                "permissions": [],
                "domains": [VALID_OID_2],
                "status": "active",
                "priority": 1,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "domain.from_oid" in data["domains"]

    # -----------------------------------------------------------------------
    # update_role with permission/domain resolution (lines 245-247)
    # -----------------------------------------------------------------------

    def test_update_role_resolves_permissions(self, client, mock_db, mock_email_service):
        """Line 245: permissions in update payload are resolved."""
        existing = _make_role(permissions=["old.perm"])
        updated = _make_role(permissions=["perm.new"])

        # find_one is called multiple times: first for existing, then after update
        mock_db.roles.find_one = AsyncMock(side_effect=[existing, updated])
        mock_db.permissions.find_one = AsyncMock(
            return_value={"_id": ObjectId(VALID_OID_2), "permissionId": "perm.new"}
        )
        mock_db.users.find.return_value = _empty_async_gen()

        response = client.put(
            f"/roles/{VALID_OID}",
            json={"permissions": ["perm.new"]},
        )
        assert response.status_code == 200
        mock_db.roles.update_one.assert_called_once()

    def test_update_role_resolves_domains(self, client, mock_db, mock_email_service):
        """Line 247: domains in update payload are resolved."""
        existing = _make_role(domains=["old.domain"])
        updated = _make_role(domains=["domain.new"])

        mock_db.roles.find_one = AsyncMock(side_effect=[existing, updated])
        mock_db.data_domains.find_one = AsyncMock(
            return_value={"_id": ObjectId(VALID_OID_2), "domainId": "domain.new"}
        )
        mock_db.users.find.return_value = _empty_async_gen()

        response = client.put(
            f"/roles/{VALID_OID}",
            json={"domains": ["domain.new"]},
        )
        assert response.status_code == 200

    def test_update_role_permission_change_notifies_users(
        self, client, mock_db, mock_email_service
    ):
        """Lines 261-262: When permissions change, notify_users_of_role_change is called."""
        existing = _make_role(permissions=["read"])
        updated = _make_role(permissions=["read", "write"])

        mock_db.roles.find_one = AsyncMock(side_effect=[existing, updated])
        mock_db.permissions.find_one = AsyncMock(return_value=None)  # kept as-is

        async def user_gen():
            yield {
                "_id": ObjectId(),
                "email": "notified@example.com",
                "full_name": "Notified User",
            }

        mock_db.users.find.return_value = user_gen()

        response = client.put(
            f"/roles/{VALID_OID}",
            json={"permissions": ["read", "write"]},
        )
        assert response.status_code == 200
        # Email service should have been called for the user
        mock_email_service.send_role_change_notification.assert_called_once()

    def test_update_role_domain_change_notifies_users(
        self, client, mock_db, mock_email_service
    ):
        """When domains change, notify_users_of_role_change is called."""
        existing = _make_role(domains=[])
        updated = _make_role(domains=["domain.new"])

        mock_db.roles.find_one = AsyncMock(side_effect=[existing, updated])
        mock_db.data_domains.find_one = AsyncMock(return_value=None)

        async def user_gen():
            yield {
                "_id": ObjectId(),
                "email": "u@example.com",
                "full_name": "U",
            }

        mock_db.users.find.return_value = user_gen()

        response = client.put(
            f"/roles/{VALID_OID}",
            json={"domains": ["domain.new"]},
        )
        assert response.status_code == 200
        mock_email_service.send_role_change_notification.assert_called_once()

    def test_update_role_no_significant_changes_skips_notification(
        self, client, mock_db, mock_email_service
    ):
        """When only description changes (not permissions/domains/status), no notification."""
        existing = _make_role(description="Old desc")
        updated = _make_role(description="New desc")

        mock_db.roles.find_one = AsyncMock(side_effect=[existing, updated])

        response = client.put(
            f"/roles/{VALID_OID}",
            json={"description": "New desc"},
        )
        assert response.status_code == 200
        # No notification should be sent
        mock_email_service.send_role_change_notification.assert_not_called()

    # -----------------------------------------------------------------------
    # delete_role roleId fallback not-found (lines 285-286)
    # -----------------------------------------------------------------------

    def test_delete_role_roleid_fallback_not_found(self, client, mock_db):
        """Lines 285-286: When ObjectId conversion raises and roleId lookup returns None,
        a synthetic result with deleted_count=0 is created and 404 is returned."""
        # "not-a-valid-oid" will cause ObjectId() to raise in the route
        mock_db.roles.delete_one = AsyncMock(side_effect=Exception("invalid oid"))
        mock_db.roles.find_one = AsyncMock(return_value=None)

        response = client.delete("/roles/not-a-valid-oid")
        assert response.status_code == 404
        assert "Role not found" in response.json()["detail"]

    def test_delete_role_roleid_fallback_found_and_deleted(self, client, mock_db):
        """When ObjectId conversion raises but roleId lookup finds the role, it gets deleted."""
        role_doc = {
            "_id": ObjectId(VALID_OID),
            "roleId": "my-role",
        }
        mock_db.roles.find_one = AsyncMock(return_value=role_doc)
        # ObjectId("my-role") raises before delete_one is called in the try block,
        # so delete_one is only called once in the except block with the real _id.
        mock_db.roles.delete_one = AsyncMock(
            return_value=MagicMock(deleted_count=1)
        )

        response = client.delete("/roles/my-role")
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]
        mock_db.users.update_many.assert_called_once()

    def test_delete_role_by_valid_oid_not_found(self, client, mock_db):
        """Valid ObjectId that matches no document returns 404."""
        mock_db.roles.delete_one = AsyncMock(
            return_value=MagicMock(deleted_count=0)
        )

        response = client.delete(f"/roles/{VALID_OID}")
        assert response.status_code == 404
        assert "Role not found" in response.json()["detail"]
