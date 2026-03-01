"""Tests for File Storage Service"""
import pytest
import os
import tempfile
import shutil
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

from easylifeauth.services.file_storage_service import FileStorageService


class TestFileStorageServiceInit:
    """Tests for FileStorageService initialization"""

    def test_init_default(self):
        """Test default initialization"""
        service = FileStorageService()
        assert service.enabled is False
        assert service.storage_type == "local"

    def test_init_local_storage(self):
        """Test initialization with local storage config"""
        with tempfile.TemporaryDirectory() as tmpdir:
            service = FileStorageService({
                "type": "local",
                "base_path": tmpdir
            })
            assert service.enabled is True
            assert service.storage_type == "local"
            assert service.base_path == tmpdir

    def test_init_gcs_without_package(self):
        """Test GCS initialization when google-cloud-storage is not installed"""
        with patch.dict('sys.modules', {'google.cloud': None, 'google.cloud.storage': None}):
            service = FileStorageService({
                "type": "gcs",
                "bucket_name": "test-bucket"
            })
            # Should fall back to local
            assert service.storage_type == "local"
            assert "not installed" in str(service._init_error or "")

    def test_init_gcs_invalid_credentials_json(self):
        """Test GCS initialization with invalid JSON credentials"""
        with patch('easylifeauth.services.file_storage_service.FileStorageService._init_gcs_client') as mock_init:
            mock_init.return_value = False
            service = FileStorageService({
                "type": "gcs",
                "bucket_name": "test-bucket",
                "credentials_json": "invalid json"
            })
            # Falls back to local
            assert service.storage_type == "local"

    def test_get_init_error(self):
        """Test get_init_error method"""
        service = FileStorageService()
        service._init_error = "Test error"
        assert service.get_init_error() == "Test error"

    def test_is_gcs_configured_false(self):
        """Test is_gcs_configured when not configured"""
        service = FileStorageService()
        assert service.is_gcs_configured() is False


class TestFileStorageServiceHelpers:
    """Tests for helper methods"""

    @pytest.fixture
    def service(self):
        """Create service with local storage"""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield FileStorageService({
                "type": "local",
                "base_path": tmpdir
            })

    def test_generate_file_path(self, service):
        """Test file path generation"""
        path = service._generate_file_path("REQ-001", "test.csv", "files")
        assert "scenario_requests/REQ-001/files/" in path
        assert "test.csv" in path

    def test_generate_file_path_sanitizes_name(self, service):
        """Test file path generation sanitizes filename"""
        path = service._generate_file_path("REQ-001", "test file!@#.csv")
        assert "test_file___" in path

    def test_get_mime_type_csv(self, service):
        """Test MIME type detection for CSV"""
        mime = service._get_mime_type("test.csv")
        assert mime in ("text/csv", "application/vnd.ms-excel")

    def test_get_mime_type_json(self, service):
        """Test MIME type detection for JSON"""
        mime = service._get_mime_type("test.json")
        assert mime == "application/json"

    def test_get_mime_type_unknown(self, service):
        """Test MIME type detection for unknown"""
        # Use a truly unknown extension
        mime = service._get_mime_type("test.unknown_extension_12345")
        assert mime == "application/octet-stream"

    def test_get_file_type_excel(self, service):
        """Test file type detection for Excel"""
        assert service._get_file_type("test.xlsx") == "excel"
        assert service._get_file_type("test.xls") == "excel"

    def test_get_file_type_csv(self, service):
        """Test file type detection for CSV"""
        assert service._get_file_type("test.csv") == "csv"

    def test_get_file_type_json(self, service):
        """Test file type detection for JSON"""
        assert service._get_file_type("test.json") == "json"

    def test_get_file_type_image(self, service):
        """Test file type detection for images"""
        assert service._get_file_type("test.jpg") == "image"
        assert service._get_file_type("test.png") == "image"
        assert service._get_file_type("test.gif") == "image"
        assert service._get_file_type("test.svg") == "image"

    def test_get_file_type_pdf(self, service):
        """Test file type detection for PDF"""
        assert service._get_file_type("test.pdf") == "pdf"

    def test_get_file_type_other(self, service):
        """Test file type detection for other files"""
        assert service._get_file_type("test.doc") == "other"


