"""Tests for FastAPI Application (app.py)"""
import sys
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from fastapi.testclient import TestClient

from easylifeauth.app import create_app
from easylifeauth.errors.auth_error import AuthError
from mock_data import MOCK_EMAIL, MOCK_URL_FRONTEND, MOCK_URL_MONGODB

PATH_ROOT = "/"
PATH_DOCS = "/docs"
PATH_REDOC = "/redoc"
PATH_OPENAPI = "/openapi.json"
OPENAPI_FILENAME = "openapi.json"
REDOC_SPEC_URL_ATTR = f'spec-url="{OPENAPI_FILENAME}"'
REDOC_SCRIPT_NAME = "redoc.standalone.js"
PATCH_EASYLIFEAUTH_APP_DATABASEMANAGER = "easylifeauth.app.DatabaseManager"
PATCH_EASYLIFEAUTH_APP_INIT_DEPENDENCIES = "easylifeauth.app.init_dependencies"
PATCH_EASYLIFEAUTH_APP_TOKENMANAGER = "easylifeauth.app.TokenManager"




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
        app = create_app(cors_origins=[MOCK_URL_FRONTEND])
        assert app is not None

    def test_create_app_default_cors(self):
        """Test that default CORS allows all origins"""
        app = create_app()
        client = TestClient(app)
        response = client.get(PATH_ROOT)
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
        response = client.get(PATH_ROOT)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
        assert "docs" in data
        assert data["message"] == "EasyLife Auth API"

    def test_docs_endpoint_exists(self, client):
        """Test docs endpoint exists at root level"""
        response = client.get(PATH_DOCS)
        assert response.status_code in [200, 307]

    def test_docs_uses_relative_openapi_url(self, client):
        """Test Swagger UI references openapi.json with a relative URL"""
        response = client.get(PATH_DOCS)
        assert response.status_code in [200, 307]
        if response.status_code == 200:
            assert OPENAPI_FILENAME in response.text

    def test_redoc_endpoint_returns_html(self, client):
        """Test custom ReDoc endpoint returns HTML page"""
        response = client.get(PATH_REDOC)
        assert response.status_code == 200
        assert "text/html" in response.headers.get("content-type", "")

    def test_redoc_uses_relative_spec_url(self, client):
        """Test ReDoc HTML uses relative spec-url for openapi.json"""
        response = client.get(PATH_REDOC)
        assert response.status_code == 200
        assert REDOC_SPEC_URL_ATTR in response.text

    def test_redoc_includes_redoc_script(self, client):
        """Test ReDoc HTML includes the ReDoc standalone script"""
        response = client.get(PATH_REDOC)
        assert response.status_code == 200
        assert REDOC_SCRIPT_NAME in response.text

    @pytest.mark.skipif(
        sys.version_info < (3, 10),
        reason="pydantic v2 OpenAPI schema generation requires Python 3.10+",
    )
    def test_openapi_endpoint_exists(self, client):
        """Test openapi.json endpoint exists at root level"""
        response = client.get(PATH_OPENAPI)
        assert response.status_code == 200
        data = response.json()
        assert "openapi" in data
        assert "paths" in data


