"""Tests for Configurations Routes"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from fastapi import FastAPI
from bson import ObjectId
from datetime import datetime
import json
import io

from easylifeauth.api.configurations_routes import (
    router,
    init_gcs_service,
    get_gcs_service,
    generate_config_id,
    serialize_config,
    create_pagination_meta,
    DbConfigurationTypes
)
from easylifeauth.api.dependencies import get_db
from easylifeauth.security.access_control import require_super_admin


class TestHelperFunctions:
    """Tests for helper functions"""

    def test_generate_config_id(self):
        """Test generate_config_id produces unique IDs"""
        id1 = generate_config_id()
        id2 = generate_config_id()
        assert id1 != id2
        assert id1.startswith("config_")
        assert len(id1) > 7  # "config_" + at least some hex chars

    def test_serialize_config_with_id(self):
        """Test serialize_config converts _id to id"""
        config = {"_id": ObjectId(), "key": "test"}
        result = serialize_config(config)
        assert "id" in result
        assert "_id" not in result

    def test_serialize_config_adds_defaults(self):
        """Test serialize_config adds default values for null fields"""
        config = {
            "_id": ObjectId(),
            "lookups": None,
            "queries": None,
            "logics": None,
            "operations": None,
            "data": None
        }
        result = serialize_config(config)
        assert result["lookups"] == {}
        assert result["queries"] == {}
        assert result["logics"] == {}
        assert result["operations"] == {}
        assert result["data"] == {}

    def test_serialize_config_preserves_existing(self):
        """Test serialize_config preserves existing values"""
        config = {
            "_id": ObjectId(),
            "lookups": {"key": "value"},
            "queries": ["query1"]
        }
        result = serialize_config(config)
        assert result["lookups"] == {"key": "value"}
        assert result["queries"] == ["query1"]

    def test_create_pagination_meta(self):
        """Test create_pagination_meta"""
        meta = create_pagination_meta(100, 0, 25)
        assert meta.total == 100
        assert meta.page == 0
        assert meta.limit == 25
        assert meta.pages == 4
        assert meta.has_next is True
        assert meta.has_prev is False

    def test_create_pagination_meta_zero_limit(self):
        """Test create_pagination_meta with zero limit"""
        meta = create_pagination_meta(100, 0, 0)
        assert meta.pages == 0

    def test_db_configuration_types(self):
        """Test DbConfigurationTypes enum values"""
        assert DbConfigurationTypes.LOOKUP_DATA_TYPE.value == "lookup-data"
        assert DbConfigurationTypes.PROCESS_TYPE.value == "process-config"
        assert DbConfigurationTypes.SNAP_SHOT_TYPE.value == "snapshot-data"
        assert DbConfigurationTypes.GCS_DATA_TYPE.value == "gcs-data"


class TestGCSServiceInitialization:
    """Tests for GCS service initialization"""

    def test_init_gcs_service_with_config(self):
        """Test init_gcs_service with config"""
        with patch('easylifeauth.api.configurations_routes.GCSService') as MockGCS:
            mock_service = MagicMock()
            mock_service.is_configured.return_value = True
            MockGCS.return_value = mock_service

            init_gcs_service({"bucket_name": "test-bucket"})

            MockGCS.assert_called_once_with({"bucket_name": "test-bucket"})

    def test_init_gcs_service_without_config(self):
        """Test init_gcs_service without config"""
        with patch('easylifeauth.api.configurations_routes.GCSService') as MockGCS:
            mock_service = MagicMock()
            MockGCS.return_value = mock_service

            init_gcs_service(None)

            MockGCS.assert_called_once_with()

    def test_get_gcs_service(self):
        """Test get_gcs_service returns the service"""
        with patch('easylifeauth.api.configurations_routes._gcs_service', MagicMock()):
            service = get_gcs_service()
            assert service is not None


class TestConfigurationsRoutes:
    """Tests for configurations API routes"""

    @pytest.fixture
    def app(self):
        """Create test app"""
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_db(self):
        """Create mock database"""
        db = MagicMock()
        db.configurations = MagicMock()
        return db

    @pytest.fixture
    def mock_super_admin(self):
        """Create mock super admin user"""
        user = MagicMock()
        user.email = "admin@test.com"
        user.roles = ["super-administrator"]
        return user

    @pytest.fixture
    def client(self, app, mock_db, mock_super_admin):
        """Create test client with overridden dependencies"""
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        return TestClient(app)

    def test_list_configurations(self, client, mock_db):
        """Test list configurations endpoint"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_123",
            "key": "test-config",
            "type": "lookup-data",
            "row_update_stp": datetime.utcnow()
        }

        mock_db.configurations.count_documents = AsyncMock(return_value=1)
        mock_cursor = MagicMock()
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[config.copy()])
        mock_db.configurations.find = MagicMock(return_value=mock_cursor)

        response = client.get("/configurations")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert "pagination" in data

    def test_list_configurations_with_type_filter(self, client, mock_db):
        """Test list configurations with type filter"""
        mock_db.configurations.count_documents = AsyncMock(return_value=0)
        mock_cursor = MagicMock()
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.configurations.find = MagicMock(return_value=mock_cursor)

        response = client.get("/configurations?type=lookup-data")
        assert response.status_code == 200

    def test_list_configurations_with_search(self, client, mock_db):
        """Test list configurations with search"""
        mock_db.configurations.count_documents = AsyncMock(return_value=0)
        mock_cursor = MagicMock()
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.configurations.find = MagicMock(return_value=mock_cursor)

        response = client.get("/configurations?search=test")
        assert response.status_code == 200

    def test_count_configurations(self, client, mock_db):
        """Test count configurations endpoint"""
        mock_db.configurations.count_documents = AsyncMock(return_value=5)

        response = client.get("/configurations/count")
        assert response.status_code == 200
        assert response.json()["count"] == 5

    def test_count_configurations_with_type(self, client, mock_db):
        """Test count configurations with type filter"""
        mock_db.configurations.count_documents = AsyncMock(return_value=3)

        response = client.get("/configurations/count?type=lookup-data")
        assert response.status_code == 200
        assert response.json()["count"] == 3

    def test_get_configuration_types(self, client):
        """Test get configuration types endpoint"""
        response = client.get("/configurations/types")
        assert response.status_code == 200
        data = response.json()
        assert "types" in data
        assert len(data["types"]) == 4

    def test_get_configuration_by_config_id(self, client, mock_db):
        """Test get configuration by config_id"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_123",
            "key": "test-config",
            "type": "lookup-data"
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        response = client.get("/configurations/config_123")
        assert response.status_code == 200

    def test_get_configuration_by_object_id(self, client, mock_db):
        """Test get configuration by ObjectId"""
        obj_id = ObjectId()
        config = {
            "_id": obj_id,
            "config_id": "config_123",
            "key": "test-config",
            "type": "lookup-data"
        }

        # First query by config_id returns None, second by _id returns config
        mock_db.configurations.find_one = AsyncMock(side_effect=[None, config.copy()])

        response = client.get(f"/configurations/{obj_id}")
        assert response.status_code == 200

    def test_get_configuration_not_found(self, client, mock_db):
        """Test get configuration not found"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)

        response = client.get("/configurations/nonexistent")
        assert response.status_code == 404

    def test_get_configuration_gcs_type(self, client, mock_db):
        """Test get configuration of GCS type"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_123",
            "key": "test-config",
            "type": "gcs-data",
            "gcs": {"path": "gs://bucket/file.json"}
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        response = client.get("/configurations/config_123")
        assert response.status_code == 200

    def test_create_configuration(self, client, mock_db):
        """Test create configuration endpoint"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)  # Key doesn't exist
        mock_db.configurations.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))

        config_data = {
            "key": "new-config",
            "type": "lookup-data",
            "status": "active"
        }

        response = client.post("/configurations", json=config_data)
        assert response.status_code in [200, 201]  # Route may return 200 or 201

    def test_create_configuration_key_exists(self, client, mock_db):
        """Test create configuration with existing key"""
        mock_db.configurations.find_one = AsyncMock(return_value={"key": "existing"})

        config_data = {
            "key": "existing",
            "type": "lookup-data",
            "status": "active"
        }

        response = client.post("/configurations", json=config_data)
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_update_configuration(self, client, mock_db):
        """Test update configuration endpoint"""
        config_id = ObjectId()
        existing = {
            "_id": config_id,
            "config_id": "config_123",
            "key": "test-config",
            "type": "lookup-data",
            "lookups": {"old": "data"},
            "queries": {},
            "logics": {},
            "operations": {},
            "data": {},
        }
        updated = existing.copy()
        updated["key"] = "updated-config"

        # find_one is called: (1) to find existing, (2) to check duplicate key, (3) to return updated doc
        mock_db.configurations.find_one = AsyncMock(
            side_effect=[existing.copy(), None, updated.copy()]
        )
        mock_db.configurations.update_one = AsyncMock()

        with patch("easylifeauth.api.configurations_routes._gcs_service", None):
            response = client.put(
                "/configurations/config_123",
                json={"key": "updated-config", "lookups": {"new": "data"}}
            )
        assert response.status_code == 200
        data = response.json()
        assert data["key"] == "updated-config"

    def test_update_configuration_not_found(self, client, mock_db):
        """Test update configuration not found"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)

        response = client.put("/configurations/nonexistent", json={"key": "updated"})
        assert response.status_code == 404

    def test_delete_configuration(self, client, mock_db):
        """Test delete configuration endpoint"""
        mock_db.configurations.find_one = AsyncMock(return_value={"config_id": "config_123", "_id": ObjectId()})
        mock_db.configurations.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))

        response = client.delete("/configurations/config_123")
        assert response.status_code == 200
        assert "deleted" in response.json()["message"]

    def test_delete_configuration_not_found(self, client, mock_db):
        """Test delete configuration not found"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)

        response = client.delete("/configurations/nonexistent")
        assert response.status_code == 404

    def test_update_configuration_duplicate_key(self, client, mock_db):
        """Test update configuration rejects duplicate key"""
        config_id = ObjectId()
        existing = {
            "_id": config_id,
            "config_id": "config_123",
            "key": "test-config",
            "type": "lookup-data",
        }
        other_config = {"_id": ObjectId(), "key": "taken-key"}

        # find_one: (1) find existing by config_id, (2) check duplicate key -> found
        mock_db.configurations.find_one = AsyncMock(
            side_effect=[existing.copy(), other_config]
        )

        response = client.put(
            "/configurations/config_123",
            json={"key": "taken-key"}
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    def test_update_configuration_by_object_id(self, client, mock_db):
        """Test update configuration falls back to ObjectId lookup"""
        obj_id = ObjectId()
        existing = {
            "_id": obj_id,
            "config_id": "config_123",
            "key": "test-config",
            "type": "lookup-data",
            "lookups": {},
            "queries": {},
            "logics": {},
            "operations": {},
            "data": {},
        }
        updated = existing.copy()
        updated["lookups"] = {"updated": True}

        # find_one: (1) by config_id -> None, (2) by _id -> found, (3) return updated
        mock_db.configurations.find_one = AsyncMock(
            side_effect=[None, existing.copy(), updated.copy()]
        )
        mock_db.configurations.update_one = AsyncMock()

        with patch("easylifeauth.api.configurations_routes._gcs_service", None):
            response = client.put(
                f"/configurations/{obj_id}",
                json={"lookups": {"updated": True}}
            )
        assert response.status_code == 200

    def test_update_configuration_null_fields_get_defaults(self, client, mock_db):
        """Test update configuration sets empty dict for null fields"""
        config_id = ObjectId()
        existing = {
            "_id": config_id,
            "config_id": "config_123",
            "key": "test-config",
            "type": "lookup-data",
            "lookups": None,
            "queries": None,
            "logics": None,
            "operations": None,
            "data": None,
        }
        updated = existing.copy()
        updated["lookups"] = {}
        updated["queries"] = {}
        updated["logics"] = {}
        updated["operations"] = {}
        updated["data"] = {}

        mock_db.configurations.find_one = AsyncMock(
            side_effect=[existing.copy(), updated.copy()]
        )
        mock_db.configurations.update_one = AsyncMock()

        with patch("easylifeauth.api.configurations_routes._gcs_service", None):
            response = client.put(
                "/configurations/config_123",
                json={}
            )
        assert response.status_code == 200
        data = response.json()
        assert data["lookups"] == {}
        assert data["queries"] == {}

    def test_delete_configuration_by_object_id(self, client, mock_db):
        """Test delete configuration falls back to ObjectId lookup"""
        obj_id = ObjectId()
        config = {
            "_id": obj_id,
            "config_id": "config_456",
            "key": "test-config",
        }

        # find_one: (1) by config_id -> None, (2) by _id -> found
        mock_db.configurations.find_one = AsyncMock(
            side_effect=[None, config.copy()]
        )
        mock_db.configurations.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))

        with patch("easylifeauth.api.configurations_routes._gcs_service", None):
            response = client.delete(f"/configurations/{obj_id}")
        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

    def test_delete_configuration_with_gcs_versions(self, client, mock_db):
        """Test delete cleans up GCS versioned files"""
        obj_id = ObjectId()
        config = {
            "_id": obj_id,
            "config_id": "config_gcs",
            "key": "gcs-config",
            "type": "gcs-data",
            "gcs": {
                "versions": [
                    {"gcs_key": "configurations/gcs-config/v1_file.xlsx"},
                    {"gcs_key": "configurations/gcs-config/v2_file.xlsx"},
                ]
            },
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())
        mock_db.configurations.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        mock_gcs.delete_file = AsyncMock()

        with patch("easylifeauth.api.configurations_routes._gcs_service", mock_gcs):
            response = client.delete("/configurations/config_gcs")

        assert response.status_code == 200
        assert mock_gcs.delete_file.call_count == 2

    def test_delete_configuration_with_gcs_sync(self, client, mock_db):
        """Test delete cleans up GCS sync file"""
        obj_id = ObjectId()
        config = {
            "_id": obj_id,
            "config_id": "config_sync",
            "key": "sync-config",
            "type": "lookup-data",
            "gcs_sync": {"gcs_path": "configurations/sync-config/config.json"},
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())
        mock_db.configurations.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        mock_gcs.delete_file = AsyncMock()

        with patch("easylifeauth.api.configurations_routes._gcs_service", mock_gcs):
            response = client.delete("/configurations/config_sync")

        assert response.status_code == 200
        mock_gcs.delete_file.assert_called_once_with("configurations/sync-config/config.json")

    def test_delete_configuration_gcs_cleanup_failure_still_deletes(self, client, mock_db):
        """Test delete succeeds even if GCS cleanup fails"""
        obj_id = ObjectId()
        config = {
            "_id": obj_id,
            "config_id": "config_fail",
            "key": "fail-config",
            "gcs": {
                "versions": [{"gcs_key": "some/path"}]
            },
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())
        mock_db.configurations.delete_one = AsyncMock(return_value=MagicMock(deleted_count=1))

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        mock_gcs.delete_file = AsyncMock(side_effect=Exception("GCS error"))

        with patch("easylifeauth.api.configurations_routes._gcs_service", mock_gcs):
            response = client.delete("/configurations/config_fail")

        assert response.status_code == 200

    def test_get_configuration_with_source_mongo(self, client, mock_db):
        """Test get configuration with source=mongo for GCS type"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_gcs",
            "key": "gcs-config",
            "type": "gcs-data",
            "gcs": {"path": "gs://bucket/file"},
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        response = client.get("/configurations/config_gcs?source=mongo")
        assert response.status_code == 200
        data = response.json()
        assert data.get("_loaded_from") == "mongo"

    def test_get_configuration_with_source_gcs(self, client, mock_db):
        """Test get configuration with source=gcs loads from GCS"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_lookup",
            "key": "lookup-config",
            "type": "lookup-data",
            "gcs_sync": {"gcs_path": "configurations/lookup-config/config.json"},
            "lookups": {"old": "data"},
        }

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        gcs_data = json.dumps({"lookups": {"new": "gcs_data"}}).encode("utf-8")
        mock_gcs.download_file = AsyncMock(return_value=gcs_data)

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        with patch("easylifeauth.api.configurations_routes._gcs_service", mock_gcs):
            response = client.get("/configurations/config_lookup?source=gcs")

        assert response.status_code == 200
        data = response.json()
        assert data.get("_loaded_from") == "gcs"
        assert data["lookups"] == {"new": "gcs_data"}

    def test_get_configuration_source_gcs_no_path(self, client, mock_db):
        """Test get configuration with source=gcs but no gcs_path falls back to mongo"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_no_path",
            "key": "no-path-config",
            "type": "lookup-data",
            "gcs_sync": {},
        }

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        with patch("easylifeauth.api.configurations_routes._gcs_service", mock_gcs):
            response = client.get("/configurations/config_no_path?source=gcs")

        assert response.status_code == 200
        data = response.json()
        assert data.get("_loaded_from") == "mongo"

    def test_get_configuration_source_gcs_download_fails(self, client, mock_db):
        """Test get configuration with source=gcs gracefully handles download failure"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_fail",
            "key": "fail-config",
            "type": "lookup-data",
            "gcs_sync": {"gcs_path": "configurations/fail-config/config.json"},
        }

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        mock_gcs.download_file = AsyncMock(side_effect=Exception("Download failed"))

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        with patch("easylifeauth.api.configurations_routes._gcs_service", mock_gcs):
            response = client.get("/configurations/config_fail?source=gcs")

        assert response.status_code == 200
        data = response.json()
        assert data.get("_loaded_from") == "mongo_fallback"


