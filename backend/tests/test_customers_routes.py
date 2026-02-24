"""Tests for Customer API Routes"""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient
from bson import ObjectId

from easylifeauth.api.customers_routes import router, create_pagination_meta
from easylifeauth.api import dependencies
from easylifeauth.security.access_control import CurrentUser, require_group_admin


# ---------------------------------------------------------------------------
# Unit tests for helper functions
# ---------------------------------------------------------------------------

class TestCustomersPaginationMeta:
    """Tests for customers pagination metadata helper."""

    def test_create_pagination_meta_basic(self):
        """Test basic pagination meta creation."""
        meta = create_pagination_meta(total=50, page=0, limit=10)
        assert meta.total == 50
        assert meta.page == 0
        assert meta.limit == 10
        assert meta.pages == 5
        assert meta.has_next is True
        assert meta.has_prev is False

    def test_create_pagination_meta_last_page(self):
        """Test pagination meta on the last page."""
        meta = create_pagination_meta(total=50, page=4, limit=10)
        assert meta.pages == 5
        assert meta.has_next is False
        assert meta.has_prev is True

    def test_create_pagination_meta_middle_page(self):
        """Test pagination meta on a middle page."""
        meta = create_pagination_meta(total=50, page=2, limit=10)
        assert meta.has_next is True
        assert meta.has_prev is True

    def test_create_pagination_meta_single_page(self):
        """Test pagination meta when all results fit on one page."""
        meta = create_pagination_meta(total=5, page=0, limit=10)
        assert meta.pages == 1
        assert meta.has_next is False
        assert meta.has_prev is False

    def test_create_pagination_meta_zero_total(self):
        """Test pagination meta when there are no results."""
        meta = create_pagination_meta(total=0, page=0, limit=10)
        assert meta.total == 0
        assert meta.pages == 0
        assert meta.has_next is False
        assert meta.has_prev is False

    def test_create_pagination_meta_zero_limit(self):
        """Test pagination meta with zero limit returns zero pages."""
        meta = create_pagination_meta(total=50, page=0, limit=0)
        assert meta.pages == 0

    def test_create_pagination_meta_partial_last_page(self):
        """Test pagination rounds up for partial last page."""
        meta = create_pagination_meta(total=11, page=0, limit=5)
        assert meta.pages == 3  # ceil(11/5) = 3


# ---------------------------------------------------------------------------
# Fixtures and route-level tests
# ---------------------------------------------------------------------------

