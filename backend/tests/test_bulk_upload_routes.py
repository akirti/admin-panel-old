"""Tests for Bulk Upload API Routes"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from io import BytesIO
import pandas as pd

from easylifeauth.api.bulk_upload_routes import (
    router,
    get_bulk_upload_service,
    get_gcs_service,
)
from easylifeauth.security.access_control import CurrentUser, require_super_admin


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_super_admin():
    """Create a mock super-admin user returned by the dependency override."""
    return CurrentUser(
        user_id="507f1f77bcf86cd799439012",
        email="admin@example.com",
        roles=["super-administrator"],
        groups=["administrator"],
        domains=["all"],
    )


@pytest.fixture
def mock_bulk_service():
    """Create a fully-mocked BulkUploadService."""
    svc = MagicMock()
    svc.process_entity = AsyncMock(return_value=MagicMock(
        to_dict=MagicMock(return_value={
            "total": 5,
            "successful": 4,
            "failed": 1,
            "errors": [{"row": 3, "error": "duplicate email"}],
        })
    ))
    svc.get_template = MagicMock(return_value=pd.DataFrame({"col1": [], "col2": []}))
    return svc


@pytest.fixture
def mock_gcs_service_configured():
    """Create a mock GCSService that is properly configured."""
    svc = MagicMock()
    svc.is_configured = MagicMock(return_value=True)
    svc.bucket_name = "test-bucket"
    svc.get_init_error = MagicMock(return_value=None)
    svc.download_file = AsyncMock(return_value=b"csv,data\n1,2")
    svc.list_files = AsyncMock(return_value=[
        {"name": "users.csv", "size": 1234, "updated": "2026-01-01T00:00:00Z"},
        {"name": "roles.xlsx", "size": 5678, "updated": "2026-01-02T00:00:00Z"},
    ])
    return svc


@pytest.fixture
def mock_gcs_service_unconfigured():
    """Create a mock GCSService that is NOT configured."""
    svc = MagicMock()
    svc.is_configured = MagicMock(return_value=False)
    svc.bucket_name = None
    svc.get_init_error = MagicMock(return_value="Missing credentials")
    return svc


@pytest.fixture
def app(mock_super_admin, mock_bulk_service):
    """Create a FastAPI app with dependency overrides (no GCS by default)."""
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
    app.dependency_overrides[get_bulk_upload_service] = lambda: mock_bulk_service
    # GCS not overridden here -- tests that need it will set it explicitly.
    return app


@pytest.fixture
def client(app):
    """TestClient backed by the default app (no GCS override)."""
    return TestClient(app)


@pytest.fixture
def client_with_gcs(app, mock_gcs_service_configured):
    """TestClient with a configured GCS service."""
    app.dependency_overrides[get_gcs_service] = lambda: mock_gcs_service_configured
    return TestClient(app)


@pytest.fixture
def client_with_unconfigured_gcs(app, mock_gcs_service_unconfigured):
    """TestClient with an unconfigured GCS service."""
    app.dependency_overrides[get_gcs_service] = lambda: mock_gcs_service_unconfigured
    return TestClient(app)


# ===========================================================================
# POST /bulk/upload/{entity_type}
# ===========================================================================

class TestBulkUpload:
    """Tests for POST /bulk/upload/{entity_type}"""

    VALID_TYPES = [
        "users", "roles", "groups", "permissions",
        "customers", "domains", "domain_scenarios",
    ]

    # -- Happy-path uploads ------------------------------------------------

    @pytest.mark.parametrize("entity_type", VALID_TYPES)
    @patch("easylifeauth.utils.file_validation.validate_upload")
    def test_upload_valid_entity_csv(
        self, mock_validate, entity_type, client, mock_bulk_service
    ):
        """Uploading a CSV for every valid entity type returns 200."""
        csv_content = b"col1,col2\nval1,val2"
        response = client.post(
            f"/bulk/upload/{entity_type}",
            files={"file": ("data.csv", BytesIO(csv_content), "text/csv")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["successful"] == 4
        assert data["failed"] == 1
        mock_validate.assert_called_once()
        mock_bulk_service.process_entity.assert_awaited_once_with(
            entity_type, csv_content, "data.csv", True
        )

    @patch("easylifeauth.utils.file_validation.validate_upload")
    def test_upload_xlsx_file(self, mock_validate, client, mock_bulk_service):
        """Uploading an XLSX file is accepted."""
        xlsx_content = b"PK\x03\x04fake-xlsx"
        response = client.post(
            "/bulk/upload/users",
            files={"file": ("users.xlsx", BytesIO(xlsx_content),
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        )
        assert response.status_code == 200
        mock_bulk_service.process_entity.assert_awaited_once()

    @patch("easylifeauth.utils.file_validation.validate_upload")
    def test_upload_send_password_emails_false(
        self, mock_validate, client, mock_bulk_service
    ):
        """The send_password_emails query param is forwarded to process_entity."""
        csv_content = b"email\nuser@test.com"
        response = client.post(
            "/bulk/upload/users?send_password_emails=false",
            files={"file": ("users.csv", BytesIO(csv_content), "text/csv")},
        )
        assert response.status_code == 200
        mock_bulk_service.process_entity.assert_awaited_once_with(
            "users", csv_content, "users.csv", False
        )

    # -- process_entity returns plain dict (no to_dict) --------------------

    @patch("easylifeauth.utils.file_validation.validate_upload")
    def test_upload_result_plain_dict(self, mock_validate, client, mock_bulk_service):
        """When process_entity returns a plain dict (no to_dict), it is used as-is."""
        plain = {"total": 2, "successful": 2, "failed": 0, "errors": []}
        mock_bulk_service.process_entity = AsyncMock(return_value=plain)
        response = client.post(
            "/bulk/upload/users",
            files={"file": ("u.csv", BytesIO(b"c\n1"), "text/csv")},
        )
        assert response.status_code == 200
        assert response.json() == plain

    # -- Invalid entity type -----------------------------------------------

    def test_upload_invalid_entity_type(self, client):
        """An invalid entity_type yields 400."""
        response = client.post(
            "/bulk/upload/widgets",
            files={"file": ("w.csv", BytesIO(b"c\n1"), "text/csv")},
        )
        assert response.status_code == 400
        assert "Invalid entity type" in response.json()["detail"]

    # -- ValueError from process_entity ------------------------------------

    @patch("easylifeauth.utils.file_validation.validate_upload")
    def test_upload_value_error(self, mock_validate, client, mock_bulk_service):
        """A ValueError from process_entity maps to 400."""
        mock_bulk_service.process_entity = AsyncMock(
            side_effect=ValueError("Missing required column: email")
        )
        response = client.post(
            "/bulk/upload/users",
            files={"file": ("u.csv", BytesIO(b"c\n1"), "text/csv")},
        )
        assert response.status_code == 400
        assert "Missing required column" in response.json()["detail"]

    # -- Generic exception from process_entity -----------------------------

    @patch("easylifeauth.utils.file_validation.validate_upload")
    def test_upload_internal_error(self, mock_validate, client, mock_bulk_service):
        """An unexpected exception from process_entity maps to 500."""
        mock_bulk_service.process_entity = AsyncMock(
            side_effect=RuntimeError("DB connection lost")
        )
        response = client.post(
            "/bulk/upload/users",
            files={"file": ("u.csv", BytesIO(b"c\n1"), "text/csv")},
        )
        assert response.status_code == 500
        assert "Error processing file" in response.json()["detail"]

    # -- validate_upload raises HTTPException --------------------------------

    @patch("easylifeauth.utils.file_validation.validate_upload")
    def test_upload_file_validation_failure(self, mock_validate, client):
        """When validate_upload raises, the error propagates (e.g. 400/422)."""
        from fastapi import HTTPException, status
        mock_validate.side_effect = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type",
        )
        response = client.post(
            "/bulk/upload/users",
            files={"file": ("u.exe", BytesIO(b"\x00\x00"), "application/octet-stream")},
        )
        assert response.status_code == 400
        assert "Invalid file type" in response.json()["detail"]


# ===========================================================================
# GET /bulk/template/{entity_type}
# ===========================================================================

class TestGetTemplate:
    """Tests for GET /bulk/template/{entity_type}"""

    VALID_TYPES = [
        "users", "roles", "groups", "permissions",
        "customers", "domains", "domain_scenarios",
    ]

    # -- CSV template download ---------------------------------------------

    @pytest.mark.parametrize("entity_type", VALID_TYPES)
    def test_template_csv(self, entity_type, client):
        """Download a CSV template for every valid entity type."""
        response = client.get(f"/bulk/template/{entity_type}?format=csv")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
        disposition = response.headers["content-disposition"]
        assert f"{entity_type}_template.csv" in disposition
        # The body should contain the column header row from the mock DataFrame.
        body = response.text
        assert "col1" in body
        assert "col2" in body

    # -- XLSX template download --------------------------------------------

    @pytest.mark.parametrize("entity_type", VALID_TYPES)
    def test_template_xlsx(self, entity_type, client):
        """Download an XLSX template for every valid entity type."""
        response = client.get(f"/bulk/template/{entity_type}?format=xlsx")
        assert response.status_code == 200
        ct = response.headers["content-type"]
        assert "spreadsheetml" in ct or "openxmlformats" in ct
        disposition = response.headers["content-disposition"]
        assert f"{entity_type}_template.xlsx" in disposition
        # XLSX files start with the ZIP magic bytes PK.
        assert response.content[:2] == b"PK"

    # -- Default format is xlsx --------------------------------------------

    def test_template_default_format_is_xlsx(self, client):
        """When no format query param is given, default is xlsx."""
        response = client.get("/bulk/template/users")
        assert response.status_code == 200
        assert "users_template.xlsx" in response.headers["content-disposition"]

    # -- Invalid entity type -----------------------------------------------

    def test_template_invalid_entity_type(self, client):
        """An invalid entity_type yields 400."""
        response = client.get("/bulk/template/widgets?format=csv")
        assert response.status_code == 400
        assert "Invalid entity type" in response.json()["detail"]

    # -- Invalid format ----------------------------------------------------

    def test_template_invalid_format(self, client):
        """An unsupported format yields 400."""
        response = client.get("/bulk/template/users?format=pdf")
        assert response.status_code == 400
        assert "Format must be" in response.json()["detail"]

    # -- get_template raises ValueError ------------------------------------

    def test_template_value_error(self, client, mock_bulk_service):
        """A ValueError from get_template maps to 400."""
        mock_bulk_service.get_template = MagicMock(
            side_effect=ValueError("Unknown entity type: bad")
        )
        response = client.get("/bulk/template/users?format=csv")
        assert response.status_code == 400
        assert "Unknown entity type" in response.json()["detail"]


# ===========================================================================
# POST /bulk/gcs/upload/{entity_type}
# ===========================================================================

class TestBulkUploadFromGCS:
    """Tests for POST /bulk/gcs/upload/{entity_type}"""

    VALID_TYPES = [
        "users", "roles", "groups", "permissions",
        "customers", "domains", "domain_scenarios",
    ]

    # -- Happy path --------------------------------------------------------

    @pytest.mark.parametrize("entity_type", VALID_TYPES)
    def test_gcs_upload_valid_entity(
        self, entity_type, client_with_gcs, mock_bulk_service
    ):
        """Upload from GCS for every valid entity type returns 200."""
        response = client_with_gcs.post(
            f"/bulk/gcs/upload/{entity_type}",
            json={"file_path": "uploads/data.csv"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["successful"] == 4
        mock_bulk_service.process_entity.assert_awaited_once()

    def test_gcs_upload_with_bucket_name(
        self, client_with_gcs, mock_gcs_service_configured, mock_bulk_service
    ):
        """Optional bucket_name is forwarded to gcs_service.download_file."""
        response = client_with_gcs.post(
            "/bulk/gcs/upload/users",
            json={"file_path": "data.csv", "bucket_name": "my-bucket"},
        )
        assert response.status_code == 200
        mock_gcs_service_configured.download_file.assert_awaited_once_with(
            "data.csv", "my-bucket"
        )

    def test_gcs_upload_send_password_emails_false(
        self, client_with_gcs, mock_bulk_service
    ):
        """send_password_emails query param is forwarded to process_entity."""
        response = client_with_gcs.post(
            "/bulk/gcs/upload/users?send_password_emails=false",
            json={"file_path": "data.csv"},
        )
        assert response.status_code == 200
        call_args = mock_bulk_service.process_entity.call_args
        assert call_args[0][3] is False  # send_password_emails

    # -- process_entity returns plain dict ---------------------------------

    def test_gcs_upload_result_plain_dict(
        self, client_with_gcs, mock_bulk_service
    ):
        """When process_entity returns a plain dict, it is used as-is."""
        plain = {"total": 1, "successful": 1, "failed": 0, "errors": []}
        mock_bulk_service.process_entity = AsyncMock(return_value=plain)
        response = client_with_gcs.post(
            "/bulk/gcs/upload/users",
            json={"file_path": "data.csv"},
        )
        assert response.status_code == 200
        assert response.json() == plain

    # -- Invalid entity type -----------------------------------------------

    def test_gcs_upload_invalid_entity_type(self, client_with_gcs):
        """An invalid entity_type yields 400."""
        response = client_with_gcs.post(
            "/bulk/gcs/upload/widgets",
            json={"file_path": "data.csv"},
        )
        assert response.status_code == 400
        assert "Invalid entity type" in response.json()["detail"]

    # -- GCS not configured ------------------------------------------------

    def test_gcs_upload_service_none(self, client):
        """When gcs_service dependency returns None, yields 503."""
        # The default client has no GCS override, so get_gcs_service returns
        # the module-level _gcs_service which is None in a test context.
        response = client.post(
            "/bulk/gcs/upload/users",
            json={"file_path": "data.csv"},
        )
        assert response.status_code == 503
        assert "GCS service not configured" in response.json()["detail"]

    def test_gcs_upload_service_unconfigured(self, client_with_unconfigured_gcs):
        """When gcs_service.is_configured() is False, yields 503."""
        response = client_with_unconfigured_gcs.post(
            "/bulk/gcs/upload/users",
            json={"file_path": "data.csv"},
        )
        assert response.status_code == 503
        assert "GCS service not configured" in response.json()["detail"]

    # -- File not found in GCS ---------------------------------------------

    def test_gcs_upload_file_not_found(
        self, client_with_gcs, mock_gcs_service_configured
    ):
        """When download_file returns None, yields 404."""
        mock_gcs_service_configured.download_file = AsyncMock(return_value=None)
        response = client_with_gcs.post(
            "/bulk/gcs/upload/users",
            json={"file_path": "missing.csv"},
        )
        assert response.status_code == 404
        assert "File not found in GCS" in response.json()["detail"]

    # -- ValueError from process_entity ------------------------------------

    def test_gcs_upload_value_error(
        self, client_with_gcs, mock_bulk_service
    ):
        """A ValueError from process_entity maps to 400."""
        mock_bulk_service.process_entity = AsyncMock(
            side_effect=ValueError("bad column layout")
        )
        response = client_with_gcs.post(
            "/bulk/gcs/upload/users",
            json={"file_path": "data.csv"},
        )
        assert response.status_code == 400
        assert "bad column layout" in response.json()["detail"]

    # -- Generic exception from process_entity -----------------------------

    def test_gcs_upload_internal_error(
        self, client_with_gcs, mock_bulk_service
    ):
        """An unexpected exception from process_entity maps to 500."""
        mock_bulk_service.process_entity = AsyncMock(
            side_effect=RuntimeError("timeout")
        )
        response = client_with_gcs.post(
            "/bulk/gcs/upload/users",
            json={"file_path": "data.csv"},
        )
        assert response.status_code == 500
        assert "Error processing file" in response.json()["detail"]


# ===========================================================================
# GET /bulk/gcs/list
# ===========================================================================

class TestListGCSFiles:
    """Tests for GET /bulk/gcs/list"""

    def test_list_files_success(
        self, client_with_gcs, mock_gcs_service_configured
    ):
        """Listing files returns the expected payload."""
        response = client_with_gcs.get("/bulk/gcs/list")
        assert response.status_code == 200
        data = response.json()
        assert "files" in data
        assert len(data["files"]) == 2
        assert data["files"][0]["name"] == "users.csv"
        mock_gcs_service_configured.list_files.assert_awaited_once_with("", None)

    def test_list_files_with_prefix_and_bucket(
        self, client_with_gcs, mock_gcs_service_configured
    ):
        """prefix and bucket_name query params are forwarded."""
        response = client_with_gcs.get(
            "/bulk/gcs/list?prefix=uploads/&bucket_name=other-bucket"
        )
        assert response.status_code == 200
        mock_gcs_service_configured.list_files.assert_awaited_once_with(
            "uploads/", "other-bucket"
        )

    def test_list_files_gcs_none(self, client):
        """When gcs_service is None, yields 503."""
        response = client.get("/bulk/gcs/list")
        assert response.status_code == 503
        assert "GCS service not configured" in response.json()["detail"]

    def test_list_files_gcs_unconfigured(self, client_with_unconfigured_gcs):
        """When gcs_service.is_configured() is False, yields 503."""
        response = client_with_unconfigured_gcs.get("/bulk/gcs/list")
        assert response.status_code == 503
        assert "GCS service not configured" in response.json()["detail"]


# ===========================================================================
# GET /bulk/gcs/status
# ===========================================================================

class TestGCSStatus:
    """Tests for GET /bulk/gcs/status"""

    def test_status_configured(self, client_with_gcs):
        """When GCS is configured, returns configured=True and bucket name."""
        response = client_with_gcs.get("/bulk/gcs/status")
        assert response.status_code == 200
        data = response.json()
        assert data["configured"] is True
        assert data["bucket_name"] == "test-bucket"
        assert data["error"] is None

    def test_status_unconfigured(self, client_with_unconfigured_gcs):
        """When GCS is not configured, returns configured=False."""
        response = client_with_unconfigured_gcs.get("/bulk/gcs/status")
        assert response.status_code == 200
        data = response.json()
        assert data["configured"] is False
        assert data["bucket_name"] is None
        assert data["error"] == "Missing credentials"

    def test_status_gcs_none(self, client):
        """When gcs_service is None, returns not-initialized payload."""
        response = client.get("/bulk/gcs/status")
        assert response.status_code == 200
        data = response.json()
        assert data["configured"] is False
        assert data["bucket_name"] is None
        assert data["error"] == "GCS service not initialized"
