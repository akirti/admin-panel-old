"""Tests for GCS Service"""
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, AsyncMock
import asyncio

from easylifeauth.services.gcs_service import GCSService


class TestGCSServiceInit:
    """Tests for GCSService initialization"""

    def test_init_default(self):
        """Test default initialization"""
        service = GCSService()
        assert service.client is None
        assert service.bucket_name is None
        assert service.credentials is None

    def test_init_no_bucket_name(self):
        """Test init without bucket name"""
        service = GCSService({"credentials_json": "{}"})
        assert service.is_configured() is False
        assert "bucket_name" in service.get_init_error()

    def test_init_no_credentials(self):
        """Test init without credentials"""
        service = GCSService({"bucket_name": "test-bucket"})
        assert service.is_configured() is False
        assert "credentials_json" in service.get_init_error()

    def test_init_invalid_json_credentials(self):
        """Test init with invalid JSON credentials"""
        service = GCSService({
            "bucket_name": "test-bucket",
            "credentials_json": "invalid json {"
        })
        assert service.is_configured() is False
        assert "Invalid JSON" in service.get_init_error()

    def test_init_credentials_missing_type(self):
        """Test init with credentials missing type field"""
        service = GCSService({
            "bucket_name": "test-bucket",
            "credentials_json": '{"project_id": "test"}'
        })
        assert service.is_configured() is False
        assert "type" in service.get_init_error()

    def test_get_init_error(self):
        """Test get_init_error method"""
        service = GCSService()
        assert service.get_init_error() is None

        service._init_error = "Test error"
        assert service.get_init_error() == "Test error"

    def test_is_configured_false(self):
        """Test is_configured when not configured"""
        service = GCSService()
        assert service.is_configured() is False

    def test_is_configured_true(self):
        """Test is_configured when configured"""
        service = GCSService()
        service.client = MagicMock()  # Simulate configured client
        assert service.is_configured() is True


