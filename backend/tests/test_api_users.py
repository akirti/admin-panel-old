"""Tests for Users API Routes"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from bson import ObjectId

from easylifeauth.api.users_routes import router, create_pagination_meta
from easylifeauth.api import dependencies
from easylifeauth.security.access_control import CurrentUser, require_super_admin, require_admin, require_group_admin, get_current_user


class TestPaginationMeta:
    """Tests for pagination metadata helper"""

    def test_create_pagination_meta_basic(self):
        """Test basic pagination meta creation"""
        meta = create_pagination_meta(total=100, page=0, limit=25)
        assert meta.total == 100
        assert meta.page == 0
        assert meta.limit == 25
        assert meta.pages == 4
        assert meta.has_next is True
        assert meta.has_prev is False

    def test_create_pagination_meta_last_page(self):
        """Test pagination meta for last page"""
        meta = create_pagination_meta(total=100, page=3, limit=25)
        assert meta.has_next is False
        assert meta.has_prev is True

    def test_create_pagination_meta_middle_page(self):
        """Test pagination meta for middle page"""
        meta = create_pagination_meta(total=100, page=2, limit=25)
        assert meta.has_next is True
        assert meta.has_prev is True

    def test_create_pagination_meta_zero_limit(self):
        """Test pagination with zero limit"""
        meta = create_pagination_meta(total=100, page=0, limit=0)
        assert meta.pages == 0

    def test_create_pagination_meta_single_page(self):
        """Test pagination with single page"""
        meta = create_pagination_meta(total=10, page=0, limit=25)
        assert meta.pages == 1
        assert meta.has_next is False
        assert meta.has_prev is False


class TestUsersRoutes:
    """Tests for users management endpoints"""

    @pytest.fixture
    def mock_super_admin_user(self):
        """Create mock super admin user"""
        return CurrentUser(
            user_id="507f1f77bcf86cd799439011",
            email="admin@example.com",
            roles=["super-administrator"],
            groups=[],
            domains=[]
        )

    @pytest.fixture
    def mock_db(self):
        """Create mock database"""
        db = MagicMock()
        db.users = MagicMock()
        db.users.find_one = AsyncMock()
        db.users.find = MagicMock()
        db.users.insert_one = AsyncMock()
        db.users.update_one = AsyncMock()
        db.users.delete_one = AsyncMock()
        db.users.count_documents = AsyncMock(return_value=0)
        db.roles = MagicMock()
        db.roles.find_one = AsyncMock(return_value=None)
        db.groups = MagicMock()
        db.groups.find_one = AsyncMock(return_value=None)
        return db

    @pytest.fixture
    def mock_email_service(self):
        """Create mock email service"""
        service = MagicMock()
        service.send_welcome_email = AsyncMock()
        service.send_password_reset_email = AsyncMock()
        return service

    @pytest.fixture
    def mock_activity_log(self):
        """Create mock activity log service"""
        service = MagicMock()
        service.log = AsyncMock()
        return service

    @pytest.fixture
    def app(self, mock_super_admin_user, mock_db, mock_email_service, mock_activity_log):
        """Create test FastAPI app"""
        app = FastAPI()
        app.include_router(router)

        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin_user
        app.dependency_overrides[require_admin] = lambda: mock_super_admin_user
        app.dependency_overrides[require_group_admin] = lambda: mock_super_admin_user
        app.dependency_overrides[get_current_user] = lambda: mock_super_admin_user
        app.dependency_overrides[dependencies.get_db] = lambda: mock_db
        app.dependency_overrides[dependencies.get_email_service] = lambda: mock_email_service
        app.dependency_overrides[dependencies.get_activity_log_service] = lambda: mock_activity_log

        return app

    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return TestClient(app)

    def test_list_users_empty(self, client, mock_db):
        """Test listing users when empty"""
        mock_db.users.count_documents = AsyncMock(return_value=0)

        async def empty_cursor():
            return
            yield  # Makes it an async generator

        # Create a proper chain mock where each method returns an object that has the next method
        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = empty_cursor()
        mock_db.users.find.return_value = mock_cursor

        response = client.get("/users")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data

    def test_list_users_with_filters(self, client, mock_db):
        """Test listing users with filters"""
        mock_db.users.count_documents = AsyncMock(return_value=0)

        async def empty_cursor():
            return
            yield

        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = empty_cursor()
        mock_db.users.find.return_value = mock_cursor

        response = client.get("/users?is_active=true&search=test")
        assert response.status_code == 200

    def test_count_users(self, client, mock_db):
        """Test counting users"""
        mock_db.users.count_documents = AsyncMock(return_value=42)

        response = client.get("/users/count")
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 42

    def test_count_users_with_filter(self, client, mock_db):
        """Test counting users with filter"""
        mock_db.users.count_documents = AsyncMock(return_value=10)

        response = client.get("/users/count?is_active=true")
        assert response.status_code == 200

    def test_get_user_success(self, client, mock_db):
        """Test getting a specific user"""
        user_data = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "username": "testuser",
            "full_name": "Test User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "domains": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        mock_db.users.find_one.return_value = user_data

        response = client.get("/users/507f1f77bcf86cd799439011")
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"

    def test_get_user_not_found(self, client, mock_db):
        """Test getting non-existent user"""
        mock_db.users.find_one.return_value = None

        response = client.get("/users/nonexistent")
        assert response.status_code == 404

    def test_create_user_success(self, client, mock_db, mock_email_service, mock_activity_log):
        """Test creating a new user"""
        mock_db.users.find_one.return_value = None  # No existing user
        mock_db.users.insert_one.return_value = MagicMock(
            inserted_id=ObjectId("507f1f77bcf86cd799439011")
        )

        response = client.post("/users", json={
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "password123",
            "full_name": "New User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "domains": [],
            "send_password_email": False
        })

        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        mock_activity_log.log.assert_called_once()

    def test_create_user_email_exists(self, client, mock_db):
        """Test creating user with existing email"""
        mock_db.users.find_one.return_value = {"email": "existing@example.com"}

        response = client.post("/users", json={
            "email": "existing@example.com",
            "username": "newuser",
            "password": "password123",
            "full_name": "New User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "domains": []
        })

        assert response.status_code == 400
        assert "Email already registered" in response.json()["detail"]

    def test_create_user_username_exists(self, client, mock_db):
        """Test creating user with existing username"""
        # First call returns None (email doesn't exist)
        # Second call returns user (username exists)
        mock_db.users.find_one.side_effect = [None, {"username": "existinguser"}]

        response = client.post("/users", json={
            "email": "new@example.com",
            "username": "existinguser",
            "password": "password123",
            "full_name": "New User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "domains": []
        })

        assert response.status_code == 400
        assert "Username already taken" in response.json()["detail"]

    def test_create_user_with_email(self, client, mock_db, mock_email_service, mock_activity_log):
        """Test creating user with welcome email"""
        mock_db.users.find_one.return_value = None
        mock_db.users.insert_one.return_value = MagicMock(
            inserted_id=ObjectId("507f1f77bcf86cd799439011")
        )

        response = client.post("/users", json={
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "password123",
            "full_name": "New User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "domains": [],
            "send_password_email": True
        })

        assert response.status_code == 201
        mock_email_service.send_welcome_email.assert_called_once()

    def test_update_user_success(self, client, mock_db, mock_activity_log):
        """Test updating a user"""
        existing_user = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "username": "testuser",
            "full_name": "Test User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "domains": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        mock_db.users.find_one.return_value = existing_user

        response = client.put("/users/507f1f77bcf86cd799439011", json={
            "full_name": "Updated Name"
        })

        assert response.status_code == 200
        mock_db.users.update_one.assert_called_once()
        mock_activity_log.log.assert_called_once()

    def test_update_user_not_found(self, client, mock_db):
        """Test updating non-existent user"""
        mock_db.users.find_one.return_value = None

        response = client.put("/users/nonexistent", json={
            "full_name": "Updated Name"
        })

        assert response.status_code == 404

    def test_delete_user_success(self, client, mock_db, mock_activity_log):
        """Test deleting a user"""
        mock_db.users.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com"
        }
        mock_db.users.delete_one.return_value = MagicMock(deleted_count=1)

        response = client.delete("/users/507f1f77bcf86cd799439011")
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]
        mock_activity_log.log.assert_called_once()

    def test_delete_user_not_found(self, client, mock_db):
        """Test deleting non-existent user"""
        mock_db.users.find_one.return_value = None
        mock_db.users.delete_one.return_value = MagicMock(deleted_count=0)

        response = client.delete("/users/nonexistent")
        assert response.status_code == 404

    def test_toggle_user_status(self, client, mock_db, mock_activity_log):
        """Test toggling user status"""
        mock_db.users.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "is_active": True
        }

        response = client.post("/users/507f1f77bcf86cd799439011/toggle-status")
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False  # Toggled from True

    def test_toggle_user_status_not_found(self, client, mock_db):
        """Test toggling status of non-existent user"""
        mock_db.users.find_one.return_value = None

        response = client.post("/users/nonexistent/toggle-status")
        assert response.status_code == 404

    def test_send_password_reset_email(self, client, mock_db, mock_email_service):
        """Test sending password reset email"""
        mock_db.users.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "full_name": "Test User"
        }

        response = client.post("/users/507f1f77bcf86cd799439011/send-password-reset?send_email=true")
        assert response.status_code == 200
        mock_email_service.send_password_reset_email.assert_called_once()

    def test_send_password_reset_no_email(self, client, mock_db, mock_email_service):
        """Test password reset without sending email"""
        mock_db.users.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "full_name": "Test User"
        }

        response = client.post("/users/507f1f77bcf86cd799439011/send-password-reset?send_email=false")
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        mock_email_service.send_password_reset_email.assert_not_called()

    def test_admin_reset_password(self, client, mock_db, mock_email_service):
        """Test admin resetting user password"""
        mock_db.users.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "full_name": "Test User"
        }

        response = client.post("/users/507f1f77bcf86cd799439011/reset-password?send_email=true")
        assert response.status_code == 200
        mock_db.users.update_one.assert_called_once()
        mock_email_service.send_welcome_email.assert_called_once()

    def test_admin_reset_password_no_email(self, client, mock_db, mock_email_service):
        """Test admin reset password without email"""
        mock_db.users.find_one.return_value = {
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "full_name": "Test User"
        }

        response = client.post("/users/507f1f77bcf86cd799439011/reset-password?send_email=false")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    def test_admin_reset_password_not_found(self, client, mock_db):
        """Test admin reset password for non-existent user"""
        mock_db.users.find_one.return_value = None

        response = client.post("/users/nonexistent/reset-password")
        assert response.status_code == 404


class TestResolveRolesAndGroups:
    """Tests for resolve_roles and resolve_groups helper functions."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.roles = MagicMock()
        db.roles.find_one = AsyncMock(return_value=None)
        db.groups = MagicMock()
        db.groups.find_one = AsyncMock(return_value=None)
        return db

    @pytest.mark.asyncio
    async def test_resolve_roles_empty_list(self, mock_db):
        """resolve_roles returns [] when given empty list (line 46)."""
        from easylifeauth.api.users_routes import resolve_roles
        result = await resolve_roles(mock_db, [])
        assert result == []

    @pytest.mark.asyncio
    async def test_resolve_roles_by_object_id(self, mock_db):
        """resolve_roles resolves valid ObjectId to roleId key (lines 52-55)."""
        from easylifeauth.api.users_routes import resolve_roles
        oid = str(ObjectId())
        mock_db.roles.find_one = AsyncMock(return_value={"_id": ObjectId(oid), "roleId": "editor"})

        result = await resolve_roles(mock_db, [oid])
        assert result == ["editor"]
        mock_db.roles.find_one.assert_called_once_with({"_id": ObjectId(oid)})

    @pytest.mark.asyncio
    async def test_resolve_roles_by_role_id_key(self, mock_db):
        """resolve_roles resolves roleId key string (line 60)."""
        from easylifeauth.api.users_routes import resolve_roles
        # First call (ObjectId lookup) returns None because 'editor' is not a valid ObjectId
        # So it falls through to roleId lookup
        mock_db.roles.find_one = AsyncMock(return_value={"roleId": "editor"})

        result = await resolve_roles(mock_db, ["editor"])
        assert result == ["editor"]

    @pytest.mark.asyncio
    async def test_resolve_roles_unknown_ref_kept(self, mock_db):
        """resolve_roles keeps unknown refs as-is (line 63)."""
        from easylifeauth.api.users_routes import resolve_roles
        mock_db.roles.find_one = AsyncMock(return_value=None)

        result = await resolve_roles(mock_db, ["nonexistent-role"])
        assert result == ["nonexistent-role"]

    @pytest.mark.asyncio
    async def test_resolve_roles_objectid_not_found_falls_through(self, mock_db):
        """resolve_roles falls through to roleId lookup when ObjectId not found (lines 51-60)."""
        from easylifeauth.api.users_routes import resolve_roles
        oid = str(ObjectId())
        # First call with _id returns None, second call with roleId returns the role
        mock_db.roles.find_one = AsyncMock(side_effect=[None, {"roleId": oid}])

        result = await resolve_roles(mock_db, [oid])
        assert result == [oid]

    @pytest.mark.asyncio
    async def test_resolve_groups_empty_list(self, mock_db):
        """resolve_groups returns [] when given empty list (line 74)."""
        from easylifeauth.api.users_routes import resolve_groups
        result = await resolve_groups(mock_db, [])
        assert result == []

    @pytest.mark.asyncio
    async def test_resolve_groups_by_object_id(self, mock_db):
        """resolve_groups resolves valid ObjectId to groupId key (lines 80-84)."""
        from easylifeauth.api.users_routes import resolve_groups
        oid = str(ObjectId())
        mock_db.groups.find_one = AsyncMock(return_value={"_id": ObjectId(oid), "groupId": "team-a"})

        result = await resolve_groups(mock_db, [oid])
        assert result == ["team-a"]

    @pytest.mark.asyncio
    async def test_resolve_groups_by_group_id_key(self, mock_db):
        """resolve_groups resolves groupId key string (lines 88-89)."""
        from easylifeauth.api.users_routes import resolve_groups
        mock_db.groups.find_one = AsyncMock(return_value={"groupId": "team-a"})

        result = await resolve_groups(mock_db, ["team-a"])
        assert result == ["team-a"]

    @pytest.mark.asyncio
    async def test_resolve_groups_unknown_ref_kept(self, mock_db):
        """resolve_groups keeps unknown refs as-is (line 92)."""
        from easylifeauth.api.users_routes import resolve_groups
        mock_db.groups.find_one = AsyncMock(return_value=None)

        result = await resolve_groups(mock_db, ["nonexistent-group"])
        assert result == ["nonexistent-group"]

    @pytest.mark.asyncio
    async def test_resolve_groups_objectid_not_found_falls_through(self, mock_db):
        """resolve_groups falls through to groupId lookup when ObjectId not found."""
        from easylifeauth.api.users_routes import resolve_groups
        oid = str(ObjectId())
        mock_db.groups.find_one = AsyncMock(side_effect=[None, {"groupId": oid}])

        result = await resolve_groups(mock_db, [oid])
        assert result == [oid]


