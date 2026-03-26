from mock_data import MOCK_EMAIL, MOCK_URL_JIRA_BASE
"""Tests for API Dependencies"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
PATCH_BULK_UPLOAD_ROUTES_INIT_BULK_SERVICES = "easylifeauth.api.bulk_upload_routes.init_bulk_services"
PATCH_CONFIGURATIONS_ROUTES_INIT_GCS_SERVICE = "easylifeauth.api.configurations_routes.init_gcs_service"
PATCH_DEPENDENCIES_ADMINSERVICE = "easylifeauth.api.dependencies.AdminService"
PATCH_DEPENDENCIES_DATADOMAINSERVICE = "easylifeauth.api.dependencies.DataDomainService"
PATCH_DEPENDENCIES_FEEDBACKSERVICE = "easylifeauth.api.dependencies.FeedbackService"
PATCH_DEPENDENCIES_FILESTORAGESERVICE = "easylifeauth.api.dependencies.FileStorageService"
PATCH_DEPENDENCIES_INIT_ACTIVITY_LOG_SERVICE = "easylifeauth.api.dependencies.init_activity_log_service"
PATCH_DEPENDENCIES_NEWSCENARIOSERVICE = "easylifeauth.api.dependencies.NewScenarioService"
PATCH_DEPENDENCIES_PASSWORDRESETSERVICE = "easylifeauth.api.dependencies.PasswordResetService"
PATCH_DEPENDENCIES_PLAYBOARDSERVICE = "easylifeauth.api.dependencies.PlayboardService"
PATCH_DEPENDENCIES_SCENARIOSERVICE = "easylifeauth.api.dependencies.ScenarioService"
PATCH_DEPENDENCIES_SET_TOKEN_MANAGER = "easylifeauth.api.dependencies.set_token_manager"
PATCH_DEPENDENCIES_USERSERVICE = "easylifeauth.api.dependencies.UserService"



class TestDependencyGetters:
    """Tests for dependency getter functions"""

    def test_get_db_not_initialized(self):
        """Test get_db raises when not initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._db
        try:
            deps._db = None
            with pytest.raises(RuntimeError) as exc_info:
                deps.get_db()
            assert "Database not initialized" in str(exc_info.value)
        finally:
            deps._db = original

    def test_get_db_initialized(self):
        """Test get_db returns db when initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._db
        mock_db = MagicMock()
        try:
            deps._db = mock_db
            result = deps.get_db()
            assert result is mock_db
        finally:
            deps._db = original

    def test_get_token_manager_not_initialized(self):
        """Test get_token_manager raises when not initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._token_manager
        try:
            deps._token_manager = None
            with pytest.raises(RuntimeError) as exc_info:
                deps.get_token_manager()
            assert "Token manager not initialized" in str(exc_info.value)
        finally:
            deps._token_manager = original

    def test_get_token_manager_initialized(self):
        """Test get_token_manager returns manager when initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._token_manager
        mock_tm = MagicMock()
        try:
            deps._token_manager = mock_tm
            result = deps.get_token_manager()
            assert result is mock_tm
        finally:
            deps._token_manager = original

    def test_get_user_service_not_initialized(self):
        """Test get_user_service raises when not initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._user_service
        try:
            deps._user_service = None
            with pytest.raises(RuntimeError) as exc_info:
                deps.get_user_service()
            assert "User service not initialized" in str(exc_info.value)
        finally:
            deps._user_service = original

    def test_get_user_service_initialized(self):
        """Test get_user_service returns service when initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._user_service
        mock_service = MagicMock()
        try:
            deps._user_service = mock_service
            result = deps.get_user_service()
            assert result is mock_service
        finally:
            deps._user_service = original

    def test_get_admin_service_not_initialized(self):
        """Test get_admin_service raises when not initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._admin_service
        try:
            deps._admin_service = None
            with pytest.raises(RuntimeError) as exc_info:
                deps.get_admin_service()
            assert "Admin service not initialized" in str(exc_info.value)
        finally:
            deps._admin_service = original

    def test_get_admin_service_initialized(self):
        """Test get_admin_service returns service when initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._admin_service
        mock_service = MagicMock()
        try:
            deps._admin_service = mock_service
            result = deps.get_admin_service()
            assert result is mock_service
        finally:
            deps._admin_service = original

    def test_get_password_service_not_initialized(self):
        """Test get_password_service raises when not initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._password_service
        try:
            deps._password_service = None
            with pytest.raises(RuntimeError) as exc_info:
                deps.get_password_service()
            assert "Password service not initialized" in str(exc_info.value)
        finally:
            deps._password_service = original

    def test_get_password_service_initialized(self):
        """Test get_password_service returns service when initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._password_service
        mock_service = MagicMock()
        try:
            deps._password_service = mock_service
            result = deps.get_password_service()
            assert result is mock_service
        finally:
            deps._password_service = original

    def test_get_email_service_none(self):
        """Test get_email_service returns None when not set"""
        import easylifeauth.api.dependencies as deps
        original = deps._email_service
        try:
            deps._email_service = None
            result = deps.get_email_service()
            assert result is None
        finally:
            deps._email_service = original

    def test_get_email_service_initialized(self):
        """Test get_email_service returns service when set"""
        import easylifeauth.api.dependencies as deps
        original = deps._email_service
        mock_service = MagicMock()
        try:
            deps._email_service = mock_service
            result = deps.get_email_service()
            assert result is mock_service
        finally:
            deps._email_service = original

    def test_get_domain_service_not_initialized(self):
        """Test get_domain_service raises when not initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._domain_service
        try:
            deps._domain_service = None
            with pytest.raises(RuntimeError) as exc_info:
                deps.get_domain_service()
            assert "Domain service not initialized" in str(exc_info.value)
        finally:
            deps._domain_service = original

    def test_get_domain_service_initialized(self):
        """Test get_domain_service returns service when initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._domain_service
        mock_service = MagicMock()
        try:
            deps._domain_service = mock_service
            result = deps.get_domain_service()
            assert result is mock_service
        finally:
            deps._domain_service = original

    def test_get_scenario_service_not_initialized(self):
        """Test get_scenario_service raises when not initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._scenario_service
        try:
            deps._scenario_service = None
            with pytest.raises(RuntimeError) as exc_info:
                deps.get_scenario_service()
            assert "Scenario service not initialized" in str(exc_info.value)
        finally:
            deps._scenario_service = original

    def test_get_scenario_service_initialized(self):
        """Test get_scenario_service returns service when initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._scenario_service
        mock_service = MagicMock()
        try:
            deps._scenario_service = mock_service
            result = deps.get_scenario_service()
            assert result is mock_service
        finally:
            deps._scenario_service = original

    def test_get_playboard_service_not_initialized(self):
        """Test get_playboard_service raises when not initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._playboard_service
        try:
            deps._playboard_service = None
            with pytest.raises(RuntimeError) as exc_info:
                deps.get_playboard_service()
            assert "Playboard service not initialized" in str(exc_info.value)
        finally:
            deps._playboard_service = original

    def test_get_playboard_service_initialized(self):
        """Test get_playboard_service returns service when initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._playboard_service
        mock_service = MagicMock()
        try:
            deps._playboard_service = mock_service
            result = deps.get_playboard_service()
            assert result is mock_service
        finally:
            deps._playboard_service = original

    def test_get_feedback_service_not_initialized(self):
        """Test get_feedback_service raises when not initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._feedback_service
        try:
            deps._feedback_service = None
            with pytest.raises(RuntimeError) as exc_info:
                deps.get_feedback_service()
            assert "Feedback service not initialized" in str(exc_info.value)
        finally:
            deps._feedback_service = original

    def test_get_feedback_service_initialized(self):
        """Test get_feedback_service returns service when initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._feedback_service
        mock_service = MagicMock()
        try:
            deps._feedback_service = mock_service
            result = deps.get_feedback_service()
            assert result is mock_service
        finally:
            deps._feedback_service = original

    def test_get_scenario_request_service_not_initialized(self):
        """Test get_scenario_request_service raises when not initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._scenario_request_service
        try:
            deps._scenario_request_service = None
            with pytest.raises(RuntimeError) as exc_info:
                deps.get_scenario_request_service()
            assert "Scenario request service not initialized" in str(exc_info.value)
        finally:
            deps._scenario_request_service = original

    def test_get_scenario_request_service_initialized(self):
        """Test get_scenario_request_service returns service when initialized"""
        import easylifeauth.api.dependencies as deps
        original = deps._scenario_request_service
        mock_service = MagicMock()
        try:
            deps._scenario_request_service = mock_service
            result = deps.get_scenario_request_service()
            assert result is mock_service
        finally:
            deps._scenario_request_service = original

    def test_get_jira_service_none(self):
        """Test get_jira_service returns None when not set"""
        import easylifeauth.api.dependencies as deps
        original = deps._jira_service
        try:
            deps._jira_service = None
            result = deps.get_jira_service()
            assert result is None
        finally:
            deps._jira_service = original

    def test_get_jira_service_initialized(self):
        """Test get_jira_service returns service when set"""
        import easylifeauth.api.dependencies as deps
        original = deps._jira_service
        mock_service = MagicMock()
        try:
            deps._jira_service = mock_service
            result = deps.get_jira_service()
            assert result is mock_service
        finally:
            deps._jira_service = original

    def test_get_file_storage_service_none(self):
        """Test get_file_storage_service returns None when not set"""
        import easylifeauth.api.dependencies as deps
        original = deps._file_storage_service
        try:
            deps._file_storage_service = None
            result = deps.get_file_storage_service()
            assert result is None
        finally:
            deps._file_storage_service = original

    def test_get_file_storage_service_initialized(self):
        """Test get_file_storage_service returns service when set"""
        import easylifeauth.api.dependencies as deps
        original = deps._file_storage_service
        mock_service = MagicMock()
        try:
            deps._file_storage_service = mock_service
            result = deps.get_file_storage_service()
            assert result is mock_service
        finally:
            deps._file_storage_service = original

    def test_get_activity_log_service_none(self):
        """Test get_activity_log_service returns None when not set"""
        import easylifeauth.api.dependencies as deps
        original = deps._activity_log_service
        try:
            deps._activity_log_service = None
            result = deps.get_activity_log_service()
            assert result is None
        finally:
            deps._activity_log_service = original

    def test_get_activity_log_service_initialized(self):
        """Test get_activity_log_service returns service when set"""
        import easylifeauth.api.dependencies as deps
        original = deps._activity_log_service
        mock_service = MagicMock()
        try:
            deps._activity_log_service = mock_service
            result = deps.get_activity_log_service()
            assert result is mock_service
        finally:
            deps._activity_log_service = original

    def test_get_prevail_api_key_none(self):
        """Test get_prevail_api_key returns None when not set"""
        import easylifeauth.api.dependencies as deps
        original = deps._prevail_api_key
        try:
            deps._prevail_api_key = None
            result = deps.get_prevail_api_key()
            assert result is None
        finally:
            deps._prevail_api_key = original

    def test_get_prevail_api_key_initialized(self):
        """Test get_prevail_api_key returns key when set"""
        import easylifeauth.api.dependencies as deps
        original = deps._prevail_api_key
        try:
            deps._prevail_api_key = "custom-key"
            result = deps.get_prevail_api_key()
            assert result == "custom-key"
        finally:
            deps._prevail_api_key = original


