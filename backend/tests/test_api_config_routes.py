"""Tests for API Config Routes"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI
from bson import ObjectId
from datetime import datetime
from io import BytesIO

from easylifeauth.api.api_config_routes import router, get_api_config_service
from easylifeauth.api.dependencies import get_db, get_gcs_service
from easylifeauth.security.access_control import (
    get_current_user,
    require_super_admin,
)


# --- Sample data factories ---

def make_config_dict(**overrides):
    """Return a minimal API config dict suitable for ApiConfigInDB."""
    base = {
        "_id": str(ObjectId()),
        "key": "test-api",
        "name": "Test API",
        "description": "A test API configuration",
        "endpoint": "https://api.example.com/v1",
        "method": "GET",
        "headers": {"Authorization": "Bearer token"},
        "params": None,
        "body": None,
        "auth_type": "none",
        "auth_config": None,
        "ssl_verify": True,
        "ssl_cert_gcs_path": None,
        "ssl_key_gcs_path": None,
        "ssl_ca_gcs_path": None,
        "timeout": 30,
        "retry_count": 0,
        "retry_delay": 1,
        "response_path": None,
        "response_mapping": None,
        "use_proxy": False,
        "proxy_url": None,
        "ping_endpoint": None,
        "ping_method": "GET",
        "ping_expected_status": 200,
        "ping_timeout": 5,
        "cache_enabled": False,
        "cache_ttl": 300,
        "status": "active",
        "tags": ["test"],
        "created_at": datetime.utcnow().isoformat(),
        "created_by": "admin@test.com",
        "updated_at": None,
        "updated_by": None,
    }
    base.update(overrides)
    return base


def make_create_payload(**overrides):
    """Return a valid payload for creating an API config."""
    base = {
        "key": "new-api",
        "name": "New API",
        "endpoint": "https://api.example.com/v2",
        "method": "POST",
        "status": "active",
        "tags": ["new"],
    }
    base.update(overrides)
    return base


class TestApiConfigRoutesSuperAdmin:
    """Tests for API config routes requiring super admin access."""

    @pytest.fixture
    def app(self):
        """Create test FastAPI app."""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_service(self):
        """Create mock ApiConfigService."""
        return MagicMock()

    @pytest.fixture
    def mock_super_admin(self):
        """Create a mock super admin user."""
        user = MagicMock()
        user.email = "superadmin@test.com"
        user.user_id = "superadmin_123"
        user.roles = ["super-administrator"]
        return user

    @pytest.fixture
    def mock_gcs_service(self):
        """Create a mock GCS service."""
        gcs = MagicMock()
        gcs.is_configured.return_value = True
        gcs.bucket_name = "test-bucket"
        gcs.get_init_error.return_value = None
        return gcs

    @pytest.fixture
    def client(self, app, mock_service, mock_super_admin):
        """Create test client with super admin dependencies."""
        app.dependency_overrides[get_api_config_service] = lambda: mock_service
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        app.dependency_overrides[get_current_user] = lambda: mock_super_admin
        return TestClient(app)

    # ---- GET /api-configs (list) ----

    def test_list_api_configs_success(self, client, mock_service):
        """Test listing API configs with default pagination."""
        configs = [make_config_dict(), make_config_dict(key="second-api")]
        mock_service.list_configs = AsyncMock(return_value=(configs, 2))

        response = client.get("/api-configs")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data
        assert data["pagination"]["total"] == 2
        assert len(data["data"]) == 2

    def test_list_api_configs_with_filters(self, client, mock_service):
        """Test listing API configs with status, tags, and search filters."""
        mock_service.list_configs = AsyncMock(return_value=([], 0))

        response = client.get(
            "/api-configs?page=1&limit=10&status=active&tags=web,internal&search=test"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["pagination"]["total"] == 0
        assert data["pagination"]["page"] == 1
        assert data["pagination"]["limit"] == 10

        # Verify service called with parsed tag list
        call_kwargs = mock_service.list_configs.call_args[1]
        assert call_kwargs["tags"] == ["web", "internal"]
        assert call_kwargs["status"] == "active"
        assert call_kwargs["search"] == "test"

    def test_list_api_configs_pagination_metadata(self, client, mock_service):
        """Test pagination metadata calculation."""
        mock_service.list_configs = AsyncMock(return_value=([], 50))

        response = client.get("/api-configs?page=1&limit=10")
        assert response.status_code == 200
        pagination = response.json()["pagination"]
        assert pagination["pages"] == 5
        assert pagination["has_next"] is True
        assert pagination["has_prev"] is True

    def test_list_api_configs_first_page_no_prev(self, client, mock_service):
        """Test first page has_prev is False."""
        mock_service.list_configs = AsyncMock(return_value=([], 30))

        response = client.get("/api-configs?page=0&limit=10")
        pagination = response.json()["pagination"]
        assert pagination["has_prev"] is False
        assert pagination["has_next"] is True

    def test_list_api_configs_last_page_no_next(self, client, mock_service):
        """Test last page has_next is False."""
        mock_service.list_configs = AsyncMock(return_value=([], 30))

        response = client.get("/api-configs?page=2&limit=10")
        pagination = response.json()["pagination"]
        assert pagination["has_next"] is False
        assert pagination["has_prev"] is True

    # ---- GET /api-configs/count ----

    def test_get_api_configs_count(self, client, mock_service):
        """Test count endpoint without filter."""
        mock_service.get_count = AsyncMock(return_value=42)

        response = client.get("/api-configs/count")
        assert response.status_code == 200
        assert response.json() == {"count": 42}

    def test_get_api_configs_count_with_status(self, client, mock_service):
        """Test count endpoint with status filter."""
        mock_service.get_count = AsyncMock(return_value=10)

        response = client.get("/api-configs/count?status=active")
        assert response.status_code == 200
        assert response.json() == {"count": 10}
        mock_service.get_count.assert_called_once_with(status="active")

    # ---- GET /api-configs/tags ----

    def test_get_api_config_tags(self, client, mock_service):
        """Test retrieving unique tags."""
        mock_service.get_tags = AsyncMock(return_value=["web", "internal", "v2"])

        response = client.get("/api-configs/tags")
        assert response.status_code == 200
        assert response.json() == {"tags": ["web", "internal", "v2"]}

    # ---- GET /api-configs/{config_id} ----

    def test_get_api_config_by_id_success(self, client, mock_service):
        """Test getting a config by ID."""
        config = make_config_dict()
        mock_service.get_config_by_id = AsyncMock(return_value=config)

        response = client.get(f"/api-configs/{config['_id']}")
        assert response.status_code == 200
        assert response.json()["key"] == "test-api"

    def test_get_api_config_by_id_not_found(self, client, mock_service):
        """Test 404 when config not found by ID."""
        mock_service.get_config_by_id = AsyncMock(return_value=None)

        response = client.get(f"/api-configs/{ObjectId()}")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"]

    # ---- GET /api-configs/key/{key} ----

    def test_get_api_config_by_key_success(self, client, mock_service):
        """Test getting a config by key."""
        config = make_config_dict(key="my-key")
        mock_service.get_config_by_key = AsyncMock(return_value=config)

        response = client.get("/api-configs/key/my-key")
        assert response.status_code == 200
        assert response.json()["key"] == "my-key"

    def test_get_api_config_by_key_not_found(self, client, mock_service):
        """Test 404 when config not found by key."""
        mock_service.get_config_by_key = AsyncMock(return_value=None)

        response = client.get("/api-configs/key/nonexistent")
        assert response.status_code == 404
        assert "nonexistent" in response.json()["detail"]

    # ---- POST /api-configs (create) ----

    def test_create_api_config_success(self, client, mock_service, mock_super_admin):
        """Test creating a new API config."""
        payload = make_create_payload()
        created = make_config_dict(**payload)
        mock_service.create_config = AsyncMock(return_value=created)

        response = client.post("/api-configs", json=payload)
        assert response.status_code == 201
        assert response.json()["key"] == payload["key"]
        mock_service.create_config.assert_called_once()

    def test_create_api_config_duplicate_key(self, client, mock_service):
        """Test 400 when creating with duplicate key."""
        mock_service.create_config = AsyncMock(
            side_effect=ValueError("API config with key 'dup-key' already exists")
        )

        response = client.post("/api-configs", json=make_create_payload(key="dup-key"))
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    # ---- PUT /api-configs/{config_id} (update) ----

    def test_update_api_config_success(self, client, mock_service):
        """Test updating an API config."""
        config_id = str(ObjectId())
        updated = make_config_dict(_id=config_id, name="Updated Name")
        mock_service.update_config = AsyncMock(return_value=updated)

        response = client.put(
            f"/api-configs/{config_id}",
            json={"name": "Updated Name"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    def test_update_api_config_not_found(self, client, mock_service):
        """Test 404 when updating nonexistent config."""
        mock_service.update_config = AsyncMock(return_value=None)

        response = client.put(
            f"/api-configs/{ObjectId()}",
            json={"name": "Updated"},
        )
        assert response.status_code == 404

    # ---- DELETE /api-configs/{config_id} ----

    def test_delete_api_config_success(self, client, mock_service):
        """Test deleting an API config."""
        mock_service.delete_config = AsyncMock(return_value=True)

        response = client.delete(f"/api-configs/{ObjectId()}")
        assert response.status_code == 200
        assert "deleted successfully" in response.json()["message"]

    def test_delete_api_config_not_found(self, client, mock_service):
        """Test 404 when deleting nonexistent config."""
        mock_service.delete_config = AsyncMock(return_value=False)

        response = client.delete(f"/api-configs/{ObjectId()}")
        assert response.status_code == 404

    # ---- POST /api-configs/{config_id}/toggle-status ----

    def test_toggle_status_success(self, client, mock_service):
        """Test toggling config status."""
        toggled = make_config_dict(status="inactive")
        mock_service.toggle_status = AsyncMock(return_value=toggled)

        response = client.post(f"/api-configs/{toggled['_id']}/toggle-status")
        assert response.status_code == 200
        assert response.json()["status"] == "inactive"

    def test_toggle_status_not_found(self, client, mock_service):
        """Test 404 when toggling status of nonexistent config."""
        mock_service.toggle_status = AsyncMock(return_value=None)

        response = client.post(f"/api-configs/{ObjectId()}/toggle-status")
        assert response.status_code == 404

    # ---- POST /api-configs/{config_id}/upload-cert ----

    def test_upload_certificate_success(self, client, mock_service, mock_super_admin):
        """Test uploading a certificate file."""
        config_id = str(ObjectId())
        config = make_config_dict(_id=config_id, key="cert-api")
        mock_service.get_config_by_id = AsyncMock(return_value=config)
        mock_service.upload_certificate = AsyncMock(return_value={
            "gcs_path": "gs://bucket/certs/cert.pem",
            "file_name": "cert.pem",
            "cert_type": "cert",
            "uploaded_at": datetime.utcnow().isoformat(),
        })
        mock_service.update_config = AsyncMock(return_value=config)

        response = client.post(
            f"/api-configs/{config_id}/upload-cert",
            data={"cert_type": "cert"},
            files={"file": ("cert.pem", b"CERT CONTENT", "application/x-pem-file")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["gcs_path"] == "gs://bucket/certs/cert.pem"
        assert data["cert_type"] == "cert"

    def test_upload_certificate_key_type(self, client, mock_service, mock_super_admin):
        """Test uploading a key certificate."""
        config_id = str(ObjectId())
        config = make_config_dict(_id=config_id, key="key-api")
        mock_service.get_config_by_id = AsyncMock(return_value=config)
        mock_service.upload_certificate = AsyncMock(return_value={
            "gcs_path": "gs://bucket/certs/key.pem",
            "file_name": "key.pem",
            "cert_type": "key",
            "uploaded_at": datetime.utcnow().isoformat(),
        })
        mock_service.update_config = AsyncMock(return_value=config)

        response = client.post(
            f"/api-configs/{config_id}/upload-cert",
            data={"cert_type": "key"},
            files={"file": ("key.pem", b"KEY CONTENT", "application/x-pem-file")},
        )
        assert response.status_code == 200
        assert response.json()["cert_type"] == "key"

    def test_upload_certificate_ca_type(self, client, mock_service, mock_super_admin):
        """Test uploading a CA certificate."""
        config_id = str(ObjectId())
        config = make_config_dict(_id=config_id, key="ca-api")
        mock_service.get_config_by_id = AsyncMock(return_value=config)
        mock_service.upload_certificate = AsyncMock(return_value={
            "gcs_path": "gs://bucket/certs/ca.pem",
            "file_name": "ca.pem",
            "cert_type": "ca",
            "uploaded_at": datetime.utcnow().isoformat(),
        })
        mock_service.update_config = AsyncMock(return_value=config)

        response = client.post(
            f"/api-configs/{config_id}/upload-cert",
            data={"cert_type": "ca"},
            files={"file": ("ca.pem", b"CA CONTENT", "application/x-pem-file")},
        )
        assert response.status_code == 200
        assert response.json()["cert_type"] == "ca"

    def test_upload_certificate_config_not_found(self, client, mock_service):
        """Test 404 when uploading cert for nonexistent config."""
        mock_service.get_config_by_id = AsyncMock(return_value=None)

        response = client.post(
            f"/api-configs/{ObjectId()}/upload-cert",
            data={"cert_type": "cert"},
            files={"file": ("cert.pem", b"CONTENT", "application/x-pem-file")},
        )
        assert response.status_code == 404

    def test_upload_certificate_value_error(self, client, mock_service, mock_super_admin):
        """Test 400 when upload raises ValueError."""
        config_id = str(ObjectId())
        config = make_config_dict(_id=config_id, key="err-api")
        mock_service.get_config_by_id = AsyncMock(return_value=config)
        mock_service.upload_certificate = AsyncMock(
            side_effect=ValueError("Invalid certificate format")
        )

        response = client.post(
            f"/api-configs/{config_id}/upload-cert",
            data={"cert_type": "cert"},
            files={"file": ("bad.pem", b"BAD CONTENT", "application/x-pem-file")},
        )
        assert response.status_code == 400
        assert "Invalid certificate format" in response.json()["detail"]


class TestApiConfigRoutesTestEndpoints:
    """Tests for API config test endpoints (require get_current_user, not super_admin)."""

    @pytest.fixture
    def app(self):
        """Create test FastAPI app."""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_service(self):
        """Create mock ApiConfigService."""
        return MagicMock()

    @pytest.fixture
    def mock_user(self):
        """Create a mock regular user."""
        user = MagicMock()
        user.email = "user@test.com"
        user.user_id = "user_123"
        user.roles = ["user"]
        return user

    @pytest.fixture
    def client(self, app, mock_service, mock_user):
        """Create test client with regular user dependencies."""
        app.dependency_overrides[get_api_config_service] = lambda: mock_service
        app.dependency_overrides[get_current_user] = lambda: mock_user
        # Override require_super_admin so non-test endpoints are also accessible
        # if needed, but test endpoints only require get_current_user
        app.dependency_overrides[require_super_admin] = lambda: mock_user
        return TestClient(app)

    # ---- POST /api-configs/test ----

    def test_test_api_config_with_config_id(self, client, mock_service):
        """Test API config by providing config_id."""
        config = make_config_dict()
        mock_service.get_config_by_id = AsyncMock(return_value=config)
        mock_service.test_api = AsyncMock(return_value={
            "success": True,
            "status_code": 200,
            "response_time_ms": 150.5,
            "response_headers": {"Content-Type": "application/json"},
            "response_body": {"result": "ok"},
            "error": None,
            "ssl_info": None,
        })

        response = client.post("/api-configs/test", json={
            "config_id": config["_id"],
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["status_code"] == 200

    def test_test_api_config_with_inline_config(self, client, mock_service):
        """Test API config by providing an inline config."""
        mock_service.test_api = AsyncMock(return_value={
            "success": True,
            "status_code": 200,
            "response_time_ms": 100.0,
            "response_headers": None,
            "response_body": None,
            "error": None,
            "ssl_info": None,
        })

        response = client.post("/api-configs/test", json={
            "config": {
                "key": "inline-test",
                "name": "Inline Test",
                "endpoint": "https://httpbin.org/get",
                "method": "GET",
            },
        })
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_test_api_config_with_test_params(self, client, mock_service):
        """Test API config with override test_params and test_body."""
        config = make_config_dict()
        mock_service.get_config_by_id = AsyncMock(return_value=config)
        mock_service.test_api = AsyncMock(return_value={
            "success": True,
            "status_code": 200,
            "response_time_ms": 50.0,
            "response_headers": None,
            "response_body": None,
            "error": None,
            "ssl_info": None,
        })

        response = client.post("/api-configs/test", json={
            "config_id": config["_id"],
            "test_params": {"q": "search"},
            "test_body": {"data": "value"},
        })
        assert response.status_code == 200
        call_kwargs = mock_service.test_api.call_args[1]
        assert call_kwargs["test_params"] == {"q": "search"}
        assert call_kwargs["test_body"] == {"data": "value"}

    def test_test_api_config_config_not_found(self, client, mock_service):
        """Test 404 when test references nonexistent config_id."""
        mock_service.get_config_by_id = AsyncMock(return_value=None)

        response = client.post("/api-configs/test", json={
            "config_id": str(ObjectId()),
        })
        assert response.status_code == 404

    def test_test_api_config_missing_both(self, client, mock_service):
        """Test 400 when neither config_id nor config is provided."""
        response = client.post("/api-configs/test", json={})
        assert response.status_code == 400
        assert "Either config_id or config must be provided" in response.json()["detail"]

    # ---- POST /api-configs/{config_id}/test ----

    def test_test_api_config_by_id_success(self, client, mock_service):
        """Test API config by ID endpoint."""
        config_id = str(ObjectId())
        config = make_config_dict(_id=config_id)
        mock_service.get_config_by_id = AsyncMock(return_value=config)
        mock_service.test_api = AsyncMock(return_value={
            "success": True,
            "status_code": 200,
            "response_time_ms": 75.0,
            "response_headers": None,
            "response_body": {"status": "healthy"},
            "error": None,
            "ssl_info": None,
        })

        response = client.post(f"/api-configs/{config_id}/test")
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_test_api_config_by_id_not_found(self, client, mock_service):
        """Test 404 when testing nonexistent config by ID."""
        mock_service.get_config_by_id = AsyncMock(return_value=None)

        response = client.post(f"/api-configs/{ObjectId()}/test")
        assert response.status_code == 404


class TestApiConfigRoutesGCSStatus:
    """Tests for the GCS status endpoint."""

    @pytest.fixture
    def app(self):
        """Create test FastAPI app."""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_user(self):
        """Create a mock user."""
        user = MagicMock()
        user.email = "user@test.com"
        user.user_id = "user_123"
        user.roles = ["user"]
        return user

    @pytest.fixture
    def mock_gcs_configured(self):
        """Create a mock GCS service that is configured."""
        gcs = MagicMock()
        gcs.is_configured.return_value = True
        gcs.bucket_name = "my-bucket"
        gcs.get_init_error.return_value = None
        return gcs

    @pytest.fixture
    def mock_gcs_not_configured(self):
        """Create a mock GCS service that is not configured."""
        gcs = MagicMock()
        gcs.is_configured.return_value = False
        gcs.bucket_name = None
        gcs.get_init_error.return_value = "Missing credentials"
        return gcs

    def test_gcs_status_configured(self, app, mock_user, mock_gcs_configured):
        """Test GCS status when configured."""
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[get_gcs_service] = lambda: mock_gcs_configured
        app.dependency_overrides[require_super_admin] = lambda: mock_user
        client = TestClient(app)

        response = client.get("/api-configs/gcs/status")
        assert response.status_code == 200
        data = response.json()
        assert data["configured"] is True
        assert data["bucket"] == "my-bucket"
        assert data["error"] is None

    def test_gcs_status_not_configured(self, app, mock_user, mock_gcs_not_configured):
        """Test GCS status when not configured."""
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[get_gcs_service] = lambda: mock_gcs_not_configured
        app.dependency_overrides[require_super_admin] = lambda: mock_user
        client = TestClient(app)

        response = client.get("/api-configs/gcs/status")
        assert response.status_code == 200
        data = response.json()
        assert data["configured"] is False
        assert data["error"] == "Missing credentials"

    def test_gcs_status_service_none(self, app, mock_user):
        """Test GCS status when service is None."""
        app.dependency_overrides[get_current_user] = lambda: mock_user
        app.dependency_overrides[get_gcs_service] = lambda: None
        app.dependency_overrides[require_super_admin] = lambda: mock_user
        client = TestClient(app)

        response = client.get("/api-configs/gcs/status")
        assert response.status_code == 200
        data = response.json()
        assert data["configured"] is False
        assert data["error"] == "GCS service not initialized"


class TestApiConfigRoutesAuthEnforcement:
    """Tests to verify auth dependency enforcement on protected routes."""

    @pytest.fixture
    def app(self):
        """Create test FastAPI app with no dependency overrides."""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_service(self):
        """Create mock ApiConfigService."""
        return MagicMock()

    @pytest.fixture
    def mock_regular_user(self):
        """Create a mock regular user (not super admin)."""
        user = MagicMock()
        user.email = "user@test.com"
        user.user_id = "user_123"
        user.roles = ["user"]
        return user

    @pytest.fixture
    def unauthenticated_client(self, app, mock_service, mock_regular_user):
        """Create a client where get_current_user works but require_super_admin rejects."""
        app.dependency_overrides[get_api_config_service] = lambda: mock_service
        app.dependency_overrides[get_current_user] = lambda: mock_regular_user
        # Do NOT override require_super_admin -- it will reject non-super-admins
        return TestClient(app)

    def test_list_configs_requires_super_admin(self, unauthenticated_client):
        """Test that listing configs requires super admin."""
        response = unauthenticated_client.get("/api-configs")
        assert response.status_code == 403
        assert "Super Administrator access required" in response.json()["detail"]

    def test_get_count_requires_super_admin(self, unauthenticated_client):
        """Test that count endpoint requires super admin."""
        response = unauthenticated_client.get("/api-configs/count")
        assert response.status_code == 403

    def test_get_tags_requires_super_admin(self, unauthenticated_client):
        """Test that tags endpoint requires super admin."""
        response = unauthenticated_client.get("/api-configs/tags")
        assert response.status_code == 403

    def test_create_config_requires_super_admin(self, unauthenticated_client):
        """Test that creating a config requires super admin."""
        response = unauthenticated_client.post(
            "/api-configs", json=make_create_payload()
        )
        assert response.status_code == 403

    def test_update_config_requires_super_admin(self, unauthenticated_client):
        """Test that updating a config requires super admin."""
        response = unauthenticated_client.put(
            f"/api-configs/{ObjectId()}", json={"name": "Updated"}
        )
        assert response.status_code == 403

    def test_delete_config_requires_super_admin(self, unauthenticated_client):
        """Test that deleting a config requires super admin."""
        response = unauthenticated_client.delete(f"/api-configs/{ObjectId()}")
        assert response.status_code == 403

    def test_toggle_status_requires_super_admin(self, unauthenticated_client):
        """Test that toggling status requires super admin."""
        response = unauthenticated_client.post(
            f"/api-configs/{ObjectId()}/toggle-status"
        )
        assert response.status_code == 403

    def test_upload_cert_requires_super_admin(self, unauthenticated_client):
        """Test that uploading cert requires super admin."""
        response = unauthenticated_client.post(
            f"/api-configs/{ObjectId()}/upload-cert",
            data={"cert_type": "cert"},
            files={"file": ("cert.pem", b"CONTENT", "application/x-pem-file")},
        )
        assert response.status_code == 403

    def test_test_endpoint_accessible_by_regular_user(
        self, unauthenticated_client, mock_service
    ):
        """Test that POST /api-configs/test is accessible without super admin."""
        mock_service.test_api = AsyncMock(return_value={
            "success": True,
            "status_code": 200,
            "response_time_ms": 50.0,
            "response_headers": None,
            "response_body": None,
            "error": None,
            "ssl_info": None,
        })

        response = unauthenticated_client.post("/api-configs/test", json={
            "config": {
                "key": "test-key",
                "name": "Test",
                "endpoint": "https://example.com",
                "method": "GET",
            },
        })
        assert response.status_code == 200