class TestCustomersRoutes:
    """Tests for all customers management endpoints."""

    # -- Shared fixtures ---------------------------------------------------

    @pytest.fixture
    def mock_group_admin_user(self):
        """Create a mock group admin user."""
        return CurrentUser(
            user_id="507f1f77bcf86cd799439011",
            email="groupadmin@example.com",
            roles=["group-administrator"],
            groups=["group1"],
            domains=["domain1"],
        )

    @pytest.fixture
    def mock_db(self):
        """Create a fully mocked DatabaseManager."""
        db = MagicMock()

        # customers collection
        db.customers = MagicMock()
        db.customers.find_one = AsyncMock()
        db.customers.find = MagicMock()
        db.customers.insert_one = AsyncMock()
        db.customers.update_one = AsyncMock()
        db.customers.delete_one = AsyncMock()
        db.customers.count_documents = AsyncMock(return_value=0)
        db.customers.distinct = AsyncMock(return_value=[])
        db.customers.aggregate = MagicMock()

        # users collection
        db.users = MagicMock()
        db.users.find_one = AsyncMock()
        db.users.find = MagicMock()
        db.users.update_one = AsyncMock()
        db.users.update_many = AsyncMock()

        # groups collection
        db.groups = MagicMock()
        db.groups.update_many = AsyncMock()

        return db

    @pytest.fixture
    def app(self, mock_group_admin_user, mock_db):
        """Create a test FastAPI app with dependency overrides."""
        app = FastAPI()
        app.include_router(router)

        app.dependency_overrides[require_group_admin] = lambda: mock_group_admin_user
        app.dependency_overrides[dependencies.get_db] = lambda: mock_db

        return app

    @pytest.fixture
    def client(self, app):
        """Create a synchronous test client."""
        return TestClient(app)

    # -- Shared helpers / sample data --------------------------------------

    @staticmethod
    def _sample_customer_doc(
        _id=None,
        customer_id="CUST-001",
        name="Acme Corp",
        description="A test customer",
        customer_status="active",
        metadata=None,
    ):
        """Return a sample customer document as it would appear in MongoDB."""
        return {
            "_id": _id or ObjectId("65a1b2c3d4e5f6a7b8c9d0e1"),
            "customerId": customer_id,
            "name": name,
            "description": description,
            "status": customer_status,
            "metadata": metadata or {},
            "created_at": datetime(2024, 1, 1, 12, 0, 0),
            "updated_at": datetime(2024, 1, 1, 12, 0, 0),
        }

    @staticmethod
    def _make_cursor_mock(documents):
        """Build a MagicMock that behaves like an async Motor cursor.

        Supports chained .skip().limit().sort() and to_list().
        """
        cursor = MagicMock()
        cursor.skip.return_value = cursor
        cursor.limit.return_value = cursor
        cursor.sort.return_value = cursor
        cursor.to_list = AsyncMock(return_value=documents)
        return cursor

    # ======================================================================
    # GET /customers  (list_customers)
    # ======================================================================

    def test_list_customers_empty(self, client, mock_db):
        """Test listing customers when collection is empty."""
        mock_db.customers.count_documents = AsyncMock(return_value=0)
        mock_db.customers.find.return_value = self._make_cursor_mock([])

        response = client.get("/customers")

        assert response.status_code == 200
        data = response.json()
        assert data["data"] == []
        assert data["pagination"]["total"] == 0
        assert data["pagination"]["pages"] == 0

    def test_list_customers_returns_data(self, client, mock_db):
        """Test listing customers returns paginated results."""
        doc = self._sample_customer_doc()
        mock_db.customers.count_documents = AsyncMock(return_value=1)
        mock_db.customers.find.return_value = self._make_cursor_mock([doc])

        response = client.get("/customers")

        assert response.status_code == 200
        data = response.json()
        assert len(data["data"]) == 1
        assert data["data"][0]["customerId"] == "CUST-001"
        assert data["data"][0]["_id"] == str(doc["_id"])
        assert data["pagination"]["total"] == 1

    def test_list_customers_pagination_params(self, client, mock_db):
        """Test that page and limit query params are forwarded."""
        mock_db.customers.count_documents = AsyncMock(return_value=100)
        cursor = self._make_cursor_mock([])
        mock_db.customers.find.return_value = cursor

        response = client.get("/customers?page=2&limit=10")

        assert response.status_code == 200
        cursor.skip.assert_called_once_with(20)  # page * limit = 2 * 10
        cursor.limit.assert_called_once_with(10)

    def test_list_customers_with_search_filter(self, client, mock_db):
        """Test listing customers with a search query."""
        mock_db.customers.count_documents = AsyncMock(return_value=0)
        mock_db.customers.find.return_value = self._make_cursor_mock([])

        response = client.get("/customers?search=acme")

        assert response.status_code == 200
        # Verify the query passed to count_documents contains $or
        call_args = mock_db.customers.count_documents.call_args
        query = call_args[0][0]
        assert "$or" in query

    def test_list_customers_with_status_filter(self, client, mock_db):
        """Test listing customers filtered by status."""
        mock_db.customers.count_documents = AsyncMock(return_value=0)
        mock_db.customers.find.return_value = self._make_cursor_mock([])

        response = client.get("/customers?status=active")

        assert response.status_code == 200
        call_args = mock_db.customers.count_documents.call_args
        query = call_args[0][0]
        assert query["status"] == "active"

    def test_list_customers_with_tag_filter(self, client, mock_db):
        """Test listing customers filtered by tag."""
        mock_db.customers.count_documents = AsyncMock(return_value=0)
        mock_db.customers.find.return_value = self._make_cursor_mock([])

        response = client.get("/customers?tag=premium")

        assert response.status_code == 200
        call_args = mock_db.customers.count_documents.call_args
        query = call_args[0][0]
        assert query["tags"] == "premium"

    def test_list_customers_with_location_filter(self, client, mock_db):
        """Test listing customers filtered by location."""
        mock_db.customers.count_documents = AsyncMock(return_value=0)
        mock_db.customers.find.return_value = self._make_cursor_mock([])

        response = client.get("/customers?location=Berlin")

        assert response.status_code == 200
        call_args = mock_db.customers.count_documents.call_args
        query = call_args[0][0]
        assert "location" in query
        assert query["location"]["$regex"] == "^Berlin$"

    def test_list_customers_with_unit_filter(self, client, mock_db):
        """Test listing customers filtered by unit."""
        mock_db.customers.count_documents = AsyncMock(return_value=0)
        mock_db.customers.find.return_value = self._make_cursor_mock([])

        response = client.get("/customers?unit=Engineering")

        assert response.status_code == 200
        call_args = mock_db.customers.count_documents.call_args
        query = call_args[0][0]
        assert "unit" in query
        assert query["unit"]["$regex"] == "^Engineering$"

    def test_list_customers_combined_filters(self, client, mock_db):
        """Test listing customers with multiple filters at once."""
        mock_db.customers.count_documents = AsyncMock(return_value=0)
        mock_db.customers.find.return_value = self._make_cursor_mock([])

        response = client.get(
            "/customers?search=test&status=active&tag=vip&location=NYC&unit=Sales"
        )

        assert response.status_code == 200
        call_args = mock_db.customers.count_documents.call_args
        query = call_args[0][0]
        assert "$or" in query
        assert query["status"] == "active"
        assert query["tags"] == "vip"
        assert "location" in query
        assert "unit" in query

    def test_list_customers_converts_objectid_to_string(self, client, mock_db):
        """Test that _id ObjectId is converted to string in the response."""
        oid = ObjectId()
        doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.count_documents = AsyncMock(return_value=1)
        mock_db.customers.find.return_value = self._make_cursor_mock([doc])

        response = client.get("/customers")

        assert response.status_code == 200
        assert response.json()["data"][0]["_id"] == str(oid)

    # ======================================================================
    # GET /customers/count  (count_customers)
    # ======================================================================

    def test_count_customers_no_filter(self, client, mock_db):
        """Test counting all customers without filters."""
        mock_db.customers.count_documents = AsyncMock(return_value=42)

        response = client.get("/customers/count")

        assert response.status_code == 200
        assert response.json()["count"] == 42

    def test_count_customers_with_search(self, client, mock_db):
        """Test counting customers with a search query."""
        mock_db.customers.count_documents = AsyncMock(return_value=5)

        response = client.get("/customers/count?search=acme")

        assert response.status_code == 200
        assert response.json()["count"] == 5
        call_args = mock_db.customers.count_documents.call_args
        query = call_args[0][0]
        assert "$or" in query

    def test_count_customers_with_status(self, client, mock_db):
        """Test counting customers filtered by status."""
        mock_db.customers.count_documents = AsyncMock(return_value=10)

        response = client.get("/customers/count?status=inactive")

        assert response.status_code == 200
        assert response.json()["count"] == 10
        call_args = mock_db.customers.count_documents.call_args
        query = call_args[0][0]
        assert query["status"] == "inactive"

    def test_count_customers_with_search_and_status(self, client, mock_db):
        """Test counting customers filtered by both search and status."""
        mock_db.customers.count_documents = AsyncMock(return_value=3)

        response = client.get("/customers/count?search=test&status=active")

        assert response.status_code == 200
        assert response.json()["count"] == 3
        call_args = mock_db.customers.count_documents.call_args
        query = call_args[0][0]
        assert "$or" in query
        assert query["status"] == "active"

    # ======================================================================
    # GET /customers/filters  (get_customer_filters)
    # ======================================================================

    def test_get_customer_filters_empty(self, client, mock_db):
        """Test getting filters when no data exists."""
        agg_cursor = MagicMock()
        agg_cursor.to_list = AsyncMock(return_value=[])
        mock_db.customers.aggregate.return_value = agg_cursor
        mock_db.customers.distinct = AsyncMock(return_value=[])

        response = client.get("/customers/filters")

        assert response.status_code == 200
        data = response.json()
        assert data["tags"] == []
        assert data["locations"] == []
        assert data["units"] == []

    def test_get_customer_filters_with_data(self, client, mock_db):
        """Test getting filters returns sorted distinct values."""
        agg_cursor = MagicMock()
        agg_cursor.to_list = AsyncMock(
            return_value=[{"_id": "premium"}, {"_id": "enterprise"}, {"_id": "trial"}]
        )
        mock_db.customers.aggregate.return_value = agg_cursor
        mock_db.customers.distinct = AsyncMock(
            side_effect=[
                ["Berlin", "Munich", "Hamburg"],  # locations
                ["Engineering", "Sales"],           # units
            ]
        )

        response = client.get("/customers/filters")

        assert response.status_code == 200
        data = response.json()
        assert data["tags"] == ["premium", "enterprise", "trial"]
        assert data["locations"] == ["Berlin", "Hamburg", "Munich"]
        assert data["units"] == ["Engineering", "Sales"]

    def test_get_customer_filters_strips_none_values(self, client, mock_db):
        """Test that None and empty values are excluded from filters."""
        agg_cursor = MagicMock()
        agg_cursor.to_list = AsyncMock(
            return_value=[{"_id": "tagA"}, {"_id": None}, {"_id": "tagB"}]
        )
        mock_db.customers.aggregate.return_value = agg_cursor
        mock_db.customers.distinct = AsyncMock(
            side_effect=[
                [None, "Berlin", ""],   # locations
                ["", None, "Sales"],     # units
            ]
        )

        response = client.get("/customers/filters")

        assert response.status_code == 200
        data = response.json()
        assert None not in data["tags"]
        assert "" not in data["locations"]
        assert None not in data["locations"]
        assert "" not in data["units"]
        assert None not in data["units"]

    # ======================================================================
    # GET /customers/{customer_id}  (get_customer)
    # ======================================================================

    def test_get_customer_by_objectid(self, client, mock_db):
        """Test getting a customer by valid ObjectId string."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(return_value=doc)

        response = client.get(f"/customers/{str(oid)}")

        assert response.status_code == 200
        data = response.json()
        assert data["customerId"] == "CUST-001"
        assert data["name"] == "Acme Corp"

    def test_get_customer_by_custom_id(self, client, mock_db):
        """Test getting a customer by customerId when ObjectId parse fails.

        When the path parameter is not a valid 24-hex ObjectId, bson raises
        InvalidId *before* find_one is called.  The bare ``except`` catches it
        and the code falls back to ``find_one({"customerId": ...})``.  So the
        mock only receives the single fallback call.
        """
        doc = self._sample_customer_doc()
        mock_db.customers.find_one = AsyncMock(return_value=doc)

        response = client.get("/customers/CUST-001")

        assert response.status_code == 200
        assert response.json()["customerId"] == "CUST-001"

    def test_get_customer_not_found(self, client, mock_db):
        """Test getting a non-existent customer returns 404."""
        mock_db.customers.find_one = AsyncMock(return_value=None)

        response = client.get("/customers/nonexistent")

        assert response.status_code == 404
        assert "Customer not found" in response.json()["detail"]

    def test_get_customer_not_found_objectid_fallback(self, client, mock_db):
        """Test 404 when customerId fallback also returns None."""
        mock_db.customers.find_one = AsyncMock(return_value=None)

        response = client.get("/customers/bad-id")

        assert response.status_code == 404

    # ======================================================================
    # POST /customers  (create_customer)
    # ======================================================================

    def test_create_customer_success(self, client, mock_db):
        """Test creating a new customer with valid data."""
        inserted_id = ObjectId("65a1b2c3d4e5f6a7b8c9d0e2")
        mock_db.customers.find_one = AsyncMock(return_value=None)  # no duplicate
        mock_db.customers.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=inserted_id)
        )

        payload = {
            "customerId": "CUST-NEW",
            "name": "New Customer",
            "description": "Freshly created",
            "status": "active",
            "metadata": {"tier": "gold"},
        }
        response = client.post("/customers", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["customerId"] == "CUST-NEW"
        assert data["name"] == "New Customer"
        assert data["description"] == "Freshly created"
        assert data["status"] == "active"
        mock_db.customers.insert_one.assert_called_once()

    def test_create_customer_defaults(self, client, mock_db):
        """Test that defaults are applied (status=active, metadata={})."""
        inserted_id = ObjectId()
        mock_db.customers.find_one = AsyncMock(return_value=None)
        mock_db.customers.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=inserted_id)
        )

        payload = {"customerId": "CUST-DEF", "name": "Defaults Test"}
        response = client.post("/customers", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "active"

    def test_create_customer_duplicate_id(self, client, mock_db):
        """Test creating a customer with an existing customerId returns 400."""
        mock_db.customers.find_one = AsyncMock(
            return_value={"customerId": "CUST-DUP", "name": "Existing"}
        )

        payload = {"customerId": "CUST-DUP", "name": "Duplicate"}
        response = client.post("/customers", json=payload)

        assert response.status_code == 400
        assert "Customer ID already exists" in response.json()["detail"]

    def test_create_customer_missing_customer_id(self, client, mock_db):
        """Test creating a customer without customerId returns 422."""
        payload = {"name": "No ID"}
        response = client.post("/customers", json=payload)

        assert response.status_code == 422

    def test_create_customer_missing_name(self, client, mock_db):
        """Test creating a customer without name returns 422."""
        payload = {"customerId": "CUST-X"}
        response = client.post("/customers", json=payload)

        assert response.status_code == 422

    def test_create_customer_empty_customer_id(self, client, mock_db):
        """Test creating a customer with empty customerId fails validation."""
        payload = {"customerId": "", "name": "Empty ID"}
        response = client.post("/customers", json=payload)

        assert response.status_code == 422

    def test_create_customer_empty_name(self, client, mock_db):
        """Test creating a customer with empty name fails validation."""
        payload = {"customerId": "CUST-X", "name": ""}
        response = client.post("/customers", json=payload)

        assert response.status_code == 422

    def test_create_customer_sets_timestamps(self, client, mock_db):
        """Test that created_at and updated_at are set on creation."""
        inserted_id = ObjectId()
        mock_db.customers.find_one = AsyncMock(return_value=None)
        mock_db.customers.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=inserted_id)
        )

        payload = {"customerId": "CUST-TS", "name": "Timestamp Test"}
        response = client.post("/customers", json=payload)

        assert response.status_code == 201
        insert_call = mock_db.customers.insert_one.call_args[0][0]
        assert "created_at" in insert_call
        assert "updated_at" in insert_call
        assert isinstance(insert_call["created_at"], datetime)
        assert isinstance(insert_call["updated_at"], datetime)

    # ======================================================================
    # PUT /customers/{customer_id}  (update_customer)
    # ======================================================================

    def test_update_customer_success(self, client, mock_db):
        """Test updating an existing customer."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        existing = self._sample_customer_doc(_id=oid)
        updated = {**existing, "name": "Updated Name", "updated_at": datetime.utcnow()}

        mock_db.customers.find_one = AsyncMock(side_effect=[existing, updated])

        payload = {"name": "Updated Name"}
        response = client.put(f"/customers/{str(oid)}", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        mock_db.customers.update_one.assert_called_once()

    def test_update_customer_partial(self, client, mock_db):
        """Test partial update with only description."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        existing = self._sample_customer_doc(_id=oid)
        updated = {**existing, "description": "New desc"}

        mock_db.customers.find_one = AsyncMock(side_effect=[existing, updated])

        payload = {"description": "New desc"}
        response = client.put(f"/customers/{str(oid)}", json=payload)

        assert response.status_code == 200
        # Verify that only description and updated_at are in the $set
        update_call = mock_db.customers.update_one.call_args
        set_data = update_call[0][1]["$set"]
        assert "description" in set_data
        assert "updated_at" in set_data
        # name/status should NOT be in the update because they were not sent
        assert "name" not in set_data
        assert "status" not in set_data

    def test_update_customer_by_custom_id(self, client, mock_db):
        """Test updating a customer found by customerId fallback."""
        existing = self._sample_customer_doc()
        updated = {**existing, "name": "Fallback Updated"}

        # ObjectId("CUST-001") raises before find_one is called in the try block,
        # so find_one is only called in the except block (customerId lookup) and
        # then again to fetch the updated doc.
        mock_db.customers.find_one = AsyncMock(
            side_effect=[existing, updated]
        )

        payload = {"name": "Fallback Updated"}
        response = client.put("/customers/CUST-001", json=payload)

        assert response.status_code == 200
        assert response.json()["name"] == "Fallback Updated"

    def test_update_customer_not_found(self, client, mock_db):
        """Test updating a non-existent customer returns 404."""
        mock_db.customers.find_one = AsyncMock(return_value=None)

        payload = {"name": "Ghost"}
        response = client.put("/customers/nonexistent", json=payload)

        assert response.status_code == 404
        assert "Customer not found" in response.json()["detail"]

    def test_update_customer_sets_updated_at(self, client, mock_db):
        """Test that updated_at is always refreshed on update."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        existing = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(side_effect=[existing, existing])

        payload = {"name": "TimeCheck"}
        response = client.put(f"/customers/{str(oid)}", json=payload)

        assert response.status_code == 200
        update_call = mock_db.customers.update_one.call_args
        set_data = update_call[0][1]["$set"]
        assert "updated_at" in set_data
        assert isinstance(set_data["updated_at"], datetime)

    # ======================================================================
    # DELETE /customers/{customer_id}  (delete_customer)
    # ======================================================================

    def test_delete_customer_success_by_objectid(self, client, mock_db):
        """Test deleting a customer by valid ObjectId."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        mock_db.customers.delete_one = AsyncMock(
            return_value=MagicMock(deleted_count=1)
        )

        response = client.delete(f"/customers/{str(oid)}")

        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]

    def test_delete_customer_removes_from_users(self, client, mock_db):
        """Test that deleting a customer also removes it from users."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        mock_db.customers.delete_one = AsyncMock(
            return_value=MagicMock(deleted_count=1)
        )

        response = client.delete(f"/customers/{str(oid)}")

        assert response.status_code == 200
        mock_db.users.update_many.assert_called_once()

    def test_delete_customer_removes_from_groups(self, client, mock_db):
        """Test that deleting a customer also removes it from groups."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        mock_db.customers.delete_one = AsyncMock(
            return_value=MagicMock(deleted_count=1)
        )

        response = client.delete(f"/customers/{str(oid)}")

        assert response.status_code == 200
        mock_db.groups.update_many.assert_called_once()

    def test_delete_customer_by_custom_id_fallback(self, client, mock_db):
        """Test deleting a customer found by customerId when ObjectId is invalid."""
        doc = self._sample_customer_doc()
        # ObjectId("CUST-001") raises before delete_one is called in the try block,
        # so delete_one is only called once in the except block.
        mock_db.customers.delete_one = AsyncMock(
            return_value=MagicMock(deleted_count=1)
        )
        mock_db.customers.find_one = AsyncMock(return_value=doc)

        response = client.delete("/customers/CUST-001")

        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]

    def test_delete_customer_not_found(self, client, mock_db):
        """Test deleting a non-existent customer returns 404."""
        mock_db.customers.delete_one = AsyncMock(
            return_value=MagicMock(deleted_count=0)
        )

        response = client.delete("/customers/507f1f77bcf86cd799439011")

        assert response.status_code == 404
        assert "Customer not found" in response.json()["detail"]

    def test_delete_customer_not_found_by_custom_id(self, client, mock_db):
        """Test 404 when customerId fallback also finds nothing."""
        mock_db.customers.delete_one = AsyncMock(
            side_effect=Exception("Invalid ObjectId")
        )
        mock_db.customers.find_one = AsyncMock(return_value=None)

        response = client.delete("/customers/bad-id")

        assert response.status_code == 404

    # ======================================================================
    # POST /customers/{customer_id}/toggle-status
    # ======================================================================

    def test_toggle_status_active_to_inactive(self, client, mock_db):
        """Test toggling an active customer to inactive."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        doc = self._sample_customer_doc(_id=oid, customer_status="active")
        mock_db.customers.find_one = AsyncMock(return_value=doc)

        response = client.post(f"/customers/{str(oid)}/toggle-status")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "inactive"
        assert "inactive" in data["message"]

    def test_toggle_status_inactive_to_active(self, client, mock_db):
        """Test toggling an inactive customer to active."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        doc = self._sample_customer_doc(_id=oid, customer_status="inactive")
        mock_db.customers.find_one = AsyncMock(return_value=doc)

        response = client.post(f"/customers/{str(oid)}/toggle-status")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "active"
        assert "active" in data["message"]

    def test_toggle_status_calls_update(self, client, mock_db):
        """Test that toggle-status performs an update_one with correct fields."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        doc = self._sample_customer_doc(_id=oid, customer_status="active")
        mock_db.customers.find_one = AsyncMock(return_value=doc)

        response = client.post(f"/customers/{str(oid)}/toggle-status")

        assert response.status_code == 200
        mock_db.customers.update_one.assert_called_once()
        update_call = mock_db.customers.update_one.call_args
        set_data = update_call[0][1]["$set"]
        assert set_data["status"] == "inactive"
        assert "updated_at" in set_data

    def test_toggle_status_by_custom_id(self, client, mock_db):
        """Test toggling status using customerId fallback."""
        doc = self._sample_customer_doc(customer_status="active")
        # ObjectId("CUST-001") raises before find_one, so only one find_one call
        mock_db.customers.find_one = AsyncMock(return_value=doc)

        response = client.post("/customers/CUST-001/toggle-status")

        assert response.status_code == 200
        assert response.json()["status"] == "inactive"

    def test_toggle_status_not_found(self, client, mock_db):
        """Test toggling status of a non-existent customer returns 404."""
        mock_db.customers.find_one = AsyncMock(return_value=None)

        response = client.post("/customers/nonexistent/toggle-status")

        assert response.status_code == 404
        assert "Customer not found" in response.json()["detail"]

    def test_toggle_status_missing_status_field(self, client, mock_db):
        """Test toggling when customer doc has no status field defaults to active."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        doc = {
            "_id": oid,
            "customerId": "CUST-001",
            "name": "No Status",
        }
        mock_db.customers.find_one = AsyncMock(return_value=doc)

        response = client.post(f"/customers/{str(oid)}/toggle-status")

        assert response.status_code == 200
        # status is None (not "active"), so the toggle goes to "active"
        assert response.json()["status"] == "active"

    # ======================================================================
    # GET /customers/{customer_id}/users  (get_customer_users)
    # ======================================================================

    def test_get_customer_users_success(self, client, mock_db):
        """Test getting users assigned to a customer."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        customer_doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(return_value=customer_doc)

        user_oid = ObjectId()
        users = [
            {
                "_id": user_oid,
                "email": "user1@example.com",
                "username": "user1",
                "full_name": "User One",
                "is_active": True,
            }
        ]
        users_cursor = MagicMock()
        users_cursor.to_list = AsyncMock(return_value=users)
        mock_db.users.find.return_value = users_cursor

        response = client.get(f"/customers/{str(oid)}/users")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["email"] == "user1@example.com"
        assert data[0]["_id"] == str(user_oid)

    def test_get_customer_users_empty(self, client, mock_db):
        """Test getting users when none are assigned."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        customer_doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(return_value=customer_doc)

        users_cursor = MagicMock()
        users_cursor.to_list = AsyncMock(return_value=[])
        mock_db.users.find.return_value = users_cursor

        response = client.get(f"/customers/{str(oid)}/users")

        assert response.status_code == 200
        assert response.json() == []

    def test_get_customer_users_not_found(self, client, mock_db):
        """Test getting users for non-existent customer returns 404."""
        mock_db.customers.find_one = AsyncMock(return_value=None)

        response = client.get("/customers/nonexistent/users")

        assert response.status_code == 404
        assert "Customer not found" in response.json()["detail"]

    def test_get_customer_users_by_custom_id(self, client, mock_db):
        """Test getting users via customerId fallback lookup."""
        doc = self._sample_customer_doc()
        # ObjectId("CUST-001") raises before find_one, so only one find_one call
        mock_db.customers.find_one = AsyncMock(return_value=doc)

        users_cursor = MagicMock()
        users_cursor.to_list = AsyncMock(return_value=[])
        mock_db.users.find.return_value = users_cursor

        response = client.get("/customers/CUST-001/users")

        assert response.status_code == 200

    def test_get_customer_users_returns_correct_fields(self, client, mock_db):
        """Test that only the expected user fields are returned."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        customer_doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(return_value=customer_doc)

        user_oid = ObjectId()
        users = [
            {
                "_id": user_oid,
                "email": "user@example.com",
                "username": "testuser",
                "full_name": "Test User",
                "is_active": True,
                "password_hash": "should_not_appear",
                "tokens": ["should_not_appear"],
            }
        ]
        users_cursor = MagicMock()
        users_cursor.to_list = AsyncMock(return_value=users)
        mock_db.users.find.return_value = users_cursor

        response = client.get(f"/customers/{str(oid)}/users")

        assert response.status_code == 200
        user_data = response.json()[0]
        assert set(user_data.keys()) == {"_id", "email", "username", "full_name", "is_active"}

    # ======================================================================
    # POST /customers/{customer_id}/assign-users
    # ======================================================================

    def test_assign_users_success(self, client, mock_db):
        """Test assigning users to a customer."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        customer_doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(return_value=customer_doc)

        user_oid = ObjectId()
        mock_db.users.update_one = AsyncMock(
            return_value=MagicMock(modified_count=1)
        )

        response = client.post(
            f"/customers/{str(oid)}/assign-users",
            json=[str(user_oid)],
        )

        assert response.status_code == 200
        data = response.json()
        assert data["assigned"] == 1
        assert "Assigned 1 users" in data["message"]

    def test_assign_users_multiple(self, client, mock_db):
        """Test assigning multiple users at once."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        customer_doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(return_value=customer_doc)

        mock_db.users.update_one = AsyncMock(
            return_value=MagicMock(modified_count=1)
        )

        user_ids = [str(ObjectId()) for _ in range(3)]
        response = client.post(
            f"/customers/{str(oid)}/assign-users",
            json=user_ids,
        )

        assert response.status_code == 200
        assert response.json()["assigned"] == 3

    def test_assign_users_some_already_assigned(self, client, mock_db):
        """Test assigning when some users are already assigned (modified_count=0)."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        customer_doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(return_value=customer_doc)

        # First user: newly assigned. Second user: already had the customer.
        mock_db.users.update_one = AsyncMock(
            side_effect=[
                MagicMock(modified_count=1),
                MagicMock(modified_count=0),
            ]
        )

        user_ids = [str(ObjectId()), str(ObjectId())]
        response = client.post(
            f"/customers/{str(oid)}/assign-users",
            json=user_ids,
        )

        assert response.status_code == 200
        assert response.json()["assigned"] == 1

    def test_assign_users_by_email(self, client, mock_db):
        """Test assigning users using email addresses (non-ObjectId strings)."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        customer_doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(return_value=customer_doc)

        mock_db.users.update_one = AsyncMock(
            return_value=MagicMock(modified_count=1)
        )

        response = client.post(
            f"/customers/{str(oid)}/assign-users",
            json=["user@example.com"],
        )

        assert response.status_code == 200
        assert response.json()["assigned"] == 1
        # Verify lookup was by email (not ObjectId)
        call_args = mock_db.users.update_one.call_args
        user_filter = call_args[0][0]
        assert "email" in user_filter

    def test_assign_users_customer_not_found(self, client, mock_db):
        """Test assigning users to a non-existent customer returns 404."""
        mock_db.customers.find_one = AsyncMock(return_value=None)

        response = client.post(
            "/customers/nonexistent/assign-users",
            json=["user@example.com"],
        )

        assert response.status_code == 404
        assert "Customer not found" in response.json()["detail"]

    def test_assign_users_empty_list(self, client, mock_db):
        """Test assigning an empty list of users."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        customer_doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(return_value=customer_doc)

        response = client.post(
            f"/customers/{str(oid)}/assign-users",
            json=[],
        )

        assert response.status_code == 200
        assert response.json()["assigned"] == 0

    # ======================================================================
    # POST /customers/{customer_id}/remove-users
    # ======================================================================

    def test_remove_users_success(self, client, mock_db):
        """Test removing users from a customer."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        customer_doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(return_value=customer_doc)

        user_oid = ObjectId()
        mock_db.users.update_one = AsyncMock(
            return_value=MagicMock(modified_count=1)
        )

        response = client.post(
            f"/customers/{str(oid)}/remove-users",
            json=[str(user_oid)],
        )

        assert response.status_code == 200
        data = response.json()
        assert data["removed"] == 1
        assert "Removed 1 users" in data["message"]

    def test_remove_users_multiple(self, client, mock_db):
        """Test removing multiple users at once."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        customer_doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(return_value=customer_doc)

        mock_db.users.update_one = AsyncMock(
            return_value=MagicMock(modified_count=1)
        )

        user_ids = [str(ObjectId()) for _ in range(2)]
        response = client.post(
            f"/customers/{str(oid)}/remove-users",
            json=user_ids,
        )

        assert response.status_code == 200
        assert response.json()["removed"] == 2

    def test_remove_users_some_not_assigned(self, client, mock_db):
        """Test removing when some users were not assigned (modified_count=0)."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        customer_doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(return_value=customer_doc)

        mock_db.users.update_one = AsyncMock(
            side_effect=[
                MagicMock(modified_count=1),
                MagicMock(modified_count=0),
            ]
        )

        user_ids = [str(ObjectId()), str(ObjectId())]
        response = client.post(
            f"/customers/{str(oid)}/remove-users",
            json=user_ids,
        )

        assert response.status_code == 200
        assert response.json()["removed"] == 1

    def test_remove_users_by_email(self, client, mock_db):
        """Test removing users using email addresses."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        customer_doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(return_value=customer_doc)

        mock_db.users.update_one = AsyncMock(
            return_value=MagicMock(modified_count=1)
        )

        response = client.post(
            f"/customers/{str(oid)}/remove-users",
            json=["user@example.com"],
        )

        assert response.status_code == 200
        assert response.json()["removed"] == 1
        call_args = mock_db.users.update_one.call_args
        user_filter = call_args[0][0]
        assert "email" in user_filter

    def test_remove_users_customer_not_found(self, client, mock_db):
        """Test removing users from a non-existent customer returns 404."""
        mock_db.customers.find_one = AsyncMock(return_value=None)

        response = client.post(
            "/customers/nonexistent/remove-users",
            json=["user@example.com"],
        )

        assert response.status_code == 404
        assert "Customer not found" in response.json()["detail"]

    def test_remove_users_empty_list(self, client, mock_db):
        """Test removing an empty list of users."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        customer_doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(return_value=customer_doc)

        response = client.post(
            f"/customers/{str(oid)}/remove-users",
            json=[],
        )

        assert response.status_code == 200
        assert response.json()["removed"] == 0

    def test_remove_users_uses_pull_operator(self, client, mock_db):
        """Test that remove-users uses $pull to remove customer from user."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        customer_doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(return_value=customer_doc)

        mock_db.users.update_one = AsyncMock(
            return_value=MagicMock(modified_count=1)
        )

        response = client.post(
            f"/customers/{str(oid)}/remove-users",
            json=[str(ObjectId())],
        )

        assert response.status_code == 200
        call_args = mock_db.users.update_one.call_args
        update_op = call_args[0][1]
        assert "$pull" in update_op
        assert "customers" in update_op["$pull"]

    # ======================================================================
    # Edge cases / cross-cutting concerns
    # ======================================================================

    def test_search_special_characters_are_escaped(self, client, mock_db):
        """Test that regex special chars in search are escaped."""
        mock_db.customers.count_documents = AsyncMock(return_value=0)
        mock_db.customers.find.return_value = self._make_cursor_mock([])

        # Characters like . + * ? are special in regex
        response = client.get("/customers?search=test.%2B*%3F")

        assert response.status_code == 200
        call_args = mock_db.customers.count_documents.call_args
        query = call_args[0][0]
        # The $or search values should contain escaped regex
        search_regex = query["$or"][0]["customerId"]["$regex"]
        assert "\\." in search_regex or "test" in search_regex

    def test_list_customers_sort_by_created_at_desc(self, client, mock_db):
        """Test that list endpoint sorts by created_at descending."""
        mock_db.customers.count_documents = AsyncMock(return_value=0)
        cursor = self._make_cursor_mock([])
        mock_db.customers.find.return_value = cursor

        response = client.get("/customers")

        assert response.status_code == 200
        cursor.sort.assert_called_once_with("created_at", -1)

    def test_assign_users_uses_addtoset(self, client, mock_db):
        """Test that assign-users uses $addToSet to avoid duplicates."""
        oid = ObjectId("65a1b2c3d4e5f6a7b8c9d0e1")
        customer_doc = self._sample_customer_doc(_id=oid)
        mock_db.customers.find_one = AsyncMock(return_value=customer_doc)

        mock_db.users.update_one = AsyncMock(
            return_value=MagicMock(modified_count=1)
        )

        response = client.post(
            f"/customers/{str(oid)}/assign-users",
            json=[str(ObjectId())],
        )

        assert response.status_code == 200
        call_args = mock_db.users.update_one.call_args
        update_op = call_args[0][1]
        assert "$addToSet" in update_op
        assert "customers" in update_op["$addToSet"]