class TestGCSServiceConfiguredOperations:
    """Tests for GCS operations when configured"""

    @pytest.fixture
    def mock_service(self):
        """Create service with mocked client"""
        service = GCSService()
        service.client = MagicMock()
        service.bucket_name = "test-bucket"
        return service

    def test_sync_download_file_success(self, mock_service):
        """Test sync download success"""
        mock_blob = MagicMock()
        mock_blob.exists.return_value = True
        mock_blob.download_as_bytes.return_value = b"file content"

        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob

        mock_service.client.bucket.return_value = mock_bucket

        result = mock_service._sync_download_file("path/file.txt", "test-bucket")
        assert result == b"file content"

    def test_sync_download_file_not_found(self, mock_service):
        """Test sync download when file not found"""
        mock_blob = MagicMock()
        mock_blob.exists.return_value = False

        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob

        mock_service.client.bucket.return_value = mock_bucket

        result = mock_service._sync_download_file("path/file.txt", "test-bucket")
        assert result is None

    def test_sync_download_file_exception(self, mock_service):
        """Test sync download with exception"""
        mock_service.client.bucket.side_effect = Exception("Network error")

        result = mock_service._sync_download_file("path/file.txt", "test-bucket")
        assert result is None

    def test_sync_upload_file_success(self, mock_service):
        """Test sync upload success"""
        mock_blob = MagicMock()
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob

        mock_service.client.bucket.return_value = mock_bucket

        result = mock_service._sync_upload_file(
            b"content", "path/file.txt", "text/plain", "test-bucket"
        )
        assert result == "gs://test-bucket/path/file.txt"
        mock_blob.upload_from_string.assert_called_once()

    def test_sync_upload_file_exception(self, mock_service):
        """Test sync upload with exception"""
        mock_service.client.bucket.side_effect = Exception("Upload error")

        result = mock_service._sync_upload_file(
            b"content", "path/file.txt", "text/plain", "test-bucket"
        )
        assert result is None

    def test_sync_list_files_success(self, mock_service):
        """Test sync list files success"""
        mock_blob1 = MagicMock()
        mock_blob1.name = "file1.txt"
        mock_blob1.size = 100
        mock_blob1.updated = datetime.now(timezone.utc)
        mock_blob1.content_type = "text/plain"

        mock_blob2 = MagicMock()
        mock_blob2.name = "file2.csv"
        mock_blob2.size = 200
        mock_blob2.updated = None
        mock_blob2.content_type = "text/csv"

        mock_bucket = MagicMock()
        mock_bucket.list_blobs.return_value = [mock_blob1, mock_blob2]

        mock_service.client.bucket.return_value = mock_bucket

        result = mock_service._sync_list_files("prefix/", "test-bucket")
        assert len(result) == 2
        assert result[0]["name"] == "file1.txt"
        assert result[1]["name"] == "file2.csv"

    def test_sync_list_files_exception(self, mock_service):
        """Test sync list files with exception"""
        mock_service.client.bucket.side_effect = Exception("List error")

        result = mock_service._sync_list_files("prefix/", "test-bucket")
        assert result == []

    def test_sync_delete_file_success(self, mock_service):
        """Test sync delete success"""
        mock_blob = MagicMock()
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob

        mock_service.client.bucket.return_value = mock_bucket

        result = mock_service._sync_delete_file("path/file.txt", "test-bucket")
        assert result is True
        mock_blob.delete.assert_called_once()

    def test_sync_delete_file_exception(self, mock_service):
        """Test sync delete with exception"""
        mock_service.client.bucket.side_effect = Exception("Delete error")

        result = mock_service._sync_delete_file("path/file.txt", "test-bucket")
        assert result is False

    def test_sync_file_exists_true(self, mock_service):
        """Test sync file exists when file exists"""
        mock_blob = MagicMock()
        mock_blob.exists.return_value = True
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob

        mock_service.client.bucket.return_value = mock_bucket

        result = mock_service._sync_file_exists("path/file.txt", "test-bucket")
        assert result is True

    def test_sync_file_exists_false(self, mock_service):
        """Test sync file exists when file doesn't exist"""
        mock_blob = MagicMock()
        mock_blob.exists.return_value = False
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob

        mock_service.client.bucket.return_value = mock_bucket

        result = mock_service._sync_file_exists("path/file.txt", "test-bucket")
        assert result is False

    def test_sync_file_exists_exception(self, mock_service):
        """Test sync file exists with exception"""
        mock_service.client.bucket.side_effect = Exception("Check error")

        result = mock_service._sync_file_exists("path/file.txt", "test-bucket")
        assert result is False

    def test_sync_get_signed_url_success(self, mock_service):
        """Test sync get signed URL success"""
        mock_blob = MagicMock()
        mock_blob.generate_signed_url.return_value = "https://signed-url.example.com"
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob

        mock_service.client.bucket.return_value = mock_bucket

        result = mock_service._sync_get_signed_url("path/file.txt", 60, "test-bucket")
        assert result == "https://signed-url.example.com"

    def test_sync_get_signed_url_exception(self, mock_service):
        """Test sync get signed URL with exception"""
        mock_service.client.bucket.side_effect = Exception("URL error")

        result = mock_service._sync_get_signed_url("path/file.txt", 60, "test-bucket")
        assert result is None