class TestInitDependencies:
    """Tests for init_dependencies function"""

    @patch(PATCH_DEPENDENCIES_INIT_ACTIVITY_LOG_SERVICE)
    @patch(PATCH_DEPENDENCIES_SET_TOKEN_MANAGER)
    @patch(PATCH_DEPENDENCIES_USERSERVICE)
    @patch(PATCH_DEPENDENCIES_ADMINSERVICE)
    @patch(PATCH_DEPENDENCIES_PASSWORDRESETSERVICE)
    @patch(PATCH_DEPENDENCIES_DATADOMAINSERVICE)
    @patch(PATCH_DEPENDENCIES_SCENARIOSERVICE)
    @patch(PATCH_DEPENDENCIES_PLAYBOARDSERVICE)
    @patch(PATCH_DEPENDENCIES_FEEDBACKSERVICE)
    @patch(PATCH_DEPENDENCIES_NEWSCENARIOSERVICE)
    @patch(PATCH_DEPENDENCIES_FILESTORAGESERVICE)
    @patch(PATCH_BULK_UPLOAD_ROUTES_INIT_BULK_SERVICES)
    @patch(PATCH_CONFIGURATIONS_ROUTES_INIT_GCS_SERVICE)
    def test_init_dependencies_minimal(
        self, mock_init_gcs, mock_init_bulk, mock_file_storage,
        mock_new_scenario, mock_feedback, mock_playboard, mock_scenario,
        mock_domain, mock_password, mock_admin, mock_user,
        mock_set_token, mock_init_activity
    ):
        """Test init_dependencies with minimal config"""
        from easylifeauth.api.dependencies import init_dependencies
        import easylifeauth.api.dependencies as deps

        mock_db = MagicMock()
        mock_token_manager = MagicMock()
        mock_file_storage.return_value.enabled = False
        mock_init_activity.return_value = MagicMock()

        init_dependencies(mock_db, mock_token_manager)

        mock_set_token.assert_called_once_with(mock_token_manager)
        mock_user.assert_called_once_with(mock_db, mock_token_manager)
        mock_admin.assert_called_once_with(mock_db)
        mock_file_storage.assert_called_once()
        mock_init_bulk.assert_called_once()
        mock_init_gcs.assert_called_once()

    @patch(PATCH_DEPENDENCIES_INIT_ACTIVITY_LOG_SERVICE)
    @patch(PATCH_DEPENDENCIES_SET_TOKEN_MANAGER)
    @patch(PATCH_DEPENDENCIES_USERSERVICE)
    @patch(PATCH_DEPENDENCIES_ADMINSERVICE)
    @patch(PATCH_DEPENDENCIES_PASSWORDRESETSERVICE)
    @patch(PATCH_DEPENDENCIES_DATADOMAINSERVICE)
    @patch(PATCH_DEPENDENCIES_SCENARIOSERVICE)
    @patch(PATCH_DEPENDENCIES_PLAYBOARDSERVICE)
    @patch(PATCH_DEPENDENCIES_FEEDBACKSERVICE)
    @patch(PATCH_DEPENDENCIES_NEWSCENARIOSERVICE)
    @patch('easylifeauth.api.dependencies.JiraService')
    @patch(PATCH_DEPENDENCIES_FILESTORAGESERVICE)
    @patch(PATCH_BULK_UPLOAD_ROUTES_INIT_BULK_SERVICES)
    @patch(PATCH_CONFIGURATIONS_ROUTES_INIT_GCS_SERVICE)
    def test_init_dependencies_with_jira(self, *mocks):
        """Test init_dependencies with Jira config"""
        from easylifeauth.api.dependencies import init_dependencies

        # Patches are passed in reverse decorator order
        mock_init_gcs, mock_init_bulk, mock_file_storage, mock_jira = mocks[:4]
        mock_init_activity = mocks[-1]

        mock_db = MagicMock()
        mock_token_manager = MagicMock()
        mock_jira.return_value.enabled = True
        mock_file_storage.return_value.enabled = False
        mock_init_activity.return_value = MagicMock()

        jira_config = {
            "base_url": MOCK_URL_JIRA_BASE,
            "email": MOCK_EMAIL,
            "api_token": "token"
        }

        init_dependencies(mock_db, mock_token_manager, jira_config=jira_config)

        mock_jira.assert_called_once_with(jira_config)

    @patch(PATCH_DEPENDENCIES_INIT_ACTIVITY_LOG_SERVICE)
    @patch(PATCH_DEPENDENCIES_SET_TOKEN_MANAGER)
    @patch(PATCH_DEPENDENCIES_USERSERVICE)
    @patch(PATCH_DEPENDENCIES_ADMINSERVICE)
    @patch(PATCH_DEPENDENCIES_PASSWORDRESETSERVICE)
    @patch(PATCH_DEPENDENCIES_DATADOMAINSERVICE)
    @patch(PATCH_DEPENDENCIES_SCENARIOSERVICE)
    @patch(PATCH_DEPENDENCIES_PLAYBOARDSERVICE)
    @patch(PATCH_DEPENDENCIES_FEEDBACKSERVICE)
    @patch(PATCH_DEPENDENCIES_NEWSCENARIOSERVICE)
    @patch(PATCH_DEPENDENCIES_FILESTORAGESERVICE)
    @patch(PATCH_BULK_UPLOAD_ROUTES_INIT_BULK_SERVICES)
    @patch(PATCH_CONFIGURATIONS_ROUTES_INIT_GCS_SERVICE)
    def test_init_dependencies_with_file_storage(
        self, mock_init_gcs, mock_init_bulk, mock_file_storage,
        mock_new_scenario, mock_feedback, mock_playboard, mock_scenario,
        mock_domain, mock_password, mock_admin, mock_user,
        mock_set_token, mock_init_activity
    ):
        """Test init_dependencies with file storage config"""
        from easylifeauth.api.dependencies import init_dependencies

        mock_db = MagicMock()
        mock_token_manager = MagicMock()
        mock_file_storage.return_value.enabled = True
        mock_file_storage.return_value.storage_type = "gcs"
        mock_init_activity.return_value = MagicMock()

        file_config = {"type": "gcs", "bucket": "test-bucket"}

        init_dependencies(mock_db, mock_token_manager, file_storage_config=file_config)

        mock_file_storage.assert_called_once_with(file_config)

    @patch(PATCH_DEPENDENCIES_INIT_ACTIVITY_LOG_SERVICE)
    @patch(PATCH_DEPENDENCIES_SET_TOKEN_MANAGER)
    @patch(PATCH_DEPENDENCIES_USERSERVICE)
    @patch(PATCH_DEPENDENCIES_ADMINSERVICE)
    @patch(PATCH_DEPENDENCIES_PASSWORDRESETSERVICE)
    @patch(PATCH_DEPENDENCIES_DATADOMAINSERVICE)
    @patch(PATCH_DEPENDENCIES_SCENARIOSERVICE)
    @patch(PATCH_DEPENDENCIES_PLAYBOARDSERVICE)
    @patch(PATCH_DEPENDENCIES_FEEDBACKSERVICE)
    @patch(PATCH_DEPENDENCIES_NEWSCENARIOSERVICE)
    @patch(PATCH_DEPENDENCIES_FILESTORAGESERVICE)
    @patch(PATCH_BULK_UPLOAD_ROUTES_INIT_BULK_SERVICES)
    @patch(PATCH_CONFIGURATIONS_ROUTES_INIT_GCS_SERVICE)
    def test_init_dependencies_with_gcs(
        self, mock_init_gcs, mock_init_bulk, mock_file_storage,
        mock_new_scenario, mock_feedback, mock_playboard, mock_scenario,
        mock_domain, mock_password, mock_admin, mock_user,
        mock_set_token, mock_init_activity
    ):
        """Test init_dependencies with GCS config"""
        from easylifeauth.api.dependencies import init_dependencies

        mock_db = MagicMock()
        mock_token_manager = MagicMock()
        mock_file_storage.return_value.enabled = False
        mock_init_activity.return_value = MagicMock()

        gcs_config = {"bucket": "test-bucket", "project": "test-project"}

        init_dependencies(mock_db, mock_token_manager, gcs_config=gcs_config)

        mock_init_bulk.assert_called_once_with(mock_db, gcs_config)
        mock_init_gcs.assert_called_once_with(gcs_config)

    @patch(PATCH_DEPENDENCIES_INIT_ACTIVITY_LOG_SERVICE)
    @patch(PATCH_DEPENDENCIES_SET_TOKEN_MANAGER)
    @patch(PATCH_DEPENDENCIES_USERSERVICE)
    @patch(PATCH_DEPENDENCIES_ADMINSERVICE)
    @patch(PATCH_DEPENDENCIES_PASSWORDRESETSERVICE)
    @patch(PATCH_DEPENDENCIES_DATADOMAINSERVICE)
    @patch(PATCH_DEPENDENCIES_SCENARIOSERVICE)
    @patch(PATCH_DEPENDENCIES_PLAYBOARDSERVICE)
    @patch(PATCH_DEPENDENCIES_FEEDBACKSERVICE)
    @patch(PATCH_DEPENDENCIES_NEWSCENARIOSERVICE)
    @patch(PATCH_DEPENDENCIES_FILESTORAGESERVICE)
    @patch(PATCH_BULK_UPLOAD_ROUTES_INIT_BULK_SERVICES)
    @patch(PATCH_CONFIGURATIONS_ROUTES_INIT_GCS_SERVICE)
    def test_init_dependencies_with_email_service(
        self, mock_init_gcs, mock_init_bulk, mock_file_storage,
        mock_new_scenario, mock_feedback, mock_playboard, mock_scenario,
        mock_domain, mock_password, mock_admin, mock_user,
        mock_set_token, mock_init_activity
    ):
        """Test init_dependencies with email service"""
        from easylifeauth.api.dependencies import init_dependencies
        import easylifeauth.api.dependencies as deps

        mock_db = MagicMock()
        mock_token_manager = MagicMock()
        mock_email_service = MagicMock()
        mock_file_storage.return_value.enabled = False
        mock_init_activity.return_value = MagicMock()

        init_dependencies(mock_db, mock_token_manager, email_service=mock_email_service)

        # Password service should receive email service
        mock_password.assert_called_once_with(mock_db, mock_token_manager, mock_email_service)
        # Feedback service should receive email service
        mock_feedback.assert_called_once()
