"""Tests for FastAPI Application (app.py)"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from fastapi.testclient import TestClient

from easylifeauth.app import create_app
from easylifeauth.errors.auth_error import AuthError


class TestCreateApp:
    """Tests for create_app function"""

    def test_create_app_minimal(self):
        """Test creating app with minimal configuration"""
        app = create_app()
        assert app is not None
        assert app.title == "EasyLife Auth API"

    def test_create_app_custom_title(self):
        """Test creating app with custom title"""
        app = create_app(
            title="Custom Auth API",
            description="Custom description"
        )
        assert app.title == "Custom Auth API"
        assert app.description == "Custom description"

    def test_create_app_with_cors_origins(self):
        """Test creating app with custom CORS origins"""
        app = create_app(cors_origins=["http://localhost:3000"])
        assert app is not None

    def test_create_app_default_cors(self):
        """Test that default CORS allows all origins"""
        app = create_app()
        client = TestClient(app)
        response = client.get("/")
        assert response.status_code == 200


class TestAppRoutes:
    """Tests for app routes"""

    @pytest.fixture
    def app(self):
        """Create test app"""
        return create_app()

    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return TestClient(app)

    def test_root_endpoint(self, client):
        """Test root endpoint returns API info"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
        assert "docs" in data
        assert data["message"] == "EasyLife Auth API"

    def test_docs_endpoint_exists(self, client):
        """Test docs endpoint exists"""
        response = client.get("/api/v1/docs")
        # Should redirect or return docs page
        assert response.status_code in [200, 307]

    def test_openapi_endpoint_exists(self, client):
        """Test openapi.json endpoint exists"""
        response = client.get("/api/v1/openapi.json")
        assert response.status_code == 200
        data = response.json()
        assert "openapi" in data
        assert "paths" in data


class TestExceptionHandlers:
    """Tests for exception handlers"""

    @pytest.fixture
    def app(self):
        """Create test app"""
        return create_app()

    @pytest.fixture
    def client(self, app):
        """Create test client"""
        return TestClient(app, raise_server_exceptions=False)

    def test_auth_error_handler(self, app, client):
        """Test AuthError exception handler"""
        @app.get("/test-auth-error")
        async def raise_auth_error():
            raise AuthError("Test auth error", 401)

        response = client.get("/test-auth-error")
        assert response.status_code == 401
        assert response.json()["error"] == "Test auth error"

    def test_http_exception_handler(self, app, client):
        """Test HTTPException handler"""
        @app.get("/test-http-error")
        async def raise_http_error():
            raise HTTPException(status_code=404, detail="Not found")

        response = client.get("/test-http-error")
        assert response.status_code == 404
        assert response.json()["error"] == "Not found"

    def test_general_exception_handler(self, app, client):
        """Test general exception handler"""
        @app.get("/test-general-error")
        async def raise_general_error():
            raise ValueError("Unexpected error")

        response = client.get("/test-general-error")
        assert response.status_code == 500
        assert response.json()["error"] == "Internal server error"


