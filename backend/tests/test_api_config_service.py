"""Tests for API Configuration Service"""
import pytest
import ssl
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
from bson import ObjectId

from easylifeauth.services.api_config_service import ApiConfigService


class TestApiConfigServiceInit:
    """Tests for ApiConfigService initialization."""

    def test_init_with_db_only(self):
        """Test initialization with only db parameter."""
        mock_db = MagicMock()
        service = ApiConfigService(mock_db)

        assert service.db is mock_db
        assert service.gcs_service is None
        assert service._temp_cert_cache == {}

    def test_init_with_db_and_gcs(self):
        """Test initialization with db and gcs_service."""
        mock_db = MagicMock()
        mock_gcs = MagicMock()
        service = ApiConfigService(mock_db, gcs_service=mock_gcs)

        assert service.db is mock_db
        assert service.gcs_service is mock_gcs

    def test_collection_name_constant(self):
        """Test COLLECTION_NAME is set correctly."""
        assert ApiConfigService.COLLECTION_NAME == "api_configs"

    def test_cert_gcs_prefix_constant(self):
        """Test CERT_GCS_PREFIX is set correctly."""
        assert ApiConfigService.CERT_GCS_PREFIX == "api_configs/certs"


class TestGetCollection:
    """Tests for the _get_collection method."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.db = MagicMock()
        db.db.__getitem__ = MagicMock(return_value=MagicMock())
        return db

    @pytest.fixture
    def service(self, mock_db):
        return ApiConfigService(mock_db)

    @pytest.mark.asyncio
    async def test_get_collection_returns_correct_collection(self, service, mock_db):
        """Test that _get_collection accesses db.db['api_configs']."""
        collection = await service._get_collection()
        assert collection == mock_db.db["api_configs"]


class TestListConfigs:
    """Tests for the list_configs method."""

    @pytest.fixture
    def mock_collection(self):
        collection = MagicMock()
        collection.count_documents = AsyncMock(return_value=0)
        cursor = MagicMock()
        cursor.sort = MagicMock(return_value=cursor)
        cursor.skip = MagicMock(return_value=cursor)
        cursor.limit = MagicMock(return_value=cursor)
        cursor.to_list = AsyncMock(return_value=[])
        collection.find = MagicMock(return_value=cursor)
        return collection

    @pytest.fixture
    def mock_db(self, mock_collection):
        db = MagicMock()
        db.db = MagicMock()
        db.db.__getitem__ = MagicMock(return_value=mock_collection)
        return db

    @pytest.fixture
    def service(self, mock_db):
        return ApiConfigService(mock_db)

    @pytest.mark.asyncio
    async def test_list_configs_no_filters(self, service, mock_collection):
        """Test listing configs without any filters."""
        configs, total = await service.list_configs()

        assert configs == []
        assert total == 0
        mock_collection.count_documents.assert_called_once_with({})
        mock_collection.find.assert_called_once_with({})

    @pytest.mark.asyncio
    async def test_list_configs_with_status_filter(self, service, mock_collection):
        """Test listing configs filtered by status."""
        await service.list_configs(status="active")

        expected_query = {"status": "active"}
        mock_collection.count_documents.assert_called_once_with(expected_query)
        mock_collection.find.assert_called_once_with(expected_query)

    @pytest.mark.asyncio
    async def test_list_configs_with_tags_filter(self, service, mock_collection):
        """Test listing configs filtered by tags."""
        await service.list_configs(tags=["api", "internal"])

        expected_query = {"tags": {"$all": ["api", "internal"]}}
        mock_collection.count_documents.assert_called_once_with(expected_query)
        mock_collection.find.assert_called_once_with(expected_query)

    @pytest.mark.asyncio
    async def test_list_configs_with_search_filter(self, service, mock_collection):
        """Test listing configs with search query."""
        await service.list_configs(search="my-api")

        expected_query = {
            "$or": [
                {"name": {"$regex": "my-api", "$options": "i"}},
                {"key": {"$regex": "my-api", "$options": "i"}},
                {"description": {"$regex": "my-api", "$options": "i"}}
            ]
        }
        mock_collection.count_documents.assert_called_once_with(expected_query)
        mock_collection.find.assert_called_once_with(expected_query)

    @pytest.mark.asyncio
    async def test_list_configs_with_all_filters(self, service, mock_collection):
        """Test listing configs with all filters combined."""
        await service.list_configs(status="active", tags=["prod"], search="payment")

        expected_query = {
            "status": "active",
            "tags": {"$all": ["prod"]},
            "$or": [
                {"name": {"$regex": "payment", "$options": "i"}},
                {"key": {"$regex": "payment", "$options": "i"}},
                {"description": {"$regex": "payment", "$options": "i"}}
            ]
        }
        mock_collection.count_documents.assert_called_once_with(expected_query)
        mock_collection.find.assert_called_once_with(expected_query)

    @pytest.mark.asyncio
    async def test_list_configs_pagination(self, service, mock_collection):
        """Test that pagination parameters are applied correctly."""
        cursor = mock_collection.find.return_value
        await service.list_configs(page=2, limit=10)

        cursor.sort.assert_called_once_with("created_at", -1)
        cursor.skip.assert_called_once_with(20)  # page * limit = 2 * 10
        cursor.limit.assert_called_once_with(10)
        cursor.to_list.assert_called_once_with(length=10)

    @pytest.mark.asyncio
    async def test_list_configs_default_pagination(self, service, mock_collection):
        """Test default pagination values (page=0, limit=25)."""
        cursor = mock_collection.find.return_value
        await service.list_configs()

        cursor.skip.assert_called_once_with(0)  # 0 * 25
        cursor.limit.assert_called_once_with(25)
        cursor.to_list.assert_called_once_with(length=25)

    @pytest.mark.asyncio
    async def test_list_configs_converts_objectid_to_string(self, service, mock_collection):
        """Test that _id ObjectId values are converted to strings."""
        oid = ObjectId()
        cursor = mock_collection.find.return_value
        cursor.to_list = AsyncMock(return_value=[
            {"_id": oid, "name": "Test API", "key": "test-api"},
            {"_id": ObjectId(), "name": "Other API", "key": "other-api"}
        ])
        mock_collection.count_documents = AsyncMock(return_value=2)

        configs, total = await service.list_configs()

        assert total == 2
        assert len(configs) == 2
        assert configs[0]["_id"] == str(oid)
        assert isinstance(configs[0]["_id"], str)
        assert isinstance(configs[1]["_id"], str)

    @pytest.mark.asyncio
    async def test_list_configs_returns_tuple(self, service, mock_collection):
        """Test that list_configs returns a tuple of (list, int)."""
        mock_collection.count_documents = AsyncMock(return_value=5)
        cursor = mock_collection.find.return_value
        cursor.to_list = AsyncMock(return_value=[{"_id": ObjectId(), "name": "A"}])

        result = await service.list_configs()

        assert isinstance(result, tuple)
        assert len(result) == 2
        assert isinstance(result[0], list)
        assert isinstance(result[1], int)


class TestGetConfigById:
    """Tests for the get_config_by_id method."""

    @pytest.fixture
    def mock_collection(self):
        collection = MagicMock()
        collection.find_one = AsyncMock(return_value=None)
        return collection

    @pytest.fixture
    def mock_db(self, mock_collection):
        db = MagicMock()
        db.db = MagicMock()
        db.db.__getitem__ = MagicMock(return_value=mock_collection)
        return db

    @pytest.fixture
    def service(self, mock_db):
        return ApiConfigService(mock_db)

    @pytest.mark.asyncio
    async def test_get_config_by_id_found(self, service, mock_collection):
        """Test getting an existing config by ID."""
        oid = ObjectId()
        mock_collection.find_one = AsyncMock(return_value={
            "_id": oid,
            "name": "Test API",
            "key": "test-api"
        })

        result = await service.get_config_by_id(str(oid))

        assert result is not None
        assert result["_id"] == str(oid)
        assert result["name"] == "Test API"

    @pytest.mark.asyncio
    async def test_get_config_by_id_not_found(self, service, mock_collection):
        """Test getting a non-existent config returns None."""
        mock_collection.find_one = AsyncMock(return_value=None)

        result = await service.get_config_by_id(str(ObjectId()))

        assert result is None

    @pytest.mark.asyncio
    async def test_get_config_by_id_invalid_id(self, service):
        """Test getting config with invalid ObjectId returns None (exception caught)."""
        result = await service.get_config_by_id("not-a-valid-oid")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_config_by_id_converts_objectid(self, service, mock_collection):
        """Test that _id is converted from ObjectId to string."""
        oid = ObjectId()
        mock_collection.find_one = AsyncMock(return_value={
            "_id": oid,
            "key": "k"
        })

        result = await service.get_config_by_id(str(oid))

        assert isinstance(result["_id"], str)

    @pytest.mark.asyncio
    async def test_get_config_by_id_exception(self, service, mock_collection):
        """Test that exceptions are caught and None is returned."""
        mock_collection.find_one = AsyncMock(side_effect=Exception("DB error"))

        result = await service.get_config_by_id(str(ObjectId()))

        assert result is None


class TestGetConfigByKey:
    """Tests for the get_config_by_key method."""

    @pytest.fixture
    def mock_collection(self):
        collection = MagicMock()
        collection.find_one = AsyncMock(return_value=None)
        return collection

    @pytest.fixture
    def mock_db(self, mock_collection):
        db = MagicMock()
        db.db = MagicMock()
        db.db.__getitem__ = MagicMock(return_value=mock_collection)
        return db

    @pytest.fixture
    def service(self, mock_db):
        return ApiConfigService(mock_db)

    @pytest.mark.asyncio
    async def test_get_config_by_key_found(self, service, mock_collection):
        """Test getting an existing config by key."""
        oid = ObjectId()
        mock_collection.find_one = AsyncMock(return_value={
            "_id": oid,
            "key": "payment-api",
            "name": "Payment API"
        })

        result = await service.get_config_by_key("payment-api")

        assert result is not None
        assert result["key"] == "payment-api"
        assert result["_id"] == str(oid)
        mock_collection.find_one.assert_called_once_with({"key": "payment-api"})

    @pytest.mark.asyncio
    async def test_get_config_by_key_not_found(self, service, mock_collection):
        """Test getting a non-existent config by key returns None."""
        mock_collection.find_one = AsyncMock(return_value=None)

        result = await service.get_config_by_key("nonexistent")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_config_by_key_converts_objectid(self, service, mock_collection):
        """Test that _id is converted to string."""
        oid = ObjectId()
        mock_collection.find_one = AsyncMock(return_value={
            "_id": oid,
            "key": "my-key"
        })

        result = await service.get_config_by_key("my-key")

        assert isinstance(result["_id"], str)


class TestCreateConfig:
    """Tests for the create_config method."""

    @pytest.fixture
    def mock_collection(self):
        collection = MagicMock()
        collection.find_one = AsyncMock(return_value=None)
        collection.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        return collection

    @pytest.fixture
    def mock_db(self, mock_collection):
        db = MagicMock()
        db.db = MagicMock()
        db.db.__getitem__ = MagicMock(return_value=mock_collection)
        return db

    @pytest.fixture
    def service(self, mock_db):
        return ApiConfigService(mock_db)

    @pytest.mark.asyncio
    async def test_create_config_success(self, service, mock_collection):
        """Test successful config creation."""
        config_data = {
            "key": "new-api",
            "name": "New API",
            "endpoint": "https://api.example.com"
        }

        result = await service.create_config(config_data, "admin@example.com")

        assert result["key"] == "new-api"
        assert result["name"] == "New API"
        assert result["created_by"] == "admin@example.com"
        assert result["updated_by"] == "admin@example.com"
        assert "created_at" in result
        assert "updated_at" in result
        assert "_id" in result
        assert isinstance(result["_id"], str)
        mock_collection.insert_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_config_duplicate_key_raises(self, service, mock_collection):
        """Test that creating a config with duplicate key raises ValueError."""
        # get_config_by_key uses find_one on the collection; simulate existing record
        oid = ObjectId()
        mock_collection.find_one = AsyncMock(return_value={
            "_id": oid,
            "key": "existing-api"
        })

        config_data = {"key": "existing-api", "name": "Duplicate"}

        with pytest.raises(ValueError, match="already exists"):
            await service.create_config(config_data, "admin@example.com")

        mock_collection.insert_one.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_config_adds_metadata_timestamps(self, service, mock_collection):
        """Test that created_at and updated_at are set as UTC datetimes."""
        config_data = {"key": "ts-test", "name": "Timestamp test"}

        result = await service.create_config(config_data, "user@example.com")

        assert isinstance(result["created_at"], datetime)
        assert isinstance(result["updated_at"], datetime)
        assert result["created_at"].tzinfo is not None  # UTC-aware

    @pytest.mark.asyncio
    async def test_create_config_converts_auth_type_enum(self, service, mock_collection):
        """Test that auth_type enum is converted to string value."""
        mock_enum = MagicMock()
        mock_enum.value = "bearer"

        config_data = {
            "key": "enum-test",
            "name": "Enum test",
            "auth_type": mock_enum
        }

        result = await service.create_config(config_data, "admin@example.com")

        assert result["auth_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_create_config_auth_type_string_passthrough(self, service, mock_collection):
        """Test that auth_type as plain string is not converted."""
        config_data = {
            "key": "str-auth",
            "name": "String auth",
            "auth_type": "api_key"
        }

        result = await service.create_config(config_data, "admin@example.com")

        assert result["auth_type"] == "api_key"

    @pytest.mark.asyncio
    async def test_create_config_sets_created_by_and_updated_by(self, service, mock_collection):
        """Test that created_by and updated_by are set to user_email."""
        config_data = {"key": "owner-test", "name": "Owner test"}

        result = await service.create_config(config_data, "creator@example.com")

        assert result["created_by"] == "creator@example.com"
        assert result["updated_by"] == "creator@example.com"


class TestUpdateConfig:
    """Tests for the update_config method."""

    @pytest.fixture
    def mock_collection(self):
        collection = MagicMock()
        collection.find_one = AsyncMock(return_value=None)
        collection.find_one_and_update = AsyncMock(return_value=None)
        return collection

    @pytest.fixture
    def mock_db(self, mock_collection):
        db = MagicMock()
        db.db = MagicMock()
        db.db.__getitem__ = MagicMock(return_value=mock_collection)
        return db

    @pytest.fixture
    def service(self, mock_db):
        return ApiConfigService(mock_db)

    @pytest.mark.asyncio
    async def test_update_config_success(self, service, mock_collection):
        """Test successful config update."""
        oid = ObjectId()
        mock_collection.find_one_and_update = AsyncMock(return_value={
            "_id": oid,
            "key": "test-api",
            "name": "Updated API",
            "updated_by": "admin@example.com"
        })

        update_data = {"name": "Updated API"}
        result = await service.update_config(str(oid), update_data, "admin@example.com")

        assert result is not None
        assert result["name"] == "Updated API"
        assert result["_id"] == str(oid)
        mock_collection.find_one_and_update.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_config_filters_none_values(self, service, mock_collection):
        """Test that None values are filtered from update_data."""
        oid = ObjectId()
        mock_collection.find_one_and_update = AsyncMock(return_value={
            "_id": oid,
            "key": "test-api",
            "name": "Updated"
        })

        update_data = {"name": "Updated", "description": None, "tags": None}
        await service.update_config(str(oid), update_data, "admin@example.com")

        call_args = mock_collection.find_one_and_update.call_args
        set_data = call_args[0][1]["$set"]
        assert "description" not in set_data
        assert "tags" not in set_data
        assert "name" in set_data

    @pytest.mark.asyncio
    async def test_update_config_empty_after_filter_returns_existing(self, service, mock_collection):
        """Test that all-None update_data returns existing config via get_config_by_id."""
        oid = ObjectId()
        mock_collection.find_one = AsyncMock(return_value={
            "_id": oid,
            "key": "test-api",
            "name": "Existing"
        })

        update_data = {"name": None, "description": None}
        result = await service.update_config(str(oid), update_data, "admin@example.com")

        assert result is not None
        assert result["name"] == "Existing"
        mock_collection.find_one_and_update.assert_not_called()

    @pytest.mark.asyncio
    async def test_update_config_adds_metadata(self, service, mock_collection):
        """Test that updated_at and updated_by are added to update data."""
        oid = ObjectId()
        mock_collection.find_one_and_update = AsyncMock(return_value={
            "_id": oid,
            "key": "test-api"
        })

        await service.update_config(str(oid), {"name": "New Name"}, "editor@example.com")

        call_args = mock_collection.find_one_and_update.call_args
        set_data = call_args[0][1]["$set"]
        assert "updated_at" in set_data
        assert set_data["updated_by"] == "editor@example.com"
        assert isinstance(set_data["updated_at"], datetime)

    @pytest.mark.asyncio
    async def test_update_config_converts_auth_type_enum(self, service, mock_collection):
        """Test that auth_type enum is converted to string during update."""
        oid = ObjectId()
        mock_enum = MagicMock()
        mock_enum.value = "oauth2"

        mock_collection.find_one_and_update = AsyncMock(return_value={
            "_id": oid,
            "auth_type": "oauth2"
        })

        await service.update_config(str(oid), {"auth_type": mock_enum}, "admin@example.com")

        call_args = mock_collection.find_one_and_update.call_args
        set_data = call_args[0][1]["$set"]
        assert set_data["auth_type"] == "oauth2"

    @pytest.mark.asyncio
    async def test_update_config_not_found(self, service, mock_collection):
        """Test updating a non-existent config returns None."""
        mock_collection.find_one_and_update = AsyncMock(return_value=None)

        result = await service.update_config(str(ObjectId()), {"name": "New"}, "admin@example.com")

        assert result is None

    @pytest.mark.asyncio
    async def test_update_config_invalid_id(self, service, mock_collection):
        """Test updating with invalid ObjectId returns None."""
        mock_collection.find_one_and_update = AsyncMock(side_effect=Exception("invalid id"))

        result = await service.update_config("bad-id", {"name": "New"}, "admin@example.com")

        assert result is None

    @pytest.mark.asyncio
    async def test_update_config_db_exception(self, service, mock_collection):
        """Test that DB exceptions are caught and None is returned."""
        mock_collection.find_one_and_update = AsyncMock(side_effect=Exception("DB error"))

        result = await service.update_config(str(ObjectId()), {"name": "X"}, "admin@example.com")

        assert result is None

    @pytest.mark.asyncio
    async def test_update_config_uses_return_document_true(self, service, mock_collection):
        """Test that find_one_and_update uses return_document=True."""
        oid = ObjectId()
        mock_collection.find_one_and_update = AsyncMock(return_value={
            "_id": oid,
            "key": "test"
        })

        await service.update_config(str(oid), {"name": "X"}, "admin@example.com")

        call_kwargs = mock_collection.find_one_and_update.call_args
        assert call_kwargs[1]["return_document"] is True


class TestDeleteConfig:
    """Tests for the delete_config method."""

    @pytest.fixture
    def mock_collection(self):
        collection = MagicMock()
        collection.find_one = AsyncMock(return_value=None)
        collection.delete_one = AsyncMock(
            return_value=MagicMock(deleted_count=1)
        )
        return collection

    @pytest.fixture
    def mock_db(self, mock_collection):
        db = MagicMock()
        db.db = MagicMock()
        db.db.__getitem__ = MagicMock(return_value=mock_collection)
        return db

    @pytest.fixture
    def service(self, mock_db):
        return ApiConfigService(mock_db)

    @pytest.mark.asyncio
    async def test_delete_config_success(self, service, mock_collection):
        """Test successful config deletion."""
        oid = ObjectId()
        mock_collection.find_one = AsyncMock(return_value={
            "_id": oid,
            "key": "test-api"
        })

        result = await service.delete_config(str(oid))

        assert result is True
        mock_collection.delete_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_config_not_found(self, service, mock_collection):
        """Test deleting a non-existent config returns False."""
        mock_collection.find_one = AsyncMock(return_value=None)
        mock_collection.delete_one = AsyncMock(
            return_value=MagicMock(deleted_count=0)
        )

        result = await service.delete_config(str(ObjectId()))

        assert result is False

    @pytest.mark.asyncio
    async def test_delete_config_with_gcs_certs(self, service, mock_collection):
        """Test that GCS certificates are deleted when config has cert paths."""
        oid = ObjectId()
        mock_gcs = MagicMock()
        mock_gcs.delete_file = AsyncMock()
        service.gcs_service = mock_gcs

        mock_collection.find_one = AsyncMock(return_value={
            "_id": str(oid),
            "key": "ssl-api",
            "ssl_cert_gcs_path": "api_configs/certs/ssl-api/cert.pem",
            "ssl_key_gcs_path": "api_configs/certs/ssl-api/key.pem",
            "ssl_ca_gcs_path": "api_configs/certs/ssl-api/ca.pem"
        })

        result = await service.delete_config(str(oid))

        assert result is True
        assert mock_gcs.delete_file.call_count == 3

    @pytest.mark.asyncio
    async def test_delete_config_gcs_delete_failure_continues(self, service, mock_collection):
        """Test that GCS cert deletion failure does not prevent config deletion."""
        oid = ObjectId()
        mock_gcs = MagicMock()
        mock_gcs.delete_file = AsyncMock(side_effect=Exception("GCS error"))
        service.gcs_service = mock_gcs

        mock_collection.find_one = AsyncMock(return_value={
            "_id": str(oid),
            "key": "ssl-api",
            "ssl_cert_gcs_path": "some/path.pem"
        })

        result = await service.delete_config(str(oid))

        assert result is True
        mock_collection.delete_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_config_no_gcs_service_skips_cert_deletion(self, service, mock_collection):
        """Test that cert deletion is skipped when gcs_service is None."""
        oid = ObjectId()
        service.gcs_service = None

        mock_collection.find_one = AsyncMock(return_value={
            "_id": str(oid),
            "key": "ssl-api",
            "ssl_cert_gcs_path": "some/path.pem"
        })

        result = await service.delete_config(str(oid))

        assert result is True

    @pytest.mark.asyncio
    async def test_delete_config_invalid_id(self, service, mock_collection):
        """Test deleting with invalid ObjectId returns False."""
        # find_one inside get_config_by_id will fail for invalid id,
        # but delete_one with ObjectId("bad-id") will raise an exception
        mock_collection.delete_one = AsyncMock(side_effect=Exception("invalid id"))
        mock_collection.find_one = AsyncMock(return_value=None)

        result = await service.delete_config("bad-id")

        assert result is False

    @pytest.mark.asyncio
    async def test_delete_config_exception(self, service, mock_collection):
        """Test that DB exception results in False."""
        mock_collection.delete_one = AsyncMock(side_effect=Exception("DB error"))
        mock_collection.find_one = AsyncMock(return_value=None)

        result = await service.delete_config(str(ObjectId()))

        assert result is False


class TestGetCount:
    """Tests for the get_count method."""

    @pytest.fixture
    def mock_collection(self):
        collection = MagicMock()
        collection.count_documents = AsyncMock(return_value=0)
        return collection

    @pytest.fixture
    def mock_db(self, mock_collection):
        db = MagicMock()
        db.db = MagicMock()
        db.db.__getitem__ = MagicMock(return_value=mock_collection)
        return db

    @pytest.fixture
    def service(self, mock_db):
        return ApiConfigService(mock_db)

    @pytest.mark.asyncio
    async def test_get_count_no_filter(self, service, mock_collection):
        """Test getting total count without filter."""
        mock_collection.count_documents = AsyncMock(return_value=42)

        count = await service.get_count()

        assert count == 42
        mock_collection.count_documents.assert_called_once_with({})

    @pytest.mark.asyncio
    async def test_get_count_with_status(self, service, mock_collection):
        """Test getting count filtered by status."""
        mock_collection.count_documents = AsyncMock(return_value=10)

        count = await service.get_count(status="active")

        assert count == 10
        mock_collection.count_documents.assert_called_once_with({"status": "active"})

    @pytest.mark.asyncio
    async def test_get_count_zero(self, service, mock_collection):
        """Test getting zero count."""
        mock_collection.count_documents = AsyncMock(return_value=0)

        count = await service.get_count()

        assert count == 0


class TestUploadCertificate:
    """Tests for the upload_certificate method."""

    @pytest.fixture
    def mock_gcs(self):
        gcs = MagicMock()
        gcs.is_configured = MagicMock(return_value=True)
        gcs.upload_file = AsyncMock()
        return gcs

    @pytest.fixture
    def service(self, mock_gcs):
        mock_db = MagicMock()
        mock_db.db = MagicMock()
        return ApiConfigService(mock_db, gcs_service=mock_gcs)

    @pytest.mark.asyncio
    async def test_upload_certificate_success_cert(self, service, mock_gcs):
        """Test successful certificate upload."""
        file_content = b"-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----"

        with patch("easylifeauth.services.api_config_service.x509") as mock_x509:
            mock_cert = MagicMock()
            mock_cert.not_valid_after_utc.isoformat.return_value = "2025-12-31T00:00:00"
            mock_x509.load_pem_x509_certificate.return_value = mock_cert

            result = await service.upload_certificate(
                config_key="payment-api",
                cert_type="cert",
                file_content=file_content,
                file_name="server.pem",
                user_email="admin@example.com"
            )

        assert result["cert_type"] == "cert"
        assert result["file_name"] == "server.pem"
        assert "gcs_path" in result
        assert result["gcs_path"].startswith("api_configs/certs/payment-api/")
        assert result["expires_at"] == "2025-12-31T00:00:00"
        assert "uploaded_at" in result
        mock_gcs.upload_file.assert_called_once()

    @pytest.mark.asyncio
    async def test_upload_certificate_key_type_no_expiry_parsing(self, service, mock_gcs):
        """Test that key type does not attempt cert expiry parsing."""
        file_content = b"-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----"

        result = await service.upload_certificate(
            config_key="payment-api",
            cert_type="key",
            file_content=file_content,
            file_name="server.key",
            user_email="admin@example.com"
        )

        assert result["cert_type"] == "key"
        assert result["expires_at"] is None

    @pytest.mark.asyncio
    async def test_upload_certificate_ca_type(self, service, mock_gcs):
        """Test CA certificate upload with expiry parsing."""
        file_content = b"-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----"

        with patch("easylifeauth.services.api_config_service.x509") as mock_x509:
            mock_cert = MagicMock()
            mock_cert.not_valid_after_utc.isoformat.return_value = "2026-06-15T00:00:00"
            mock_x509.load_pem_x509_certificate.return_value = mock_cert

            result = await service.upload_certificate(
                config_key="api-key",
                cert_type="ca",
                file_content=file_content,
                file_name="ca.pem",
                user_email="admin@example.com"
            )

        assert result["cert_type"] == "ca"
        assert result["expires_at"] == "2026-06-15T00:00:00"

    @pytest.mark.asyncio
    async def test_upload_certificate_invalid_cert_content(self, service, mock_gcs):
        """Test that cert expiry parsing failure is handled gracefully."""
        file_content = b"not-a-real-certificate"

        with patch("easylifeauth.services.api_config_service.x509") as mock_x509:
            mock_x509.load_pem_x509_certificate.side_effect = Exception("Invalid cert")

            result = await service.upload_certificate(
                config_key="api-key",
                cert_type="cert",
                file_content=file_content,
                file_name="bad.pem",
                user_email="admin@example.com"
            )

        assert result["expires_at"] is None
        mock_gcs.upload_file.assert_called_once()

    @pytest.mark.asyncio
    async def test_upload_certificate_gcs_not_configured(self):
        """Test that ValueError is raised when GCS is not configured."""
        mock_db = MagicMock()
        mock_db.db = MagicMock()
        service = ApiConfigService(mock_db, gcs_service=None)

        with pytest.raises(ValueError, match="GCS is not configured"):
            await service.upload_certificate(
                config_key="api",
                cert_type="cert",
                file_content=b"content",
                file_name="f.pem",
                user_email="admin@example.com"
            )

    @pytest.mark.asyncio
    async def test_upload_certificate_gcs_is_configured_false(self):
        """Test that ValueError is raised when gcs_service.is_configured returns False."""
        mock_db = MagicMock()
        mock_db.db = MagicMock()
        mock_gcs = MagicMock()
        mock_gcs.is_configured = MagicMock(return_value=False)
        service = ApiConfigService(mock_db, gcs_service=mock_gcs)

        with pytest.raises(ValueError, match="GCS is not configured"):
            await service.upload_certificate(
                config_key="api",
                cert_type="cert",
                file_content=b"content",
                file_name="f.pem",
                user_email="admin@example.com"
            )

    @pytest.mark.asyncio
    async def test_upload_certificate_invalid_cert_type(self, service):
        """Test that invalid cert_type raises ValueError."""
        with pytest.raises(ValueError, match="Invalid cert type"):
            await service.upload_certificate(
                config_key="api",
                cert_type="invalid",
                file_content=b"content",
                file_name="f.pem",
                user_email="admin@example.com"
            )

    @pytest.mark.asyncio
    async def test_upload_certificate_gcs_path_format(self, service, mock_gcs):
        """Test the generated GCS path contains correct components."""
        file_content = b"content"

        result = await service.upload_certificate(
            config_key="my-api",
            cert_type="key",
            file_content=file_content,
            file_name="key.pem",
            user_email="admin@example.com"
        )

        gcs_path = result["gcs_path"]
        assert gcs_path.startswith("api_configs/certs/my-api/key_")
        assert gcs_path.endswith("_key.pem")


class TestDownloadCertToTemp:
    """Tests for the _download_cert_to_temp method."""

    @pytest.fixture
    def mock_gcs(self):
        gcs = MagicMock()
        gcs.is_configured = MagicMock(return_value=True)
        gcs.download_file = AsyncMock(return_value=b"cert-content")
        return gcs

    @pytest.fixture
    def service(self, mock_gcs):
        mock_db = MagicMock()
        mock_db.db = MagicMock()
        return ApiConfigService(mock_db, gcs_service=mock_gcs)

    @pytest.mark.asyncio
    async def test_download_cert_to_temp_success(self, service, mock_gcs):
        """Test successful cert download to temp file."""
        result = await service._download_cert_to_temp("api_configs/certs/cert.pem")

        assert result is not None
        assert result.endswith(".pem")
        mock_gcs.download_file.assert_called_once_with("api_configs/certs/cert.pem")

    @pytest.mark.asyncio
    async def test_download_cert_to_temp_uses_cache(self, service, mock_gcs):
        """Test that subsequent calls use cached temp file path."""
        gcs_path = "api_configs/certs/cached.pem"
        service._temp_cert_cache[gcs_path] = "/tmp/cached.pem"

        result = await service._download_cert_to_temp(gcs_path)

        assert result == "/tmp/cached.pem"
        mock_gcs.download_file.assert_not_called()

    @pytest.mark.asyncio
    async def test_download_cert_to_temp_no_gcs_service(self):
        """Test returns None when gcs_service is None."""
        mock_db = MagicMock()
        mock_db.db = MagicMock()
        service = ApiConfigService(mock_db, gcs_service=None)

        result = await service._download_cert_to_temp("some/path.pem")

        assert result is None

    @pytest.mark.asyncio
    async def test_download_cert_to_temp_gcs_not_configured(self):
        """Test returns None when gcs_service is not configured."""
        mock_db = MagicMock()
        mock_db.db = MagicMock()
        mock_gcs = MagicMock()
        mock_gcs.is_configured = MagicMock(return_value=False)
        service = ApiConfigService(mock_db, gcs_service=mock_gcs)

        result = await service._download_cert_to_temp("some/path.pem")

        assert result is None

    @pytest.mark.asyncio
    async def test_download_cert_to_temp_download_exception(self, service, mock_gcs):
        """Test returns None when download raises an exception."""
        mock_gcs.download_file = AsyncMock(side_effect=Exception("Download failed"))

        result = await service._download_cert_to_temp("some/path.pem")

        assert result is None

    @pytest.mark.asyncio
    async def test_download_cert_to_temp_empty_content(self, service, mock_gcs):
        """Test returns None when download returns None (empty content)."""
        mock_gcs.download_file = AsyncMock(return_value=None)

        result = await service._download_cert_to_temp("some/path.pem")

        assert result is None

    @pytest.mark.asyncio
    async def test_download_cert_to_temp_caches_result(self, service, mock_gcs):
        """Test that successful download result is cached."""
        gcs_path = "api_configs/certs/new.pem"

        result = await service._download_cert_to_temp(gcs_path)

        assert gcs_path in service._temp_cert_cache
        assert service._temp_cert_cache[gcs_path] == result


class TestExtractTokenFromResponse:
    """Tests for the _extract_token_from_response method."""

    @pytest.fixture
    def service(self):
        mock_db = MagicMock()
        mock_db.db = MagicMock()
        return ApiConfigService(mock_db)

    def test_extract_simple_path(self, service):
        """Test extracting token from a simple key."""
        response_data = {"access_token": "my-token-123"}

        result = service._extract_token_from_response(response_data, "access_token")

        assert result == "my-token-123"

    def test_extract_nested_path(self, service):
        """Test extracting token from nested path."""
        response_data = {"data": {"access_token": "nested-token"}}

        result = service._extract_token_from_response(response_data, "data.access_token")

        assert result == "nested-token"

    def test_extract_deeply_nested_path(self, service):
        """Test extracting token from deeply nested path."""
        response_data = {"result": {"auth": {"token": "deep-token"}}}

        result = service._extract_token_from_response(response_data, "result.auth.token")

        assert result == "deep-token"

    def test_extract_empty_path(self, service):
        """Test that empty path returns None."""
        response_data = {"token": "value"}

        result = service._extract_token_from_response(response_data, "")

        assert result is None

    def test_extract_none_path(self, service):
        """Test that None path returns None."""
        response_data = {"token": "value"}

        result = service._extract_token_from_response(response_data, None)

        assert result is None

    def test_extract_missing_key(self, service):
        """Test that missing key returns None."""
        response_data = {"other_field": "value"}

        result = service._extract_token_from_response(response_data, "access_token")

        assert result is None

    def test_extract_non_dict_value_in_path(self, service):
        """Test that non-dict intermediate value returns None."""
        response_data = {"data": "not-a-dict"}

        result = service._extract_token_from_response(response_data, "data.token")

        assert result is None

    def test_extract_none_value(self, service):
        """Test that None token value returns None."""
        response_data = {"access_token": None}

        result = service._extract_token_from_response(response_data, "access_token")

        assert result is None

    def test_extract_numeric_value_converted_to_string(self, service):
        """Test that numeric token values are converted to string."""
        response_data = {"token": 12345}

        result = service._extract_token_from_response(response_data, "token")

        assert result == "12345"

    def test_extract_empty_string_value(self, service):
        """Test that empty string token value returns None (falsy)."""
        response_data = {"access_token": ""}

        result = service._extract_token_from_response(response_data, "access_token")

        assert result is None

    def test_extract_from_list_response(self, service):
        """Test that list at response root returns None."""
        response_data = [{"token": "val"}]

        result = service._extract_token_from_response(response_data, "token")

        assert result is None


class TestObtainLoginToken:
    """Tests for the _obtain_login_token method."""

    @pytest.fixture
    def service(self):
        mock_db = MagicMock()
        mock_db.db = MagicMock()
        return ApiConfigService(mock_db)

    @pytest.mark.asyncio
    async def test_obtain_login_token_missing_endpoint(self, service):
        """Test that missing login_endpoint returns error."""
        auth_config = {"username": "user", "password": "pass"}

        token, error = await service._obtain_login_token(auth_config, None, None, 5)

        assert token is None
        assert "login_endpoint is required" in error

    @pytest.mark.asyncio
    async def test_obtain_login_token_success(self, service):
        """Test successful login token retrieval."""
        auth_config = {
            "login_endpoint": "https://auth.example.com/login",
            "login_method": "POST",
            "username_field": "email",
            "password_field": "password",
            "username": "user@example.com",
            "password": "secret",
            "token_response_path": "access_token"
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"access_token": "login-token-xyz"}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            token, error = await service._obtain_login_token(auth_config, None, None, 5)

        assert token == "login-token-xyz"
        assert error is None

    @pytest.mark.asyncio
    async def test_obtain_login_token_http_error(self, service):
        """Test login token when server returns error status."""
        auth_config = {
            "login_endpoint": "https://auth.example.com/login",
            "username": "user",
            "password": "bad-pass"
        }

        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            token, error = await service._obtain_login_token(auth_config, None, None, 5)

        assert token is None
        assert "Login failed with status 401" in error

    @pytest.mark.asyncio
    async def test_obtain_login_token_invalid_json_response(self, service):
        """Test login token when response is not valid JSON."""
        auth_config = {
            "login_endpoint": "https://auth.example.com/login",
            "username": "user",
            "password": "pass"
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = Exception("Not JSON")

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            token, error = await service._obtain_login_token(auth_config, None, None, 5)

        assert token is None
        assert "not valid JSON" in error

    @pytest.mark.asyncio
    async def test_obtain_login_token_cannot_extract_token(self, service):
        """Test login token when token cannot be extracted from response."""
        auth_config = {
            "login_endpoint": "https://auth.example.com/login",
            "username": "user",
            "password": "pass",
            "token_response_path": "data.token"
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"result": "ok"}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            token, error = await service._obtain_login_token(auth_config, None, None, 5)

        assert token is None
        assert "Could not extract token" in error

    @pytest.mark.asyncio
    async def test_obtain_login_token_connect_timeout(self, service):
        """Test login token when connection times out."""
        import httpx
        auth_config = {
            "login_endpoint": "https://auth.example.com/login",
            "username": "user",
            "password": "pass"
        }

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(side_effect=httpx.ConnectTimeout("timeout"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            token, error = await service._obtain_login_token(auth_config, None, None, 5)

        assert token is None
        assert "timed out" in error

    @pytest.mark.asyncio
    async def test_obtain_login_token_connect_error(self, service):
        """Test login token when connection fails."""
        import httpx
        auth_config = {
            "login_endpoint": "https://auth.example.com/login",
            "username": "user",
            "password": "pass"
        }

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(side_effect=httpx.ConnectError("refused"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            token, error = await service._obtain_login_token(auth_config, None, None, 5)

        assert token is None
        assert "connection error" in error.lower()

    @pytest.mark.asyncio
    async def test_obtain_login_token_generic_exception(self, service):
        """Test login token when generic exception occurs."""
        auth_config = {
            "login_endpoint": "https://auth.example.com/login",
            "username": "user",
            "password": "pass"
        }

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(side_effect=RuntimeError("something broke"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            token, error = await service._obtain_login_token(auth_config, None, None, 5)

        assert token is None
        assert "Login error" in error

    @pytest.mark.asyncio
    async def test_obtain_login_token_uses_extra_body(self, service):
        """Test that extra_body fields are included in login request."""
        auth_config = {
            "login_endpoint": "https://auth.example.com/login",
            "username": "user",
            "password": "pass",
            "extra_body": {"grant_type": "password", "scope": "read"}
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"access_token": "token"}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            token, error = await service._obtain_login_token(auth_config, None, None, 5)

        assert token == "token"
        call_kwargs = mock_client.request.call_args[1]
        body = call_kwargs["json"]
        assert body["grant_type"] == "password"
        assert body["scope"] == "read"

    @pytest.mark.asyncio
    async def test_obtain_login_token_default_field_names(self, service):
        """Test that default username_field and password_field are used."""
        auth_config = {
            "login_endpoint": "https://auth.example.com/login",
            "username": "admin@test.com",
            "password": "secret123"
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"access_token": "tok"}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            await service._obtain_login_token(auth_config, None, None, 5)

        call_kwargs = mock_client.request.call_args[1]
        body = call_kwargs["json"]
        # Default fields are "email" and "password"
        assert "email" in body
        assert body["email"] == "admin@test.com"
        assert body["password"] == "secret123"


class TestObtainOAuth2Token:
    """Tests for the _obtain_oauth2_token method."""

    @pytest.fixture
    def service(self):
        mock_db = MagicMock()
        mock_db.db = MagicMock()
        return ApiConfigService(mock_db)

    @pytest.mark.asyncio
    async def test_obtain_oauth2_token_missing_endpoint(self, service):
        """Test that missing token_endpoint returns error."""
        auth_config = {"client_id": "id", "client_secret": "secret"}

        token, error = await service._obtain_oauth2_token(auth_config, None, None, 5)

        assert token is None
        assert "token_endpoint is required" in error

    @pytest.mark.asyncio
    async def test_obtain_oauth2_token_success(self, service):
        """Test successful OAuth2 token retrieval."""
        auth_config = {
            "token_endpoint": "https://auth.example.com/oauth/token",
            "client_id": "my-client",
            "client_secret": "my-secret",
            "token_response_path": "access_token"
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"access_token": "oauth-token-abc"}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            token, error = await service._obtain_oauth2_token(auth_config, None, None, 5)

        assert token == "oauth-token-abc"
        assert error is None

    @pytest.mark.asyncio
    async def test_obtain_oauth2_token_with_scope_and_audience(self, service):
        """Test OAuth2 token request includes scope and audience."""
        auth_config = {
            "token_endpoint": "https://auth.example.com/oauth/token",
            "client_id": "cid",
            "client_secret": "csecret",
            "scope": "read write",
            "audience": "https://api.example.com"
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"access_token": "scoped-token"}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            token, error = await service._obtain_oauth2_token(auth_config, None, None, 5)

        assert token == "scoped-token"
        call_kwargs = mock_client.post.call_args[1]
        body = call_kwargs["data"]
        assert body["scope"] == "read write"
        assert body["audience"] == "https://api.example.com"

    @pytest.mark.asyncio
    async def test_obtain_oauth2_token_http_error(self, service):
        """Test OAuth2 token when server returns error."""
        auth_config = {
            "token_endpoint": "https://auth.example.com/oauth/token",
            "client_id": "cid",
            "client_secret": "bad"
        }

        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.text = "Forbidden"

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            token, error = await service._obtain_oauth2_token(auth_config, None, None, 5)

        assert token is None
        assert "failed with status 403" in error

    @pytest.mark.asyncio
    async def test_obtain_oauth2_token_invalid_json(self, service):
        """Test OAuth2 token when response is not valid JSON."""
        auth_config = {
            "token_endpoint": "https://auth.example.com/oauth/token",
            "client_id": "cid",
            "client_secret": "csecret"
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = Exception("not json")

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            token, error = await service._obtain_oauth2_token(auth_config, None, None, 5)

        assert token is None
        assert "not valid JSON" in error

    @pytest.mark.asyncio
    async def test_obtain_oauth2_token_connect_timeout(self, service):
        """Test OAuth2 token when connection times out."""
        import httpx
        auth_config = {
            "token_endpoint": "https://auth.example.com/oauth/token",
            "client_id": "cid",
            "client_secret": "csecret"
        }

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=httpx.ConnectTimeout("timeout"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            token, error = await service._obtain_oauth2_token(auth_config, None, None, 5)

        assert token is None
        assert "timed out" in error

    @pytest.mark.asyncio
    async def test_obtain_oauth2_token_connect_error(self, service):
        """Test OAuth2 token when connection fails."""
        import httpx
        auth_config = {
            "token_endpoint": "https://auth.example.com/oauth/token",
            "client_id": "cid",
            "client_secret": "csecret"
        }

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=httpx.ConnectError("refused"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            token, error = await service._obtain_oauth2_token(auth_config, None, None, 5)

        assert token is None
        assert "connection error" in error.lower()

    @pytest.mark.asyncio
    async def test_obtain_oauth2_token_generic_exception(self, service):
        """Test OAuth2 token when generic exception occurs."""
        auth_config = {
            "token_endpoint": "https://auth.example.com/oauth/token",
            "client_id": "cid",
            "client_secret": "csecret"
        }

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(side_effect=RuntimeError("boom"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            token, error = await service._obtain_oauth2_token(auth_config, None, None, 5)

        assert token is None
        assert "OAuth2 error" in error

    @pytest.mark.asyncio
    async def test_obtain_oauth2_token_cannot_extract(self, service):
        """Test OAuth2 token when token cannot be extracted."""
        auth_config = {
            "token_endpoint": "https://auth.example.com/oauth/token",
            "client_id": "cid",
            "client_secret": "csecret",
            "token_response_path": "data.token"
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"access_token": "tok"}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            token, error = await service._obtain_oauth2_token(auth_config, None, None, 5)

        assert token is None
        assert "Could not extract token" in error

    @pytest.mark.asyncio
    async def test_obtain_oauth2_token_uses_form_encoded(self, service):
        """Test that OAuth2 request uses form-encoded data (not JSON)."""
        auth_config = {
            "token_endpoint": "https://auth.example.com/oauth/token",
            "client_id": "cid",
            "client_secret": "csecret"
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"access_token": "tok"}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            await service._obtain_oauth2_token(auth_config, None, None, 5)

        call_kwargs = mock_client.post.call_args[1]
        assert "data" in call_kwargs  # form-encoded
        assert call_kwargs["headers"]["Content-Type"] == "application/x-www-form-urlencoded"

    @pytest.mark.asyncio
    async def test_obtain_oauth2_token_with_extra_params(self, service):
        """Test that extra_params are included in the request body."""
        auth_config = {
            "token_endpoint": "https://auth.example.com/oauth/token",
            "client_id": "cid",
            "client_secret": "csecret",
            "extra_params": {"resource": "https://resource.example.com"}
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"access_token": "tok"}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.post = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            await service._obtain_oauth2_token(auth_config, None, None, 5)

        call_kwargs = mock_client.post.call_args[1]
        body = call_kwargs["data"]
        assert body["resource"] == "https://resource.example.com"


class TestTestApi:
    """Tests for the test_api method."""

    @pytest.fixture
    def service(self):
        mock_db = MagicMock()
        mock_db.db = MagicMock()
        return ApiConfigService(mock_db)

    @pytest.mark.asyncio
    async def test_test_api_simple_get_success(self, service):
        """Test a simple GET request that succeeds."""
        config = {
            "endpoint": "https://api.example.com/health",
            "method": "GET",
            "timeout": 10,
            "auth_type": "none"
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "application/json"}
        mock_response.json.return_value = {"status": "ok"}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await service.test_api(config)

        assert result["success"] is True
        assert result["status_code"] == 200
        assert result["response_body"] == {"status": "ok"}
        assert result["response_time_ms"] is not None
        assert result["error"] is None

    @pytest.mark.asyncio
    async def test_test_api_uses_ping_endpoint(self, service):
        """Test that ping_endpoint takes precedence over endpoint."""
        config = {
            "endpoint": "https://api.example.com/data",
            "ping_endpoint": "https://api.example.com/health",
            "ping_method": "HEAD",
            "ping_timeout": 3,
            "ping_expected_status": 204,
            "auth_type": "none"
        }

        mock_response = MagicMock()
        mock_response.status_code = 204
        mock_response.headers = {}
        mock_response.json.side_effect = Exception("no body")
        mock_response.text = ""

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await service.test_api(config)

        assert result["success"] is True
        assert result["status_code"] == 204
        call_kwargs = mock_client.request.call_args[1]
        assert call_kwargs["url"] == "https://api.example.com/health"
        assert call_kwargs["method"] == "HEAD"

    @pytest.mark.asyncio
    async def test_test_api_basic_auth(self, service):
        """Test API with basic auth headers."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "basic",
            "auth_config": {"username": "user", "password": "pass"}
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.return_value = {"ok": True}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await service.test_api(config)

        assert result["success"] is True
        call_kwargs = mock_client.request.call_args[1]
        assert "Authorization" in call_kwargs["headers"]
        assert call_kwargs["headers"]["Authorization"].startswith("Basic ")

    @pytest.mark.asyncio
    async def test_test_api_bearer_auth(self, service):
        """Test API with bearer token auth."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "bearer",
            "auth_config": {"token": "my-bearer-token"}
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.return_value = {}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await service.test_api(config)

        call_kwargs = mock_client.request.call_args[1]
        assert call_kwargs["headers"]["Authorization"] == "Bearer my-bearer-token"

    @pytest.mark.asyncio
    async def test_test_api_api_key_in_header(self, service):
        """Test API with API key in header."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "api_key",
            "auth_config": {
                "key_name": "X-Custom-Key",
                "key_value": "secret-key-123",
                "key_location": "header"
            }
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.return_value = {}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            await service.test_api(config)

        call_kwargs = mock_client.request.call_args[1]
        assert call_kwargs["headers"]["X-Custom-Key"] == "secret-key-123"

    @pytest.mark.asyncio
    async def test_test_api_api_key_in_query(self, service):
        """Test API with API key in query params."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "api_key",
            "auth_config": {
                "key_name": "apikey",
                "key_value": "qp-key-456",
                "key_location": "query"
            }
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.return_value = {}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            await service.test_api(config)

        call_kwargs = mock_client.request.call_args[1]
        assert call_kwargs["params"]["apikey"] == "qp-key-456"

    @pytest.mark.asyncio
    async def test_test_api_login_token_auth_success(self, service):
        """Test API with login_token auth type."""
        config = {
            "endpoint": "https://api.example.com/data",
            "method": "GET",
            "timeout": 10,
            "auth_type": "login_token",
            "auth_config": {
                "login_endpoint": "https://auth.example.com/login",
                "username": "user",
                "password": "pass",
                "token_type": "Bearer",
                "token_header_name": "Authorization"
            }
        }

        with patch.object(service, "_obtain_login_token", new_callable=AsyncMock) as mock_login:
            mock_login.return_value = ("obtained-token", None)

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.headers = {}
            mock_response.json.return_value = {"data": [1, 2, 3]}

            with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
                mock_client = AsyncMock()
                mock_client.request = AsyncMock(return_value=mock_response)
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                mock_client_cls.return_value = mock_client

                result = await service.test_api(config)

        assert result["success"] is True
        call_kwargs = mock_client.request.call_args[1]
        assert call_kwargs["headers"]["Authorization"] == "Bearer obtained-token"

    @pytest.mark.asyncio
    async def test_test_api_login_token_auth_failure(self, service):
        """Test API returns auth error when login_token fails."""
        config = {
            "endpoint": "https://api.example.com/data",
            "method": "GET",
            "timeout": 10,
            "auth_type": "login_token",
            "auth_config": {
                "login_endpoint": "https://auth.example.com/login",
                "username": "user",
                "password": "bad"
            }
        }

        with patch.object(service, "_obtain_login_token", new_callable=AsyncMock) as mock_login:
            mock_login.return_value = (None, "Login failed with status 401")

            result = await service.test_api(config)

        assert result["success"] is False
        assert "Login auth error" in result["error"]
        assert result["auth_error"] is True
        assert result["response_time_ms"] is not None

    @pytest.mark.asyncio
    async def test_test_api_oauth2_auth_success(self, service):
        """Test API with oauth2 auth type."""
        config = {
            "endpoint": "https://api.example.com/data",
            "method": "GET",
            "timeout": 10,
            "auth_type": "oauth2",
            "auth_config": {
                "token_endpoint": "https://auth.example.com/token",
                "client_id": "cid",
                "client_secret": "csecret",
                "token_type": "Bearer",
                "token_header_name": "Authorization"
            }
        }

        with patch.object(service, "_obtain_oauth2_token", new_callable=AsyncMock) as mock_oauth:
            mock_oauth.return_value = ("oauth-token", None)

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.headers = {}
            mock_response.json.return_value = {}

            with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
                mock_client = AsyncMock()
                mock_client.request = AsyncMock(return_value=mock_response)
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                mock_client_cls.return_value = mock_client

                result = await service.test_api(config)

        assert result["success"] is True
        call_kwargs = mock_client.request.call_args[1]
        assert call_kwargs["headers"]["Authorization"] == "Bearer oauth-token"

    @pytest.mark.asyncio
    async def test_test_api_oauth2_auth_failure(self, service):
        """Test API returns auth error when oauth2 fails."""
        config = {
            "endpoint": "https://api.example.com/data",
            "method": "GET",
            "timeout": 10,
            "auth_type": "oauth2",
            "auth_config": {
                "token_endpoint": "https://auth.example.com/token",
                "client_id": "cid",
                "client_secret": "bad"
            }
        }

        with patch.object(service, "_obtain_oauth2_token", new_callable=AsyncMock) as mock_oauth:
            mock_oauth.return_value = (None, "OAuth2 token request failed")

            result = await service.test_api(config)

        assert result["success"] is False
        assert "OAuth2 auth error" in result["error"]
        assert result["auth_error"] is True

    @pytest.mark.asyncio
    async def test_test_api_status_mismatch(self, service):
        """Test API where status code does not match expected."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "none",
            "ping_expected_status": 200
        }

        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.headers = {}
        mock_response.json.return_value = {"error": "not found"}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await service.test_api(config)

        assert result["success"] is False
        assert result["status_code"] == 404

    @pytest.mark.asyncio
    async def test_test_api_non_json_response(self, service):
        """Test API with non-JSON response body."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "none"
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {"content-type": "text/html"}
        mock_response.json.side_effect = Exception("Not JSON")
        mock_response.text = "<html>Hello</html>"

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await service.test_api(config)

        assert result["response_body"] == "<html>Hello</html>"

    @pytest.mark.asyncio
    async def test_test_api_long_text_truncated(self, service):
        """Test API with long non-JSON response is truncated."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "none"
        }

        long_text = "A" * 2000
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.side_effect = Exception("Not JSON")
        mock_response.text = long_text

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await service.test_api(config)

        assert result["response_body"].endswith("... (truncated)")
        assert len(result["response_body"]) < 2000

    @pytest.mark.asyncio
    async def test_test_api_connect_timeout(self, service):
        """Test API with connection timeout."""
        import httpx
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 1,
            "auth_type": "none"
        }

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(side_effect=httpx.ConnectTimeout("timeout"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await service.test_api(config)

        assert result["success"] is False
        assert result["error"] == "Connection timeout"
        assert result["response_time_ms"] is not None

    @pytest.mark.asyncio
    async def test_test_api_read_timeout(self, service):
        """Test API with read timeout."""
        import httpx
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 1,
            "auth_type": "none"
        }

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(side_effect=httpx.ReadTimeout("read timeout"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await service.test_api(config)

        assert result["success"] is False
        assert "Read timeout" in result["error"]

    @pytest.mark.asyncio
    async def test_test_api_write_timeout(self, service):
        """Test API with write timeout."""
        import httpx
        config = {
            "endpoint": "https://api.example.com",
            "method": "POST",
            "timeout": 1,
            "auth_type": "none"
        }

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(side_effect=httpx.WriteTimeout("write timeout"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await service.test_api(config)

        assert result["success"] is False
        assert "Write timeout" in result["error"]

    @pytest.mark.asyncio
    async def test_test_api_pool_timeout(self, service):
        """Test API with pool timeout."""
        import httpx
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 1,
            "auth_type": "none"
        }

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(side_effect=httpx.PoolTimeout("pool timeout"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await service.test_api(config)

        assert result["success"] is False
        assert "pool timeout" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_test_api_connect_error(self, service):
        """Test API with connection error."""
        import httpx
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "none"
        }

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(side_effect=httpx.ConnectError("refused"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await service.test_api(config)

        assert result["success"] is False
        assert "Connection error" in result["error"]

    @pytest.mark.asyncio
    async def test_test_api_ssl_error(self, service):
        """Test API with SSL error."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "none"
        }

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(side_effect=ssl.SSLError("certificate verify failed"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await service.test_api(config)

        assert result["success"] is False
        assert "SSL error" in result["error"]

    @pytest.mark.asyncio
    async def test_test_api_generic_exception(self, service):
        """Test API with unexpected exception."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "none"
        }

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(side_effect=RuntimeError("unexpected"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await service.test_api(config)

        assert result["success"] is False
        assert "Unexpected error" in result["error"]

    @pytest.mark.asyncio
    async def test_test_api_with_test_params_override(self, service):
        """Test that test_params override config params."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "none",
            "params": {"page": 1}
        }

        test_params = {"page": 5, "limit": 50}

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.return_value = {}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            await service.test_api(config, test_params=test_params)

        call_kwargs = mock_client.request.call_args[1]
        assert call_kwargs["params"] == {"page": 5, "limit": 50}

    @pytest.mark.asyncio
    async def test_test_api_with_test_body_override(self, service):
        """Test that test_body override config body for POST."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "POST",
            "timeout": 5,
            "auth_type": "none",
            "body": {"original": True}
        }

        test_body = {"override": True}

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.return_value = {}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            await service.test_api(config, test_body=test_body)

        call_kwargs = mock_client.request.call_args[1]
        assert call_kwargs["json"] == {"override": True}

    @pytest.mark.asyncio
    async def test_test_api_body_not_sent_for_get(self, service):
        """Test that body is not sent for GET requests."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "none",
            "body": {"data": "value"}
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.return_value = {}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            await service.test_api(config)

        call_kwargs = mock_client.request.call_args[1]
        assert "json" not in call_kwargs

    @pytest.mark.asyncio
    async def test_test_api_ssl_verify_disabled(self, service):
        """Test API with SSL verification disabled."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "none",
            "ssl_verify": False
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.return_value = {}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            await service.test_api(config)

        # verify should be False when ssl_verify is False
        call_kwargs = mock_client_cls.call_args[1]
        assert call_kwargs["verify"] is False

    @pytest.mark.asyncio
    async def test_test_api_with_proxy(self, service):
        """Test API with proxy configuration."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "none",
            "use_proxy": True,
            "proxy_url": "http://proxy.example.com:8080"
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.return_value = {}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            await service.test_api(config)

        call_kwargs = mock_client_cls.call_args[1]
        assert call_kwargs["proxy"] == "http://proxy.example.com:8080"

    @pytest.mark.asyncio
    async def test_test_api_no_proxy_when_use_proxy_false(self, service):
        """Test that proxy is not used when use_proxy is False."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "none",
            "use_proxy": False,
            "proxy_url": "http://proxy.example.com:8080"
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.return_value = {}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            await service.test_api(config)

        call_kwargs = mock_client_cls.call_args[1]
        assert call_kwargs["proxy"] is None

    @pytest.mark.asyncio
    async def test_test_api_with_custom_headers(self, service):
        """Test API with custom headers from config."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "none",
            "headers": {"X-Custom": "value", "Accept": "application/json"}
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.return_value = {}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            await service.test_api(config)

        call_kwargs = mock_client.request.call_args[1]
        assert call_kwargs["headers"]["X-Custom"] == "value"
        assert call_kwargs["headers"]["Accept"] == "application/json"

    @pytest.mark.asyncio
    async def test_test_api_login_token_no_token_type(self, service):
        """Test login_token auth with empty token_type (no prefix)."""
        config = {
            "endpoint": "https://api.example.com/data",
            "method": "GET",
            "timeout": 10,
            "auth_type": "login_token",
            "auth_config": {
                "login_endpoint": "https://auth.example.com/login",
                "username": "user",
                "password": "pass",
                "token_type": "",
                "token_header_name": "Authorization"
            }
        }

        with patch.object(service, "_obtain_login_token", new_callable=AsyncMock) as mock_login:
            mock_login.return_value = ("raw-token", None)

            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.headers = {}
            mock_response.json.return_value = {}

            with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
                mock_client = AsyncMock()
                mock_client.request = AsyncMock(return_value=mock_response)
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                mock_client_cls.return_value = mock_client

                await service.test_api(config)

        call_kwargs = mock_client.request.call_args[1]
        # When token_type is empty (falsy), token is used directly
        assert call_kwargs["headers"]["Authorization"] == "raw-token"

    @pytest.mark.asyncio
    async def test_test_api_result_structure(self, service):
        """Test that the result dict always has the expected keys."""
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "none"
        }

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.return_value = {}

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await service.test_api(config)

        expected_keys = {"success", "status_code", "response_time_ms",
                         "response_headers", "response_body", "error", "ssl_info"}
        assert set(result.keys()) >= expected_keys

    @pytest.mark.asyncio
    async def test_test_api_http_status_error(self, service):
        """Test API with HTTPStatusError exception."""
        import httpx
        config = {
            "endpoint": "https://api.example.com",
            "method": "GET",
            "timeout": 5,
            "auth_type": "none"
        }

        mock_resp = MagicMock()
        mock_resp.status_code = 500

        with patch("easylifeauth.services.api_config_service.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            error = httpx.HTTPStatusError(
                "Server Error",
                request=MagicMock(),
                response=mock_resp
            )
            mock_client.request = AsyncMock(side_effect=error)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await service.test_api(config)

        assert result["success"] is False
        assert "HTTP error" in result["error"]
        assert result["status_code"] == 500


class TestToggleStatus:
    """Tests for the toggle_status method."""

    @pytest.fixture
    def mock_collection(self):
        collection = MagicMock()
        collection.find_one = AsyncMock(return_value=None)
        collection.find_one_and_update = AsyncMock(return_value=None)
        return collection

    @pytest.fixture
    def mock_db(self, mock_collection):
        db = MagicMock()
        db.db = MagicMock()
        db.db.__getitem__ = MagicMock(return_value=mock_collection)
        return db

    @pytest.fixture
    def service(self, mock_db):
        return ApiConfigService(mock_db)

    @pytest.mark.asyncio
    async def test_toggle_active_to_inactive(self, service, mock_collection):
        """Test toggling an active config to inactive."""
        oid = ObjectId()
        mock_collection.find_one = AsyncMock(return_value={
            "_id": oid,
            "key": "test-api",
            "status": "active"
        })
        mock_collection.find_one_and_update = AsyncMock(return_value={
            "_id": oid,
            "key": "test-api",
            "status": "inactive"
        })

        result = await service.toggle_status(str(oid), "admin@example.com")

        assert result is not None
        call_args = mock_collection.find_one_and_update.call_args
        set_data = call_args[0][1]["$set"]
        assert set_data["status"] == "inactive"

    @pytest.mark.asyncio
    async def test_toggle_inactive_to_active(self, service, mock_collection):
        """Test toggling an inactive config to active."""
        oid = ObjectId()
        mock_collection.find_one = AsyncMock(return_value={
            "_id": oid,
            "key": "test-api",
            "status": "inactive"
        })
        mock_collection.find_one_and_update = AsyncMock(return_value={
            "_id": oid,
            "key": "test-api",
            "status": "active"
        })

        result = await service.toggle_status(str(oid), "admin@example.com")

        assert result is not None
        call_args = mock_collection.find_one_and_update.call_args
        set_data = call_args[0][1]["$set"]
        assert set_data["status"] == "active"

    @pytest.mark.asyncio
    async def test_toggle_no_status_defaults_to_active(self, service, mock_collection):
        """Test toggling config with no status field defaults to active."""
        oid = ObjectId()
        mock_collection.find_one = AsyncMock(return_value={
            "_id": oid,
            "key": "test-api"
            # No 'status' field
        })
        mock_collection.find_one_and_update = AsyncMock(return_value={
            "_id": oid,
            "key": "test-api",
            "status": "active"
        })

        result = await service.toggle_status(str(oid), "admin@example.com")

        assert result is not None
        call_args = mock_collection.find_one_and_update.call_args
        set_data = call_args[0][1]["$set"]
        assert set_data["status"] == "active"

    @pytest.mark.asyncio
    async def test_toggle_nonexistent_config(self, service, mock_collection):
        """Test toggling a non-existent config returns None."""
        mock_collection.find_one = AsyncMock(return_value=None)

        result = await service.toggle_status(str(ObjectId()), "admin@example.com")

        assert result is None
        mock_collection.find_one_and_update.assert_not_called()


class TestGetTags:
    """Tests for the get_tags method."""

    @pytest.fixture
    def mock_collection(self):
        collection = MagicMock()
        return collection

    @pytest.fixture
    def mock_db(self, mock_collection):
        db = MagicMock()
        db.db = MagicMock()
        db.db.__getitem__ = MagicMock(return_value=mock_collection)
        return db

    @pytest.fixture
    def service(self, mock_db):
        return ApiConfigService(mock_db)

    @pytest.mark.asyncio
    async def test_get_tags_returns_sorted_unique_tags(self, service, mock_collection):
        """Test that get_tags returns sorted list of unique tags."""
        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[
            {"_id": "api"},
            {"_id": "internal"},
            {"_id": "production"}
        ])
        mock_collection.aggregate = MagicMock(return_value=mock_cursor)

        result = await service.get_tags()

        assert result == ["api", "internal", "production"]

    @pytest.mark.asyncio
    async def test_get_tags_empty(self, service, mock_collection):
        """Test that get_tags returns empty list when no tags exist."""
        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_collection.aggregate = MagicMock(return_value=mock_cursor)

        result = await service.get_tags()

        assert result == []

    @pytest.mark.asyncio
    async def test_get_tags_uses_correct_pipeline(self, service, mock_collection):
        """Test that get_tags uses the correct aggregation pipeline."""
        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_collection.aggregate = MagicMock(return_value=mock_cursor)

        await service.get_tags()

        expected_pipeline = [
            {"$unwind": "$tags"},
            {"$group": {"_id": "$tags"}},
            {"$sort": {"_id": 1}}
        ]
        mock_collection.aggregate.assert_called_once_with(expected_pipeline)

    @pytest.mark.asyncio
    async def test_get_tags_limits_to_100(self, service, mock_collection):
        """Test that get_tags limits results to 100."""
        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_collection.aggregate = MagicMock(return_value=mock_cursor)

        await service.get_tags()

        mock_cursor.to_list.assert_called_once_with(length=100)

    @pytest.mark.asyncio
    async def test_get_tags_single_tag(self, service, mock_collection):
        """Test get_tags with a single tag in the result."""
        mock_cursor = MagicMock()
        mock_cursor.to_list = AsyncMock(return_value=[{"_id": "singleton"}])
        mock_collection.aggregate = MagicMock(return_value=mock_cursor)

        result = await service.get_tags()

        assert result == ["singleton"]
