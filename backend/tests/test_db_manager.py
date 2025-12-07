"""Tests for Database Manager"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from bson import ObjectId
from bson.errors import InvalidId

from easylifeauth.db.db_manager import DatabaseManager, is_valid_objectid, distribute_limit


class TestDistributeLimit:
    """Tests for distribute_limit function"""

    def test_default_values(self):
        """Test with default values"""
        result = distribute_limit()
        assert result == [25]

    def test_custom_limit(self):
        """Test with custom limit"""
        result = distribute_limit(limit=50)
        assert result == [50]

    def test_limit_with_size(self):
        """Test limit distribution with size"""
        result = distribute_limit(limit=100, size=25)
        assert result == [25, 25, 25, 25]

    def test_limit_with_remainder(self):
        """Test limit distribution with remainder"""
        result = distribute_limit(limit=30, size=25)
        assert result == [25, 5]

    def test_string_values(self):
        """Test with string values"""
        result = distribute_limit(limit="50", size="25")
        assert result == [25, 25]

    def test_negative_limit(self):
        """Test with negative limit"""
        result = distribute_limit(limit=-10)
        assert result == [25]  # Falls back to default

    def test_negative_size(self):
        """Test with negative size"""
        result = distribute_limit(limit=50, size=-10)
        assert result == [25, 25]  # Falls back to default size

    def test_empty_string_values(self):
        """Test with empty string values"""
        result = distribute_limit(limit="", size="")
        assert result == [25]


class TestIsValidObjectId:
    """Tests for is_valid_objectid function"""

    def test_valid_objectid_string(self):
        """Test with valid ObjectId string"""
        assert is_valid_objectid("507f1f77bcf86cd799439011") is True

    def test_valid_objectid_object(self):
        """Test with ObjectId object"""
        oid = ObjectId()
        assert is_valid_objectid(str(oid)) is True

    def test_invalid_string(self):
        """Test with invalid string"""
        assert is_valid_objectid("invalid") is False

    def test_none_value(self):
        """Test with None value"""
        assert is_valid_objectid(None) is False

    def test_empty_string(self):
        """Test with empty string"""
        assert is_valid_objectid("") is False

    def test_short_string(self):
        """Test with too short string"""
        assert is_valid_objectid("507f1f77") is False


class TestDatabaseManager:
    """Tests for DatabaseManager"""

    def test_init_missing_params(self):
        """Test initialization with missing parameters"""
        with pytest.raises(ValueError):
            DatabaseManager(config={
                "connectionScheme": "mongodb",
                "host": "localhost"
                # Missing username and password
            })

    @patch('motor.motor_asyncio.AsyncIOMotorClient')
    def test_init_success(self, mock_client):
        """Test successful initialization"""
        mock_db = MagicMock()
        mock_client.return_value.__getitem__ = MagicMock(return_value=mock_db)
        mock_db.__getitem__ = MagicMock(return_value=MagicMock())
        
        config = {
            "connectionScheme": "mongodb",
            "username": "user",
            "password": "pass",
            "host": "localhost:27017",
            "database": "testdb",
            "collections": ["users", "tokens"]
        }
        
        db = DatabaseManager(config=config)
        assert db is not None

    @patch('motor.motor_asyncio.AsyncIOMotorClient')
    def test_init_all_collections(self, mock_client):
        """Test initialization with all collection types"""
        mock_db = MagicMock()
        mock_client.return_value.__getitem__ = MagicMock(return_value=mock_db)
        mock_db.__getitem__ = MagicMock(return_value=MagicMock())
        
        config = {
            "connectionScheme": "mongodb",
            "username": "user",
            "password": "pass",
            "host": "localhost:27017",
            "database": "testdb",
            "collections": [
                "users", "tokens", "reset_tokens", "sessions",
                "roles", "groups", "scenario_requests",
                "update_scenario_requests", "feedbacks",
                "domains", "domain_scenarios",
                "playboards", "custom_collection"
            ]
        }
        
        db = DatabaseManager(config=config)
        assert db is not None

    @patch('motor.motor_asyncio.AsyncIOMotorClient')
    def test_init_none_config(self, mock_client):
        """Test initialization with None config"""
        db = DatabaseManager(config=None)
        # Should not raise, just not initialize

    @patch('motor.motor_asyncio.AsyncIOMotorClient')
    @pytest.mark.asyncio
    async def test_ping_success(self, mock_client):
        """Test successful ping"""
        mock_db = MagicMock()
        mock_client.return_value.__getitem__ = MagicMock(return_value=mock_db)
        mock_db.__getitem__ = MagicMock(return_value=MagicMock())
        mock_db.command = AsyncMock(return_value={"ok": 1})
        
        config = {
            "connectionScheme": "mongodb",
            "username": "user",
            "password": "pass",
            "host": "localhost:27017",
            "database": "testdb",
            "collections": []
        }
        
        db = DatabaseManager(config=config)
        db.db = mock_db
        
        result = await db.ping()
        assert result is True

    @patch('motor.motor_asyncio.AsyncIOMotorClient')
    @pytest.mark.asyncio
    async def test_ping_failure(self, mock_client):
        """Test failed ping"""
        mock_db = MagicMock()
        mock_client.return_value.__getitem__ = MagicMock(return_value=mock_db)
        mock_db.__getitem__ = MagicMock(return_value=MagicMock())
        mock_db.command = AsyncMock(side_effect=Exception("Connection failed"))
        
        config = {
            "connectionScheme": "mongodb",
            "username": "user",
            "password": "pass",
            "host": "localhost:27017",
            "database": "testdb",
            "collections": []
        }
        
        db = DatabaseManager(config=config)
        db.db = mock_db
        
        result = await db.ping()
        assert result is False

    @patch('motor.motor_asyncio.AsyncIOMotorClient')
    def test_close(self, mock_client):
        """Test closing database connection"""
        mock_db = MagicMock()
        mock_client_instance = MagicMock()
        mock_client.return_value = mock_client_instance
        mock_client_instance.__getitem__ = MagicMock(return_value=mock_db)
        mock_db.__getitem__ = MagicMock(return_value=MagicMock())
        
        config = {
            "connectionScheme": "mongodb",
            "username": "user",
            "password": "pass",
            "host": "localhost:27017",
            "database": "testdb",
            "collections": []
        }
        
        db = DatabaseManager(config=config)
        db.close()
        
        mock_client_instance.close.assert_called_once()