class TestAssignedCustomers:
    """Tests for GET /users/me/assigned-customers endpoint."""

    @pytest.fixture
    def mock_user(self):
        return CurrentUser(
            user_id="507f1f77bcf86cd799439011",
            email="user@example.com",
            roles=["user"],
            groups=["group-a"],
            domains=[]
        )

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.users = MagicMock()
        db.users.find_one = AsyncMock()
        db.groups = MagicMock()
        db.groups.find = MagicMock()
        db.customers = MagicMock()
        db.customers.find = MagicMock()
        return db

    @pytest.fixture
    def app(self, mock_user, mock_db):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[require_group_admin] = lambda: mock_user
        app.dependency_overrides[require_admin] = lambda: mock_user
        app.dependency_overrides[require_super_admin] = lambda: mock_user
        app.dependency_overrides[dependencies.get_db] = lambda: mock_db
        app.dependency_overrides[dependencies.get_email_service] = lambda: None
        app.dependency_overrides[dependencies.get_activity_log_service] = lambda: None
        return app

    @pytest.fixture
    def client(self, app):
        return TestClient(app)

    def test_assigned_customers_direct_assignments(self, client, mock_db):
        """Test getting directly assigned customers (lines 186-189)."""
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "customers": ["CUST-001", "CUST-002"],
            "groups": []
        })

        async def customer_cursor():
            for c in [
                {"customerId": "CUST-001", "name": "Customer One", "tags": ["vip"], "unit": "U1"},
                {"customerId": "CUST-002", "name": "Customer Two", "tags": [], "unit": "U2"},
            ]:
                yield c

        mock_find = MagicMock()
        mock_find.sort.return_value = customer_cursor()
        mock_db.customers.find.return_value = mock_find

        response = client.get("/users/me/assigned-customers")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["customers"]) == 2
        assert data["customers"][0]["customerId"] == "CUST-001"
        assert data["customers"][0]["source"] == "direct"

    def test_assigned_customers_via_groups(self, client, mock_db):
        """Test getting customers assigned via groups (lines 192-203)."""
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "customers": [],
            "groups": ["group-a"]
        })

        async def group_cursor():
            yield {"groupId": "group-a", "name": "Group A", "type": "customers", "status": "active", "customers": ["CUST-010"]}

        mock_db.groups.find.return_value = group_cursor()

        async def customer_cursor():
            yield {"customerId": "CUST-010", "name": "Group Customer", "tags": ["tag1"], "unit": "U3"}

        mock_find = MagicMock()
        mock_find.sort.return_value = customer_cursor()
        mock_db.customers.find.return_value = mock_find

        response = client.get("/users/me/assigned-customers")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["customers"][0]["source"] == "Group A"

    def test_assigned_customers_no_assignments(self, client, mock_db):
        """Test when user has no customer assignments (line 206)."""
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "customers": [],
            "groups": []
        })

        response = client.get("/users/me/assigned-customers")
        assert response.status_code == 200
        data = response.json()
        assert data["customers"] == []
        assert data["total"] == 0

    def test_assigned_customers_with_search(self, client, mock_db):
        """Test assigned customers with search filter (lines 212-224)."""
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "customers": ["CUST-001", "CUST-002"],
            "groups": []
        })

        async def customer_cursor():
            yield {"customerId": "CUST-001", "name": "Matching Customer", "tags": [], "unit": "U1"}

        mock_find = MagicMock()
        mock_find.sort.return_value = customer_cursor()
        mock_db.customers.find.return_value = mock_find

        response = client.get("/users/me/assigned-customers?search=Matching")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

    def test_assigned_customers_with_tag_filter(self, client, mock_db):
        """Test assigned customers with tag filter (lines 226-227)."""
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "customers": ["CUST-001"],
            "groups": []
        })

        async def customer_cursor():
            yield {"customerId": "CUST-001", "name": "VIP Customer", "tags": ["vip"], "unit": "U1"}

        mock_find = MagicMock()
        mock_find.sort.return_value = customer_cursor()
        mock_db.customers.find.return_value = mock_find

        response = client.get("/users/me/assigned-customers?tag=vip")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

    def test_assigned_customers_with_search_and_tag(self, client, mock_db):
        """Test assigned customers with both search and tag filters."""
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "customers": ["CUST-001"],
            "groups": []
        })

        async def customer_cursor():
            yield {"customerId": "CUST-001", "name": "VIP Customer", "tags": ["vip"], "unit": "U1"}

        mock_find = MagicMock()
        mock_find.sort.return_value = customer_cursor()
        mock_db.customers.find.return_value = mock_find

        response = client.get("/users/me/assigned-customers?search=VIP&tag=vip")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

    def test_assigned_customers_direct_and_group_merged(self, client, mock_db):
        """Test dedup: direct assignment takes precedence over group (lines 188-203)."""
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "customers": ["CUST-001"],
            "groups": ["group-a"]
        })

        async def group_cursor():
            yield {
                "groupId": "group-a", "name": "Group A",
                "type": "customers", "status": "active",
                "customers": ["CUST-001", "CUST-002"]
            }

        mock_db.groups.find.return_value = group_cursor()

        async def customer_cursor():
            for c in [
                {"customerId": "CUST-001", "name": "Shared", "tags": [], "unit": "U1"},
                {"customerId": "CUST-002", "name": "Group Only", "tags": [], "unit": "U2"},
            ]:
                yield c

        mock_find = MagicMock()
        mock_find.sort.return_value = customer_cursor()
        mock_db.customers.find.return_value = mock_find

        response = client.get("/users/me/assigned-customers")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        # CUST-001 was direct, should stay "direct"
        cust_001 = [c for c in data["customers"] if c["customerId"] == "CUST-001"][0]
        assert cust_001["source"] == "direct"
        # CUST-002 was only from group
        cust_002 = [c for c in data["customers"] if c["customerId"] == "CUST-002"][0]
        assert cust_002["source"] == "Group A"


