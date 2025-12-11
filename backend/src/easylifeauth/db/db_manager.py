"""Async Database Connection Manager for MongoDB using Motor"""
import logging
import asyncio
from typing import Optional, Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
from bson.objectid import ObjectId
from bson.errors import InvalidId
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError, AutoReconnect

logger = logging.getLogger(__name__)

DEFAULT_FETCH_SIZE = 25


def distribute_limit(limit: Optional[int] = None, size: Optional[int] = None) -> List[int]:
    """Distribute limit across pages"""
    if limit in [None, ""]:
        limit = DEFAULT_FETCH_SIZE
    if size in [None, ""]:
        size = DEFAULT_FETCH_SIZE

    if isinstance(limit, str):
        limit = int(limit)
        if limit < 0:
            limit = DEFAULT_FETCH_SIZE
    if isinstance(size, str):
        size = int(size)
        if size < 0:
            size = DEFAULT_FETCH_SIZE

    rtn = [limit]

    d = limit // size
    r = limit % size
    if r > 0:
        rtn = [size for x in range(d)] + [r]
    else:
        rtn = [size for x in range(d)]
    return rtn


class DatabaseManager:
    """Async MongoDB Database Manager using Motor"""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None
        self._config: Optional[Dict[str, Any]] = None

        # Collection references
        self.users: Optional[AsyncIOMotorCollection] = None
        self.tokens: Optional[AsyncIOMotorCollection] = None
        self.reset_tokens: Optional[AsyncIOMotorCollection] = None
        self.sessions: Optional[AsyncIOMotorCollection] = None
        self.roles: Optional[AsyncIOMotorCollection] = None
        self.groups: Optional[AsyncIOMotorCollection] = None
        self.permissions: Optional[AsyncIOMotorCollection] = None
        self.customers: Optional[AsyncIOMotorCollection] = None
        self.scenario_requests: Optional[AsyncIOMotorCollection] = None
        self.update_scenario_requests: Optional[AsyncIOMotorCollection] = None
        self.feedbacks: Optional[AsyncIOMotorCollection] = None
        self.domains: Optional[AsyncIOMotorCollection] = None
        self.domain_scenarios: Optional[AsyncIOMotorCollection] = None
        self.playboards: Optional[AsyncIOMotorCollection] = None
        self.configurations: Optional[AsyncIOMotorCollection] = None
        self.activity_logs: Optional[AsyncIOMotorCollection] = None
        self.api_configs: Optional[AsyncIOMotorCollection] = None
        self.distribution_lists: Optional[AsyncIOMotorCollection] = None

        if config is not None:
            self._initialize(config)

    def _initialize(self, config: Dict[str, Any]) -> None:
        """Initialize database connection with connection pooling and auto-reconnect"""
        self._config = config
        self._create_client(config)

    def _create_client(self, config: Dict[str, Any]) -> None:
        """Create the MongoDB client with proper settings"""
        scheme = config.get('connectionScheme', 'mongodb')
        username = config.get('username')
        password = config.get('password')
        host = config.get('host')

        if not all([username, password, host]):
            raise ValueError("Missing required DB connection parameters: username, password, or host")

        conn_string = f"{scheme}://{username}:{password}@{host}"

        # Get connection pool settings from config with defaults
        # Reduced maxIdleTimeMS to clear stale connections faster after system resume
        max_pool_size = int(config.get('maxPoolSize', 50))
        min_pool_size = int(config.get('minPoolSize', 1))  # Reduced to allow more connection cycling
        max_idle_time_ms = int(config.get('maxIdleTimeMS', 30000))  # 30 seconds - clear stale connections faster
        server_selection_timeout_ms = int(config.get('serverSelectionTimeoutMS', 5000))  # 5 seconds - fail faster
        connect_timeout_ms = int(config.get('connectTimeoutMS', 5000))  # 5 seconds
        socket_timeout_ms = int(config.get('socketTimeoutMS', 30000))  # 30 seconds
        heartbeat_frequency_ms = int(config.get('heartbeatFrequencyMS', 5000))  # 5 seconds - check more frequently
        wait_queue_timeout_ms = int(config.get('waitQueueTimeoutMS', 5000))  # 5 seconds

        # Motor async client with connection pool and reconnect settings
        # These settings help maintain connections and auto-reconnect after idle periods
        self.client = AsyncIOMotorClient(
            conn_string,
            # Connection pool settings
            maxPoolSize=max_pool_size,
            minPoolSize=min_pool_size,
            maxIdleTimeMS=max_idle_time_ms,

            # Reconnection and timeout settings - faster timeouts for quicker recovery
            serverSelectionTimeoutMS=server_selection_timeout_ms,
            connectTimeoutMS=connect_timeout_ms,
            socketTimeoutMS=socket_timeout_ms,

            # Heartbeat to keep connections alive and detect failures early
            heartbeatFrequencyMS=heartbeat_frequency_ms,

            # Auto-retry on network errors - critical for recovery after sleep
            retryWrites=True,
            retryReads=True,

            # Wait queue settings for when pool is exhausted
            waitQueueTimeoutMS=wait_queue_timeout_ms,

            # Direct connection option for single server setups (common in dev)
            # directConnection=True,  # Uncomment if using single MongoDB server
        )
        self.db = self.client[config["database"]]

        logger.info(
            f"MongoDB connection initialized with pool "
            f"(min={min_pool_size}, max={max_pool_size}, heartbeat={heartbeat_frequency_ms}ms, maxIdle={max_idle_time_ms}ms)"
        )

        self._setup_collections(config)

    def _setup_collections(self, config: Dict[str, Any]) -> None:
        """Set up collection references"""
        collection_mapping = {
            "users": "users",
            "tokens": "tokens",
            "reset_tokens": "reset_tokens",
            "sessions": "sessions",
            "roles": "roles",
            "groups": "groups",
            "permissions": "permissions",
            "customers": "customers",
            "scenario_requests": "scenario_requests",
            "update_scenario_requests": "update_scenario_requests",
            "feedbacks": "feedbacks",
            "domains": "domains",
            "domain_scenarios": "domain_scenarios",
            "playboards": "playboards",
            "configurations": "configurations",
            "activity_logs": "activity_logs",
            "api_configs": "api_configs",
            "distribution_lists": "distribution_lists"
        }

        for key in config.get("collections", []):
            if key in collection_mapping:
                setattr(self, collection_mapping[key], self.db[key])
            else:
                setattr(self, key, self.db[key])

    def reconnect(self) -> None:
        """
        Force reconnection by closing and recreating the client.
        Use this when connections are stale after system resume.
        """
        logger.info("Forcing MongoDB reconnection...")
        try:
            if self.client:
                self.client.close()
        except Exception as e:
            logger.warning(f"Error closing old client: {e}")

        if self._config:
            self._create_client(self._config)
            self._setup_collections(self._config)
            logger.info("MongoDB reconnection completed")

    def close(self) -> None:
        """Close database connection"""
        if self.client:
            try:
                self.client.close()
                logger.info("MongoDB connection closed")
            except Exception as e:
                logger.warning(f"Error closing MongoDB connection: {e}")

    async def ping(self) -> bool:
        """Test database connection"""
        try:
            await self.client.admin.command('ping')
            return True
        except Exception as e:
            logger.warning(f"MongoDB ping failed: {e}")
            return False

    async def ensure_connected(self, max_retries: int = 3) -> bool:
        """
        Ensure the database connection is alive with automatic reconnection.
        This method will attempt to reconnect if the connection is stale.

        Args:
            max_retries: Maximum number of reconnection attempts

        Returns:
            True if connected, False otherwise
        """
        for attempt in range(max_retries):
            try:
                # This will trigger reconnection if needed
                await asyncio.wait_for(
                    self.client.admin.command('ping'),
                    timeout=5.0
                )
                return True
            except asyncio.TimeoutError:
                logger.warning(f"MongoDB ping timeout (attempt {attempt + 1}/{max_retries})")
            except (ConnectionFailure, ServerSelectionTimeoutError, AutoReconnect) as e:
                logger.warning(f"MongoDB connection error (attempt {attempt + 1}/{max_retries}): {e}")
            except Exception as e:
                logger.warning(f"MongoDB unexpected error (attempt {attempt + 1}/{max_retries}): {e}")

            # On failure, try to force reconnect
            if attempt < max_retries - 1:
                logger.info("Attempting to force reconnect...")
                try:
                    self.reconnect()
                    await asyncio.sleep(1)  # Brief pause before retry
                except Exception as e:
                    logger.error(f"Reconnection failed: {e}")

        logger.error(f"MongoDB connection check failed after {max_retries} attempts")
        return False


def is_valid_objectid(id_str: str) -> bool:
    """Check if string is a valid MongoDB ObjectId"""
    try:
        ObjectId(id_str)
        return True
    except (InvalidId, TypeError):
        return False
