"""
Tests for domains, scenarios, and playboards endpoints.
"""
import pytest
from httpx import AsyncClient
import json
from io import BytesIO


class TestDomains:
    """Test domain management endpoints."""
    
    @pytest.mark.asyncio
    async def test_list_domains(self, app_client: AsyncClient, admin_headers: dict, sample_domain):
        """Test listing domains."""
        response = await app_client.get("/api/domains", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    @pytest.mark.asyncio
    async def test_count_domains(self, app_client: AsyncClient, admin_headers: dict, sample_domain):
        """Test counting domains."""
        response = await app_client.get("/api/domains/count", headers=admin_headers)
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_get_domain(self, app_client: AsyncClient, admin_headers: dict, sample_domain):
        """Test getting a specific domain."""
        response = await app_client.get(
            f"/api/domains/{sample_domain['key']}",
            headers=admin_headers
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_create_domain(self, app_client: AsyncClient, admin_headers: dict):
        """Test creating a domain."""
        response = await app_client.post(
            "/api/domains",
            headers=admin_headers,
            json={
                "type": "custom",
                "key": "new-domain-123",
                "name": "New Domain",
                "description": "A new domain",
                "path": "/new-domain",
                "status": "active",
                "order": 1,
                "subDomains": []
            }
        )
        assert response.status_code == 201
    
    @pytest.mark.asyncio
    async def test_update_domain(self, app_client: AsyncClient, admin_headers: dict, sample_domain):
        """Test updating a domain."""
        response = await app_client.put(
            f"/api/domains/{sample_domain['key']}",
            headers=admin_headers,
            json={"name": "Updated Domain"}
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_delete_domain(self, app_client: AsyncClient, admin_headers: dict, mock_db):
        """Test deleting a domain."""
        from datetime import datetime
        
        await mock_db["domains"].insert_one({
            "type": "custom",
            "key": "to-delete-domain",
            "name": "To Delete",
            "path": "/delete",
            "status": "active",
            "order": 1,
            "subDomains": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        })
        
        response = await app_client.delete(
            "/api/domains/to-delete-domain",
            headers=admin_headers
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_toggle_domain_status(self, app_client: AsyncClient, admin_headers: dict, sample_domain):
        """Test toggling domain status."""
        response = await app_client.post(
            f"/api/domains/{sample_domain['key']}/toggle-status",
            headers=admin_headers
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_add_subdomain(self, app_client: AsyncClient, admin_headers: dict, sample_domain):
        """Test adding a subdomain."""
        response = await app_client.post(
            f"/api/domains/{sample_domain['key']}/subdomains",
            headers=admin_headers,
            json={
                "key": "subdomain-1",
                "name": "Subdomain 1",
                "path": "/subdomain-1",
                "status": "active",
                "order": 1
            }
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_get_domain_scenarios(self, app_client: AsyncClient, admin_headers: dict, sample_domain, sample_scenario):
        """Test getting scenarios for a domain."""
        response = await app_client.get(
            f"/api/domains/{sample_domain['key']}/scenarios",
            headers=admin_headers
        )
        assert response.status_code == 200


class TestDomainScenarios:
    """Test domain scenario management endpoints."""
    
    @pytest.mark.asyncio
    async def test_list_scenarios(self, app_client: AsyncClient, admin_headers: dict, sample_scenario):
        """Test listing scenarios."""
        response = await app_client.get("/api/domain-scenarios", headers=admin_headers)
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_count_scenarios(self, app_client: AsyncClient, admin_headers: dict, sample_scenario):
        """Test counting scenarios."""
        response = await app_client.get("/api/domain-scenarios/count", headers=admin_headers)
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_get_scenario(self, app_client: AsyncClient, admin_headers: dict, sample_scenario):
        """Test getting a specific scenario."""
        response = await app_client.get(
            f"/api/domain-scenarios/{sample_scenario['key']}",
            headers=admin_headers
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_create_scenario(self, app_client: AsyncClient, admin_headers: dict, sample_domain):
        """Test creating a scenario."""
        response = await app_client.post(
            "/api/domain-scenarios",
            headers=admin_headers,
            json={
                "type": "custom",
                "key": "new-scenario-123",
                "name": "New Scenario",
                "description": "A new scenario",
                "path": "/new-scenario",
                "status": "active",
                "order": 1,
                "domainKey": sample_domain["key"],
                "subDomains": []
            }
        )
        assert response.status_code == 201
    
    @pytest.mark.asyncio
    async def test_update_scenario(self, app_client: AsyncClient, admin_headers: dict, sample_scenario):
        """Test updating a scenario."""
        response = await app_client.put(
            f"/api/domain-scenarios/{sample_scenario['key']}",
            headers=admin_headers,
            json={"name": "Updated Scenario"}
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_toggle_scenario_status(self, app_client: AsyncClient, admin_headers: dict, sample_scenario):
        """Test toggling scenario status."""
        response = await app_client.post(
            f"/api/domain-scenarios/{sample_scenario['key']}/toggle-status",
            headers=admin_headers
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_get_scenario_playboards(self, app_client: AsyncClient, admin_headers: dict, sample_scenario, sample_playboard):
        """Test getting playboards for a scenario."""
        response = await app_client.get(
            f"/api/domain-scenarios/{sample_scenario['key']}/playboards",
            headers=admin_headers
        )
        assert response.status_code == 200


class TestPlayboards:
    """Test playboard management endpoints."""
    
    @pytest.mark.asyncio
    async def test_list_playboards(self, app_client: AsyncClient, admin_headers: dict, sample_playboard):
        """Test listing playboards."""
        response = await app_client.get("/api/playboards", headers=admin_headers)
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_count_playboards(self, app_client: AsyncClient, admin_headers: dict, sample_playboard):
        """Test counting playboards."""
        response = await app_client.get("/api/playboards/count", headers=admin_headers)
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_get_playboard(self, app_client: AsyncClient, admin_headers: dict, sample_playboard):
        """Test getting a specific playboard."""
        response = await app_client.get(
            f"/api/playboards/{sample_playboard['_id']}",
            headers=admin_headers
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_create_playboard(self, app_client: AsyncClient, admin_headers: dict, sample_scenario):
        """Test creating a playboard."""
        response = await app_client.post(
            "/api/playboards",
            headers=admin_headers,
            json={
                "name": "New Playboard",
                "description": "A new playboard",
                "scenarioKey": sample_scenario["key"],
                "data": {"config": {"test": True}},
                "status": "active"
            }
        )
        assert response.status_code == 201
    
    @pytest.mark.asyncio
    async def test_upload_playboard_json(self, app_client: AsyncClient, admin_headers: dict, sample_scenario):
        """Test uploading a JSON file as playboard."""
        json_content = json.dumps({"test": "data", "items": [1, 2, 3]})
        files = {"file": ("test.json", json_content, "application/json")}
        
        response = await app_client.post(
            "/api/playboards/upload",
            headers=admin_headers,
            files=files,
            params={
                "name": "Uploaded Playboard",
                "scenario_key": sample_scenario["key"]
            }
        )
        assert response.status_code == 201
    
    @pytest.mark.asyncio
    async def test_upload_invalid_json(self, app_client: AsyncClient, admin_headers: dict, sample_scenario):
        """Test uploading invalid JSON file."""
        files = {"file": ("test.json", "invalid json {{{", "application/json")}
        
        response = await app_client.post(
            "/api/playboards/upload",
            headers=admin_headers,
            files=files,
            params={
                "name": "Invalid Playboard",
                "scenario_key": sample_scenario["key"]
            }
        )
        assert response.status_code == 400
    
    @pytest.mark.asyncio
    async def test_upload_non_json_file(self, app_client: AsyncClient, admin_headers: dict, sample_scenario):
        """Test uploading non-JSON file."""
        files = {"file": ("test.txt", "some text", "text/plain")}
        
        response = await app_client.post(
            "/api/playboards/upload",
            headers=admin_headers,
            files=files,
            params={
                "name": "Invalid Playboard",
                "scenario_key": sample_scenario["key"]
            }
        )
        assert response.status_code == 400
    
    @pytest.mark.asyncio
    async def test_update_playboard(self, app_client: AsyncClient, admin_headers: dict, sample_playboard):
        """Test updating a playboard."""
        response = await app_client.put(
            f"/api/playboards/{sample_playboard['_id']}",
            headers=admin_headers,
            json={"name": "Updated Playboard"}
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_toggle_playboard_status(self, app_client: AsyncClient, admin_headers: dict, sample_playboard):
        """Test toggling playboard status."""
        response = await app_client.post(
            f"/api/playboards/{sample_playboard['_id']}/toggle-status",
            headers=admin_headers
        )
        assert response.status_code == 200
    
    @pytest.mark.asyncio
    async def test_download_playboard(self, app_client: AsyncClient, admin_headers: dict, sample_playboard):
        """Test downloading playboard JSON."""
        response = await app_client.get(
            f"/api/playboards/{sample_playboard['_id']}/download",
            headers=admin_headers
        )
        assert response.status_code == 200