class TestConfigurationDownload:
    """Tests for configuration download endpoint"""

    @pytest.fixture
    def app(self):
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.configurations = MagicMock()
        return db

    @pytest.fixture
    def mock_super_admin(self):
        user = MagicMock()
        user.email = "admin@test.com"
        user.roles = ["super-administrator"]
        return user

    @pytest.fixture
    def client(self, app, mock_db, mock_super_admin):
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        return TestClient(app)

    def test_download_not_found(self, client, mock_db):
        """Test download for nonexistent configuration"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)

        response = client.get("/configurations/nonexistent/download")
        assert response.status_code == 404

    def test_download_process_type_returns_json(self, client, mock_db):
        """Test download for process-config type returns JSON data"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_proc",
            "key": "process-config",
            "type": "process-config",
            "queries": {"q1": "SELECT *"},
            "logics": {"l1": "if x"},
            "operations": {"o1": "insert"},
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        response = client.get("/configurations/config_proc/download")
        assert response.status_code == 200
        data = response.json()
        assert data["queries"] == {"q1": "SELECT *"}
        assert data["logics"] == {"l1": "if x"}
        assert data["operations"] == {"o1": "insert"}

    def test_download_lookup_type_returns_json(self, client, mock_db):
        """Test download for lookup-data type returns lookups"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_lookup",
            "key": "lookup-config",
            "type": "lookup-data",
            "lookups": {"countries": ["US", "UK"]},
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        response = client.get("/configurations/config_lookup/download")
        assert response.status_code == 200
        data = response.json()
        assert data["lookups"] == {"countries": ["US", "UK"]}

    def test_download_snapshot_type_returns_json(self, client, mock_db):
        """Test download for snapshot-data type returns data"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_snap",
            "key": "snapshot-config",
            "type": "snapshot-data",
            "data": {"snapshot": "2024-01-01"},
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        response = client.get("/configurations/config_snap/download")
        assert response.status_code == 200
        data = response.json()
        assert data["data"] == {"snapshot": "2024-01-01"}

    def test_download_gcs_type_no_gcs_info(self, client, mock_db):
        """Test download for gcs-data type with no gcs info"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_gcs_empty",
            "key": "gcs-empty",
            "type": "gcs-data",
            "gcs": None,
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        response = client.get("/configurations/config_gcs_empty/download")
        assert response.status_code == 404
        assert "No file associated" in response.json()["detail"]

    def test_download_gcs_type_specific_version(self, client, mock_db):
        """Test download for gcs-data type with specific version"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_versioned",
            "key": "versioned-config",
            "type": "gcs-data",
            "gcs": {
                "current_gcs_key": "configurations/versioned/v2_file.xlsx",
                "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "file_name": "file.xlsx",
                "versions": [
                    {"version": 1, "gcs_key": "configurations/versioned/v1_file.xlsx"},
                    {"version": 2, "gcs_key": "configurations/versioned/v2_file.xlsx"},
                ],
            },
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        mock_gcs.download_file = AsyncMock(return_value=b"file-content-v1")

        with patch("easylifeauth.api.configurations_routes._gcs_service", mock_gcs):
            response = client.get("/configurations/config_versioned/download?version=1")

        assert response.status_code == 200
        mock_gcs.download_file.assert_called_once_with("configurations/versioned/v1_file.xlsx")

    def test_download_gcs_type_version_not_found(self, client, mock_db):
        """Test download for gcs-data type with nonexistent version"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_versioned",
            "key": "versioned-config",
            "type": "gcs-data",
            "gcs": {
                "current_gcs_key": "configurations/versioned/v1_file.xlsx",
                "versions": [
                    {"version": 1, "gcs_key": "configurations/versioned/v1_file.xlsx"},
                ],
            },
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        response = client.get("/configurations/config_versioned/download?version=99")
        assert response.status_code == 404
        assert "Version 99 not found" in response.json()["detail"]

    def test_download_gcs_type_current_version(self, client, mock_db):
        """Test download for gcs-data type returns current version by default"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_current",
            "key": "current-config",
            "type": "gcs-data",
            "gcs": {
                "current_gcs_key": "configurations/current/v2_file.xlsx",
                "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "file_name": "file.xlsx",
                "versions": [],
            },
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        mock_gcs.download_file = AsyncMock(return_value=b"file-content-v2")

        with patch("easylifeauth.api.configurations_routes._gcs_service", mock_gcs):
            response = client.get("/configurations/config_current/download")

        assert response.status_code == 200
        mock_gcs.download_file.assert_called_once_with("configurations/current/v2_file.xlsx")

    def test_download_gcs_type_no_gcs_key(self, client, mock_db):
        """Test download for gcs-data type when no gcs_key is set"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_nokey",
            "key": "nokey-config",
            "type": "gcs-data",
            "gcs": {"versions": []},
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        response = client.get("/configurations/config_nokey/download")
        assert response.status_code == 404
        assert "File not found" in response.json()["detail"]

    def test_download_gcs_type_service_not_configured(self, client, mock_db):
        """Test download for gcs-data type when GCS service is not configured"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_nogcs",
            "key": "nogcs-config",
            "type": "gcs-data",
            "gcs": {
                "current_gcs_key": "configurations/nogcs/v1_file.xlsx",
                "content_type": "application/octet-stream",
                "file_name": "file.xlsx",
            },
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        with patch("easylifeauth.api.configurations_routes._gcs_service", None):
            response = client.get("/configurations/config_nogcs/download")

        assert response.status_code == 503
        assert "GCS service not configured" in response.json()["detail"]

    def test_download_gcs_type_download_returns_none(self, client, mock_db):
        """Test download for gcs-data type when GCS download returns None"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_dlnone",
            "key": "dlnone-config",
            "type": "gcs-data",
            "gcs": {
                "current_gcs_key": "configurations/dlnone/v1_file.xlsx",
                "content_type": "application/octet-stream",
                "file_name": "file.xlsx",
            },
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        mock_gcs.download_file = AsyncMock(return_value=None)

        with patch("easylifeauth.api.configurations_routes._gcs_service", mock_gcs):
            response = client.get("/configurations/config_dlnone/download")

        assert response.status_code == 404
        assert "Failed to download" in response.json()["detail"]


class TestConfigurationVersions:
    """Tests for configuration versions endpoint"""

    @pytest.fixture
    def app(self):
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.configurations = MagicMock()
        return db

    @pytest.fixture
    def mock_super_admin(self):
        user = MagicMock()
        user.email = "admin@test.com"
        user.roles = ["super-administrator"]
        return user

    @pytest.fixture
    def client(self, app, mock_db, mock_super_admin):
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        return TestClient(app)

    def test_versions_not_found(self, client, mock_db):
        """Test versions endpoint for nonexistent configuration"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)

        response = client.get("/configurations/nonexistent/versions")
        assert response.status_code == 404

    def test_versions_non_gcs_type(self, client, mock_db):
        """Test versions endpoint for non-GCS type returns empty"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_lookup",
            "key": "lookup-config",
            "type": "lookup-data",
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        response = client.get("/configurations/config_lookup/versions")
        assert response.status_code == 200
        data = response.json()
        assert data["versions"] == []
        assert "does not support versioning" in data["message"]

    def test_versions_gcs_type_with_versions(self, client, mock_db):
        """Test versions endpoint for GCS type with multiple versions"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_versioned",
            "key": "versioned-config",
            "type": "gcs-data",
            "gcs": {
                "current_version": 3,
                "versions": [
                    {"version": 1, "gcs_key": "v1_file.xlsx", "upload_date": "2024-01-01"},
                    {"version": 2, "gcs_key": "v2_file.xlsx", "upload_date": "2024-02-01"},
                    {"version": 3, "gcs_key": "v3_file.xlsx", "upload_date": "2024-03-01"},
                ],
            },
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        response = client.get("/configurations/config_versioned/versions")
        assert response.status_code == 200
        data = response.json()
        assert data["config_id"] == "config_versioned"
        assert data["key"] == "versioned-config"
        assert data["current_version"] == 3
        assert len(data["versions"]) == 3

    def test_versions_gcs_type_empty_gcs(self, client, mock_db):
        """Test versions endpoint for GCS type with no versions"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_empty_gcs",
            "key": "empty-gcs-config",
            "type": "gcs-data",
            "gcs": {},
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        response = client.get("/configurations/config_empty_gcs/versions")
        assert response.status_code == 200
        data = response.json()
        assert data["versions"] == []
        assert data["current_version"] is None

    def test_versions_gcs_type_null_gcs(self, client, mock_db):
        """Test versions endpoint for GCS type with null gcs field"""
        config = {
            "_id": ObjectId(),
            "config_id": "config_null_gcs",
            "key": "null-gcs-config",
            "type": "gcs-data",
            "gcs": None,
        }

        mock_db.configurations.find_one = AsyncMock(return_value=config.copy())

        response = client.get("/configurations/config_null_gcs/versions")
        assert response.status_code == 200
        data = response.json()
        assert data["versions"] == []


class TestGCSStatus:
    """Tests for GCS status endpoint"""

    @pytest.fixture
    def app(self):
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_super_admin(self):
        user = MagicMock()
        user.email = "admin@test.com"
        user.roles = ["super-administrator"]
        return user

    @pytest.fixture
    def client(self, app, mock_super_admin):
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        return TestClient(app)

    def test_gcs_status_not_initialized(self, client):
        """Test GCS status when service is not initialized"""
        with patch("easylifeauth.api.configurations_routes._gcs_service", None):
            response = client.get("/configurations/gcs/status")

        assert response.status_code == 200
        data = response.json()
        assert data["configured"] is False
        assert data["bucket_name"] is None
        assert "not initialized" in data["error"]

    def test_gcs_status_configured(self, client):
        """Test GCS status when service is configured"""
        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        mock_gcs.bucket_name = "test-bucket"
        mock_gcs.get_init_error.return_value = None

        with patch("easylifeauth.api.configurations_routes._gcs_service", mock_gcs):
            response = client.get("/configurations/gcs/status")

        assert response.status_code == 200
        data = response.json()
        assert data["configured"] is True
        assert data["bucket_name"] == "test-bucket"

    def test_gcs_status_not_configured(self, client):
        """Test GCS status when service exists but is not configured"""
        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = False
        mock_gcs.get_init_error.return_value = "Missing credentials"

        with patch("easylifeauth.api.configurations_routes._gcs_service", mock_gcs):
            response = client.get("/configurations/gcs/status")

        assert response.status_code == 200
        data = response.json()
        assert data["configured"] is False
        assert data["bucket_name"] is None
        assert data["error"] == "Missing credentials"


class TestSyncConfigToGCS:
    """Tests for the sync_config_to_gcs helper function"""

    @pytest.mark.asyncio
    async def test_sync_no_service(self):
        """Test sync returns None when no GCS service"""
        from easylifeauth.api.configurations_routes import sync_config_to_gcs

        result = await sync_config_to_gcs({"key": "test"}, None)
        assert result is None

    @pytest.mark.asyncio
    async def test_sync_service_not_configured(self):
        """Test sync returns None when GCS service is not configured"""
        from easylifeauth.api.configurations_routes import sync_config_to_gcs

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = False

        result = await sync_config_to_gcs({"key": "test"}, mock_gcs)
        assert result is None

    @pytest.mark.asyncio
    async def test_sync_gcs_data_type_skipped(self):
        """Test sync returns None for GCS_DATA_TYPE configs"""
        from easylifeauth.api.configurations_routes import sync_config_to_gcs

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True

        config = {"key": "test", "type": "gcs-data"}
        result = await sync_config_to_gcs(config, mock_gcs)
        assert result is None

    @pytest.mark.asyncio
    async def test_sync_lookup_data_type(self):
        """Test sync uploads lookup data to GCS"""
        from easylifeauth.api.configurations_routes import sync_config_to_gcs

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        mock_gcs.upload_file = AsyncMock(return_value="https://storage.googleapis.com/bucket/path")

        config = {
            "config_id": "config_123",
            "key": "test-lookup",
            "type": "lookup-data",
            "lookups": {"countries": ["US", "UK"]},
            "row_update_stp": "2024-01-01T00:00:00",
        }

        result = await sync_config_to_gcs(config, mock_gcs)
        assert result is not None
        assert result["synced"] is True
        assert result["gcs_path"] == "configurations/test-lookup/config.json"

        # Verify the uploaded content contains lookups
        call_args = mock_gcs.upload_file.call_args
        uploaded_content = json.loads(call_args.kwargs["file_content"].decode("utf-8"))
        assert uploaded_content["lookups"] == {"countries": ["US", "UK"]}

    @pytest.mark.asyncio
    async def test_sync_process_type(self):
        """Test sync uploads process-config data to GCS"""
        from easylifeauth.api.configurations_routes import sync_config_to_gcs

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        mock_gcs.upload_file = AsyncMock(return_value="https://storage.googleapis.com/bucket/path")

        config = {
            "config_id": "config_proc",
            "key": "test-process",
            "type": "process-config",
            "queries": {"q1": "SELECT"},
            "logics": {"l1": "if"},
            "operations": {"o1": "insert"},
            "row_update_stp": "2024-01-01T00:00:00",
        }

        result = await sync_config_to_gcs(config, mock_gcs)
        assert result is not None
        assert result["synced"] is True

        call_args = mock_gcs.upload_file.call_args
        uploaded_content = json.loads(call_args.kwargs["file_content"].decode("utf-8"))
        assert "queries" in uploaded_content
        assert "logics" in uploaded_content
        assert "operations" in uploaded_content

    @pytest.mark.asyncio
    async def test_sync_snapshot_type(self):
        """Test sync uploads snapshot data to GCS"""
        from easylifeauth.api.configurations_routes import sync_config_to_gcs

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        mock_gcs.upload_file = AsyncMock(return_value="https://storage.googleapis.com/bucket/path")

        config = {
            "config_id": "config_snap",
            "key": "test-snapshot",
            "type": "snapshot-data",
            "data": {"snapshot_date": "2024-01-01"},
            "row_update_stp": "2024-01-01T00:00:00",
        }

        result = await sync_config_to_gcs(config, mock_gcs)
        assert result is not None
        assert result["synced"] is True

        call_args = mock_gcs.upload_file.call_args
        uploaded_content = json.loads(call_args.kwargs["file_content"].decode("utf-8"))
        assert uploaded_content["data"] == {"snapshot_date": "2024-01-01"}

    @pytest.mark.asyncio
    async def test_sync_upload_returns_none(self):
        """Test sync returns None when upload fails (returns None)"""
        from easylifeauth.api.configurations_routes import sync_config_to_gcs

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        mock_gcs.upload_file = AsyncMock(return_value=None)

        config = {
            "config_id": "config_123",
            "key": "test",
            "type": "lookup-data",
            "lookups": {},
            "row_update_stp": "2024-01-01T00:00:00",
        }

        result = await sync_config_to_gcs(config, mock_gcs)
        assert result is None

    @pytest.mark.asyncio
    async def test_sync_upload_raises_exception(self):
        """Test sync returns None when upload raises exception"""
        from easylifeauth.api.configurations_routes import sync_config_to_gcs

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        mock_gcs.upload_file = AsyncMock(side_effect=Exception("Upload error"))

        config = {
            "config_id": "config_123",
            "key": "test",
            "type": "lookup-data",
            "lookups": {},
            "row_update_stp": "2024-01-01T00:00:00",
        }

        result = await sync_config_to_gcs(config, mock_gcs)
        assert result is None


class TestConfigurationUpload:
    """Tests for configuration file upload endpoint"""

    @pytest.fixture
    def app(self):
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.configurations = MagicMock()
        return db

    @pytest.fixture
    def mock_super_admin(self):
        user = MagicMock()
        user.email = "admin@test.com"
        user.roles = ["super-administrator"]
        return user

    @pytest.fixture
    def client(self, app, mock_db, mock_super_admin):
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        return TestClient(app)

    def test_upload_json_new_config_lookup(self, client, mock_db):
        """Test uploading a JSON file creates new lookup configuration"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)
        mock_db.configurations.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        mock_db.configurations.update_one = AsyncMock()

        json_data = json.dumps({"lookups": {"countries": ["US", "UK"]}}).encode("utf-8")

        with patch("easylifeauth.api.configurations_routes._gcs_service", None):
            with patch("easylifeauth.api.configurations_routes.sync_config_to_gcs", new_callable=AsyncMock, return_value=None):
                with patch("easylifeauth.utils.file_validation.validate_upload"):
                    response = client.post(
                        "/configurations/upload",
                        data={"key": "new-lookup"},
                        files={"file": ("lookups.json", io.BytesIO(json_data), "application/json")},
                    )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Configuration created from JSON file"
        assert data["key"] == "new-lookup"
        assert data["file_name"] == "lookups.json"

    def test_upload_json_new_config_process(self, client, mock_db):
        """Test uploading a JSON file with queries/logics creates process config"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)
        mock_db.configurations.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        mock_db.configurations.update_one = AsyncMock()

        json_data = json.dumps({
            "queries": {"q1": "SELECT *"},
            "logics": {"l1": "if true"},
        }).encode("utf-8")

        with patch("easylifeauth.api.configurations_routes._gcs_service", None):
            with patch("easylifeauth.api.configurations_routes.sync_config_to_gcs", new_callable=AsyncMock, return_value=None):
                with patch("easylifeauth.utils.file_validation.validate_upload"):
                    response = client.post(
                        "/configurations/upload",
                        data={"key": "new-process"},
                        files={"file": ("process.json", io.BytesIO(json_data), "application/json")},
                    )

        assert response.status_code == 200

    def test_upload_json_new_config_snapshot(self, client, mock_db):
        """Test uploading a JSON file with data creates snapshot config"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)
        mock_db.configurations.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        mock_db.configurations.update_one = AsyncMock()

        json_data = json.dumps({"data": {"snapshot": "2024-01-01"}}).encode("utf-8")

        with patch("easylifeauth.api.configurations_routes._gcs_service", None):
            with patch("easylifeauth.api.configurations_routes.sync_config_to_gcs", new_callable=AsyncMock, return_value=None):
                with patch("easylifeauth.utils.file_validation.validate_upload"):
                    response = client.post(
                        "/configurations/upload",
                        data={"key": "new-snapshot"},
                        files={"file": ("snapshot.json", io.BytesIO(json_data), "application/json")},
                    )

        assert response.status_code == 200

    def test_upload_json_new_config_unknown_structure(self, client, mock_db):
        """Test uploading JSON without standard keys wraps data in snapshot"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)
        mock_db.configurations.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        mock_db.configurations.update_one = AsyncMock()

        json_data = json.dumps({"custom_field": "value"}).encode("utf-8")

        with patch("easylifeauth.api.configurations_routes._gcs_service", None):
            with patch("easylifeauth.api.configurations_routes.sync_config_to_gcs", new_callable=AsyncMock, return_value=None):
                with patch("easylifeauth.utils.file_validation.validate_upload"):
                    response = client.post(
                        "/configurations/upload",
                        data={"key": "new-custom"},
                        files={"file": ("custom.json", io.BytesIO(json_data), "application/json")},
                    )

        assert response.status_code == 200

    def test_upload_json_existing_config_update(self, client, mock_db):
        """Test uploading JSON file updates existing configuration"""
        existing = {
            "_id": ObjectId(),
            "config_id": "config_existing",
            "key": "existing-config",
            "type": "lookup-data",
        }

        # find_one: (1) check existing by key -> found, (2) after update for sync
        mock_db.configurations.find_one = AsyncMock(
            side_effect=[existing.copy(), existing.copy()]
        )
        mock_db.configurations.update_one = AsyncMock()

        json_data = json.dumps({"lookups": {"updated": True}}).encode("utf-8")

        with patch("easylifeauth.api.configurations_routes._gcs_service", None):
            with patch("easylifeauth.api.configurations_routes.sync_config_to_gcs", new_callable=AsyncMock, return_value=None):
                with patch("easylifeauth.utils.file_validation.validate_upload"):
                    response = client.post(
                        "/configurations/upload",
                        data={"key": "existing-config"},
                        files={"file": ("updated.json", io.BytesIO(json_data), "application/json")},
                    )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Configuration updated from JSON file"

    def test_upload_json_with_explicit_type(self, client, mock_db):
        """Test uploading JSON with explicit config_type parameter"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)
        mock_db.configurations.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        mock_db.configurations.update_one = AsyncMock()

        json_data = json.dumps({"arbitrary": "data"}).encode("utf-8")

        with patch("easylifeauth.api.configurations_routes._gcs_service", None):
            with patch("easylifeauth.api.configurations_routes.sync_config_to_gcs", new_callable=AsyncMock, return_value=None):
                with patch("easylifeauth.utils.file_validation.validate_upload"):
                    response = client.post(
                        "/configurations/upload",
                        data={"key": "typed-config", "config_type": "process-config"},
                        files={"file": ("config.json", io.BytesIO(json_data), "application/json")},
                    )

        assert response.status_code == 200

    def test_upload_invalid_json(self, client, mock_db):
        """Test uploading invalid JSON file returns 400"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)

        invalid_json = b"{ not valid json }"

        with patch("easylifeauth.utils.file_validation.validate_upload"):
            response = client.post(
                "/configurations/upload",
                data={"key": "bad-json"},
                files={"file": ("bad.json", io.BytesIO(invalid_json), "application/json")},
            )

        assert response.status_code == 400
        assert "Invalid JSON" in response.json()["detail"]

    def test_upload_xlsx_no_gcs_configured(self, client, mock_db):
        """Test uploading XLSX file without GCS configured returns 400"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)

        xlsx_content = b"PK\x03\x04fake xlsx content"

        with patch("easylifeauth.api.configurations_routes._gcs_service", None):
            with patch("easylifeauth.utils.file_validation.validate_upload"):
                response = client.post(
                    "/configurations/upload",
                    data={"key": "xlsx-config"},
                    files={"file": ("data.xlsx", io.BytesIO(xlsx_content), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                )

        assert response.status_code == 400
        assert "GCS is not configured" in response.json()["detail"]

    def test_upload_xlsx_new_config_with_gcs(self, client, mock_db):
        """Test uploading XLSX file creates new GCS config"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)
        mock_db.configurations.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))

        xlsx_content = b"PK\x03\x04fake xlsx content"

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        mock_gcs.bucket_name = "test-bucket"
        mock_gcs.upload_file = AsyncMock(return_value="https://storage.googleapis.com/test-bucket/path")

        with patch("easylifeauth.api.configurations_routes._gcs_service", mock_gcs):
            with patch("easylifeauth.utils.file_validation.validate_upload"):
                response = client.post(
                    "/configurations/upload",
                    data={"key": "xlsx-config"},
                    files={"file": ("data.xlsx", io.BytesIO(xlsx_content), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                )

        assert response.status_code == 200
        data = response.json()
        assert "uploaded successfully" in data["message"]
        assert data["version"] == 1
        assert data["key"] == "xlsx-config"

    def test_upload_xlsx_existing_config_increments_version(self, client, mock_db):
        """Test uploading XLSX file to existing config increments version"""
        existing = {
            "_id": ObjectId(),
            "config_id": "config_xlsx",
            "key": "xlsx-config",
            "type": "gcs-data",
            "gcs": {
                "current_version": 2,
                "versions": [
                    {"version": 1, "gcs_key": "v1_data.xlsx"},
                    {"version": 2, "gcs_key": "v2_data.xlsx"},
                ],
            },
        }

        mock_db.configurations.find_one = AsyncMock(return_value=existing.copy())
        mock_db.configurations.update_one = AsyncMock()

        xlsx_content = b"PK\x03\x04fake xlsx content"

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        mock_gcs.bucket_name = "test-bucket"
        mock_gcs.upload_file = AsyncMock(return_value="https://storage.googleapis.com/test-bucket/path")

        with patch("easylifeauth.api.configurations_routes._gcs_service", mock_gcs):
            with patch("easylifeauth.utils.file_validation.validate_upload"):
                response = client.post(
                    "/configurations/upload",
                    data={"key": "xlsx-config"},
                    files={"file": ("data.xlsx", io.BytesIO(xlsx_content), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                )

        assert response.status_code == 200
        data = response.json()
        assert data["version"] == 3

    def test_upload_xlsx_gcs_upload_fails(self, client, mock_db):
        """Test uploading XLSX file when GCS upload fails returns 500"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)

        xlsx_content = b"PK\x03\x04fake xlsx content"

        mock_gcs = MagicMock()
        mock_gcs.is_configured.return_value = True
        mock_gcs.bucket_name = "test-bucket"
        mock_gcs.upload_file = AsyncMock(return_value=None)

        with patch("easylifeauth.api.configurations_routes._gcs_service", mock_gcs):
            with patch("easylifeauth.utils.file_validation.validate_upload"):
                response = client.post(
                    "/configurations/upload",
                    data={"key": "failing-xlsx"},
                    files={"file": ("data.xlsx", io.BytesIO(xlsx_content), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                )

        assert response.status_code == 500
        assert "Failed to upload" in response.json()["detail"]

    def test_upload_json_with_gcs_sync(self, client, mock_db):
        """Test uploading JSON file triggers GCS sync when configured"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)
        mock_db.configurations.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        mock_db.configurations.update_one = AsyncMock()

        json_data = json.dumps({"lookups": {"synced": True}}).encode("utf-8")

        sync_result = {
            "synced": True,
            "gcs_path": "configurations/synced-config/config.json",
            "sync_date": "2024-01-01T00:00:00",
        }

        with patch("easylifeauth.api.configurations_routes.sync_config_to_gcs", new_callable=AsyncMock, return_value=sync_result):
            with patch("easylifeauth.utils.file_validation.validate_upload"):
                response = client.post(
                    "/configurations/upload",
                    data={"key": "synced-config"},
                    files={"file": ("synced.json", io.BytesIO(json_data), "application/json")},
                )

        assert response.status_code == 200
        data = response.json()
        assert data["gcs_key"] == "configurations/synced-config/config.json"


class TestCreateConfigurationGCSSync:
    """Tests for create configuration with GCS sync behavior"""

    @pytest.fixture
    def app(self):
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.configurations = MagicMock()
        return db

    @pytest.fixture
    def mock_super_admin(self):
        user = MagicMock()
        user.email = "admin@test.com"
        user.roles = ["super-administrator"]
        return user

    @pytest.fixture
    def client(self, app, mock_db, mock_super_admin):
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        return TestClient(app)

    def test_create_configuration_with_gcs_sync(self, client, mock_db):
        """Test creating a configuration triggers GCS sync for non-GCS types"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)
        mock_db.configurations.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        mock_db.configurations.update_one = AsyncMock()

        sync_result = {
            "synced": True,
            "gcs_path": "configurations/new-config/config.json",
            "sync_date": "2024-01-01T00:00:00",
        }

        with patch("easylifeauth.api.configurations_routes.sync_config_to_gcs", new_callable=AsyncMock, return_value=sync_result) as mock_sync:
            response = client.post(
                "/configurations",
                json={"key": "new-config", "type": "lookup-data"}
            )

        assert response.status_code == 200
        mock_sync.assert_called_once()
        # Verify GCS sync info was persisted
        mock_db.configurations.update_one.assert_called_once()

    def test_create_gcs_data_type_skips_sync(self, client, mock_db):
        """Test creating GCS_DATA_TYPE configuration skips sync"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)
        mock_db.configurations.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))

        with patch("easylifeauth.api.configurations_routes.sync_config_to_gcs", new_callable=AsyncMock) as mock_sync:
            response = client.post(
                "/configurations",
                json={"key": "gcs-config", "type": "gcs-data"}
            )

        assert response.status_code == 200
        mock_sync.assert_not_called()

    def test_create_configuration_with_all_fields(self, client, mock_db):
        """Test creating a configuration with all optional fields populated"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)
        mock_db.configurations.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))

        with patch("easylifeauth.api.configurations_routes._gcs_service", None):
            response = client.post(
                "/configurations",
                json={
                    "key": "full-config",
                    "type": "process-config",
                    "lookups": {"a": 1},
                    "queries": {"b": 2},
                    "logics": {"c": 3},
                    "operations": {"d": 4},
                    "data": {"e": 5},
                }
            )

        assert response.status_code == 200
        data = response.json()
        assert data["lookups"] == {"a": 1}
        assert data["queries"] == {"b": 2}
        assert data["logics"] == {"c": 3}
        assert data["operations"] == {"d": 4}
        assert data["data"] == {"e": 5}

    def test_create_configuration_fields_default_to_empty_dict(self, client, mock_db):
        """Test creating a configuration without optional fields defaults them to empty dicts"""
        mock_db.configurations.find_one = AsyncMock(return_value=None)
        mock_db.configurations.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))

        with patch("easylifeauth.api.configurations_routes._gcs_service", None):
            response = client.post(
                "/configurations",
                json={"key": "minimal-config", "type": "lookup-data"}
            )

        assert response.status_code == 200
        data = response.json()
        assert data["lookups"] == {}
        assert data["queries"] == {}
        assert data["logics"] == {}
        assert data["operations"] == {}
        assert data["data"] == {}