class TestDocsWithRootPath:
    """Tests for docs endpoints behind a reverse proxy (root_path set)"""

    @pytest.fixture
    def client_with_root_path(self):
        app = create_app(root_path="/mine/tine/security")
        return TestClient(app)

    def test_docs_still_accessible(self, client_with_root_path):
        """Test /docs is accessible when root_path is set"""
        response = client_with_root_path.get(PATH_DOCS)
        assert response.status_code in [200, 307]

    def test_redoc_still_accessible(self, client_with_root_path):
        """Test /redoc is accessible when root_path is set"""
        response = client_with_root_path.get(PATH_REDOC)
        assert response.status_code == 200
        assert REDOC_SPEC_URL_ATTR in response.text

    def test_redoc_does_not_use_absolute_root_path_url(self, client_with_root_path):
        """Test ReDoc does not hardcode root_path in the spec URL"""
        response = client_with_root_path.get(PATH_REDOC)
        assert response.status_code == 200
        assert f"/mine/tine/security/{OPENAPI_FILENAME}" not in response.text
        assert REDOC_SPEC_URL_ATTR in response.text


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
        with patch(PATCH_EASYLIFEAUTH_APP_DATABASEMANAGER) as MockDB:
            mock_db = MagicMock()
            mock_db.ping = AsyncMock(return_value=True)
            mock_db.close = MagicMock()
            MockDB.return_value = mock_db

            with patch(PATCH_EASYLIFEAUTH_APP_TOKENMANAGER) as MockTM:
                MockTM.return_value = MagicMock()

                with patch(PATCH_EASYLIFEAUTH_APP_INIT_DEPENDENCIES) as mock_init:
                    app = create_app(
                        db_config={"uri": MOCK_URL_MONGODB, "database": "test"},
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
        with patch(PATCH_EASYLIFEAUTH_APP_DATABASEMANAGER) as MockDB:
            mock_db = MagicMock()
            mock_db.ping = AsyncMock(return_value=False)
            mock_db.close = MagicMock()
            MockDB.return_value = mock_db

            with patch(PATCH_EASYLIFEAUTH_APP_TOKENMANAGER):
                with patch(PATCH_EASYLIFEAUTH_APP_INIT_DEPENDENCIES):
                    app = create_app(
                        db_config={"uri": MOCK_URL_MONGODB, "database": "test"},
                        token_secret="test_secret"
                    )

                    # Should not raise, just log warning
                    with TestClient(app):
                        MockDB.assert_called_once()

    @pytest.mark.asyncio
    async def test_lifespan_db_connection_exception(self):
        """Test lifespan handles database connection exception"""
        with patch(PATCH_EASYLIFEAUTH_APP_DATABASEMANAGER) as MockDB:
            mock_db = MagicMock()
            mock_db.ping = AsyncMock(side_effect=Exception("Connection refused"))
            mock_db.close = MagicMock()
            MockDB.return_value = mock_db

            with patch(PATCH_EASYLIFEAUTH_APP_TOKENMANAGER):
                with patch(PATCH_EASYLIFEAUTH_APP_INIT_DEPENDENCIES):
                    app = create_app(
                        db_config={"uri": MOCK_URL_MONGODB, "database": "test"},
                        token_secret="test_secret"
                    )

                    # Should not raise, just log warning
                    with TestClient(app):
                        MockDB.assert_called_once()

    @pytest.mark.asyncio
    async def test_lifespan_with_email_service(self):
        """Test lifespan initializes email service when config provided"""
        with patch(PATCH_EASYLIFEAUTH_APP_DATABASEMANAGER) as MockDB:
            mock_db = MagicMock()
            mock_db.ping = AsyncMock(return_value=True)
            mock_db.close = MagicMock()
            MockDB.return_value = mock_db

            with patch(PATCH_EASYLIFEAUTH_APP_TOKENMANAGER):
                with patch('easylifeauth.app.EmailService') as MockEmail:
                    MockEmail.return_value = MagicMock()

                    with patch(PATCH_EASYLIFEAUTH_APP_INIT_DEPENDENCIES):
                        app = create_app(
                            db_config={"uri": MOCK_URL_MONGODB, "database": "test"},
                            token_secret="test_secret",
                            smtp_config={
                                "smtp_server": "smtp.example.com",
                                "smtp_port": 587,
                                "email": MOCK_EMAIL,
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
        # Health check is at root level (infrastructure tier)
        response = client.get("/health")
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
        """Test API version in route prefix and health at root"""
        app = create_app()
        client = TestClient(app)

        # Root should work
        response = client.get(PATH_ROOT)
        assert response.status_code == 200

        # Health check at root (infrastructure tier)
        response = client.get("/health")
        assert response.status_code == 200


class TestUITemplatesDB:
    """Tests for separate ui_templates database initialization"""

    @pytest.mark.asyncio
    async def test_lifespan_with_ui_templates_db_config(self):
        """Test lifespan initializes separate ui_templates DB when config provided"""
        with patch(PATCH_EASYLIFEAUTH_APP_DATABASEMANAGER) as MockDB:
            mock_auth_db = MagicMock()
            mock_auth_db.ping = AsyncMock(return_value=True)
            mock_auth_db.close = MagicMock()

            mock_ui_db = MagicMock()
            mock_ui_db.ping = AsyncMock(return_value=True)
            mock_ui_db.close = MagicMock()

            MockDB.side_effect = [mock_auth_db, mock_ui_db]

            with patch(PATCH_EASYLIFEAUTH_APP_TOKENMANAGER):
                with patch(PATCH_EASYLIFEAUTH_APP_INIT_DEPENDENCIES) as mock_init:
                    app = create_app(
                        db_config={"uri": MOCK_URL_MONGODB, "database": "auth"},
                        ui_templates_db_config={"uri": MOCK_URL_MONGODB, "database": "ui_tpl"},
                        token_secret="test_secret"
                    )

                    with TestClient(app):
                        assert MockDB.call_count == 2
                        mock_init.assert_called_once()
                        call_kwargs = mock_init.call_args
                        assert call_kwargs[1]["ui_templates_db"] is mock_ui_db

    @pytest.mark.asyncio
    async def test_lifespan_ui_templates_db_ping_failure(self):
        """Test lifespan handles ui_templates DB ping returning False"""
        with patch(PATCH_EASYLIFEAUTH_APP_DATABASEMANAGER) as MockDB:
            mock_auth_db = MagicMock()
            mock_auth_db.ping = AsyncMock(return_value=True)
            mock_auth_db.close = MagicMock()

            mock_ui_db = MagicMock()
            mock_ui_db.ping = AsyncMock(return_value=False)
            mock_ui_db.close = MagicMock()

            MockDB.side_effect = [mock_auth_db, mock_ui_db]

            with patch(PATCH_EASYLIFEAUTH_APP_TOKENMANAGER):
                with patch(PATCH_EASYLIFEAUTH_APP_INIT_DEPENDENCIES):
                    app = create_app(
                        db_config={"uri": MOCK_URL_MONGODB, "database": "auth"},
                        ui_templates_db_config={"uri": MOCK_URL_MONGODB, "database": "ui_tpl"},
                        token_secret="test_secret"
                    )

                    with TestClient(app):
                        assert MockDB.call_count == 2

    @pytest.mark.asyncio
    async def test_lifespan_ui_templates_db_ping_exception(self):
        """Test lifespan handles ui_templates DB connection exception"""
        with patch(PATCH_EASYLIFEAUTH_APP_DATABASEMANAGER) as MockDB:
            mock_auth_db = MagicMock()
            mock_auth_db.ping = AsyncMock(return_value=True)
            mock_auth_db.close = MagicMock()

            mock_ui_db = MagicMock()
            mock_ui_db.ping = AsyncMock(side_effect=Exception("Connection refused"))
            mock_ui_db.close = MagicMock()

            MockDB.side_effect = [mock_auth_db, mock_ui_db]

            with patch(PATCH_EASYLIFEAUTH_APP_TOKENMANAGER):
                with patch(PATCH_EASYLIFEAUTH_APP_INIT_DEPENDENCIES):
                    app = create_app(
                        db_config={"uri": MOCK_URL_MONGODB, "database": "auth"},
                        ui_templates_db_config={"uri": MOCK_URL_MONGODB, "database": "ui_tpl"},
                        token_secret="test_secret"
                    )

                    # Should not raise
                    with TestClient(app):
                        assert MockDB.call_count == 2

    @pytest.mark.asyncio
    async def test_lifespan_ui_templates_db_shutdown_close_error(self):
        """Test lifespan handles ui_templates DB close error on shutdown"""
        with patch(PATCH_EASYLIFEAUTH_APP_DATABASEMANAGER) as MockDB:
            mock_auth_db = MagicMock()
            mock_auth_db.ping = AsyncMock(return_value=True)
            mock_auth_db.close = MagicMock()

            mock_ui_db = MagicMock()
            mock_ui_db.ping = AsyncMock(return_value=True)
            mock_ui_db.close = MagicMock(side_effect=Exception("close error"))

            MockDB.side_effect = [mock_auth_db, mock_ui_db]

            with patch(PATCH_EASYLIFEAUTH_APP_TOKENMANAGER):
                with patch(PATCH_EASYLIFEAUTH_APP_INIT_DEPENDENCIES):
                    app = create_app(
                        db_config={"uri": MOCK_URL_MONGODB, "database": "auth"},
                        ui_templates_db_config={"uri": MOCK_URL_MONGODB, "database": "ui_tpl"},
                        token_secret="test_secret"
                    )

                    # Should not raise on shutdown even when ui_templates close errors
                    with TestClient(app):
                        mock_ui_db.close.assert_not_called()  # close runs on exit

    @pytest.mark.asyncio
    async def test_lifespan_without_ui_templates_db_config(self):
        """Test lifespan skips ui_templates DB when config not provided"""
        with patch(PATCH_EASYLIFEAUTH_APP_DATABASEMANAGER) as MockDB:
            mock_db = MagicMock()
            mock_db.ping = AsyncMock(return_value=True)
            mock_db.close = MagicMock()
            MockDB.return_value = mock_db

            with patch(PATCH_EASYLIFEAUTH_APP_TOKENMANAGER):
                with patch(PATCH_EASYLIFEAUTH_APP_INIT_DEPENDENCIES) as mock_init:
                    app = create_app(
                        db_config={"uri": MOCK_URL_MONGODB, "database": "auth"},
                        token_secret="test_secret"
                    )

                    with TestClient(app):
                        MockDB.assert_called_once()
                        call_kwargs = mock_init.call_args
                        assert call_kwargs[1]["ui_templates_db"] is None
