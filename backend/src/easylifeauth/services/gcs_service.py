"""
Google Cloud Storage service for file operations.
"""
from typing import Optional, Dict, Any, List
import logging
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

# Thread pool for running sync GCS operations
_executor = ThreadPoolExecutor(max_workers=4)


class GCSService:
    """Google Cloud Storage service."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.credentials = None
        self.client = None
        self.bucket_name = None
        self._config = config or {}
        self._init_error = None

        if config:
            self._initialize_client(config)

    def _initialize_client(self, config: Dict[str, Any]):
        """Initialize GCS client with credentials."""
        try:
            # Import GCS libraries only when needed
            from google.cloud import storage
            from google.oauth2 import service_account

            self.bucket_name = config.get("bucket_name")
            creds_json = config.get("credentials_json")

            if not self.bucket_name:
                self._init_error = "GCS bucket_name not provided"
                logger.warning(self._init_error)
                return

            if creds_json:
                if isinstance(creds_json, str):
                    try:
                        creds_dict = json.loads(creds_json)
                    except json.JSONDecodeError as e:
                        self._init_error = f"Invalid JSON in credentials: {e}"
                        logger.error(self._init_error)
                        return
                else:
                    creds_dict = creds_json

                if creds_dict and "type" in creds_dict:
                    self.credentials = service_account.Credentials.from_service_account_info(
                        creds_dict
                    )
                    self.client = storage.Client(credentials=self.credentials)
                    logger.info(f"GCS client initialized successfully for bucket: {self.bucket_name}")
                    print(f"✓ GCS client initialized for bucket: {self.bucket_name}")
                else:
                    self._init_error = "GCS credentials JSON missing 'type' field"
                    logger.warning(self._init_error)
            else:
                self._init_error = "GCS credentials_json not provided"
                logger.warning(self._init_error)
        except ImportError as e:
            self._init_error = f"google-cloud-storage package not installed: {e}"
            logger.warning(self._init_error)
        except Exception as e:
            self._init_error = f"Failed to initialize GCS client: {e}"
            logger.error(self._init_error)

    def get_init_error(self) -> Optional[str]:
        """Get initialization error if any."""
        return self._init_error

    def is_configured(self) -> bool:
        """Check if GCS is properly configured."""
        return self.client is not None

    def _sync_download_file(self, file_path: str, bucket_name: str) -> Optional[bytes]:
        """Synchronous download implementation."""
        try:
            bucket = self.client.bucket(bucket_name)
            blob = bucket.blob(file_path)

            if not blob.exists():
                logger.error(f"File not found in GCS: {file_path}")
                return None

            content = blob.download_as_bytes()
            logger.info(f"Downloaded file from GCS: {file_path}")
            return content
        except Exception as e:
            logger.error(f"Failed to download file from GCS: {e}")
            return None

    async def download_file(
        self,
        file_path: str,
        bucket_name: Optional[str] = None
    ) -> Optional[bytes]:
        """Download a file from GCS bucket."""
        if not self.is_configured():
            logger.error(f"GCS client not configured. Error: {self._init_error}")
            return None

        bucket_name = bucket_name or self.bucket_name
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _executor,
            self._sync_download_file,
            file_path,
            bucket_name
        )

    def _sync_upload_file(
        self,
        file_content: bytes,
        destination_path: str,
        content_type: str,
        bucket_name: str
    ) -> Optional[str]:
        """Synchronous upload implementation."""
        try:
            bucket = self.client.bucket(bucket_name)
            blob = bucket.blob(destination_path)

            blob.upload_from_string(file_content, content_type=content_type)
            logger.info(f"Uploaded file to GCS: {destination_path}")
            return f"gs://{bucket_name}/{destination_path}"
        except Exception as e:
            logger.error(f"Failed to upload file to GCS: {e}")
            import traceback
            traceback.print_exc()
            return None

    async def upload_file(
        self,
        file_content: bytes,
        destination_path: str,
        content_type: str = "application/octet-stream",
        bucket_name: Optional[str] = None
    ) -> Optional[str]:
        """Upload a file to GCS bucket."""
        if not self.is_configured():
            logger.error(f"GCS client not configured. Error: {self._init_error}")
            return None

        bucket_name = bucket_name or self.bucket_name
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _executor,
            self._sync_upload_file,
            file_content,
            destination_path,
            content_type,
            bucket_name
        )

    def _sync_list_files(self, prefix: str, bucket_name: str) -> List[Dict[str, Any]]:
        """Synchronous list files implementation."""
        try:
            bucket = self.client.bucket(bucket_name)
            blobs = bucket.list_blobs(prefix=prefix)

            files = []
            for blob in blobs:
                files.append({
                    "name": blob.name,
                    "size": blob.size,
                    "updated": blob.updated.isoformat() if blob.updated else None,
                    "content_type": blob.content_type
                })
            return files
        except Exception as e:
            logger.error(f"Failed to list files in GCS: {e}")
            return []

    async def list_files(
        self,
        prefix: str = "",
        bucket_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List files in GCS bucket with optional prefix."""
        if not self.is_configured():
            logger.error(f"GCS client not configured. Error: {self._init_error}")
            return []

        bucket_name = bucket_name or self.bucket_name
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _executor,
            self._sync_list_files,
            prefix,
            bucket_name
        )

    def _sync_delete_file(self, file_path: str, bucket_name: str) -> bool:
        """Synchronous delete implementation."""
        try:
            bucket = self.client.bucket(bucket_name)
            blob = bucket.blob(file_path)
            blob.delete()
            logger.info(f"Deleted file from GCS: {file_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete file from GCS: {e}")
            return False

    async def delete_file(
        self,
        file_path: str,
        bucket_name: Optional[str] = None
    ) -> bool:
        """Delete a file from GCS bucket."""
        if not self.is_configured():
            logger.error(f"GCS client not configured. Error: {self._init_error}")
            return False

        bucket_name = bucket_name or self.bucket_name
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _executor,
            self._sync_delete_file,
            file_path,
            bucket_name
        )

    def _sync_file_exists(self, file_path: str, bucket_name: str) -> bool:
        """Synchronous file exists check."""
        try:
            bucket = self.client.bucket(bucket_name)
            blob = bucket.blob(file_path)
            return blob.exists()
        except Exception as e:
            logger.error(f"Failed to check file existence in GCS: {e}")
            return False

    async def file_exists(
        self,
        file_path: str,
        bucket_name: Optional[str] = None
    ) -> bool:
        """Check if a file exists in GCS bucket."""
        if not self.is_configured():
            return False

        bucket_name = bucket_name or self.bucket_name
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _executor,
            self._sync_file_exists,
            file_path,
            bucket_name
        )

    def _sync_get_signed_url(
        self,
        file_path: str,
        expiration_minutes: int,
        bucket_name: str
    ) -> Optional[str]:
        """Synchronous signed URL generation."""
        try:
            from datetime import timedelta

            bucket = self.client.bucket(bucket_name)
            blob = bucket.blob(file_path)

            url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(minutes=expiration_minutes),
                method="GET"
            )
            return url
        except Exception as e:
            logger.error(f"Failed to generate signed URL: {e}")
            return None

    async def get_signed_url(
        self,
        file_path: str,
        expiration_minutes: int = 60,
        bucket_name: Optional[str] = None
    ) -> Optional[str]:
        """Generate a signed URL for temporary access to a file."""
        if not self.is_configured():
            logger.error(f"GCS client not configured. Error: {self._init_error}")
            return None

        bucket_name = bucket_name or self.bucket_name
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _executor,
            self._sync_get_signed_url,
            file_path,
            expiration_minutes,
            bucket_name
        )