class TestCustomerTags:
    """Tests for GET /users/me/customer-tags endpoint."""

    @pytest.fixture
    def mock_user(self):
        return CurrentUser(
            user_id="507f1f77bcf86cd799439011",
            email="user@example.com",
            roles=["user"],
            groups=["group-a"],
            domains=[]
        )

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.users = MagicMock()
        db.users.find_one = AsyncMock()
        db.groups = MagicMock()
        db.groups.find = MagicMock()
        db.customers = MagicMock()
        db.customers.aggregate = MagicMock()
        return db

    @pytest.fixture
    def app(self, mock_user, mock_db):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[require_group_admin] = lambda: mock_user
        app.dependency_overrides[require_admin] = lambda: mock_user
        app.dependency_overrides[require_super_admin] = lambda: mock_user
        app.dependency_overrides[dependencies.get_db] = lambda: mock_db
        app.dependency_overrides[dependencies.get_email_service] = lambda: None
        app.dependency_overrides[dependencies.get_activity_log_service] = lambda: None
        return app

    @pytest.fixture
    def client(self, app):
        return TestClient(app)

    def test_customer_tags_from_direct_customers(self, client, mock_db):
        """Test tag aggregation from directly assigned customers (lines 252-281)."""
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "customers": ["CUST-001", "CUST-002"],
            "groups": []
        })

        async def agg_cursor():
            for doc in [{"_id": "finance"}, {"_id": "vip"}]:
                yield doc

        mock_db.customers.aggregate.return_value = agg_cursor()

        response = client.get("/users/me/customer-tags")
        assert response.status_code == 200
        data = response.json()
        assert data["tags"] == ["finance", "vip"]

    def test_customer_tags_from_group_customers(self, client, mock_db):
        """Test tag aggregation including group-assigned customers (lines 256-265)."""
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "customers": ["CUST-001"],
            "groups": ["group-a"]
        })

        async def group_cursor():
            yield {
                "groupId": "group-a", "type": "customers",
                "status": "active", "customers": ["CUST-002"]
            }

        mock_db.groups.find.return_value = group_cursor()

        async def agg_cursor():
            for doc in [{"_id": "enterprise"}, {"_id": "premium"}]:
                yield doc

        mock_db.customers.aggregate.return_value = agg_cursor()

        response = client.get("/users/me/customer-tags")
        assert response.status_code == 200
        data = response.json()
        assert "enterprise" in data["tags"]
        assert "premium" in data["tags"]

    def test_customer_tags_no_customers(self, client, mock_db):
        """Test tag aggregation when user has no customers (line 268)."""
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "customers": [],
            "groups": []
        })

        response = client.get("/users/me/customer-tags")
        assert response.status_code == 200
        data = response.json()
        assert data["tags"] == []

    def test_customer_tags_dedup_group_customers(self, client, mock_db):
        """Test that duplicate customerIds from groups are deduplicated (line 264)."""
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "customers": ["CUST-001"],
            "groups": ["group-a"]
        })

        async def group_cursor():
            yield {
                "groupId": "group-a", "type": "customers",
                "status": "active", "customers": ["CUST-001", "CUST-002"]
            }

        mock_db.groups.find.return_value = group_cursor()

        async def agg_cursor():
            yield {"_id": "tag1"}

        mock_db.customers.aggregate.return_value = agg_cursor()

        response = client.get("/users/me/customer-tags")
        assert response.status_code == 200
        # Verify the pipeline was called with deduplicated customer list
        mock_db.customers.aggregate.assert_called_once()
        pipeline = mock_db.customers.aggregate.call_args[0][0]
        customer_ids_in_query = pipeline[0]["$match"]["customerId"]["$in"]
        # CUST-001 should not be duplicated
        assert len(customer_ids_in_query) == 2
        assert "CUST-001" in customer_ids_in_query
        assert "CUST-002" in customer_ids_in_query


