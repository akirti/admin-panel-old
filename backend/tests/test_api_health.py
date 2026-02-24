"""Tests for Health Check API Routes"""
import pytest
import time
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import FastAPI
from fastapi.testclient import TestClient

from easylifeauth.api.health_routes import (
    router, cache_health_data, get_system_metrics,
    determine_overall_status, _health_cache, _cache_lock
)
from easylifeauth.api.dependencies import get_db
from easylifeauth.security.access_control import CurrentUser, require_admin


class TestHealthRoutes:
    """Tests for health check endpoints"""

    @pytest.fixture
    def mock_db(self):
        """Create mock database manager"""
        db = MagicMock()
        db.ensure_connected = AsyncMock(return_value=True)
        return db

    @pytest.fixture
    def mock_admin_user(self):
        """Create mock admin user"""
        return CurrentUser(
            user_id="test",
            email="admin@test.com",
            roles=["administrator"],
            groups=[],
            domains=[]
        )

    @pytest.fixture
    def app(self, mock_db, mock_admin_user):
        """Create test FastAPI app"""
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_db] = lambda: mock_db
        app.dependency_overrides[require_admin] = lambda: mock_admin_user
        return app

    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return TestClient(app)

    def test_health_check_basic(self, client):
        """Test basic health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "timestamp" in data
        assert "uptime_seconds" in data
        assert "version" in data

    def test_health_check_with_details(self, client):
        """Test health check with detailed info"""
        response = client.get("/health?detailed=true")
        assert response.status_code == 200
        data = response.json()
        assert "python_version" in data

    def test_health_check_without_system(self, client):
        """Test health check without system metrics"""
        response = client.get("/health?system=false")
        assert response.status_code == 200
        data = response.json()
        assert response.status_code == 200

    def test_liveness_check(self, client):
        """Test liveness probe endpoint"""
        response = client.get("/health/live")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "alive"
        assert "timestamp" in data

    def test_readiness_check(self, client):
        """Test readiness probe endpoint"""
        response = client.get("/health/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert "timestamp" in data

    def test_metrics_endpoint(self, client):
        """Test metrics endpoint"""
        response = client.get("/health/metrics")
        assert response.status_code == 200
        data = response.json()
        assert "system" in data
        assert "timestamp" in data
        assert "uptime_seconds" in data

    def test_app_info_endpoint(self, client):
        """Test app info endpoint"""
        response = client.get("/info")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "EasyLife Auth API"
        assert "version" in data
        assert "timestamp" in data


class TestCacheDecorator:
    """Tests for cache_health_data decorator"""

    def test_cache_decorator_caches_result(self):
        """Test that decorator caches results"""
        call_count = 0

        @cache_health_data(ttl=60)
        def test_func():
            nonlocal call_count
            call_count += 1
            return {"result": call_count}

        # Clear cache first
        _health_cache.clear()

        # First call
        result1 = test_func()
        assert result1["result"] == 1
        assert call_count == 1

        # Second call should return cached result
        result2 = test_func()
        assert result2["result"] == 1
        assert call_count == 1  # Not incremented

    def test_cache_decorator_expires(self):
        """Test that cache expires after TTL"""
        call_count = 0

        @cache_health_data(ttl=1)  # 1 second TTL
        def test_func():
            nonlocal call_count
            call_count += 1
            return {"result": call_count}

        # Clear cache
        _health_cache.clear()

        # First call
        result1 = test_func()
        assert result1["result"] == 1

        # Wait for cache to expire
        time.sleep(1.1)

        # Third call should get fresh result
        result2 = test_func()
        assert result2["result"] == 2


class TestSystemMetrics:
    """Tests for system metrics functions"""

    @patch('easylifeauth.api.health_routes.psutil')
    def test_get_system_metrics_success(self, mock_psutil):
        """Test getting system metrics successfully"""
        # Clear cache
        _health_cache.clear()

        # Mock psutil responses
        mock_psutil.cpu_percent.return_value = 25.0
        mock_psutil.cpu_count.return_value = 4

        mock_memory = MagicMock()
        mock_memory.percent = 50.0
        mock_memory.total = 16 * 1024**3  # 16GB
        mock_memory.available = 8 * 1024**3  # 8GB
        mock_psutil.virtual_memory.return_value = mock_memory

        mock_disk = MagicMock()
        mock_disk.used = 100 * 1024**3  # 100GB
        mock_disk.total = 500 * 1024**3  # 500GB
        mock_disk.free = 400 * 1024**3  # 400GB
        mock_psutil.disk_usage.return_value = mock_disk

        mock_net = MagicMock()
        mock_net.bytes_sent = 1000
        mock_net.bytes_recv = 2000
        mock_net.packets_sent = 100
        mock_net.packets_recv = 200
        mock_psutil.net_io_counters.return_value = mock_net

        mock_process = MagicMock()
        mock_process_memory = MagicMock()
        mock_process_memory.rss = 100 * 1024**2  # 100MB
        mock_process.memory_info.return_value = mock_process_memory
        mock_process.num_threads.return_value = 10
        mock_psutil.Process.return_value = mock_process

        result = get_system_metrics()

        assert "cpu" in result
        assert "memory" in result
        assert "disk" in result
        assert "network" in result
        assert "process" in result

        assert result["cpu"]["usage_percent"] == 25.0
        assert result["cpu"]["status"] == "healthy"
        assert result["memory"]["status"] == "healthy"
        assert result["disk"]["status"] == "healthy"

    @patch('easylifeauth.api.health_routes.psutil')
    def test_get_system_metrics_high_usage_warning(self, mock_psutil):
        """Test system metrics returns warning on high usage"""
        # Clear cache
        _health_cache.clear()

        # Mock high CPU usage
        mock_psutil.cpu_percent.return_value = 95.0
        mock_psutil.cpu_count.return_value = 4

        mock_memory = MagicMock()
        mock_memory.percent = 50.0
        mock_memory.total = 16 * 1024**3
        mock_memory.available = 8 * 1024**3
        mock_psutil.virtual_memory.return_value = mock_memory

        mock_disk = MagicMock()
        mock_disk.used = 100 * 1024**3
        mock_disk.total = 500 * 1024**3
        mock_disk.free = 400 * 1024**3
        mock_psutil.disk_usage.return_value = mock_disk

        mock_net = MagicMock()
        mock_net.bytes_sent = 1000
        mock_net.bytes_recv = 2000
        mock_net.packets_sent = 100
        mock_net.packets_recv = 200
        mock_psutil.net_io_counters.return_value = mock_net

        mock_process = MagicMock()
        mock_process_memory = MagicMock()
        mock_process_memory.rss = 100 * 1024**2
        mock_process.memory_info.return_value = mock_process_memory
        mock_process.num_threads.return_value = 10
        mock_psutil.Process.return_value = mock_process

        result = get_system_metrics()
        assert result["cpu"]["status"] == "warning"

    @patch('easylifeauth.api.health_routes.psutil')
    def test_get_system_metrics_error(self, mock_psutil):
        """Test system metrics handles errors"""
        # Clear cache
        _health_cache.clear()

        mock_psutil.cpu_percent.side_effect = Exception("Test error")

        result = get_system_metrics()
        assert "error" in result
        assert result["status"] == "unhealthy"


class TestDetermineOverallStatus:
    """Tests for determine_overall_status function"""

    def test_healthy_status(self):
        """Test healthy overall status"""
        checks = {
            "system": {
                "cpu": {"status": "healthy"},
                "memory": {"status": "healthy"},
                "disk": {"status": "healthy"}
            }
        }
        assert determine_overall_status(checks) == "healthy"

    def test_degraded_status_warning(self):
        """Test degraded status from warning"""
        checks = {
            "system": {
                "cpu": {"status": "warning"},
                "memory": {"status": "healthy"},
                "disk": {"status": "healthy"}
            }
        }
        assert determine_overall_status(checks) == "degraded"

    def test_unhealthy_status(self):
        """Test unhealthy overall status"""
        checks = {
            "system": {
                "cpu": {"status": "unhealthy"},
                "memory": {"status": "healthy"},
                "disk": {"status": "healthy"}
            }
        }
        assert determine_overall_status(checks) == "unhealthy"

    def test_empty_checks(self):
        """Test with empty checks"""
        assert determine_overall_status({}) == "healthy"

    def test_missing_system_key(self):
        """Test with missing system key"""
        checks = {"other": "data"}
        assert determine_overall_status(checks) == "healthy"