class TestUpdateConfigurationGCSSync:
    """Tests for update configuration with GCS sync behavior"""

    @pytest.fixture
    def app(self):
        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.configurations = MagicMock()
        return db

    @pytest.fixture
    def mock_super_admin(self):
        user = MagicMock()
        user.email = "admin@test.com"
        user.roles = ["super-administrator"]
        return user

    @pytest.fixture
    def client(self, app, mock_db, mock_super_admin):
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_super_admin] = lambda: mock_super_admin
        return TestClient(app)

    def test_update_configuration_with_gcs_sync(self, client, mock_db):
        """Test updating a configuration triggers GCS sync"""
        config_id = ObjectId()
        existing = {
            "_id": config_id,
            "config_id": "config_123",
            "key": "test-config",
            "type": "lookup-data",
            "lookups": {},
            "queries": {},
            "logics": {},
            "operations": {},
            "data": {},
        }
        updated = existing.copy()
        updated["lookups"] = {"new": "data"}

        # find_one: (1) find existing, (2) return updated config after update
        mock_db.configurations.find_one = AsyncMock(
            side_effect=[existing.copy(), updated.copy()]
        )
        mock_db.configurations.update_one = AsyncMock()

        sync_result = {
            "synced": True,
            "gcs_path": "configurations/test-config/config.json",
            "sync_date": "2024-01-01T00:00:00",
        }

        with patch("easylifeauth.api.configurations_routes.sync_config_to_gcs", new_callable=AsyncMock, return_value=sync_result) as mock_sync:
            response = client.put(
                "/configurations/config_123",
                json={"lookups": {"new": "data"}}
            )

        assert response.status_code == 200
        mock_sync.assert_called_once()
        # update_one called twice: once for update, once for gcs_sync
        assert mock_db.configurations.update_one.call_count == 2

    def test_update_gcs_data_type_skips_sync(self, client, mock_db):
        """Test updating GCS_DATA_TYPE configuration skips sync"""
        config_id = ObjectId()
        existing = {
            "_id": config_id,
            "config_id": "config_gcs",
            "key": "gcs-config",
            "type": "gcs-data",
            "lookups": {},
            "queries": {},
            "logics": {},
            "operations": {},
            "data": {},
        }
        updated = existing.copy()

        mock_db.configurations.find_one = AsyncMock(
            side_effect=[existing.copy(), updated.copy()]
        )
        mock_db.configurations.update_one = AsyncMock()

        with patch("easylifeauth.api.configurations_routes.sync_config_to_gcs", new_callable=AsyncMock) as mock_sync:
            response = client.put(
                "/configurations/config_gcs",
                json={"data": {"updated": True}}
            )

        assert response.status_code == 200
        mock_sync.assert_not_called()