class TestSendPasswordResetEmailExtended:
    """Extended tests for POST /users/{id}/send-password-reset."""

    @pytest.fixture
    def mock_super_admin(self):
        return CurrentUser(
            user_id="507f1f77bcf86cd799439011",
            email="admin@example.com",
            roles=["super-administrator"],
            groups=[],
            domains=[]
        )

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.users = MagicMock()
        db.users.find_one = AsyncMock()
        db.users.update_one = AsyncMock()
        db.roles = MagicMock()
        db.roles.find_one = AsyncMock(return_value=None)
        db.groups = MagicMock()
        db.groups.find_one = AsyncMock(return_value=None)
        return db

    @pytest.fixture
    def mock_email_service(self):
        service = MagicMock()
        service.send_password_reset_email = AsyncMock()
        service.send_welcome_email = AsyncMock()
        return service

    @pytest.fixture
    def app(self, mock_super_admin, mock_db, mock_email_service):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        app.dependency_overrides[require_admin] = lambda: mock_super_admin
        app.dependency_overrides[require_group_admin] = lambda: mock_super_admin
        app.dependency_overrides[get_current_user] = lambda: mock_super_admin
        app.dependency_overrides[dependencies.get_db] = lambda: mock_db
        app.dependency_overrides[dependencies.get_email_service] = lambda: mock_email_service
        app.dependency_overrides[dependencies.get_activity_log_service] = lambda: None
        return app

    @pytest.fixture
    def client(self, app):
        return TestClient(app)

    def test_send_password_reset_email_lookup_by_email(self, client, mock_db, mock_email_service):
        """Test password reset falls back to email lookup (lines 526-527)."""
        # ObjectId("test@example.com") raises before find_one is called in the try block,
        # so find_one is only called once in the except block (email lookup).
        mock_db.users.find_one = AsyncMock(return_value=
            {"_id": ObjectId(), "email": "test@example.com", "full_name": "Test User"}
        )

        response = client.post("/users/test@example.com/send-password-reset?send_email=true")
        assert response.status_code == 200
        mock_email_service.send_password_reset_email.assert_called_once()

    def test_send_password_reset_user_not_found(self, client, mock_db):
        """Test password reset for non-existent user (line 530)."""
        mock_db.users.find_one = AsyncMock(return_value=None)

        response = client.post("/users/nonexistent/send-password-reset")
        assert response.status_code == 404

    def test_send_password_reset_email_failure(self, client, mock_db, mock_email_service):
        """Test password reset when email sending fails (lines 545-546)."""
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "full_name": "Test User"
        })
        mock_email_service.send_password_reset_email = AsyncMock(
            side_effect=Exception("SMTP connection refused")
        )

        response = client.post("/users/507f1f77bcf86cd799439011/send-password-reset?send_email=true")
        assert response.status_code == 200
        # Even on email failure the endpoint returns 200
        assert response.json()["message"] == "Password reset email sent"

    def test_send_password_reset_no_email_service(self, client, mock_db, app):
        """Test password reset when email service is None."""
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "full_name": "Test User"
        })
        # Override email service to None
        app.dependency_overrides[dependencies.get_email_service] = lambda: None

        response = client.post("/users/507f1f77bcf86cd799439011/send-password-reset?send_email=true")
        assert response.status_code == 200
        data = response.json()
        assert "token" in data