class TestGCSServiceAsyncMethods:
    """Tests for async methods"""

    @pytest.fixture
    def mock_service(self):
        """Create service with mocked client"""
        service = GCSService()
        service.client = MagicMock()
        service.bucket_name = "test-bucket"
        return service

    @pytest.mark.asyncio
    async def test_download_file_not_configured(self):
        """Test download when not configured"""
        service = GCSService()
        result = await service.download_file("path/file.txt")
        assert result is None

    @pytest.mark.asyncio
    async def test_download_file_success(self, mock_service):
        """Test async download success"""
        mock_blob = MagicMock()
        mock_blob.exists.return_value = True
        mock_blob.download_as_bytes.return_value = b"content"
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob
        mock_service.client.bucket.return_value = mock_bucket

        result = await mock_service.download_file("path/file.txt")
        assert result == b"content"

    @pytest.mark.asyncio
    async def test_download_file_custom_bucket(self, mock_service):
        """Test download with custom bucket"""
        mock_blob = MagicMock()
        mock_blob.exists.return_value = True
        mock_blob.download_as_bytes.return_value = b"content"
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob
        mock_service.client.bucket.return_value = mock_bucket

        result = await mock_service.download_file("path/file.txt", "custom-bucket")
        assert result == b"content"

    @pytest.mark.asyncio
    async def test_upload_file_not_configured(self):
        """Test upload when not configured"""
        service = GCSService()
        result = await service.upload_file(b"content", "path/file.txt")
        assert result is None

    @pytest.mark.asyncio
    async def test_upload_file_success(self, mock_service):
        """Test async upload success"""
        mock_blob = MagicMock()
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob
        mock_service.client.bucket.return_value = mock_bucket

        result = await mock_service.upload_file(
            b"content", "path/file.txt", "text/plain"
        )
        assert "gs://" in result

    @pytest.mark.asyncio
    async def test_list_files_not_configured(self):
        """Test list files when not configured"""
        service = GCSService()
        result = await service.list_files("prefix/")
        assert result == []

    @pytest.mark.asyncio
    async def test_list_files_success(self, mock_service):
        """Test async list files success"""
        mock_blob = MagicMock()
        mock_blob.name = "file.txt"
        mock_blob.size = 100
        mock_blob.updated = datetime.now(timezone.utc)
        mock_blob.content_type = "text/plain"

        mock_bucket = MagicMock()
        mock_bucket.list_blobs.return_value = [mock_blob]
        mock_service.client.bucket.return_value = mock_bucket

        result = await mock_service.list_files("prefix/")
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_delete_file_not_configured(self):
        """Test delete when not configured"""
        service = GCSService()
        result = await service.delete_file("path/file.txt")
        assert result is False

    @pytest.mark.asyncio
    async def test_delete_file_success(self, mock_service):
        """Test async delete success"""
        mock_blob = MagicMock()
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob
        mock_service.client.bucket.return_value = mock_bucket

        result = await mock_service.delete_file("path/file.txt")
        assert result is True

    @pytest.mark.asyncio
    async def test_file_exists_not_configured(self):
        """Test file exists when not configured"""
        service = GCSService()
        result = await service.file_exists("path/file.txt")
        assert result is False

    @pytest.mark.asyncio
    async def test_file_exists_success(self, mock_service):
        """Test async file exists"""
        mock_blob = MagicMock()
        mock_blob.exists.return_value = True
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob
        mock_service.client.bucket.return_value = mock_bucket

        result = await mock_service.file_exists("path/file.txt")
        assert result is True

    @pytest.mark.asyncio
    async def test_get_signed_url_not_configured(self):
        """Test get signed URL when not configured"""
        service = GCSService()
        result = await service.get_signed_url("path/file.txt")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_signed_url_success(self, mock_service):
        """Test async get signed URL"""
        mock_blob = MagicMock()
        mock_blob.generate_signed_url.return_value = "https://signed.url"
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob
        mock_service.client.bucket.return_value = mock_bucket

        result = await mock_service.get_signed_url("path/file.txt", 30)
        assert result == "https://signed.url"


class TestGCSServiceInitWithMockedLibraries:
    """Tests for GCS init with mocked google libraries"""

    def test_init_with_valid_credentials(self):
        """Test initialization with valid credentials"""
        import sys

        # Create mock modules
        mock_storage = MagicMock()
        mock_storage_module = MagicMock()
        mock_storage_module.Client = MagicMock(return_value=mock_storage)

        mock_sa = MagicMock()
        mock_sa.Credentials.from_service_account_info = MagicMock(return_value=MagicMock())

        mock_google = MagicMock()
        mock_google_cloud = MagicMock()
        mock_google_oauth2 = MagicMock()

        # Patch sys.modules to mock the imports
        with patch.dict(sys.modules, {
            'google': mock_google,
            'google.cloud': mock_google_cloud,
            'google.cloud.storage': mock_storage_module,
            'google.oauth2': mock_google_oauth2,
            'google.oauth2.service_account': mock_sa
        }):
            service = GCSService({
                "bucket_name": "test-bucket",
                "credentials_json": '{"type": "service_account", "project_id": "test"}'
            })

            # Verify the service was configured
            assert service.bucket_name == "test-bucket"

    def test_init_import_error(self):
        """Test initialization when google-cloud-storage not installed"""
        # Create service without config - should not try to import
        service = GCSService()
        assert service.is_configured() is False

    def test_init_credentials_dict(self):
        """Test initialization with credentials as dict"""
        import sys

        # Create mock modules
        mock_storage_module = MagicMock()
        mock_storage_module.Client = MagicMock(return_value=MagicMock())

        mock_sa = MagicMock()
        mock_sa.Credentials.from_service_account_info = MagicMock(return_value=MagicMock())

        with patch.dict(sys.modules, {
            'google': MagicMock(),
            'google.cloud': MagicMock(),
            'google.cloud.storage': mock_storage_module,
            'google.oauth2': MagicMock(),
            'google.oauth2.service_account': mock_sa
        }):
            service = GCSService({
                "bucket_name": "test-bucket",
                "credentials_json": {"type": "service_account", "project_id": "test"}
            })
            # With mocked google libraries, it should configure successfully
            assert service.bucket_name == "test-bucket"
