"""
Google Cloud Storage service for file operations.
"""
from google.cloud import storage
from google.oauth2 import service_account
from typing import Optional, BinaryIO
import io
import json
import logging
from app.config import settings

logger = logging.getLogger(__name__)


class GCSService:
    """Google Cloud Storage service."""
    
    def __init__(self):
        self.credentials = None
        self.client = None
        self.bucket_name = settings.GCS_BUCKET_NAME
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize GCS client with credentials."""
        try:
            creds_dict = settings.get_gcs_credentials()
            if creds_dict and "type" in creds_dict:
                self.credentials = service_account.Credentials.from_service_account_info(
                    creds_dict
                )
                self.client = storage.Client(credentials=self.credentials)
                logger.info("GCS client initialized successfully")
            else:
                logger.warning("GCS credentials not configured")
        except Exception as e:
            logger.error(f"Failed to initialize GCS client: {e}")
    
    def is_configured(self) -> bool:
        """Check if GCS is properly configured."""
        return self.client is not None
    
    async def download_file(
        self, 
        file_path: str, 
        bucket_name: Optional[str] = None
    ) -> Optional[bytes]:
        """Download a file from GCS bucket."""
        if not self.is_configured():
            logger.error("GCS client not configured")
            return None
        
        try:
            bucket_name = bucket_name or self.bucket_name
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
    
    async def upload_file(
        self,
        file_content: bytes,
        destination_path: str,
        content_type: str = "application/octet-stream",
        bucket_name: Optional[str] = None
    ) -> Optional[str]:
        """Upload a file to GCS bucket."""
        if not self.is_configured():
            logger.error("GCS client not configured")
            return None
        
        try:
            bucket_name = bucket_name or self.bucket_name
            bucket = self.client.bucket(bucket_name)
            blob = bucket.blob(destination_path)
            
            blob.upload_from_string(file_content, content_type=content_type)
            logger.info(f"Uploaded file to GCS: {destination_path}")
            return f"gs://{bucket_name}/{destination_path}"
        except Exception as e:
            logger.error(f"Failed to upload file to GCS: {e}")
            return None
    
    async def list_files(
        self, 
        prefix: str = "", 
        bucket_name: Optional[str] = None
    ) -> list:
        """List files in GCS bucket with optional prefix."""
        if not self.is_configured():
            logger.error("GCS client not configured")
            return []
        
        try:
            bucket_name = bucket_name or self.bucket_name
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
    
    async def delete_file(
        self, 
        file_path: str, 
        bucket_name: Optional[str] = None
    ) -> bool:
        """Delete a file from GCS bucket."""
        if not self.is_configured():
            logger.error("GCS client not configured")
            return False
        
        try:
            bucket_name = bucket_name or self.bucket_name
            bucket = self.client.bucket(bucket_name)
            blob = bucket.blob(file_path)
            blob.delete()
            logger.info(f"Deleted file from GCS: {file_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete file from GCS: {e}")
            return False


# Global GCS service instance
gcs_service = GCSService()