class TestAdminResetPasswordExtended:
    """Extended tests for POST /users/{id}/reset-password."""

    @pytest.fixture
    def mock_super_admin(self):
        return CurrentUser(
            user_id="507f1f77bcf86cd799439011",
            email="admin@example.com",
            roles=["super-administrator"],
            groups=[],
            domains=[]
        )

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.users = MagicMock()
        db.users.find_one = AsyncMock()
        db.users.update_one = AsyncMock()
        db.roles = MagicMock()
        db.roles.find_one = AsyncMock(return_value=None)
        db.groups = MagicMock()
        db.groups.find_one = AsyncMock(return_value=None)
        return db

    @pytest.fixture
    def mock_email_service(self):
        service = MagicMock()
        service.send_welcome_email = AsyncMock()
        service.send_password_reset_email = AsyncMock()
        return service

    @pytest.fixture
    def app(self, mock_super_admin, mock_db, mock_email_service):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        app.dependency_overrides[require_admin] = lambda: mock_super_admin
        app.dependency_overrides[require_group_admin] = lambda: mock_super_admin
        app.dependency_overrides[get_current_user] = lambda: mock_super_admin
        app.dependency_overrides[dependencies.get_db] = lambda: mock_db
        app.dependency_overrides[dependencies.get_email_service] = lambda: mock_email_service
        app.dependency_overrides[dependencies.get_activity_log_service] = lambda: None
        return app

    @pytest.fixture
    def client(self, app):
        return TestClient(app)

    def test_admin_reset_password_email_failure(self, client, mock_db, mock_email_service):
        """Test admin reset password when email delivery fails (lines 589-591)."""
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "full_name": "Test User"
        })
        mock_email_service.send_welcome_email = AsyncMock(
            side_effect=Exception("SMTP error")
        )

        response = client.post("/users/507f1f77bcf86cd799439011/reset-password?send_email=true")
        assert response.status_code == 200
        data = response.json()
        assert "email delivery failed" in data["message"]

    def test_admin_reset_password_no_email_service(self, client, mock_db, app):
        """Test admin reset password when email service is None (lines 592-593)."""
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "test@example.com",
            "full_name": "Test User"
        })
        # Override email service to None
        app.dependency_overrides[dependencies.get_email_service] = lambda: None

        response = client.post("/users/507f1f77bcf86cd799439011/reset-password?send_email=true")
        assert response.status_code == 200
        data = response.json()
        assert "not configured" in data["message"]
        mock_db.users.update_one.assert_called_once()

    def test_admin_reset_password_lookup_by_email_fallback(self, client, mock_db, mock_email_service):
        """Test admin reset password falls back to email lookup."""
        user_doc = {
            "_id": ObjectId(), "email": "test@example.com", "full_name": "Test User"
        }
        # ObjectId("test@example.com") raises before find_one, so only one find_one call
        mock_db.users.find_one = AsyncMock(return_value=user_doc)

        response = client.post("/users/test@example.com/reset-password?send_email=true")
        assert response.status_code == 200
        mock_db.users.update_one.assert_called_once()


