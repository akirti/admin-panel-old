"""Tests for Error Log Routes"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI

from easylifeauth.api.error_log_routes import router, create_pagination_meta
from easylifeauth.api.dependencies import get_error_log_service
from easylifeauth.security.access_control import require_super_admin


class TestCreatePaginationMeta:
    """Tests for the create_pagination_meta helper function."""

    def test_first_page(self):
        """Test pagination metadata for the first page."""
        meta = create_pagination_meta(100, 0, 25)
        assert meta["total"] == 100
        assert meta["page"] == 0
        assert meta["limit"] == 25
        assert meta["pages"] == 4
        assert meta["has_next"] is True
        assert meta["has_prev"] is False

    def test_middle_page(self):
        """Test pagination metadata for a middle page."""
        meta = create_pagination_meta(100, 2, 25)
        assert meta["page"] == 2
        assert meta["pages"] == 4
        assert meta["has_next"] is True
        assert meta["has_prev"] is True

    def test_last_page(self):
        """Test pagination metadata for the last page."""
        meta = create_pagination_meta(100, 3, 25)
        assert meta["has_next"] is False
        assert meta["has_prev"] is True

    def test_single_page(self):
        """Test pagination metadata when all results fit on one page."""
        meta = create_pagination_meta(10, 0, 25)
        assert meta["pages"] == 1
        assert meta["has_next"] is False
        assert meta["has_prev"] is False

    def test_zero_total(self):
        """Test pagination metadata with no results."""
        meta = create_pagination_meta(0, 0, 25)
        assert meta["total"] == 0
        assert meta["pages"] == 0
        assert meta["has_next"] is False
        assert meta["has_prev"] is False

    def test_zero_limit(self):
        """Test pagination metadata with zero limit returns zero pages."""
        meta = create_pagination_meta(100, 0, 0)
        assert meta["pages"] == 0

    def test_exact_page_boundary(self):
        """Test pagination when total is exactly divisible by limit."""
        meta = create_pagination_meta(50, 0, 25)
        assert meta["pages"] == 2
        assert meta["has_next"] is True

    def test_one_over_boundary(self):
        """Test pagination when total is one over a page boundary."""
        meta = create_pagination_meta(51, 0, 25)
        assert meta["pages"] == 3


class TestErrorLogRoutes:
    """Tests for error log API routes."""

    @pytest.fixture
    def mock_service(self):
        """Create a mock ErrorLogService with all async methods."""
        service = MagicMock()
        service.get_current_logs = AsyncMock()
        service.get_stats = AsyncMock()
        service.get_levels = AsyncMock()
        service.get_error_types = AsyncMock()
        service.get_current_file_content = AsyncMock()
        service.get_archived_files = AsyncMock()
        service.get_archive_download_url = AsyncMock()
        service.delete_archive = AsyncMock()
        service.force_archive = AsyncMock()
        service.cleanup_old_archives = AsyncMock()
        return service

    @pytest.fixture
    def mock_super_admin(self):
        """Create a mock super admin user."""
        user = MagicMock()
        user.user_id = "admin_001"
        user.email = "admin@test.com"
        user.roles = ["super-administrator"]
        user.groups = []
        user.domains = []
        return user

    @pytest.fixture
    def app(self):
        """Create a test FastAPI application with the error log router."""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def client(self, app, mock_service, mock_super_admin):
        """Create a test client with mocked dependencies."""
        app.dependency_overrides[get_error_log_service] = lambda: mock_service
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        return TestClient(app)

    @pytest.fixture
    def client_no_service(self, app, mock_super_admin):
        """Create a test client with error_log_service returning None (not initialized)."""
        app.dependency_overrides[get_error_log_service] = lambda: None
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        return TestClient(app)

    # ------------------------------------------------------------------ #
    # GET /error-logs  (list_error_logs)
    # ------------------------------------------------------------------ #

    def test_list_error_logs_success(self, client, mock_service):
        """Test listing error logs returns paginated data."""
        mock_service.get_current_logs.return_value = {
            "logs": [
                {
                    "_id": "abc123",
                    "level": "ERROR",
                    "error_type": "ValueError",
                    "message": "Something went wrong",
                    "timestamp": "2026-01-15T10:00:00"
                }
            ],
            "total": 1
        }

        response = client.get("/error-logs")
        assert response.status_code == 200

        data = response.json()
        assert "data" in data
        assert "pagination" in data
        assert len(data["data"]) == 1
        assert data["data"][0]["level"] == "ERROR"
        assert data["pagination"]["total"] == 1
        assert data["pagination"]["page"] == 0
        assert data["pagination"]["limit"] == 25

        mock_service.get_current_logs.assert_awaited_once_with(
            limit=25, offset=0, filters={}
        )

    def test_list_error_logs_with_pagination(self, client, mock_service):
        """Test listing error logs with custom page and limit."""
        mock_service.get_current_logs.return_value = {"logs": [], "total": 100}

        response = client.get("/error-logs?page=2&limit=10")
        assert response.status_code == 200

        data = response.json()
        assert data["pagination"]["page"] == 2
        assert data["pagination"]["limit"] == 10

        mock_service.get_current_logs.assert_awaited_once_with(
            limit=10, offset=20, filters={}
        )

    def test_list_error_logs_with_level_filter(self, client, mock_service):
        """Test listing error logs filtered by level."""
        mock_service.get_current_logs.return_value = {"logs": [], "total": 0}

        response = client.get("/error-logs?level=CRITICAL")
        assert response.status_code == 200

        mock_service.get_current_logs.assert_awaited_once_with(
            limit=25, offset=0, filters={"level": "CRITICAL"}
        )

    def test_list_error_logs_with_error_type_filter(self, client, mock_service):
        """Test listing error logs filtered by error type."""
        mock_service.get_current_logs.return_value = {"logs": [], "total": 0}

        response = client.get("/error-logs?error_type=ValueError")
        assert response.status_code == 200

        mock_service.get_current_logs.assert_awaited_once_with(
            limit=25, offset=0, filters={"error_type": "ValueError"}
        )

    def test_list_error_logs_with_search_filter(self, client, mock_service):
        """Test listing error logs with a search query."""
        mock_service.get_current_logs.return_value = {"logs": [], "total": 0}

        response = client.get("/error-logs?search=database")
        assert response.status_code == 200

        mock_service.get_current_logs.assert_awaited_once_with(
            limit=25, offset=0, filters={"search": "database"}
        )

    def test_list_error_logs_with_days_filter(self, client, mock_service):
        """Test listing error logs filtered by recent days."""
        mock_service.get_current_logs.return_value = {"logs": [], "total": 0}

        response = client.get("/error-logs?days=7")
        assert response.status_code == 200

        mock_service.get_current_logs.assert_awaited_once_with(
            limit=25, offset=0, filters={"days": 7}
        )

    def test_list_error_logs_with_all_filters(self, client, mock_service):
        """Test listing error logs with all filters combined."""
        mock_service.get_current_logs.return_value = {"logs": [], "total": 0}

        response = client.get(
            "/error-logs?page=1&limit=50&level=ERROR&error_type=KeyError&search=missing&days=30"
        )
        assert response.status_code == 200

        mock_service.get_current_logs.assert_awaited_once_with(
            limit=50,
            offset=50,
            filters={
                "level": "ERROR",
                "error_type": "KeyError",
                "search": "missing",
                "days": 30,
            }
        )

    def test_list_error_logs_empty_result(self, client, mock_service):
        """Test listing error logs when no logs exist."""
        mock_service.get_current_logs.return_value = {"logs": [], "total": 0}

        response = client.get("/error-logs")
        assert response.status_code == 200

        data = response.json()
        assert data["data"] == []
        assert data["pagination"]["total"] == 0

    def test_list_error_logs_service_not_initialized(self, client_no_service):
        """Test listing error logs when service is None returns 503."""
        response = client_no_service.get("/error-logs")
        assert response.status_code == 503
        assert "not initialized" in response.json()["detail"]

    def test_list_error_logs_invalid_page(self, client):
        """Test that a negative page value is rejected by query validation."""
        response = client.get("/error-logs?page=-1")
        assert response.status_code == 422

    def test_list_error_logs_limit_too_large(self, client):
        """Test that a limit over 100 is rejected by query validation."""
        response = client.get("/error-logs?limit=200")
        assert response.status_code == 422

    def test_list_error_logs_limit_zero(self, client):
        """Test that a limit of zero is rejected by query validation."""
        response = client.get("/error-logs?limit=0")
        assert response.status_code == 422

    # ------------------------------------------------------------------ #
    # GET /error-logs/stats  (get_error_stats)
    # ------------------------------------------------------------------ #

    def test_get_error_stats_success(self, client, mock_service):
        """Test getting error statistics."""
        mock_service.get_stats.return_value = {
            "total": 42,
            "days": 7,
            "by_level": {"ERROR": 30, "WARNING": 10, "CRITICAL": 2},
            "by_type": [
                {"type": "ValueError", "count": 20},
                {"type": "KeyError", "count": 12},
            ],
            "timeline": [
                {"date": "2026-01-10", "count": 5},
                {"date": "2026-01-11", "count": 8},
            ]
        }

        response = client.get("/error-logs/stats")
        assert response.status_code == 200

        data = response.json()
        assert data["total"] == 42
        assert data["days"] == 7
        assert "by_level" in data
        assert "by_type" in data
        assert "timeline" in data

        mock_service.get_stats.assert_awaited_once_with(days=7)

    def test_get_error_stats_custom_days(self, client, mock_service):
        """Test getting error statistics for a custom day range."""
        mock_service.get_stats.return_value = {"total": 0, "days": 30}

        response = client.get("/error-logs/stats?days=30")
        assert response.status_code == 200

        mock_service.get_stats.assert_awaited_once_with(days=30)

    def test_get_error_stats_service_not_initialized(self, client_no_service):
        """Test getting error stats when service is None returns 503."""
        response = client_no_service.get("/error-logs/stats")
        assert response.status_code == 503
        assert "not initialized" in response.json()["detail"]

    def test_get_error_stats_invalid_days(self, client):
        """Test that days=0 is rejected by query validation."""
        response = client.get("/error-logs/stats?days=0")
        assert response.status_code == 422

    def test_get_error_stats_days_over_limit(self, client):
        """Test that days over 365 is rejected by query validation."""
        response = client.get("/error-logs/stats?days=400")
        assert response.status_code == 422

    # ------------------------------------------------------------------ #
    # GET /error-logs/levels  (get_available_levels)
    # ------------------------------------------------------------------ #

    def test_get_available_levels_success(self, client, mock_service):
        """Test getting available log levels from the service."""
        mock_service.get_levels.return_value = ["CRITICAL", "ERROR", "WARNING"]

        response = client.get("/error-logs/levels")
        assert response.status_code == 200

        data = response.json()
        assert "levels" in data
        assert sorted(data["levels"]) == ["CRITICAL", "ERROR", "WARNING"]

        mock_service.get_levels.assert_awaited_once()

    def test_get_available_levels_service_not_initialized(self, client_no_service):
        """Test that when service is None, default levels are returned."""
        response = client_no_service.get("/error-logs/levels")
        assert response.status_code == 200

        data = response.json()
        assert "levels" in data
        assert "ERROR" in data["levels"]
        assert "WARNING" in data["levels"]
        assert "CRITICAL" in data["levels"]

    # ------------------------------------------------------------------ #
    # GET /error-logs/types  (get_available_types)
    # ------------------------------------------------------------------ #

    def test_get_available_types_success(self, client, mock_service):
        """Test getting available error types from the service."""
        mock_service.get_error_types.return_value = [
            "KeyError", "RuntimeError", "ValueError"
        ]

        response = client.get("/error-logs/types")
        assert response.status_code == 200

        data = response.json()
        assert "types" in data
        assert len(data["types"]) == 3
        assert "ValueError" in data["types"]

        mock_service.get_error_types.assert_awaited_once()

    def test_get_available_types_empty(self, client, mock_service):
        """Test getting available error types when none exist."""
        mock_service.get_error_types.return_value = []

        response = client.get("/error-logs/types")
        assert response.status_code == 200
        assert response.json()["types"] == []

    def test_get_available_types_service_not_initialized(self, client_no_service):
        """Test that when service is None, an empty types list is returned."""
        response = client_no_service.get("/error-logs/types")
        assert response.status_code == 200

        data = response.json()
        assert data["types"] == []

    # ------------------------------------------------------------------ #
    # GET /error-logs/current-file  (get_current_file_content)
    # ------------------------------------------------------------------ #

    def test_get_current_file_content_success(self, client, mock_service):
        """Test getting current log file content."""
        mock_service.get_current_file_content.return_value = {
            "entries": [
                {"level": "ERROR", "message": "Something failed", "timestamp": "2026-01-15T10:00:00"}
            ],
            "file_size_mb": 1.2,
            "file_path": "/app/logs/errors_current.jsonl",
            "max_size_mb": 5
        }

        response = client.get("/error-logs/current-file")
        assert response.status_code == 200

        data = response.json()
        assert "entries" in data
        assert len(data["entries"]) == 1
        assert data["file_size_mb"] == 1.2
        assert data["max_size_mb"] == 5

        mock_service.get_current_file_content.assert_awaited_once_with(lines=100)

    def test_get_current_file_content_custom_lines(self, client, mock_service):
        """Test getting current file content with custom line count."""
        mock_service.get_current_file_content.return_value = {
            "entries": [],
            "file_size_mb": 0.0,
            "file_path": "/app/logs/errors_current.jsonl",
            "max_size_mb": 5
        }

        response = client.get("/error-logs/current-file?lines=500")
        assert response.status_code == 200

        mock_service.get_current_file_content.assert_awaited_once_with(lines=500)

    def test_get_current_file_content_service_not_initialized(self, client_no_service):
        """Test getting current file content when service is None returns 503."""
        response = client_no_service.get("/error-logs/current-file")
        assert response.status_code == 503
        assert "not initialized" in response.json()["detail"]

    def test_get_current_file_content_lines_too_low(self, client):
        """Test that lines=0 is rejected by query validation."""
        response = client.get("/error-logs/current-file?lines=0")
        assert response.status_code == 422

    def test_get_current_file_content_lines_too_high(self, client):
        """Test that lines over 1000 is rejected by query validation."""
        response = client.get("/error-logs/current-file?lines=1500")
        assert response.status_code == 422

    # ------------------------------------------------------------------ #
    # GET /error-logs/archives  (list_archives)
    # ------------------------------------------------------------------ #

    def test_list_archives_success(self, client, mock_service):
        """Test listing archived error log files."""
        mock_service.get_archived_files.return_value = [
            {
                "_id": "arch001",
                "archive_id": "aabbccdd",
                "file_name": "errors_2026-01-10_aabbccdd.jsonl.gz",
                "original_size": 5242880,
                "compressed_size": 1048576,
                "error_count": 200,
                "created_at": "2026-01-10T12:00:00"
            },
            {
                "_id": "arch002",
                "archive_id": "eeff0011",
                "file_name": "errors_2026-01-05_eeff0011.jsonl.gz",
                "original_size": 3145728,
                "compressed_size": 786432,
                "error_count": 120,
                "created_at": "2026-01-05T08:00:00"
            }
        ]

        response = client.get("/error-logs/archives")
        assert response.status_code == 200

        data = response.json()
        assert "archives" in data
        assert "total" in data
        assert data["total"] == 2
        assert len(data["archives"]) == 2
        assert data["archives"][0]["archive_id"] == "aabbccdd"

        mock_service.get_archived_files.assert_awaited_once()

    def test_list_archives_empty(self, client, mock_service):
        """Test listing archives when none exist."""
        mock_service.get_archived_files.return_value = []

        response = client.get("/error-logs/archives")
        assert response.status_code == 200

        data = response.json()
        assert data["archives"] == []
        assert data["total"] == 0

    def test_list_archives_service_not_initialized(self, client_no_service):
        """Test listing archives when service is None returns 503."""
        response = client_no_service.get("/error-logs/archives")
        assert response.status_code == 503
        assert "not initialized" in response.json()["detail"]

    # ------------------------------------------------------------------ #
    # GET /error-logs/archives/{archive_id}/download
    # ------------------------------------------------------------------ #

    def test_get_archive_download_url_success(self, client, mock_service):
        """Test getting a signed download URL for an archive."""
        mock_service.get_archive_download_url.return_value = (
            "https://storage.googleapis.com/bucket/error_logs/errors_2026-01-10.jsonl.gz?signed=abc"
        )

        response = client.get("/error-logs/archives/aabbccdd/download")
        assert response.status_code == 200

        data = response.json()
        assert "download_url" in data
        assert data["download_url"].startswith("https://")
        assert data["expires_in_minutes"] == 60
        assert data["archive_id"] == "aabbccdd"

        mock_service.get_archive_download_url.assert_awaited_once_with(
            archive_id="aabbccdd", expiration_minutes=60
        )

    def test_get_archive_download_url_custom_expiration(self, client, mock_service):
        """Test getting a download URL with custom expiration."""
        mock_service.get_archive_download_url.return_value = "https://example.com/signed"

        response = client.get("/error-logs/archives/aabbccdd/download?expiration_minutes=120")
        assert response.status_code == 200

        data = response.json()
        assert data["expires_in_minutes"] == 120

        mock_service.get_archive_download_url.assert_awaited_once_with(
            archive_id="aabbccdd", expiration_minutes=120
        )

    def test_get_archive_download_url_not_found(self, client, mock_service):
        """Test getting download URL for a non-existent archive returns 404."""
        mock_service.get_archive_download_url.return_value = None

        response = client.get("/error-logs/archives/nonexistent/download")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_archive_download_url_service_not_initialized(self, client_no_service):
        """Test getting download URL when service is None returns 503."""
        response = client_no_service.get("/error-logs/archives/aabbccdd/download")
        assert response.status_code == 503
        assert "not initialized" in response.json()["detail"]

    def test_get_archive_download_url_expiration_too_low(self, client):
        """Test that expiration_minutes below 5 is rejected."""
        response = client.get("/error-logs/archives/aabbccdd/download?expiration_minutes=2")
        assert response.status_code == 422

    def test_get_archive_download_url_expiration_too_high(self, client):
        """Test that expiration_minutes above 1440 is rejected."""
        response = client.get("/error-logs/archives/aabbccdd/download?expiration_minutes=2000")
        assert response.status_code == 422

    # ------------------------------------------------------------------ #
    # DELETE /error-logs/archives/{archive_id}  (delete_archive)
    # ------------------------------------------------------------------ #

    def test_delete_archive_success(self, client, mock_service):
        """Test successfully deleting an archive."""
        mock_service.delete_archive.return_value = True

        response = client.delete("/error-logs/archives/aabbccdd")
        assert response.status_code == 200

        data = response.json()
        assert data["message"] == "Archive deleted successfully"
        assert data["archive_id"] == "aabbccdd"

        mock_service.delete_archive.assert_awaited_once_with("aabbccdd")

    def test_delete_archive_not_found(self, client, mock_service):
        """Test deleting a non-existent archive returns 404."""
        mock_service.delete_archive.return_value = False

        response = client.delete("/error-logs/archives/nonexistent")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_delete_archive_service_not_initialized(self, client_no_service):
        """Test deleting an archive when service is None returns 503."""
        response = client_no_service.delete("/error-logs/archives/aabbccdd")
        assert response.status_code == 503
        assert "not initialized" in response.json()["detail"]

    # ------------------------------------------------------------------ #
    # POST /error-logs/force-archive  (force_archive)
    # ------------------------------------------------------------------ #

    def test_force_archive_success(self, client, mock_service):
        """Test forcing a log file archive to GCS."""
        mock_service.force_archive.return_value = {
            "archive_id": "newarch01",
            "file_name": "errors_2026-02-20_newarch01.jsonl.gz",
            "original_size": 4194304,
            "compressed_size": 1048576,
            "error_count": 150,
        }

        response = client.post("/error-logs/force-archive")
        assert response.status_code == 200

        data = response.json()
        assert data["archived"] is True
        assert data["message"] == "Log file archived successfully"
        assert data["archive"]["archive_id"] == "newarch01"
        assert data["archive"]["error_count"] == 150

        mock_service.force_archive.assert_awaited_once()

    def test_force_archive_nothing_to_archive(self, client, mock_service):
        """Test force archive when there are no logs or GCS is not configured."""
        mock_service.force_archive.return_value = None

        response = client.post("/error-logs/force-archive")
        assert response.status_code == 200

        data = response.json()
        assert data["archived"] is False
        assert "No logs to archive" in data["message"]

    def test_force_archive_service_not_initialized(self, client_no_service):
        """Test force archive when service is None returns 503."""
        response = client_no_service.post("/error-logs/force-archive")
        assert response.status_code == 503
        assert "not initialized" in response.json()["detail"]

    def test_force_archive_partial_result(self, client, mock_service):
        """Test force archive when the result has some missing keys."""
        mock_service.force_archive.return_value = {
            "archive_id": "partial01",
        }

        response = client.post("/error-logs/force-archive")
        assert response.status_code == 200

        data = response.json()
        assert data["archived"] is True
        assert data["archive"]["archive_id"] == "partial01"
        assert data["archive"]["file_name"] is None
        assert data["archive"]["original_size"] is None
        assert data["archive"]["compressed_size"] is None
        assert data["archive"]["error_count"] is None

    # ------------------------------------------------------------------ #
    # DELETE /error-logs/cleanup  (cleanup_old_archives)
    # ------------------------------------------------------------------ #

    def test_cleanup_old_archives_success(self, client, mock_service):
        """Test cleaning up old archives."""
        mock_service.cleanup_old_archives.return_value = {
            "deleted": 5,
            "errors": None
        }

        response = client.delete("/error-logs/cleanup?days=90")
        assert response.status_code == 200

        data = response.json()
        assert data["deleted_count"] == 5
        assert "90 days" in data["message"]
        assert data["errors"] is None

        mock_service.cleanup_old_archives.assert_awaited_once_with(days=90)

    def test_cleanup_old_archives_default_days(self, client, mock_service):
        """Test cleanup uses default 90 days when not specified."""
        mock_service.cleanup_old_archives.return_value = {
            "deleted": 0,
            "errors": None
        }

        response = client.delete("/error-logs/cleanup")
        assert response.status_code == 200

        mock_service.cleanup_old_archives.assert_awaited_once_with(days=90)

    def test_cleanup_old_archives_custom_days(self, client, mock_service):
        """Test cleanup with a custom days value."""
        mock_service.cleanup_old_archives.return_value = {
            "deleted": 3,
            "errors": None
        }

        response = client.delete("/error-logs/cleanup?days=30")
        assert response.status_code == 200

        data = response.json()
        assert "30 days" in data["message"]
        assert data["deleted_count"] == 3

        mock_service.cleanup_old_archives.assert_awaited_once_with(days=30)

    def test_cleanup_old_archives_with_errors(self, client, mock_service):
        """Test cleanup that encounters partial errors."""
        mock_service.cleanup_old_archives.return_value = {
            "deleted": 2,
            "errors": ["Failed to delete arch001", "Error deleting arch002: timeout"]
        }

        response = client.delete("/error-logs/cleanup?days=60")
        assert response.status_code == 200

        data = response.json()
        assert data["deleted_count"] == 2
        assert len(data["errors"]) == 2

    def test_cleanup_old_archives_nothing_to_delete(self, client, mock_service):
        """Test cleanup when no archives are old enough."""
        mock_service.cleanup_old_archives.return_value = {
            "deleted": 0,
            "errors": None
        }

        response = client.delete("/error-logs/cleanup?days=365")
        assert response.status_code == 200

        data = response.json()
        assert data["deleted_count"] == 0

    def test_cleanup_old_archives_service_not_initialized(self, client_no_service):
        """Test cleanup when service is None returns 503."""
        response = client_no_service.delete("/error-logs/cleanup?days=90")
        assert response.status_code == 503
        assert "not initialized" in response.json()["detail"]

    def test_cleanup_old_archives_invalid_days(self, client):
        """Test that days=0 is rejected by query validation."""
        response = client.delete("/error-logs/cleanup?days=0")
        assert response.status_code == 422

    # ------------------------------------------------------------------ #
    # Service-not-initialized tests for all endpoints (comprehensive)
    # ------------------------------------------------------------------ #

    def test_all_endpoints_503_when_service_none(self, client_no_service):
        """Verify every endpoint that guards on service is None returns 503 or defaults."""
        # Endpoints that raise 503
        assert client_no_service.get("/error-logs").status_code == 503
        assert client_no_service.get("/error-logs/stats").status_code == 503
        assert client_no_service.get("/error-logs/current-file").status_code == 503
        assert client_no_service.get("/error-logs/archives").status_code == 503
        assert client_no_service.get("/error-logs/archives/x/download").status_code == 503
        assert client_no_service.delete("/error-logs/archives/x").status_code == 503
        assert client_no_service.post("/error-logs/force-archive").status_code == 503
        assert client_no_service.delete("/error-logs/cleanup?days=1").status_code == 503

        # Endpoints that return default values instead of 503
        levels_resp = client_no_service.get("/error-logs/levels")
        assert levels_resp.status_code == 200
        assert "ERROR" in levels_resp.json()["levels"]

        types_resp = client_no_service.get("/error-logs/types")
        assert types_resp.status_code == 200
        assert types_resp.json()["types"] == []

    # ------------------------------------------------------------------ #
    # Multiple records / realistic data scenarios
    # ------------------------------------------------------------------ #

    def test_list_error_logs_multiple_records(self, client, mock_service):
        """Test listing error logs with multiple records."""
        logs = [
            {
                "_id": f"id_{i}",
                "level": level,
                "error_type": etype,
                "message": f"Error message {i}",
                "timestamp": f"2026-01-{15 + i}T10:00:00"
            }
            for i, (level, etype) in enumerate([
                ("ERROR", "ValueError"),
                ("WARNING", "DeprecationWarning"),
                ("CRITICAL", "SystemExit"),
                ("ERROR", "KeyError"),
                ("ERROR", "RuntimeError"),
            ])
        ]

        mock_service.get_current_logs.return_value = {
            "logs": logs,
            "total": 50
        }

        response = client.get("/error-logs?page=0&limit=5")
        assert response.status_code == 200

        data = response.json()
        assert len(data["data"]) == 5
        assert data["pagination"]["total"] == 50
        assert data["pagination"]["pages"] == 10
        assert data["pagination"]["has_next"] is True

    def test_list_archives_with_date_range(self, client, mock_service):
        """Test listing archives that include date range metadata."""
        mock_service.get_archived_files.return_value = [
            {
                "_id": "arch_001",
                "archive_id": "a1b2c3d4",
                "file_name": "errors_2026-01-01_a1b2c3d4.jsonl.gz",
                "original_size": 5000000,
                "compressed_size": 1200000,
                "error_count": 300,
                "date_range": {
                    "start": "2025-12-28T00:00:00",
                    "end": "2026-01-01T23:59:59"
                },
                "created_at": "2026-01-02T00:05:00"
            }
        ]

        response = client.get("/error-logs/archives")
        assert response.status_code == 200

        data = response.json()
        archive = data["archives"][0]
        assert "date_range" in archive
        assert archive["date_range"]["start"] == "2025-12-28T00:00:00"

    def test_get_error_stats_full_structure(self, client, mock_service):
        """Test that get_stats response structure is passed through correctly."""
        full_stats = {
            "total": 150,
            "days": 14,
            "by_level": {"ERROR": 100, "WARNING": 40, "CRITICAL": 10},
            "by_type": [
                {"type": "ValueError", "count": 50},
                {"type": "KeyError", "count": 30},
                {"type": "TypeError", "count": 20},
                {"type": "AttributeError", "count": 15},
                {"type": "RuntimeError", "count": 10},
            ],
            "timeline": [
                {"date": "2026-01-01", "count": 10},
                {"date": "2026-01-02", "count": 15},
                {"date": "2026-01-03", "count": 8},
            ]
        }
        mock_service.get_stats.return_value = full_stats

        response = client.get("/error-logs/stats?days=14")
        assert response.status_code == 200

        data = response.json()
        assert data == full_stats

    def test_get_current_file_content_multiple_entries(self, client, mock_service):
        """Test getting current file content with multiple log entries."""
        entries = [
            {
                "timestamp": f"2026-02-20T10:0{i}:00",
                "level": "ERROR",
                "error_type": "TestError",
                "message": f"Test error message {i}"
            }
            for i in range(5)
        ]

        mock_service.get_current_file_content.return_value = {
            "entries": entries,
            "file_size_mb": 0.3,
            "file_path": "/app/logs/errors_current.jsonl",
            "max_size_mb": 5
        }

        response = client.get("/error-logs/current-file?lines=50")
        assert response.status_code == 200

        data = response.json()
        assert len(data["entries"]) == 5
        assert data["file_size_mb"] == 0.3