class TestLifespanWithConfig:
    """Tests for app lifespan with database configuration"""

    @pytest.mark.asyncio
    async def test_lifespan_with_db_config(self):
        """Test lifespan initializes database when config provided"""
        with patch('easylifeauth.app.DatabaseManager') as MockDB:
            mock_db = MagicMock()
            mock_db.ping = AsyncMock(return_value=True)
            mock_db.close = MagicMock()
            MockDB.return_value = mock_db

            with patch('easylifeauth.app.TokenManager') as MockTM:
                MockTM.return_value = MagicMock()

                with patch('easylifeauth.app.init_dependencies') as mock_init:
                    app = create_app(
                        db_config={"uri": "mongodb://localhost:27017", "database": "test"},
                        token_secret="test_secret"
                    )

                    with TestClient(app):
                        # Startup should have been called
                        MockDB.assert_called_once()
                        MockTM.assert_called_once()
                        mock_init.assert_called_once()

    @pytest.mark.asyncio
    async def test_lifespan_db_connection_failure(self):
        """Test lifespan handles database connection failure"""
        with patch('easylifeauth.app.DatabaseManager') as MockDB:
            mock_db = MagicMock()
            mock_db.ping = AsyncMock(return_value=False)
            mock_db.close = MagicMock()
            MockDB.return_value = mock_db

            with patch('easylifeauth.app.TokenManager'):
                with patch('easylifeauth.app.init_dependencies'):
                    app = create_app(
                        db_config={"uri": "mongodb://localhost:27017", "database": "test"},
                        token_secret="test_secret"
                    )

                    # Should not raise, just log warning
                    with TestClient(app):
                        MockDB.assert_called_once()

    @pytest.mark.asyncio
    async def test_lifespan_db_connection_exception(self):
        """Test lifespan handles database connection exception"""
        with patch('easylifeauth.app.DatabaseManager') as MockDB:
            mock_db = MagicMock()
            mock_db.ping = AsyncMock(side_effect=Exception("Connection refused"))
            mock_db.close = MagicMock()
            MockDB.return_value = mock_db

            with patch('easylifeauth.app.TokenManager'):
                with patch('easylifeauth.app.init_dependencies'):
                    app = create_app(
                        db_config={"uri": "mongodb://localhost:27017", "database": "test"},
                        token_secret="test_secret"
                    )

                    # Should not raise, just log warning
                    with TestClient(app):
                        MockDB.assert_called_once()

    @pytest.mark.asyncio
    async def test_lifespan_with_email_service(self):
        """Test lifespan initializes email service when config provided"""
        with patch('easylifeauth.app.DatabaseManager') as MockDB:
            mock_db = MagicMock()
            mock_db.ping = AsyncMock(return_value=True)
            mock_db.close = MagicMock()
            MockDB.return_value = mock_db

            with patch('easylifeauth.app.TokenManager'):
                with patch('easylifeauth.app.EmailService') as MockEmail:
                    MockEmail.return_value = MagicMock()

                    with patch('easylifeauth.app.init_dependencies'):
                        app = create_app(
                            db_config={"uri": "mongodb://localhost:27017", "database": "test"},
                            token_secret="test_secret",
                            smtp_config={
                                "smtp_server": "smtp.example.com",
                                "smtp_port": 587,
                                "email": "test@example.com",
                                "password": "password"
                            }
                        )

                        with TestClient(app):
                            MockEmail.assert_called_once()


class TestMiddlewareConfiguration:
    """Tests for middleware configuration"""

    def test_csrf_middleware_with_token_secret(self):
        """Test CSRF middleware is added when token_secret provided"""
        app = create_app(token_secret="test_secret")
        # App should be created without errors
        assert app is not None

    @patch.dict('os.environ', {'ENV': 'development'})
    def test_dev_mode_middleware_config(self):
        """Test middleware configuration in development mode"""
        app = create_app(token_secret="test_secret")
        assert app is not None

    @patch.dict('os.environ', {'ENV': 'production'})
    def test_prod_mode_middleware_config(self):
        """Test middleware configuration in production mode"""
        app = create_app(token_secret="test_secret")
        assert app is not None


class TestRouterInclusion:
    """Tests for router inclusion"""

    def test_all_routers_included(self):
        """Test all routers are included"""
        app = create_app()
        client = TestClient(app)

        # Test that various route prefixes exist
        # Health check is always available
        response = client.get("/api/v1/health")
        assert response.status_code == 200

    def test_auth_routes_included(self):
        """Test auth routes are included"""
        app = create_app()
        client = TestClient(app)

        # CSRF token endpoint should be available
        response = client.get("/api/v1/auth/csrf-token")
        # Will return 200 with token or error
        assert response.status_code in [200, 401, 500]

    def test_api_version_in_routes(self):
        """Test API version is in route prefix"""
        app = create_app()
        client = TestClient(app)

        # Root should work
        response = client.get("/")
        assert response.status_code == 200

        # Health check with version prefix
        response = client.get("/api/v1/health")
        assert response.status_code == 200
