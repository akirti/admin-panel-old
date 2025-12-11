"""Async Database Connection Manager for MongoDB using Motor"""
import logging
from typing import Optional, Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
from bson.objectid import ObjectId
from bson.errors import InvalidId

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
        scheme = config.get('connectionScheme', 'mongodb')
        username = config.get('username')
        password = config.get('password')
        host = config.get('host')

        if not all([username, password, host]):
            raise ValueError("Missing required DB connection parameters: username, password, or host")

        conn_string = f"{scheme}://{username}:{password}@{host}"

        # Get connection pool settings from config with defaults
        max_pool_size = int(config.get('maxPoolSize', 50))
        min_pool_size = int(config.get('minPoolSize', 5))
        max_idle_time_ms = int(config.get('maxIdleTimeMS', 300000))
        server_selection_timeout_ms = int(config.get('serverSelectionTimeoutMS', 30000))
        connect_timeout_ms = int(config.get('connectTimeoutMS', 20000))
        socket_timeout_ms = int(config.get('socketTimeoutMS', 60000))
        heartbeat_frequency_ms = int(config.get('heartbeatFrequencyMS', 10000))
        wait_queue_timeout_ms = int(config.get('waitQueueTimeoutMS', 10000))

        # Motor async client with connection pool and reconnect settings
        # These settings help maintain connections and auto-reconnect after idle periods
        self.client = AsyncIOMotorClient(
            conn_string,
            # Connection pool settings
            maxPoolSize=max_pool_size,
            minPoolSize=min_pool_size,
            maxIdleTimeMS=max_idle_time_ms,

            # Reconnection and timeout settings
            serverSelectionTimeoutMS=server_selection_timeout_ms,
            connectTimeoutMS=connect_timeout_ms,
            socketTimeoutMS=socket_timeout_ms,

            # Heartbeat to keep connections alive and detect failures early
            heartbeatFrequencyMS=heartbeat_frequency_ms,

            # Auto-retry on network errors
            retryWrites=True,
            retryReads=True,

            # Wait queue settings for when pool is exhausted
            waitQueueTimeoutMS=wait_queue_timeout_ms,
        )
        self.db = self.client[config["database"]]

        logger.info(
            f"MongoDB connection initialized with pool "
            f"(min={min_pool_size}, max={max_pool_size}, heartbeat={heartbeat_frequency_ms}ms)"
        )

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

    def close(self) -> None:
        """Close database connection"""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")

    async def ping(self) -> bool:
        """Test database connection"""
        try:
            await self.client.admin.command('ping')
            return True
        except Exception as e:
            logger.warning(f"MongoDB ping failed: {e}")
            return False

    async def ensure_connected(self) -> bool:
        """
        Ensure the database connection is alive.
        Motor/PyMongo handles reconnection automatically, but this method
        can be used to verify connectivity before critical operations.
        """
        try:
            # This will trigger reconnection if needed
            await self.client.admin.command('ping')
            return True
        except Exception as e:
            logger.error(f"MongoDB connection check failed: {e}")
            return False


def is_valid_objectid(id_str: str) -> bool:
    """Check if string is a valid MongoDB ObjectId"""
    try:
        ObjectId(id_str)
        return True
    except (InvalidId, TypeError):
        return False
