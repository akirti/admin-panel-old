"""Async Database Connection Manager for MongoDB using Motor"""
from typing import Optional, Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
from bson.objectid import ObjectId
from bson.errors import InvalidId

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
        
        # Collection references
        self.users: Optional[AsyncIOMotorCollection] = None
        self.tokens: Optional[AsyncIOMotorCollection] = None
        self.reset_tokens: Optional[AsyncIOMotorCollection] = None
        self.sessions: Optional[AsyncIOMotorCollection] = None
        self.roles: Optional[AsyncIOMotorCollection] = None
        self.groups: Optional[AsyncIOMotorCollection] = None
        self.scenario_requests: Optional[AsyncIOMotorCollection] = None
        self.update_scenario_requests: Optional[AsyncIOMotorCollection] = None
        self.feedbacks: Optional[AsyncIOMotorCollection] = None
        self.easylife_domain: Optional[AsyncIOMotorCollection] = None
        self.easylife_scenerios: Optional[AsyncIOMotorCollection] = None
        self.easylife_sceneario_playboard: Optional[AsyncIOMotorCollection] = None
        
        if config is not None:
            self._initialize(config)
    
    def _initialize(self, config: Dict[str, Any]) -> None:
        """Initialize database connection"""
        scheme = config.get('connectionScheme', 'mongodb')
        username = config.get('username')
        password = config.get('password')
        host = config.get('host')

        if not all([username, password, host]):
            raise ValueError("Missing required DB connection parameters: username, password, or host")

        conn_string = f"{scheme}://{username}:{password}@{host}"
        
        # Motor async client
        self.client = AsyncIOMotorClient(conn_string)
        self.db = self.client[config["database"]]

        collection_mapping = {
            "users": "users",
            "tokens": "tokens",
            "reset_tokens": "reset_tokens",
            "sessions": "sessions",
            "roles": "roles",
            "groups": "groups",
            "scenario_requests": "scenario_requests",
            "update_scenario_requests": "update_scenario_requests",
            "feedbacks": "feedbacks",
            "easylife_domain": "easylife_domain",
            "easylife_scenerios": "easylife_scenerios",
            "easylife_sceneario_playboard": "easylife_sceneario_playboard"
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
    
    async def ping(self) -> bool:
        """Test database connection"""
        try:
            await self.client.admin.command('ping')
            return True
        except Exception:
            return False


def is_valid_objectid(id_str: str) -> bool:
    """Check if string is a valid MongoDB ObjectId"""
    try:
        ObjectId(id_str)
        return True
    except (InvalidId, TypeError):
        return False
