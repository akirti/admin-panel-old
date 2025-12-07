"""GCS File Storage Service"""
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime, timezone
import os
import base64
import hashlib
import mimetypes
import json
import logging

logger = logging.getLogger(__name__)


class FileStorageService:
    """
    File Storage Service - Can work with GCS or local storage
    For GCS, requires google-cloud-storage package and credentials
    Supports fallback to local storage when GCS is configured but fails
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.enabled = False
        self.storage_type = "local"  # local or gcs
        self.bucket_name = None
        self.base_path = "/tmp/easylife_uploads"
        self.gcs_client = None
        self._init_error = None

        if config:
            self.storage_type = config.get("type", "local")
            self.bucket_name = config.get("bucket_name")
            self.base_path = config.get("base_path", "/tmp/easylife_uploads")
            credentials_json = config.get("credentials_json")

            if self.storage_type == "gcs" and self.bucket_name:
                gcs_initialized = self._init_gcs_client(credentials_json)

                # Fallback to local if GCS fails
                if not gcs_initialized:
                    logger.warning(f"GCS init failed ({self._init_error}), falling back to local storage")
                    print(f"⚠ GCS init failed: {self._init_error}, falling back to local storage")
                    self.storage_type = "local"

            if self.storage_type == "local":
                os.makedirs(self.base_path, exist_ok=True)
                self.enabled = True

    def _init_gcs_client(self, credentials_json: Optional[str] = None) -> bool:
        """Initialize GCS client with optional credentials"""
        try:
            from google.cloud import storage
            from google.oauth2 import service_account

            if credentials_json:
                # Parse credentials JSON
                if isinstance(credentials_json, str):
                    try:
                        creds_dict = json.loads(credentials_json)
                    except json.JSONDecodeError as e:
                        self._init_error = f"Invalid JSON in credentials: {e}"
                        logger.error(self._init_error)
                        return False
                else:
                    creds_dict = credentials_json

                if creds_dict and "type" in creds_dict:
                    credentials = service_account.Credentials.from_service_account_info(creds_dict)
                    self.gcs_client = storage.Client(credentials=credentials)
                    self.enabled = True
                    logger.info(f"GCS client initialized with credentials for bucket: {self.bucket_name}")
                    print(f"✓ File storage: GCS initialized for bucket: {self.bucket_name}")
                    return True
                else:
                    self._init_error = "GCS credentials JSON missing 'type' field"
                    logger.warning(self._init_error)
                    return False
            else:
                # Try default credentials (ADC)
                self.gcs_client = storage.Client()
                self.enabled = True
                logger.info(f"GCS client initialized with default credentials for bucket: {self.bucket_name}")
                print(f"✓ File storage: GCS initialized (default credentials) for bucket: {self.bucket_name}")
                return True

        except ImportError:
            self._init_error = "google-cloud-storage package not installed"
            logger.warning(self._init_error)
            return False
        except Exception as e:
            self._init_error = f"GCS initialization failed: {e}"
            logger.error(self._init_error)
            return False

    def get_init_error(self) -> Optional[str]:
        """Get initialization error if any"""
        return self._init_error

    def is_gcs_configured(self) -> bool:
        """Check if GCS is properly configured"""
        return self.storage_type == "gcs" and self.gcs_client is not None
    
    def _generate_file_path(
        self,
        request_id: str,
        file_name: str,
        folder: str = "files"
    ) -> str:
        """Generate unique file path with versioning"""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safe_name = "".join(c if c.isalnum() or c in ".-_" else "_" for c in file_name)
        return f"scenario_requests/{request_id}/{folder}/{timestamp}_{safe_name}"
    
    def _get_mime_type(self, file_name: str) -> str:
        """Get MIME type for file"""
        mime_type, _ = mimetypes.guess_type(file_name)
        return mime_type or "application/octet-stream"
    
    def _get_file_type(self, file_name: str) -> str:
        """Get file type category"""
        ext = os.path.splitext(file_name)[1].lower()
        if ext in [".xlsx", ".xls"]:
            return "excel"
        elif ext == ".csv":
            return "csv"
        elif ext == ".json":
            return "json"
        elif ext in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]:
            return "image"
        elif ext == ".pdf":
            return "pdf"
        else:
            return "other"
    
    async def upload_file(
        self,
        request_id: str,
        file_name: str,
        file_content: bytes,
        folder: str = "files",
        uploaded_by: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Upload a file to storage"""
        if not self.enabled:
            return None
        
        try:
            file_path = self._generate_file_path(request_id, file_name, folder)
            mime_type = self._get_mime_type(file_name)
            file_type = self._get_file_type(file_name)
            file_size = len(file_content)
            
            if self.storage_type == "gcs" and self.gcs_client:
                bucket = self.gcs_client.bucket(self.bucket_name)
                blob = bucket.blob(file_path)
                blob.upload_from_string(file_content, content_type=mime_type)
                
                gcs_path = f"gs://{self.bucket_name}/{file_path}"
            else:
                # Local storage
                full_path = os.path.join(self.base_path, file_path)
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                with open(full_path, "wb") as f:
                    f.write(file_content)
                gcs_path = f"file://{full_path}"
            
            return {
                "file_name": file_name,
                "bucket": self.bucket_name or "local",
                "gcs_path": gcs_path,
                "upload_date": datetime.now(timezone.utc).isoformat(),
                "code": hashlib.md5(file_content).hexdigest()[:8],
                "status": "A",
                "file_type": file_type,
                "file_size": file_size,
                "version": 1,
                "uploaded_by": uploaded_by,
                "mime_type": mime_type
            }
        except Exception as e:
            print(f"File upload error: {e}")
            return None
    
    async def download_file(self, gcs_path: str) -> Optional[Tuple[bytes, str]]:
        """Download a file from storage"""
        if not self.enabled:
            return None
        
        try:
            if gcs_path.startswith("gs://"):
                # GCS path
                if not self.gcs_client:
                    return None
                
                # Parse gs://bucket/path format
                path_parts = gcs_path[5:].split("/", 1)
                bucket_name = path_parts[0]
                blob_path = path_parts[1] if len(path_parts) > 1 else ""
                
                bucket = self.gcs_client.bucket(bucket_name)
                blob = bucket.blob(blob_path)
                content = blob.download_as_bytes()
                file_name = os.path.basename(blob_path)
                return content, file_name
            
            elif gcs_path.startswith("file://"):
                # Local file
                local_path = gcs_path[7:]
                if os.path.exists(local_path):
                    with open(local_path, "rb") as f:
                        content = f.read()
                    file_name = os.path.basename(local_path)
                    return content, file_name
            
            return None
        except Exception as e:
            print(f"File download error: {e}")
            return None
    
    async def get_file_content_for_preview(
        self,
        gcs_path: str,
        file_type: str
    ) -> Optional[Dict[str, Any]]:
        """Get file content for preview (grid/json view)"""
        result = await self.download_file(gcs_path)
        if not result:
            return None
        
        content, file_name = result
        
        try:
            if file_type == "json":
                import json
                data = json.loads(content.decode("utf-8"))
                return {
                    "type": "json",
                    "data": data,
                    "file_name": file_name
                }
            
            elif file_type == "csv":
                import csv
                import io
                reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
                rows_data = list(reader)
                headers = reader.fieldnames or []
                # Convert dict rows to list of lists for frontend
                rows = [[row.get(h, '') for h in headers] for row in rows_data]
                return {
                    "type": "grid",
                    "headers": headers,
                    "rows": rows,
                    "file_name": file_name,
                    "total_rows": len(rows)
                }

            elif file_type == "excel":
                try:
                    import pandas as pd
                    import io
                    df = pd.read_excel(io.BytesIO(content))
                    # Convert DataFrame to list of lists for frontend
                    rows = df.values.tolist()
                    return {
                        "type": "grid",
                        "headers": df.columns.tolist(),
                        "rows": rows,
                        "file_name": file_name,
                        "total_rows": len(df)
                    }
                except ImportError:
                    # Fallback if pandas not available
                    return {
                        "type": "download_only",
                        "message": "Excel preview requires pandas",
                        "file_name": file_name
                    }
            
            elif file_type == "image":
                # Return base64 encoded image
                encoded = base64.b64encode(content).decode("utf-8")
                mime_type = self._get_mime_type(file_name)
                return {
                    "type": "image",
                    "data": f"data:{mime_type};base64,{encoded}",
                    "file_name": file_name
                }

            elif file_type == "text" or file_name.endswith(".txt"):
                # Return text content
                try:
                    text_content = content.decode("utf-8")
                    return {
                        "type": "text",
                        "data": text_content,
                        "file_name": file_name
                    }
                except UnicodeDecodeError:
                    return {
                        "type": "download_only",
                        "message": "Unable to decode text file",
                        "file_name": file_name
                    }

            else:
                return {
                    "type": "download_only",
                    "file_name": file_name
                }
        except Exception as e:
            print(f"File preview error: {e}")
            return {
                "type": "error",
                "message": str(e),
                "file_name": file_name
            }
    
    async def delete_file(self, gcs_path: str) -> bool:
        """Delete a file from storage"""
        if not self.enabled:
            return False
        
        try:
            if gcs_path.startswith("gs://"):
                if not self.gcs_client:
                    return False
                
                path_parts = gcs_path[5:].split("/", 1)
                bucket_name = path_parts[0]
                blob_path = path_parts[1] if len(path_parts) > 1 else ""
                
                bucket = self.gcs_client.bucket(bucket_name)
                blob = bucket.blob(blob_path)
                blob.delete()
                return True
            
            elif gcs_path.startswith("file://"):
                local_path = gcs_path[7:]
                if os.path.exists(local_path):
                    os.remove(local_path)
                    return True
            
            return False
        except Exception as e:
            print(f"File delete error: {e}")
            return False
    
    async def list_files(
        self,
        request_id: str,
        folder: str = "files"
    ) -> List[Dict[str, Any]]:
        """List all files for a request"""
        if not self.enabled:
            return []
        
        try:
            prefix = f"scenario_requests/{request_id}/{folder}/"
            files = []
            
            if self.storage_type == "gcs" and self.gcs_client:
                bucket = self.gcs_client.bucket(self.bucket_name)
                blobs = bucket.list_blobs(prefix=prefix)
                
                for blob in blobs:
                    files.append({
                        "file_name": os.path.basename(blob.name),
                        "gcs_path": f"gs://{self.bucket_name}/{blob.name}",
                        "file_size": blob.size,
                        "upload_date": blob.time_created.isoformat() if blob.time_created else None,
                        "file_type": self._get_file_type(blob.name)
                    })
            else:
                # Local storage
                local_prefix = os.path.join(self.base_path, prefix)
                if os.path.exists(local_prefix):
                    for file_name in os.listdir(local_prefix):
                        file_path = os.path.join(local_prefix, file_name)
                        if os.path.isfile(file_path):
                            stat = os.stat(file_path)
                            files.append({
                                "file_name": file_name,
                                "gcs_path": f"file://{file_path}",
                                "file_size": stat.st_size,
                                "upload_date": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                                "file_type": self._get_file_type(file_name)
                            })
            
            return files
        except Exception as e:
            print(f"List files error: {e}")
            return []