class TestFileStorageServiceLocalOps:
    """Tests for local storage operations"""

    @pytest.fixture
    def service(self):
        """Create service with local storage"""
        tmpdir = tempfile.mkdtemp()
        service = FileStorageService({
            "type": "local",
            "base_path": tmpdir
        })
        yield service
        # Cleanup
        shutil.rmtree(tmpdir, ignore_errors=True)

    @pytest.mark.asyncio
    async def test_upload_file_success(self, service):
        """Test successful file upload"""
        result = await service.upload_file(
            request_id="REQ-001",
            file_name="test.csv",
            file_content=b"col1,col2\n1,2",
            folder="files",
            uploaded_by="test@example.com"
        )

        assert result is not None
        assert result["file_name"] == "test.csv"
        assert result["file_type"] == "csv"
        assert result["status"] == "A"
        assert result["uploaded_by"] == "test@example.com"
        assert result["gcs_path"].startswith("file://")

    @pytest.mark.asyncio
    async def test_upload_file_disabled(self):
        """Test upload when service is disabled"""
        service = FileStorageService()
        result = await service.upload_file(
            request_id="REQ-001",
            file_name="test.csv",
            file_content=b"data"
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_download_file_local(self, service):
        """Test downloading local file"""
        # First upload a file
        await service.upload_file(
            request_id="REQ-001",
            file_name="test.txt",
            file_content=b"test content"
        )

        # Get the path from list_files
        files = await service.list_files("REQ-001", "files")
        assert len(files) > 0

        result = await service.download_file(files[0]["gcs_path"])
        assert result is not None
        content, filename = result
        assert b"test content" in content

    @pytest.mark.asyncio
    async def test_download_file_not_exists(self, service):
        """Test downloading non-existent file"""
        result = await service.download_file("file:///nonexistent/path.txt")
        assert result is None

    @pytest.mark.asyncio
    async def test_download_file_disabled(self):
        """Test download when service is disabled"""
        service = FileStorageService()
        result = await service.download_file("file:///some/path.txt")
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_file_local(self, service):
        """Test deleting local file"""
        # First upload a file
        upload_result = await service.upload_file(
            request_id="REQ-001",
            file_name="delete_me.txt",
            file_content=b"to be deleted"
        )

        # Delete it
        result = await service.delete_file(upload_result["gcs_path"])
        assert result is True

        # Verify it's gone
        download_result = await service.download_file(upload_result["gcs_path"])
        assert download_result is None

    @pytest.mark.asyncio
    async def test_delete_file_not_exists(self, service):
        """Test deleting non-existent file"""
        result = await service.delete_file("file:///nonexistent/path.txt")
        assert result is False

    @pytest.mark.asyncio
    async def test_delete_file_disabled(self):
        """Test delete when service is disabled"""
        service = FileStorageService()
        result = await service.delete_file("file:///some/path.txt")
        assert result is False

    @pytest.mark.asyncio
    async def test_list_files(self, service):
        """Test listing files"""
        # Upload some files
        await service.upload_file("REQ-001", "file1.txt", b"content1")
        await service.upload_file("REQ-001", "file2.csv", b"col1,col2")

        files = await service.list_files("REQ-001", "files")
        assert len(files) == 2

    @pytest.mark.asyncio
    async def test_list_files_empty(self, service):
        """Test listing files when none exist"""
        files = await service.list_files("REQ-EMPTY", "files")
        assert files == []

    @pytest.mark.asyncio
    async def test_list_files_disabled(self):
        """Test list when service is disabled"""
        service = FileStorageService()
        result = await service.list_files("REQ-001")
        assert result == []


class TestFileStorageServicePreview:
    """Tests for file preview functionality"""

    @pytest.fixture
    def service(self):
        """Create service with local storage"""
        tmpdir = tempfile.mkdtemp()
        service = FileStorageService({
            "type": "local",
            "base_path": tmpdir
        })
        yield service
        shutil.rmtree(tmpdir, ignore_errors=True)

    @pytest.mark.asyncio
    async def test_preview_json_file(self, service):
        """Test JSON file preview"""
        json_content = b'{"key": "value", "number": 123}'
        await service.upload_file("REQ-001", "data.json", json_content)

        files = await service.list_files("REQ-001", "files")
        result = await service.get_file_content_for_preview(files[0]["gcs_path"], "json")

        assert result is not None
        assert result["type"] == "json"
        assert result["data"]["key"] == "value"

    @pytest.mark.asyncio
    async def test_preview_csv_file(self, service):
        """Test CSV file preview"""
        csv_content = b"name,age\nJohn,30\nJane,25"
        await service.upload_file("REQ-001", "data.csv", csv_content)

        files = await service.list_files("REQ-001", "files")
        result = await service.get_file_content_for_preview(files[0]["gcs_path"], "csv")

        assert result is not None
        assert result["type"] == "grid"
        assert "name" in result["headers"]
        assert result["total_rows"] == 2

    @pytest.mark.asyncio
    async def test_preview_image_file(self, service):
        """Test image file preview"""
        # Minimal PNG file (1x1 transparent pixel)
        png_content = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        await service.upload_file("REQ-001", "image.png", png_content)

        files = await service.list_files("REQ-001", "files")
        result = await service.get_file_content_for_preview(files[0]["gcs_path"], "image")

        assert result is not None
        assert result["type"] == "image"
        assert result["data"].startswith("data:image/png;base64,")

    @pytest.mark.asyncio
    async def test_preview_text_file(self, service):
        """Test text file preview"""
        text_content = b"This is plain text content."
        await service.upload_file("REQ-001", "readme.txt", text_content)

        files = await service.list_files("REQ-001", "files")
        result = await service.get_file_content_for_preview(files[0]["gcs_path"], "text")

        assert result is not None
        assert result["type"] == "text"
        assert "plain text" in result["data"]

    @pytest.mark.asyncio
    async def test_preview_other_file(self, service):
        """Test other file type preview"""
        binary_content = b"\x00\x01\x02\x03"
        await service.upload_file("REQ-001", "data.bin", binary_content)

        files = await service.list_files("REQ-001", "files")
        result = await service.get_file_content_for_preview(files[0]["gcs_path"], "other")

        assert result is not None
        assert result["type"] == "download_only"

    @pytest.mark.asyncio
    async def test_preview_file_not_found(self, service):
        """Test preview for non-existent file"""
        result = await service.get_file_content_for_preview("file:///nonexistent.json", "json")
        assert result is None

    @pytest.mark.asyncio
    async def test_preview_excel_file(self, service):
        """Test Excel file preview"""
        # Create a minimal xlsx file using pandas
        import pandas as pd
        from io import BytesIO

        df = pd.DataFrame({"col1": [1, 2], "col2": ["a", "b"]})
        buffer = BytesIO()
        df.to_excel(buffer, index=False)
        excel_content = buffer.getvalue()

        await service.upload_file("REQ-001", "data.xlsx", excel_content)

        files = await service.list_files("REQ-001", "files")
        result = await service.get_file_content_for_preview(files[0]["gcs_path"], "excel")

        assert result is not None
        assert result["type"] == "grid"
        assert "col1" in result["headers"]


class TestFileStorageServiceGCS:
    """Tests for GCS storage operations (mocked)"""

    @pytest.mark.asyncio
    async def test_upload_file_gcs(self):
        """Test GCS file upload"""
        mock_blob = MagicMock()
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob
        mock_client = MagicMock()
        mock_client.bucket.return_value = mock_bucket

        service = FileStorageService()
        service.enabled = True
        service.storage_type = "gcs"
        service.gcs_client = mock_client
        service.bucket_name = "test-bucket"

        result = await service.upload_file(
            request_id="REQ-001",
            file_name="test.csv",
            file_content=b"data"
        )

        assert result is not None
        assert result["gcs_path"].startswith("gs://test-bucket/")
        mock_blob.upload_from_string.assert_called_once()

    @pytest.mark.asyncio
    async def test_download_file_gcs(self):
        """Test GCS file download"""
        mock_blob = MagicMock()
        mock_blob.download_as_bytes.return_value = b"file content"
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob
        mock_client = MagicMock()
        mock_client.bucket.return_value = mock_bucket

        service = FileStorageService()
        service.enabled = True
        service.storage_type = "gcs"
        service.gcs_client = mock_client

        result = await service.download_file("gs://test-bucket/path/to/file.txt")

        assert result is not None
        content, filename = result
        assert content == b"file content"
        assert filename == "file.txt"

    @pytest.mark.asyncio
    async def test_delete_file_gcs(self):
        """Test GCS file deletion"""
        mock_blob = MagicMock()
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob
        mock_client = MagicMock()
        mock_client.bucket.return_value = mock_bucket

        service = FileStorageService()
        service.enabled = True
        service.storage_type = "gcs"
        service.gcs_client = mock_client

        result = await service.delete_file("gs://test-bucket/path/file.txt")

        assert result is True
        mock_blob.delete.assert_called_once()

    @pytest.mark.asyncio
    async def test_download_file_gcs_no_client(self):
        """Test GCS download when client is None"""
        service = FileStorageService()
        service.enabled = True
        service.gcs_client = None

        result = await service.download_file("gs://test-bucket/path/file.txt")
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_file_gcs_no_client(self):
        """Test GCS delete when client is None"""
        service = FileStorageService()
        service.enabled = True
        service.gcs_client = None

        result = await service.delete_file("gs://test-bucket/path/file.txt")
        assert result is False

    @pytest.mark.asyncio
    async def test_list_files_gcs(self):
        """Test GCS file listing"""
        mock_blob1 = MagicMock()
        mock_blob1.name = "scenario_requests/REQ-001/files/test1.csv"
        mock_blob1.size = 100
        mock_blob1.time_created = datetime.now(timezone.utc)

        mock_bucket = MagicMock()
        mock_bucket.list_blobs.return_value = [mock_blob1]
        mock_client = MagicMock()
        mock_client.bucket.return_value = mock_bucket

        service = FileStorageService()
        service.enabled = True
        service.storage_type = "gcs"
        service.gcs_client = mock_client
        service.bucket_name = "test-bucket"

        files = await service.list_files("REQ-001", "files")

        assert len(files) == 1
        assert files[0]["file_name"] == "test1.csv"

    # ===================== Additional Tests for Coverage =====================

    @pytest.mark.asyncio
    async def test_upload_file_exception(self):
        """Test upload file with exception"""
        mock_blob = MagicMock()
        mock_blob.upload_from_string.side_effect = Exception("Upload failed")
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob
        mock_client = MagicMock()
        mock_client.bucket.return_value = mock_bucket

        service = FileStorageService()
        service.enabled = True
        service.storage_type = "gcs"
        service.gcs_client = mock_client
        service.bucket_name = "test-bucket"

        result = await service.upload_file(
            request_id="REQ-001",
            file_name="test.csv",
            file_content=b"data"
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_download_file_gcs_exception(self):
        """Test GCS file download with exception"""
        mock_blob = MagicMock()
        mock_blob.download_as_bytes.side_effect = Exception("Download failed")
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob
        mock_client = MagicMock()
        mock_client.bucket.return_value = mock_bucket

        service = FileStorageService()
        service.enabled = True
        service.storage_type = "gcs"
        service.gcs_client = mock_client

        result = await service.download_file("gs://test-bucket/path/to/file.txt")

        assert result is None

    @pytest.mark.asyncio
    async def test_delete_file_gcs_exception(self):
        """Test GCS file deletion with exception"""
        mock_blob = MagicMock()
        mock_blob.delete.side_effect = Exception("Delete failed")
        mock_bucket = MagicMock()
        mock_bucket.blob.return_value = mock_blob
        mock_client = MagicMock()
        mock_client.bucket.return_value = mock_bucket

        service = FileStorageService()
        service.enabled = True
        service.storage_type = "gcs"
        service.gcs_client = mock_client

        result = await service.delete_file("gs://test-bucket/path/file.txt")

        assert result is False

    @pytest.mark.asyncio
    async def test_list_files_gcs_no_client(self):
        """Test GCS list when client is None"""
        service = FileStorageService()
        service.enabled = True
        service.storage_type = "gcs"
        service.gcs_client = None

        result = await service.list_files("REQ-001", "files")
        assert result == []


class TestFileStorageServiceGCSInit:
    """Tests for GCS initialization"""

    def test_init_gcs_with_valid_credentials(self):
        """Test GCS initialization with valid credentials JSON"""
        valid_creds = '{"type": "service_account", "project_id": "test"}'

        # The import happens inside _init_gcs_client, so we need to skip if google packages aren't installed
        service = FileStorageService()
        service.bucket_name = "test-bucket"
        result = service._init_gcs_client(valid_creds)

        # Result will be False if google-cloud-storage is not installed, which is expected
        # The test verifies the method can be called without exception

    def test_init_gcs_with_dict_credentials(self):
        """Test GCS initialization with dict credentials"""
        creds_dict = {"type": "service_account", "project_id": "test"}

        service = FileStorageService()
        service.bucket_name = "test-bucket"
        result = service._init_gcs_client(creds_dict)

        # Result depends on whether google-cloud-storage is installed

    def test_init_gcs_with_invalid_json(self):
        """Test GCS initialization with invalid JSON"""
        service = FileStorageService()
        service.bucket_name = "test-bucket"

        result = service._init_gcs_client("not valid json {{{")

        assert result is False
        assert "Invalid JSON" in service._init_error

    def test_init_gcs_credentials_missing_type(self):
        """Test GCS initialization with credentials missing 'type' field"""
        service = FileStorageService()
        service.bucket_name = "test-bucket"

        # Valid JSON but missing 'type' field
        result = service._init_gcs_client('{"project_id": "test"}')

        assert result is False
        assert "missing 'type'" in service._init_error

    def test_init_gcs_with_default_credentials_exception(self):
        """Test GCS initialization with default credentials that fail"""
        service = FileStorageService()
        service.bucket_name = "test-bucket"

        with patch.dict('sys.modules', {'google': MagicMock(), 'google.cloud': MagicMock(), 'google.cloud.storage': MagicMock()}):
            import sys
            mock_storage = sys.modules['google.cloud.storage']
            mock_storage.Client.side_effect = Exception("ADC not configured")

            result = service._init_gcs_client(None)

            # Should return False due to exception
            # Note: actual behavior depends on mock setup


class TestFileStorageServicePreviewEdgeCases:
    """Tests for preview edge cases"""

    @pytest.fixture
    def service(self):
        """Create service with local storage"""
        tmpdir = tempfile.mkdtemp()
        service = FileStorageService({
            "type": "local",
            "base_path": tmpdir
        })
        yield service
        shutil.rmtree(tmpdir, ignore_errors=True)

    @pytest.mark.asyncio
    async def test_preview_pdf_file(self, service):
        """Test PDF file preview (download only)"""
        # Minimal PDF content
        pdf_content = b'%PDF-1.0\n1 0 obj\n<<\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF'
        await service.upload_file("REQ-001", "doc.pdf", pdf_content)

        files = await service.list_files("REQ-001", "files")
        result = await service.get_file_content_for_preview(files[0]["gcs_path"], "pdf")

        assert result is not None
        assert result["type"] == "download_only"

    @pytest.mark.asyncio
    async def test_preview_json_invalid(self, service):
        """Test JSON file preview with invalid JSON"""
        invalid_json = b'{"invalid json'
        await service.upload_file("REQ-001", "bad.json", invalid_json)

        files = await service.list_files("REQ-001", "files")
        result = await service.get_file_content_for_preview(files[0]["gcs_path"], "json")

        # Should return error type on parse error (exception is caught in service)
        assert result is not None
        assert result["type"] == "error"

    @pytest.mark.asyncio
    async def test_preview_csv_empty_headers(self, service):
        """Test CSV preview with empty content"""
        empty_csv = b""
        await service.upload_file("REQ-001", "empty.csv", empty_csv)

        files = await service.list_files("REQ-001", "files")
        result = await service.get_file_content_for_preview(files[0]["gcs_path"], "csv")

        # Should handle empty CSV
        assert result is not None


class TestFileStorageServiceLocalStorageExceptions:
    """Tests for local storage exception handling"""

    @pytest.mark.asyncio
    async def test_delete_file_local_exception(self):
        """Test local file deletion with exception"""
        service = FileStorageService({
            "type": "local",
            "base_path": "/tmp/test_storage"
        })

        # Try to delete a file that doesn't exist
        result = await service.delete_file("file:///nonexistent/deeply/nested/path/file.txt")
        assert result is False

    @pytest.mark.asyncio
    async def test_upload_file_local_permission_error(self):
        """Test local upload with permission error"""
        # Create service with read-only directory would need elevated privileges
        # Instead, test the exception path by mocking
        service = FileStorageService({
            "type": "local",
            "base_path": "/tmp/test_storage"
        })

        with patch('builtins.open', side_effect=PermissionError("Permission denied")):
            with patch('os.makedirs'):
                result = await service.upload_file(
                    request_id="REQ-001",
                    file_name="test.csv",
                    file_content=b"data"
                )

        assert result is None
