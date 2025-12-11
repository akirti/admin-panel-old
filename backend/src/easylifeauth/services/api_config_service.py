"""
API Configuration Management Service.
Handles CRUD operations for API configurations and testing API connectivity.
"""
import asyncio
import ssl
import tempfile
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple, Union
import logging
import httpx
from cryptography import x509
from cryptography.hazmat.backends import default_backend

logger = logging.getLogger(__name__)


class ApiConfigService:
    """Service for managing API configurations."""

    COLLECTION_NAME = "api_configs"
    CERT_GCS_PREFIX = "api_configs/certs"

    def __init__(self, db, gcs_service=None):
        """
        Initialize the API config service.

        Args:
            db: Database manager instance
            gcs_service: Optional GCS service for certificate storage
        """
        self.db = db
        self.gcs_service = gcs_service
        self._temp_cert_cache: Dict[str, str] = {}

    async def _get_collection(self):
        """Get the api_configs collection."""
        return self.db.db[self.COLLECTION_NAME]

    async def list_configs(
        self,
        page: int = 0,
        limit: int = 25,
        status: Optional[str] = None,
        tags: Optional[List[str]] = None,
        search: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        List API configurations with pagination and filtering.

        Returns:
            Tuple of (configs list, total count)
        """
        collection = await self._get_collection()

        # Build query
        query: Dict[str, Any] = {}
        if status:
            query["status"] = status
        if tags:
            query["tags"] = {"$all": tags}
        if search:
            query["$or"] = [
                {"name": {"$regex": search, "$options": "i"}},
                {"key": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}}
            ]

        # Get total count
        total = await collection.count_documents(query)

        # Get paginated results
        cursor = collection.find(query).sort("created_at", -1).skip(page * limit).limit(limit)
        configs = await cursor.to_list(length=limit)

        # Convert ObjectId to string
        for config in configs:
            config["_id"] = str(config["_id"])

        return configs, total

    async def get_config_by_id(self, config_id: str) -> Optional[Dict[str, Any]]:
        """Get API configuration by ID."""
        from bson import ObjectId

        collection = await self._get_collection()

        try:
            config = await collection.find_one({"_id": ObjectId(config_id)})
            if config:
                config["_id"] = str(config["_id"])
            return config
        except Exception as e:
            logger.error(f"Error getting config by ID: {e}")
            return None

    async def get_config_by_key(self, key: str) -> Optional[Dict[str, Any]]:
        """Get API configuration by key."""
        collection = await self._get_collection()

        config = await collection.find_one({"key": key})
        if config:
            config["_id"] = str(config["_id"])
        return config

    async def create_config(
        self,
        config_data: Dict[str, Any],
        user_email: str
    ) -> Dict[str, Any]:
        """Create a new API configuration."""
        from bson import ObjectId

        collection = await self._get_collection()

        # Check for duplicate key
        existing = await self.get_config_by_key(config_data["key"])
        if existing:
            raise ValueError(f"API config with key '{config_data['key']}' already exists")

        # Add metadata
        now = datetime.now(timezone.utc)
        config_data["created_at"] = now
        config_data["created_by"] = user_email
        config_data["updated_at"] = now
        config_data["updated_by"] = user_email

        # Convert auth_type enum to string if needed
        if "auth_type" in config_data and hasattr(config_data["auth_type"], "value"):
            config_data["auth_type"] = config_data["auth_type"].value

        result = await collection.insert_one(config_data)
        config_data["_id"] = str(result.inserted_id)

        return config_data

    async def update_config(
        self,
        config_id: str,
        update_data: Dict[str, Any],
        user_email: str
    ) -> Optional[Dict[str, Any]]:
        """Update an existing API configuration."""
        from bson import ObjectId

        collection = await self._get_collection()

        # Remove None values
        update_data = {k: v for k, v in update_data.items() if v is not None}

        if not update_data:
            return await self.get_config_by_id(config_id)

        # Add metadata
        update_data["updated_at"] = datetime.now(timezone.utc)
        update_data["updated_by"] = user_email

        # Convert auth_type enum to string if needed
        if "auth_type" in update_data and hasattr(update_data["auth_type"], "value"):
            update_data["auth_type"] = update_data["auth_type"].value

        try:
            result = await collection.find_one_and_update(
                {"_id": ObjectId(config_id)},
                {"$set": update_data},
                return_document=True
            )
            if result:
                result["_id"] = str(result["_id"])
            return result
        except Exception as e:
            logger.error(f"Error updating config: {e}")
            return None

    async def delete_config(self, config_id: str) -> bool:
        """Delete an API configuration."""
        from bson import ObjectId

        collection = await self._get_collection()

        try:
            # Get config to check for certs to delete
            config = await self.get_config_by_id(config_id)
            if config:
                # Delete associated certs from GCS
                for cert_field in ["ssl_cert_gcs_path", "ssl_key_gcs_path", "ssl_ca_gcs_path"]:
                    if config.get(cert_field) and self.gcs_service:
                        try:
                            await self.gcs_service.delete_file(config[cert_field])
                        except Exception as e:
                            logger.warning(f"Failed to delete cert from GCS: {e}")

            result = await collection.delete_one({"_id": ObjectId(config_id)})
            return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error deleting config: {e}")
            return False

    async def get_count(self, status: Optional[str] = None) -> int:
        """Get count of API configurations."""
        collection = await self._get_collection()
        query = {"status": status} if status else {}
        return await collection.count_documents(query)

    async def upload_certificate(
        self,
        config_key: str,
        cert_type: str,
        file_content: bytes,
        file_name: str,
        user_email: str
    ) -> Dict[str, Any]:
        """
        Upload a certificate file to GCS.

        Args:
            config_key: API config key
            cert_type: Type of cert (cert, key, ca)
            file_content: File content as bytes
            file_name: Original file name
            user_email: User performing the upload

        Returns:
            Upload result with GCS path
        """
        if not self.gcs_service or not self.gcs_service.is_configured():
            raise ValueError("GCS is not configured for certificate storage")

        # Validate cert type
        valid_types = ["cert", "key", "ca"]
        if cert_type not in valid_types:
            raise ValueError(f"Invalid cert type. Must be one of: {valid_types}")

        # Generate GCS path
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        gcs_path = f"{self.CERT_GCS_PREFIX}/{config_key}/{cert_type}_{timestamp}_{file_name}"

        # Upload to GCS
        await self.gcs_service.upload_file(
            file_content=file_content,
            file_path=gcs_path,
            content_type="application/x-pem-file"
        )

        # Try to parse cert expiry if it's a certificate
        expires_at = None
        if cert_type in ["cert", "ca"]:
            try:
                cert = x509.load_pem_x509_certificate(file_content, default_backend())
                expires_at = cert.not_valid_after_utc.isoformat()
            except Exception as e:
                logger.warning(f"Could not parse certificate expiry: {e}")

        return {
            "gcs_path": gcs_path,
            "file_name": file_name,
            "cert_type": cert_type,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at
        }

    async def _download_cert_to_temp(self, gcs_path: str) -> Optional[str]:
        """Download certificate from GCS to a temporary file."""
        if not self.gcs_service or not self.gcs_service.is_configured():
            return None

        # Check cache
        if gcs_path in self._temp_cert_cache:
            return self._temp_cert_cache[gcs_path]

        try:
            content = await self.gcs_service.download_file(gcs_path)
            if content:
                # Create temp file
                with tempfile.NamedTemporaryFile(delete=False, suffix=".pem") as f:
                    f.write(content)
                    temp_path = f.name

                self._temp_cert_cache[gcs_path] = temp_path
                return temp_path
        except Exception as e:
            logger.error(f"Failed to download cert from GCS: {e}")

        return None

    def _extract_token_from_response(
        self,
        response_data: Any,
        token_path: str
    ) -> Optional[str]:
        """
        Extract token from response using a simple path notation.
        Supports nested keys like 'data.access_token' or 'result.token'.
        """
        if not token_path:
            return None

        try:
            keys = token_path.split(".")
            value = response_data
            for key in keys:
                if isinstance(value, dict):
                    value = value.get(key)
                else:
                    return None
            return str(value) if value else None
        except Exception as e:
            logger.error(f"Failed to extract token from path '{token_path}': {e}")
            return None

    async def _obtain_login_token(
        self,
        auth_config: Dict[str, Any],
        ssl_context: Any,
        proxy_url: Optional[str],
        base_timeout: int
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Obtain a bearer token by calling a login endpoint.

        Auth config should contain:
        - login_endpoint: URL to call for login
        - login_method: HTTP method (default POST)
        - username_field: Field name for username in request body (default 'email')
        - password_field: Field name for password in request body (default 'password')
        - username: The username/email to login with
        - password: The password to login with
        - extra_body: Optional extra fields to include in login body
        - token_response_path: Path to extract token from response (default 'access_token')
        - token_type: Token prefix (default 'Bearer')

        Returns:
            Tuple of (token, error_message)
        """
        login_endpoint = auth_config.get("login_endpoint")
        if not login_endpoint:
            return None, "login_endpoint is required for login_token auth"

        login_method = auth_config.get("login_method", "POST")
        username_field = auth_config.get("username_field", "email")
        password_field = auth_config.get("password_field", "password")
        username = auth_config.get("username", "")
        password = auth_config.get("password", "")
        extra_body = auth_config.get("extra_body", {})
        token_path = auth_config.get("token_response_path", "access_token")

        # Build login request body
        login_body = {
            username_field: username,
            password_field: password,
            **extra_body
        }

        try:
            async with httpx.AsyncClient(
                verify=ssl_context if ssl_context else True,
                proxy=proxy_url,
                timeout=base_timeout
            ) as client:
                response = await client.request(
                    method=login_method,
                    url=login_endpoint,
                    json=login_body,
                    headers={"Content-Type": "application/json"}
                )

                if response.status_code >= 400:
                    return None, f"Login failed with status {response.status_code}: {response.text[:200]}"

                try:
                    response_data = response.json()
                except Exception:
                    return None, "Login response is not valid JSON"

                token = self._extract_token_from_response(response_data, token_path)
                if not token:
                    return None, f"Could not extract token from response using path '{token_path}'"

                return token, None

        except httpx.ConnectTimeout:
            return None, "Login request timed out"
        except httpx.ConnectError as e:
            return None, f"Login connection error: {str(e)}"
        except Exception as e:
            return None, f"Login error: {str(e)}"

    async def _obtain_oauth2_token(
        self,
        auth_config: Dict[str, Any],
        ssl_context: Any,
        proxy_url: Optional[str],
        base_timeout: int
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Obtain an OAuth2 token using client credentials flow.

        Auth config should contain:
        - token_endpoint: OAuth2 token endpoint URL
        - client_id: Client ID
        - client_secret: Client secret
        - scope: Optional scope string
        - grant_type: Grant type (default 'client_credentials')
        - audience: Optional audience
        - extra_params: Optional extra parameters
        - token_response_path: Path to extract token from response (default 'access_token')

        Returns:
            Tuple of (token, error_message)
        """
        token_endpoint = auth_config.get("token_endpoint")
        if not token_endpoint:
            return None, "token_endpoint is required for oauth2 auth"

        client_id = auth_config.get("client_id", "")
        client_secret = auth_config.get("client_secret", "")
        scope = auth_config.get("scope", "")
        grant_type = auth_config.get("grant_type", "client_credentials")
        audience = auth_config.get("audience", "")
        extra_params = auth_config.get("extra_params", {})
        token_path = auth_config.get("token_response_path", "access_token")

        # Build token request body (form-encoded for OAuth2)
        token_body = {
            "grant_type": grant_type,
            "client_id": client_id,
            "client_secret": client_secret,
            **extra_params
        }

        if scope:
            token_body["scope"] = scope
        if audience:
            token_body["audience"] = audience

        try:
            async with httpx.AsyncClient(
                verify=ssl_context if ssl_context else True,
                proxy=proxy_url,
                timeout=base_timeout
            ) as client:
                response = await client.post(
                    url=token_endpoint,
                    data=token_body,  # OAuth2 typically uses form-encoded data
                    headers={"Content-Type": "application/x-www-form-urlencoded"}
                )

                if response.status_code >= 400:
                    return None, f"OAuth2 token request failed with status {response.status_code}: {response.text[:200]}"

                try:
                    response_data = response.json()
                except Exception:
                    return None, "OAuth2 token response is not valid JSON"

                token = self._extract_token_from_response(response_data, token_path)
                if not token:
                    return None, f"Could not extract token from OAuth2 response using path '{token_path}'"

                return token, None

        except httpx.ConnectTimeout:
            return None, "OAuth2 token request timed out"
        except httpx.ConnectError as e:
            return None, f"OAuth2 connection error: {str(e)}"
        except Exception as e:
            return None, f"OAuth2 error: {str(e)}"

    async def test_api(
        self,
        config: Dict[str, Any],
        test_params: Optional[Dict[str, Any]] = None,
        test_body: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Test an API configuration by making a request.

        Args:
            config: API configuration dict
            test_params: Optional params to override config params
            test_body: Optional body to override config body

        Returns:
            Test result with success status, response details, timing
        """
        start_time = time.time()
        result = {
            "success": False,
            "status_code": None,
            "response_time_ms": None,
            "response_headers": None,
            "response_body": None,
            "error": None,
            "ssl_info": None
        }

        try:
            # Build request parameters
            endpoint = config.get("ping_endpoint") or config.get("endpoint")
            method = config.get("ping_method", "GET") if config.get("ping_endpoint") else config.get("method", "GET")
            timeout = config.get("ping_timeout", 5) if config.get("ping_endpoint") else config.get("timeout", 30)
            expected_status = config.get("ping_expected_status", 200)

            headers = dict(config.get("headers") or {})
            params = test_params or config.get("params")
            body = test_body or config.get("body")

            # Build auth headers
            auth_type = config.get("auth_type", "none")
            auth_config = config.get("auth_config") or {}

            if auth_type == "basic":
                import base64
                credentials = base64.b64encode(
                    f"{auth_config.get('username', '')}:{auth_config.get('password', '')}".encode()
                ).decode()
                headers["Authorization"] = f"Basic {credentials}"
            elif auth_type == "bearer":
                token = auth_config.get("token", "")
                headers["Authorization"] = f"Bearer {token}"
            elif auth_type == "api_key":
                key_name = auth_config.get("key_name", "X-API-Key")
                key_value = auth_config.get("key_value", "")
                key_location = auth_config.get("key_location", "header")
                if key_location == "header":
                    headers[key_name] = key_value
                elif key_location == "query":
                    params = params or {}
                    params[key_name] = key_value

            # Build SSL context (needed before obtaining tokens for login_token and oauth2)
            ssl_context = None
            verify = config.get("ssl_verify", True)

            if not verify:
                ssl_context = False
            elif config.get("ssl_cert_gcs_path") or config.get("ssl_key_gcs_path") or config.get("ssl_ca_gcs_path"):
                # mTLS configuration
                ssl_context = ssl.create_default_context()

                if config.get("ssl_ca_gcs_path"):
                    ca_path = await self._download_cert_to_temp(config["ssl_ca_gcs_path"])
                    if ca_path:
                        ssl_context.load_verify_locations(ca_path)

                if config.get("ssl_cert_gcs_path") and config.get("ssl_key_gcs_path"):
                    cert_path = await self._download_cert_to_temp(config["ssl_cert_gcs_path"])
                    key_path = await self._download_cert_to_temp(config["ssl_key_gcs_path"])
                    if cert_path and key_path:
                        ssl_context.load_cert_chain(cert_path, key_path)

            # Build proxy config (httpx uses 'proxy' parameter, not 'proxies')
            proxy_url = None
            if config.get("use_proxy") and config.get("proxy_url"):
                proxy_url = config["proxy_url"]

            # Handle login_token auth - get token by calling login endpoint
            if auth_type == "login_token":
                token, auth_error = await self._obtain_login_token(
                    auth_config,
                    ssl_context,
                    proxy_url,
                    timeout
                )
                if auth_error:
                    result["error"] = f"Login auth error: {auth_error}"
                    result["auth_error"] = True
                    result["response_time_ms"] = round((time.time() - start_time) * 1000, 2)
                    return result

                token_type = auth_config.get("token_type", "Bearer")
                header_name = auth_config.get("token_header_name", "Authorization")
                headers[header_name] = f"{token_type} {token}" if token_type else token

            # Handle OAuth2 client credentials flow
            elif auth_type == "oauth2":
                token, auth_error = await self._obtain_oauth2_token(
                    auth_config,
                    ssl_context,
                    proxy_url,
                    timeout
                )
                if auth_error:
                    result["error"] = f"OAuth2 auth error: {auth_error}"
                    result["auth_error"] = True
                    result["response_time_ms"] = round((time.time() - start_time) * 1000, 2)
                    return result

                token_type = auth_config.get("token_type", "Bearer")
                header_name = auth_config.get("token_header_name", "Authorization")
                headers[header_name] = f"{token_type} {token}" if token_type else token

            # Make request
            async with httpx.AsyncClient(
                verify=ssl_context if ssl_context else verify,
                proxy=proxy_url,
                timeout=timeout
            ) as client:
                request_kwargs = {
                    "method": method,
                    "url": endpoint,
                    "headers": headers
                }
                if params:
                    request_kwargs["params"] = params
                if body and method.upper() in ["POST", "PUT", "PATCH"]:
                    request_kwargs["json"] = body

                response = await client.request(**request_kwargs)

                result["status_code"] = response.status_code
                result["response_headers"] = dict(response.headers)

                # Try to parse response as JSON
                try:
                    result["response_body"] = response.json()
                except Exception:
                    # If not JSON, return text (truncated)
                    text = response.text
                    if len(text) > 1000:
                        text = text[:1000] + "... (truncated)"
                    result["response_body"] = text

                # Check if status matches expected
                result["success"] = response.status_code == expected_status

                # Get SSL info if available
                if hasattr(response, "_transport") and hasattr(response._transport, "get_extra_info"):
                    ssl_object = response._transport.get_extra_info("ssl_object")
                    if ssl_object:
                        result["ssl_info"] = {
                            "version": ssl_object.version(),
                            "cipher": ssl_object.cipher()
                        }

        except httpx.ConnectTimeout:
            result["error"] = "Connection timeout"
        except httpx.ReadTimeout:
            result["error"] = "Read timeout - server took too long to respond"
        except httpx.WriteTimeout:
            result["error"] = "Write timeout - sending request took too long"
        except httpx.PoolTimeout:
            result["error"] = "Connection pool timeout"
        except httpx.ConnectError as e:
            result["error"] = f"Connection error: {str(e)}"
        except httpx.HTTPStatusError as e:
            result["error"] = f"HTTP error: {str(e)}"
            result["status_code"] = e.response.status_code
        except ssl.SSLError as e:
            result["error"] = f"SSL error: {str(e)}"
        except Exception as e:
            result["error"] = f"Unexpected error: {str(e)}"
            logger.exception("Error testing API")

        # Calculate response time
        result["response_time_ms"] = round((time.time() - start_time) * 1000, 2)

        return result

    async def toggle_status(self, config_id: str, user_email: str) -> Optional[Dict[str, Any]]:
        """Toggle the status of an API configuration."""
        config = await self.get_config_by_id(config_id)
        if not config:
            return None

        new_status = "inactive" if config.get("status") == "active" else "active"
        return await self.update_config(config_id, {"status": new_status}, user_email)

    async def get_tags(self) -> List[str]:
        """Get all unique tags used across configurations."""
        collection = await self._get_collection()

        pipeline = [
            {"$unwind": "$tags"},
            {"$group": {"_id": "$tags"}},
            {"$sort": {"_id": 1}}
        ]

        cursor = collection.aggregate(pipeline)
        results = await cursor.to_list(length=100)
        return [r["_id"] for r in results]