class TestUpdateUserPrivilegeEscalation:
    """Tests for privilege escalation prevention in PUT /users/{id}."""

    @pytest.fixture
    def mock_group_admin(self):
        """A group-admin user who is NOT super-administrator."""
        return CurrentUser(
            user_id="507f1f77bcf86cd799439012",
            email="groupadmin@example.com",
            roles=["group-administrator"],
            groups=["group-a"],
            domains=[]
        )

    @pytest.fixture
    def mock_super_admin(self):
        return CurrentUser(
            user_id="507f1f77bcf86cd799439011",
            email="admin@example.com",
            roles=["super-administrator"],
            groups=[],
            domains=[]
        )

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.users = MagicMock()
        db.users.find_one = AsyncMock()
        db.users.update_one = AsyncMock()
        db.roles = MagicMock()
        db.roles.find_one = AsyncMock(return_value=None)
        db.groups = MagicMock()
        db.groups.find_one = AsyncMock(return_value=None)
        return db

    @pytest.fixture
    def mock_activity_log(self):
        service = MagicMock()
        service.log = AsyncMock()
        return service

    def _make_app(self, current_user, mock_db, mock_activity_log):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[require_super_admin] = lambda: current_user
        app.dependency_overrides[require_admin] = lambda: current_user
        app.dependency_overrides[require_group_admin] = lambda: current_user
        app.dependency_overrides[get_current_user] = lambda: current_user
        app.dependency_overrides[dependencies.get_db] = lambda: mock_db
        app.dependency_overrides[dependencies.get_email_service] = lambda: None
        app.dependency_overrides[dependencies.get_activity_log_service] = lambda: mock_activity_log
        return app

    def test_group_admin_cannot_assign_admin_role(self, mock_group_admin, mock_db, mock_activity_log):
        """Non-super-admin cannot assign administrator role (lines 399-408)."""
        existing_user = {
            "_id": ObjectId("507f1f77bcf86cd799439013"),
            "email": "target@example.com",
            "username": "target",
            "full_name": "Target User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "customers": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        mock_db.users.find_one = AsyncMock(return_value=existing_user)

        app = self._make_app(mock_group_admin, mock_db, mock_activity_log)
        client = TestClient(app)

        response = client.put("/users/507f1f77bcf86cd799439013", json={
            "roles": ["administrator"]
        })

        assert response.status_code == 403
        assert "Insufficient permissions" in response.json()["detail"]

    def test_group_admin_cannot_assign_super_admin_role(self, mock_group_admin, mock_db, mock_activity_log):
        """Non-super-admin cannot assign super-administrator role (lines 401-405)."""
        existing_user = {
            "_id": ObjectId("507f1f77bcf86cd799439013"),
            "email": "target@example.com",
            "username": "target",
            "full_name": "Target User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "customers": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        mock_db.users.find_one = AsyncMock(return_value=existing_user)

        app = self._make_app(mock_group_admin, mock_db, mock_activity_log)
        client = TestClient(app)

        response = client.put("/users/507f1f77bcf86cd799439013", json={
            "roles": ["super-administrator"]
        })

        assert response.status_code == 403

    def test_super_admin_can_assign_admin_role(self, mock_super_admin, mock_db, mock_activity_log):
        """Super-admin CAN assign administrator role (line 402 guard passes)."""
        existing_user = {
            "_id": ObjectId("507f1f77bcf86cd799439013"),
            "email": "target@example.com",
            "username": "target",
            "full_name": "Target User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "customers": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        # First call returns existing, second call (after update) returns updated
        updated_user = {**existing_user, "roles": ["administrator"]}
        mock_db.users.find_one = AsyncMock(side_effect=[existing_user, updated_user])

        app = self._make_app(mock_super_admin, mock_db, mock_activity_log)
        client = TestClient(app)

        response = client.put("/users/507f1f77bcf86cd799439013", json={
            "roles": ["administrator"]
        })

        assert response.status_code == 200
        mock_db.users.update_one.assert_called_once()

    def test_update_user_with_groups_resolves(self, mock_super_admin, mock_db, mock_activity_log):
        """Test that updating user groups triggers resolve_groups (line 410)."""
        existing_user = {
            "_id": ObjectId("507f1f77bcf86cd799439013"),
            "email": "target@example.com",
            "username": "target",
            "full_name": "Target User",
            "is_active": True,
            "roles": ["user"],
            "groups": [],
            "customers": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        updated_user = {**existing_user, "groups": ["team-a"]}
        mock_db.users.find_one = AsyncMock(side_effect=[existing_user, updated_user])
        # resolve_groups will try to look up groups by groupId key
        mock_db.groups.find_one = AsyncMock(return_value={"groupId": "team-a"})

        app = self._make_app(mock_super_admin, mock_db, mock_activity_log)
        client = TestClient(app)

        response = client.put("/users/507f1f77bcf86cd799439013", json={
            "groups": ["team-a"]
        })

        assert response.status_code == 200
        mock_db.groups.find_one.assert_called()


class TestListUsersExtended:
    """Extended tests for GET /users with search, role, and group filters."""

    @pytest.fixture
    def mock_super_admin(self):
        return CurrentUser(
            user_id="507f1f77bcf86cd799439011",
            email="admin@example.com",
            roles=["super-administrator"],
            groups=[],
            domains=[]
        )

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.users = MagicMock()
        db.users.find_one = AsyncMock()
        db.users.find = MagicMock()
        db.users.count_documents = AsyncMock(return_value=0)
        db.roles = MagicMock()
        db.roles.find_one = AsyncMock(return_value=None)
        db.groups = MagicMock()
        db.groups.find_one = AsyncMock(return_value=None)
        return db

    @pytest.fixture
    def app(self, mock_super_admin, mock_db):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        app.dependency_overrides[require_admin] = lambda: mock_super_admin
        app.dependency_overrides[require_group_admin] = lambda: mock_super_admin
        app.dependency_overrides[get_current_user] = lambda: mock_super_admin
        app.dependency_overrides[dependencies.get_db] = lambda: mock_db
        app.dependency_overrides[dependencies.get_email_service] = lambda: None
        app.dependency_overrides[dependencies.get_activity_log_service] = lambda: None
        return app

    @pytest.fixture
    def client(self, app):
        return TestClient(app)

    def _setup_cursor(self, mock_db, users):
        """Helper to setup a mock cursor returning given users."""
        async def user_cursor():
            for u in users:
                yield u

        mock_cursor = MagicMock()
        mock_cursor.skip.return_value = mock_cursor
        mock_cursor.limit.return_value = mock_cursor
        mock_cursor.sort.return_value = user_cursor()
        mock_db.users.find.return_value = mock_cursor

    def test_list_users_with_role_filter(self, client, mock_db):
        """Test listing users filtered by role (line 136)."""
        mock_db.users.count_documents = AsyncMock(return_value=0)
        self._setup_cursor(mock_db, [])

        response = client.get("/users?role=editor")
        assert response.status_code == 200

    def test_list_users_with_group_filter(self, client, mock_db):
        """Test listing users filtered by group (line 138)."""
        mock_db.users.count_documents = AsyncMock(return_value=0)
        self._setup_cursor(mock_db, [])

        response = client.get("/users?group=team-a")
        assert response.status_code == 200

    def test_list_users_with_role_and_group_filters(self, client, mock_db):
        """Test listing users with both role and group filters."""
        mock_db.users.count_documents = AsyncMock(return_value=0)
        self._setup_cursor(mock_db, [])

        response = client.get("/users?role=editor&group=team-a")
        assert response.status_code == 200

    def test_list_users_returns_users_data(self, client, mock_db):
        """Test list users iterates cursor and strips password_hash (lines 148-150)."""
        now = datetime.utcnow()
        users = [
            {
                "_id": ObjectId("507f1f77bcf86cd799439011"),
                "email": "alice@example.com",
                "username": "alice",
                "full_name": "Alice",
                "is_active": True,
                "roles": ["user"],
                "groups": [],
                "customers": [],
                "password_hash": "hashed_secret",
                "created_at": now,
                "updated_at": now,
            },
            {
                "_id": ObjectId("507f1f77bcf86cd799439012"),
                "email": "bob@example.com",
                "username": "bob",
                "full_name": "Bob",
                "is_active": True,
                "roles": ["editor"],
                "groups": ["team-a"],
                "customers": [],
                "password_hash": "hashed_other",
                "created_at": now,
                "updated_at": now,
            },
        ]
        mock_db.users.count_documents = AsyncMock(return_value=2)
        self._setup_cursor(mock_db, users)

        response = client.get("/users")
        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 2
        assert data["pagination"]["total"] == 2
        # Ensure password_hash is not in the response
        for user in data["data"]:
            assert "password_hash" not in user

    def test_list_users_search_with_all_filters(self, client, mock_db):
        """Test listing with search, role, group, and is_active combined."""
        mock_db.users.count_documents = AsyncMock(return_value=0)
        self._setup_cursor(mock_db, [])

        response = client.get("/users?search=alice&role=editor&group=team-a&is_active=true")
        assert response.status_code == 200

    def test_list_users_pagination(self, client, mock_db):
        """Test listing users with custom pagination."""
        mock_db.users.count_documents = AsyncMock(return_value=50)
        self._setup_cursor(mock_db, [])

        response = client.get("/users?page=2&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert data["pagination"]["page"] == 2
        assert data["pagination"]["limit"] == 10
        assert data["pagination"]["total"] == 50
        assert data["pagination"]["pages"] == 5


class TestCreateUserExtended:
    """Extended tests for POST /users - email sending and activity logging."""

    @pytest.fixture
    def mock_super_admin(self):
        return CurrentUser(
            user_id="507f1f77bcf86cd799439011",
            email="admin@example.com",
            roles=["super-administrator"],
            groups=[],
            domains=[]
        )

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.users = MagicMock()
        db.users.find_one = AsyncMock(return_value=None)
        db.users.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId("507f1f77bcf86cd799439099"))
        )
        db.roles = MagicMock()
        db.roles.find_one = AsyncMock(return_value=None)
        db.groups = MagicMock()
        db.groups.find_one = AsyncMock(return_value=None)
        return db

    @pytest.fixture
    def mock_email_service(self):
        service = MagicMock()
        service.send_welcome_email = AsyncMock()
        service.send_password_reset_email = AsyncMock()
        return service

    @pytest.fixture
    def mock_activity_log(self):
        service = MagicMock()
        service.log = AsyncMock()
        return service

    @pytest.fixture
    def app(self, mock_super_admin, mock_db, mock_email_service, mock_activity_log):
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        app.dependency_overrides[require_admin] = lambda: mock_super_admin
        app.dependency_overrides[require_group_admin] = lambda: mock_super_admin
        app.dependency_overrides[get_current_user] = lambda: mock_super_admin
        app.dependency_overrides[dependencies.get_db] = lambda: mock_db
        app.dependency_overrides[dependencies.get_email_service] = lambda: mock_email_service
        app.dependency_overrides[dependencies.get_activity_log_service] = lambda: mock_activity_log
        return app

    @pytest.fixture
    def client(self, app):
        return TestClient(app)

    def test_create_user_with_groups_resolves(self, client, mock_db, mock_activity_log):
        """Test creating user with groups triggers resolve_groups (line 339)."""
        mock_db.groups.find_one = AsyncMock(return_value={"groupId": "team-a"})

        response = client.post("/users", json={
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "password123",
            "full_name": "New User",
            "is_active": True,
            "roles": [],
            "groups": ["team-a"],
            "customers": [],
            "send_password_email": False
        })

        assert response.status_code == 201
        mock_db.groups.find_one.assert_called()

    def test_create_user_email_send_failure(self, client, mock_db, mock_email_service, mock_activity_log):
        """Test create user succeeds even when welcome email fails (lines 357-358)."""
        mock_email_service.send_welcome_email = AsyncMock(
            side_effect=Exception("SMTP connection error")
        )

        response = client.post("/users", json={
            "email": "newuser@example.com",
            "username": "newuser",
            "password": "password123",
            "full_name": "New User",
            "is_active": True,
            "roles": [],
            "groups": [],
            "customers": [],
            "send_password_email": True
        })

        # User creation should still succeed even if email fails
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        mock_email_service.send_welcome_email.assert_called_once()
        mock_activity_log.log.assert_called_once()

    def test_create_user_activity_log_called(self, client, mock_db, mock_activity_log):
        """Test that activity log is called on user creation (lines 362-369)."""
        response = client.post("/users", json={
            "email": "logged@example.com",
            "username": "loggeduser",
            "password": "password123",
            "full_name": "Logged User",
            "is_active": True,
            "roles": [],
            "groups": [],
            "customers": [],
            "send_password_email": False
        })

        assert response.status_code == 201
        mock_activity_log.log.assert_called_once()
        call_kwargs = mock_activity_log.log.call_args
        assert call_kwargs[1]["action"] == "create" or call_kwargs.kwargs["action"] == "create"
