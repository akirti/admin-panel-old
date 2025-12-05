"""
Comprehensive tests for configurations API with 100% coverage.
"""
import pytest
import json
from datetime import datetime
from unittest.mock import patch, AsyncMock, MagicMock
from io import BytesIO


class TestConfigurationsAPI:
    """Test configurations endpoints."""

    @pytest.fixture
    async def sample_config(self, mock_db) -> dict:
        """Create sample configuration for testing."""
        config_data = {
            "config_id": "config_test123",
            "type": "process-config",
            "key": "test-process-config",
            "queries": {"query1": "SELECT * FROM table"},
            "logics": {"logic1": "some logic"},
            "operations": {"op1": "some operation"},
            "row_add_userid": "admin@test.com",
            "row_add_stp": datetime.utcnow().isoformat(),
            "row_update_userid": "admin@test.com",
            "row_update_stp": datetime.utcnow().isoformat(),
        }
        result = await mock_db["configurations"].insert_one(config_data)
        config_data["_id"] = str(result.inserted_id)
        return config_data

    @pytest.fixture
    async def sample_lookup_config(self, mock_db) -> dict:
        """Create sample lookup configuration."""
        config_data = {
            "config_id": "config_lookup123",
            "type": "lookup-data",
            "key": "test-lookup-config",
            "lookups": {"key1": "value1", "key2": "value2"},
            "row_add_userid": "admin@test.com",
            "row_add_stp": datetime.utcnow().isoformat(),
            "row_update_userid": "admin@test.com",
            "row_update_stp": datetime.utcnow().isoformat(),
        }
        result = await mock_db["configurations"].insert_one(config_data)
        config_data["_id"] = str(result.inserted_id)
        return config_data

    @pytest.fixture
    async def sample_snapshot_config(self, mock_db) -> dict:
        """Create sample snapshot configuration."""
        config_data = {
            "config_id": "config_snapshot123",
            "type": "snapshot-data",
            "key": "test-snapshot-config",
            "data": {"snapshot": {"field1": "data1"}},
            "row_add_userid": "admin@test.com",
            "row_add_stp": datetime.utcnow().isoformat(),
            "row_update_userid": "admin@test.com",
            "row_update_stp": datetime.utcnow().isoformat(),
        }
        result = await mock_db["configurations"].insert_one(config_data)
        config_data["_id"] = str(result.inserted_id)
        return config_data

    @pytest.fixture
    async def sample_gcs_config(self, mock_db) -> dict:
        """Create sample GCS configuration."""
        config_data = {
            "config_id": "config_gcs123",
            "type": "gcs-data",
            "key": "test-gcs-config",
            "gcs": {
                "bucket": "test-bucket",
                "file_name": "test.xlsx",
                "gcs_key": "configurations/test-gcs-config/v1_test.xlsx",
                "version": 1,
                "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "size": 1024,
                "upload_date": datetime.utcnow().isoformat(),
                "current_version": 1,
                "current_gcs_key": "configurations/test-gcs-config/v1_test.xlsx",
                "versioned": True,
                "versions": [
                    {
                        "bucket": "test-bucket",
                        "file_name": "test.xlsx",
                        "gcs_key": "configurations/test-gcs-config/v1_test.xlsx",
                        "version": 1,
                        "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        "size": 1024,
                        "upload_date": datetime.utcnow().isoformat(),
                    }
                ],
            },
            "row_add_userid": "admin@test.com",
            "row_add_stp": datetime.utcnow().isoformat(),
            "row_update_userid": "admin@test.com",
            "row_update_stp": datetime.utcnow().isoformat(),
        }
        result = await mock_db["configurations"].insert_one(config_data)
        config_data["_id"] = str(result.inserted_id)
        return config_data

    # List configurations tests
    async def test_list_configurations(self, app_client, admin_headers, sample_config):
        """Test listing all configurations."""
        response = await app_client.get("/api/configurations", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(c["config_id"] == "config_test123" for c in data)

    async def test_list_configurations_by_type(self, app_client, admin_headers, sample_config, sample_lookup_config):
        """Test listing configurations filtered by type."""
        response = await app_client.get(
            "/api/configurations?type=process-config",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert all(c["type"] == "process-config" for c in data)

    async def test_list_configurations_with_search(self, app_client, admin_headers, sample_config):
        """Test listing configurations with search."""
        response = await app_client.get(
            "/api/configurations?search=test-process",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    async def test_list_configurations_pagination(self, app_client, admin_headers, sample_config):
        """Test configurations pagination."""
        response = await app_client.get(
            "/api/configurations?skip=0&limit=10",
            headers=admin_headers
        )
        assert response.status_code == 200

    async def test_list_configurations_unauthorized(self, app_client):
        """Test listing configurations without auth."""
        response = await app_client.get("/api/configurations")
        assert response.status_code == 401

    # Get configuration tests
    async def test_get_configuration_by_config_id(self, app_client, admin_headers, sample_config):
        """Test getting configuration by config_id."""
        response = await app_client.get(
            f"/api/configurations/{sample_config['config_id']}",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["config_id"] == sample_config["config_id"]

    async def test_get_configuration_by_object_id(self, app_client, admin_headers, sample_config):
        """Test getting configuration by MongoDB ObjectId."""
        response = await app_client.get(
            f"/api/configurations/{sample_config['_id']}",
            headers=admin_headers
        )
        assert response.status_code == 200

    async def test_get_configuration_not_found(self, app_client, admin_headers):
        """Test getting non-existent configuration."""
        response = await app_client.get(
            "/api/configurations/nonexistent-id",
            headers=admin_headers
        )
        assert response.status_code == 404

    # Count configurations tests
    async def test_count_configurations(self, app_client, admin_headers, sample_config):
        """Test counting configurations."""
        response = await app_client.get("/api/configurations/count", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "count" in data
        assert data["count"] >= 1

    async def test_count_configurations_by_type(self, app_client, admin_headers, sample_config):
        """Test counting configurations by type."""
        response = await app_client.get(
            "/api/configurations/count?type=process-config",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "count" in data

    # Get types tests
    async def test_get_configuration_types(self, app_client, admin_headers):
        """Test getting available configuration types."""
        response = await app_client.get("/api/configurations/types", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert "types" in data
        assert len(data["types"]) > 0

    # Create configuration tests
    async def test_create_process_config(self, app_client, admin_headers):
        """Test creating process configuration."""
        config_data = {
            "type": "process-config",
            "key": "new-process-config",
            "queries": {"q1": "SELECT 1"},
            "logics": {"l1": "logic"},
            "operations": {"o1": "op"},
        }
        response = await app_client.post(
            "/api/configurations",
            json=config_data,
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["key"] == "new-process-config"
        assert data["type"] == "process-config"

    async def test_create_lookup_config(self, app_client, admin_headers):
        """Test creating lookup configuration."""
        config_data = {
            "type": "lookup-data",
            "key": "new-lookup-config",
            "lookups": {"key1": "value1"},
        }
        response = await app_client.post(
            "/api/configurations",
            json=config_data,
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "lookup-data"

    async def test_create_snapshot_config(self, app_client, admin_headers):
        """Test creating snapshot configuration."""
        config_data = {
            "type": "snapshot-data",
            "key": "new-snapshot-config",
            "data": {"field": "value"},
        }
        response = await app_client.post(
            "/api/configurations",
            json=config_data,
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "snapshot-data"

    async def test_create_gcs_config(self, app_client, admin_headers):
        """Test creating GCS configuration."""
        config_data = {
            "type": "gcs-data",
            "key": "new-gcs-config",
        }
        response = await app_client.post(
            "/api/configurations",
            json=config_data,
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "gcs-data"

    async def test_create_config_duplicate_key(self, app_client, admin_headers, sample_config):
        """Test creating configuration with duplicate key."""
        config_data = {
            "type": "process-config",
            "key": sample_config["key"],
        }
        response = await app_client.post(
            "/api/configurations",
            json=config_data,
            headers=admin_headers
        )
        assert response.status_code == 400

    # Update configuration tests
    async def test_update_configuration(self, app_client, admin_headers, sample_config):
        """Test updating configuration."""
        update_data = {
            "queries": {"updated_query": "SELECT 2"},
        }
        response = await app_client.put(
            f"/api/configurations/{sample_config['config_id']}",
            json=update_data,
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "updated_query" in data.get("queries", {})

    async def test_update_configuration_key(self, app_client, admin_headers, sample_config):
        """Test updating configuration key."""
        update_data = {
            "key": "updated-config-key",
        }
        response = await app_client.put(
            f"/api/configurations/{sample_config['config_id']}",
            json=update_data,
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["key"] == "updated-config-key"

    async def test_update_configuration_not_found(self, app_client, admin_headers):
        """Test updating non-existent configuration."""
        response = await app_client.put(
            "/api/configurations/nonexistent-id",
            json={"key": "test"},
            headers=admin_headers
        )
        assert response.status_code == 404

    async def test_update_configuration_duplicate_key(self, app_client, admin_headers, sample_config, sample_lookup_config):
        """Test updating configuration with duplicate key."""
        update_data = {
            "key": sample_lookup_config["key"],
        }
        response = await app_client.put(
            f"/api/configurations/{sample_config['config_id']}",
            json=update_data,
            headers=admin_headers
        )
        assert response.status_code == 400

    # Delete configuration tests
    async def test_delete_configuration(self, app_client, admin_headers, sample_config):
        """Test deleting configuration."""
        response = await app_client.delete(
            f"/api/configurations/{sample_config['config_id']}",
            headers=admin_headers
        )
        assert response.status_code == 200

    async def test_delete_configuration_not_found(self, app_client, admin_headers):
        """Test deleting non-existent configuration."""
        response = await app_client.delete(
            "/api/configurations/nonexistent-id",
            headers=admin_headers
        )
        assert response.status_code == 404

    # File upload tests
    async def test_upload_json_process_config(self, app_client, admin_headers, mock_gcs_service):
        """Test uploading JSON file as process config."""
        json_content = {
            "queries": {"q1": "SELECT * FROM users"},
            "logics": {"l1": "business logic"},
            "operations": {"o1": "operation"}
        }
        files = {
            "file": ("config.json", json.dumps(json_content).encode(), "application/json")
        }
        response = await app_client.post(
            "/api/configurations/upload?key=upload-process-config",
            files=files,
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["key"] == "upload-process-config"

    async def test_upload_json_lookup_config(self, app_client, admin_headers, mock_gcs_service):
        """Test uploading JSON file as lookup config."""
        json_content = {
            "lookups": {"key1": "value1", "key2": "value2"}
        }
        files = {
            "file": ("config.json", json.dumps(json_content).encode(), "application/json")
        }
        response = await app_client.post(
            "/api/configurations/upload?key=upload-lookup-config",
            files=files,
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "lookup" in data["key"] or data["config_id"]

    async def test_upload_json_snapshot_config(self, app_client, admin_headers, mock_gcs_service):
        """Test uploading JSON file as snapshot config."""
        json_content = {
            "data": {"snapshot_field": "snapshot_value"}
        }
        files = {
            "file": ("config.json", json.dumps(json_content).encode(), "application/json")
        }
        response = await app_client.post(
            "/api/configurations/upload?key=upload-snapshot-config",
            files=files,
            headers=admin_headers
        )
        assert response.status_code == 200

    async def test_upload_json_auto_type_detection(self, app_client, admin_headers, mock_gcs_service):
        """Test uploading JSON with automatic type detection."""
        json_content = {"custom_field": "custom_value"}
        files = {
            "file": ("config.json", json.dumps(json_content).encode(), "application/json")
        }
        response = await app_client.post(
            "/api/configurations/upload?key=upload-auto-config",
            files=files,
            headers=admin_headers
        )
        assert response.status_code == 200

    async def test_upload_json_with_explicit_type(self, app_client, admin_headers, mock_gcs_service):
        """Test uploading JSON with explicit type."""
        json_content = {"field": "value"}
        files = {
            "file": ("config.json", json.dumps(json_content).encode(), "application/json")
        }
        response = await app_client.post(
            "/api/configurations/upload?key=upload-explicit-type&config_type=snapshot-data",
            files=files,
            headers=admin_headers
        )
        assert response.status_code == 200

    async def test_upload_json_update_existing(self, app_client, admin_headers, sample_config, mock_gcs_service):
        """Test uploading JSON to update existing config."""
        json_content = {
            "queries": {"updated": "SELECT 99"},
            "logics": {"updated": "new logic"},
            "operations": {"updated": "new op"}
        }
        files = {
            "file": ("config.json", json.dumps(json_content).encode(), "application/json")
        }
        response = await app_client.post(
            f"/api/configurations/upload?key={sample_config['key']}",
            files=files,
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "updated" in data["message"].lower()

    async def test_upload_invalid_json(self, app_client, admin_headers):
        """Test uploading invalid JSON file."""
        files = {
            "file": ("config.json", b"invalid json {{{", "application/json")
        }
        response = await app_client.post(
            "/api/configurations/upload?key=invalid-json-config",
            files=files,
            headers=admin_headers
        )
        assert response.status_code == 400

    async def test_upload_invalid_file_type(self, app_client, admin_headers):
        """Test uploading invalid file type."""
        files = {
            "file": ("config.txt", b"text content", "text/plain")
        }
        response = await app_client.post(
            "/api/configurations/upload?key=invalid-type-config",
            files=files,
            headers=admin_headers
        )
        assert response.status_code == 400

    async def test_upload_xlsx_file(self, app_client, admin_headers, mock_gcs_service):
        """Test uploading XLSX file."""
        # Mock XLSX content
        xlsx_content = b"PK\x03\x04..."  # XLSX magic bytes
        files = {
            "file": ("data.xlsx", xlsx_content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        }
        response = await app_client.post(
            "/api/configurations/upload?key=upload-xlsx-config",
            files=files,
            headers=admin_headers
        )
        assert response.status_code == 200

    async def test_upload_csv_file(self, app_client, admin_headers, mock_gcs_service):
        """Test uploading CSV file."""
        csv_content = b"col1,col2,col3\nval1,val2,val3"
        files = {
            "file": ("data.csv", csv_content, "text/csv")
        }
        response = await app_client.post(
            "/api/configurations/upload?key=upload-csv-config",
            files=files,
            headers=admin_headers
        )
        assert response.status_code == 200

    async def test_upload_binary_without_gcs(self, app_client, admin_headers):
        """Test uploading binary file without GCS configured."""
        with patch('app.routers.configurations.gcs_service') as mock_gcs:
            mock_gcs.is_configured.return_value = False
            csv_content = b"col1,col2\nval1,val2"
            files = {
                "file": ("data.csv", csv_content, "text/csv")
            }
            response = await app_client.post(
                "/api/configurations/upload?key=no-gcs-config",
                files=files,
                headers=admin_headers
            )
            assert response.status_code == 400

    async def test_upload_binary_update_existing(self, app_client, admin_headers, sample_gcs_config, mock_gcs_service):
        """Test uploading binary to update existing GCS config."""
        csv_content = b"updated,data\n1,2"
        files = {
            "file": ("updated.csv", csv_content, "text/csv")
        }
        response = await app_client.post(
            f"/api/configurations/upload?key={sample_gcs_config['key']}",
            files=files,
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == 2

    # Download tests
    async def test_download_process_config(self, app_client, admin_headers, sample_config):
        """Test downloading process configuration."""
        response = await app_client.get(
            f"/api/configurations/{sample_config['config_id']}/download",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "queries" in data

    async def test_download_lookup_config(self, app_client, admin_headers, sample_lookup_config):
        """Test downloading lookup configuration."""
        response = await app_client.get(
            f"/api/configurations/{sample_lookup_config['config_id']}/download",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "lookups" in data

    async def test_download_snapshot_config(self, app_client, admin_headers, sample_snapshot_config):
        """Test downloading snapshot configuration."""
        response = await app_client.get(
            f"/api/configurations/{sample_snapshot_config['config_id']}/download",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "data" in data

    async def test_download_gcs_config(self, app_client, admin_headers, sample_gcs_config, mock_gcs_service):
        """Test downloading GCS configuration."""
        mock_gcs_service.download_file.return_value = b"file content"
        response = await app_client.get(
            f"/api/configurations/{sample_gcs_config['config_id']}/download",
            headers=admin_headers
        )
        assert response.status_code == 200

    async def test_download_gcs_specific_version(self, app_client, admin_headers, sample_gcs_config, mock_gcs_service):
        """Test downloading specific version of GCS config."""
        mock_gcs_service.download_file.return_value = b"file content v1"
        response = await app_client.get(
            f"/api/configurations/{sample_gcs_config['config_id']}/download?version=1",
            headers=admin_headers
        )
        assert response.status_code == 200

    async def test_download_gcs_version_not_found(self, app_client, admin_headers, sample_gcs_config):
        """Test downloading non-existent version."""
        response = await app_client.get(
            f"/api/configurations/{sample_gcs_config['config_id']}/download?version=999",
            headers=admin_headers
        )
        assert response.status_code == 404

    async def test_download_config_not_found(self, app_client, admin_headers):
        """Test downloading non-existent config."""
        response = await app_client.get(
            "/api/configurations/nonexistent/download",
            headers=admin_headers
        )
        assert response.status_code == 404

    # Versions tests
    async def test_get_versions_gcs_config(self, app_client, admin_headers, sample_gcs_config):
        """Test getting versions of GCS configuration."""
        response = await app_client.get(
            f"/api/configurations/{sample_gcs_config['config_id']}/versions",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "versions" in data
        assert len(data["versions"]) >= 1

    async def test_get_versions_non_gcs_config(self, app_client, admin_headers, sample_config):
        """Test getting versions of non-GCS configuration."""
        response = await app_client.get(
            f"/api/configurations/{sample_config['config_id']}/versions",
            headers=admin_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["versions"] == []

    async def test_get_versions_not_found(self, app_client, admin_headers):
        """Test getting versions of non-existent config."""
        response = await app_client.get(
            "/api/configurations/nonexistent/versions",
            headers=admin_headers
        )
        assert response.status_code == 404


class TestConfigurationsEdgeCases:
    """Test edge cases and error handling."""

    async def test_user_cannot_access_configurations(self, app_client, user_headers):
        """Test that regular users cannot access configurations."""
        response = await app_client.get("/api/configurations", headers=user_headers)
        assert response.status_code == 403

    async def test_upload_empty_file(self, app_client, admin_headers):
        """Test uploading empty file."""
        files = {
            "file": ("empty.json", b"", "application/json")
        }
        response = await app_client.post(
            "/api/configurations/upload?key=empty-config",
            files=files,
            headers=admin_headers
        )
        assert response.status_code == 400

    async def test_upload_large_file(self, app_client, admin_headers, mock_gcs_service):
        """Test uploading large JSON file."""
        large_data = {"data": "x" * 10000}
        files = {
            "file": ("large.json", json.dumps(large_data).encode(), "application/json")
        }
        response = await app_client.post(
            "/api/configurations/upload?key=large-config",
            files=files,
            headers=admin_headers
        )
        assert response.status_code == 200

    async def test_update_all_fields(self, app_client, admin_headers, mock_db):
        """Test updating all configuration fields."""
        # Create config first
        config_data = {
            "config_id": "config_update_all",
            "type": "process-config",
            "key": "update-all-fields",
            "queries": {},
            "logics": {},
            "operations": {},
            "row_add_userid": "admin@test.com",
            "row_add_stp": datetime.utcnow().isoformat(),
            "row_update_userid": "admin@test.com",
            "row_update_stp": datetime.utcnow().isoformat(),
        }
        await mock_db["configurations"].insert_one(config_data)

        update_data = {
            "key": "updated-all-fields",
            "type": "lookup-data",
            "queries": {"new": "query"},
            "logics": {"new": "logic"},
            "operations": {"new": "op"},
            "lookups": {"new": "lookup"},
            "data": {"new": "data"},
        }
        response = await app_client.put(
            "/api/configurations/config_update_all",
            json=update_data,
            headers=admin_headers
        )
        assert response.status_code == 200
