"""Tests for Email Service"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from email.mime.multipart import MIMEMultipart

from easylifeauth.services.email_service import EmailService
from easylifeauth.errors.email_error import EmailError


class TestEmailService:
    """Tests for EmailService"""

    @pytest.fixture
    def email_service(self):
        """Create email service with mock config"""
        config = {
            "smtp_server": "smtp.test.com",
            "smtp_port": 587,
            "email": "noreply@test.com",
            "password": "password123"
        }
        return EmailService(config)

    def test_prepare_email_template(self, email_service):
        """Test preparing password reset email template"""
        result = email_service._prepare_email_template(
            to_email="user@test.com",
            reset_token="abc123",
            reset_url="http://example.com/reset"
        )

        assert isinstance(result, MIMEMultipart)
        assert result["To"] == "user@test.com"
        assert result["Subject"] == "Password Reset Request"

    def test_prepare_feedback_email_template(self, email_service):
        """Test preparing feedback email template"""
        result = email_service._prepare_feedback_email_template(
            to_email="user@test.com",
            data={
                "rating": 5,
                "improvements": "None",
                "suggestions": "Great!",
                "createdAt": "2024-01-01"
            }
        )

        assert isinstance(result, MIMEMultipart)
        assert result["To"] == "user@test.com"

    def test_prepare_feedback_email_template_no_data(self, email_service):
        """Test preparing feedback email with no data"""
        result = email_service._prepare_feedback_email_template(
            to_email="user@test.com",
            data=None
        )

        assert isinstance(result, MIMEMultipart)

    def test_generate_scenario_steps_template(self, email_service):
        """Test generating scenario steps HTML"""
        data = {
            "steps": ["Step 1", "Step 2"],
            "stepQueries": ["SELECT 1", "SELECT 2"]
        }

        result = email_service._generate_scenario_steps_template(data)

        assert "<ol>" in result
        assert "Step 1" in result
        assert "SELECT 1" in result

    def test_generate_scenario_steps_template_empty(self, email_service):
        """Test generating steps with empty data"""
        result = email_service._generate_scenario_steps_template({})

        assert "<ol>" in result
        assert "</ol>" in result

    def test_generate_scenario_steps_template_mismatched(self, email_service):
        """Test generating steps with mismatched lengths"""
        data = {
            "steps": ["Step 1", "Step 2", "Step 3"],
            "stepQueries": ["Query 1"]
        }

        result = email_service._generate_scenario_steps_template(data)

        assert "Step 1" in result
        assert "Step 3" in result

    def test_prepare_scenario_email_template(self, email_service):
        """Test preparing scenario request email"""
        data = {
            "requestId": "REQ-SCR-0001",
            "scenarioName": "Test Scenario",
            "description": "Test Description",
            "dataDomain": "test-domain",
            "databases": ["db1"],
            "steps": ["Step 1"],
            "stepQueries": ["Query 1"],
            "filters": ["filter1"],
            "status": "S",
            "rowUpdateStp": "2024-01-01"
        }

        result = email_service._prepare_scenario_email_template(
            to_email="user@test.com",
            data=data
        )

        assert isinstance(result, MIMEMultipart)
        assert "REQ-SCR-0001" in result["Subject"]

    def test_prepare_scenario_email_template_with_comments(self, email_service):
        """Test preparing scenario email with comments"""
        data = {
            "requestId": "REQ-SCR-0001",
            "scenarioName": "Test Scenario",
            "description": "Test",
            "dataDomain": "test",
            "status": "P",
            "comments": ["Comment 1", "Comment 2"],
            "rowUpdateStp": "2024-01-01"
        }

        result = email_service._prepare_scenario_email_template(
            to_email="user@test.com",
            data=data
        )

        assert isinstance(result, MIMEMultipart)

    @pytest.mark.asyncio
    @patch('easylifeauth.services.email_service.aiosmtplib.send')
    async def test_send_reset_email_success(self, mock_send, email_service):
        """Test sending reset email successfully"""
        mock_send.return_value = AsyncMock()

        # Should not raise
        await email_service.send_reset_email(
            to_email="user@test.com",
            reset_token="abc123",
            reset_url="http://example.com/reset"
        )

        mock_send.assert_called_once()

    @pytest.mark.asyncio
    @patch('easylifeauth.services.email_service.aiosmtplib.send')
    async def test_send_reset_email_failure(self, mock_send, email_service):
        """Test sending reset email with failure"""
        mock_send.side_effect = Exception("SMTP Error")

        with pytest.raises(EmailError):
            await email_service.send_reset_email(
                to_email="user@test.com",
                reset_token="abc123",
                reset_url="http://example.com/reset"
            )

    @pytest.mark.asyncio
    @patch('easylifeauth.services.email_service.aiosmtplib.send')
    async def test_send_feedback_email_success(self, mock_send, email_service):
        """Test sending feedback email successfully"""
        mock_send.return_value = AsyncMock()

        await email_service.send_feedback_email(
            to_email="user@test.com",
            data={"rating": 5}
        )

        mock_send.assert_called_once()

    @pytest.mark.asyncio
    @patch('easylifeauth.services.email_service.aiosmtplib.send')
    async def test_send_feedback_email_failure(self, mock_send, email_service):
        """Test sending feedback email with failure"""
        mock_send.side_effect = Exception("SMTP Error")

        with pytest.raises(EmailError):
            await email_service.send_feedback_email(
                to_email="user@test.com",
                data={"rating": 5}
            )

    @pytest.mark.asyncio
    @patch('easylifeauth.services.email_service.aiosmtplib.send')
    async def test_send_scenario_email_success(self, mock_send, email_service):
        """Test sending scenario email successfully"""
        mock_send.return_value = AsyncMock()

        await email_service.send_scenario_email(
            to_email="user@test.com",
            data={
                "requestId": "REQ-SCR-0001",
                "scenarioName": "Test",
                "description": "Test",
                "dataDomain": "test",
                "status": "S",
                "rowUpdateStp": "2024-01-01"
            }
        )

        mock_send.assert_called_once()

    @pytest.mark.asyncio
    @patch('easylifeauth.services.email_service.aiosmtplib.send')
    async def test_send_scenario_email_failure(self, mock_send, email_service):
        """Test sending scenario email with failure"""
        mock_send.side_effect = Exception("SMTP Error")

        with pytest.raises(EmailError):
            await email_service.send_scenario_email(
                to_email="user@test.com",
                data={
                    "requestId": "REQ-SCR-0001",
                    "scenarioName": "Test",
                    "status": "S",
                    "rowUpdateStp": "2024-01-01"
                }
            )

    # ===================== Additional Tests for Coverage =====================

    @pytest.fixture
    def email_service_with_tls(self):
        """Create email service with TLS enabled"""
        config = {
            "smtp_server": "smtp.test.com",
            "smtp_port": 587,
            "email": "noreply@test.com",
            "password": "password123",
            "use_tls": True
        }
        return EmailService(config)

    @pytest.fixture
    def email_service_no_auth(self):
        """Create email service without authentication"""
        config = {
            "smtp_server": "localhost",
            "smtp_port": 25,
            "email": "noreply@test.com",
        }
        return EmailService(config)

    def test_prepare_welcome_email_template(self, email_service):
        """Test preparing welcome email template"""
        result = email_service._prepare_welcome_email_template(
            to_email="user@test.com",
            full_name="Test User",
            password="temp123456"
        )

        assert isinstance(result, MIMEMultipart)
        assert result["To"] == "user@test.com"
        assert "Welcome" in result["Subject"]

    def test_prepare_password_reset_email_template(self, email_service):
        """Test preparing password reset email template"""
        result = email_service._prepare_password_reset_email_template(
            to_email="user@test.com",
            full_name="Test User",
            reset_token="abc123"
        )

        assert isinstance(result, MIMEMultipart)
        assert result["To"] == "user@test.com"
        assert "Password Reset" in result["Subject"]

    @pytest.mark.asyncio
    @patch('easylifeauth.services.email_service.aiosmtplib.send')
    async def test_send_welcome_email_success(self, mock_send, email_service):
        """Test sending welcome email successfully"""
        mock_send.return_value = AsyncMock()

        await email_service.send_welcome_email(
            to_email="user@test.com",
            full_name="Test User",
            password="temp123456"
        )

        mock_send.assert_called_once()

    @pytest.mark.asyncio
    @patch('easylifeauth.services.email_service.aiosmtplib.send')
    async def test_send_welcome_email_failure(self, mock_send, email_service):
        """Test sending welcome email with failure"""
        mock_send.side_effect = Exception("SMTP Error")

        with pytest.raises(EmailError):
            await email_service.send_welcome_email(
                to_email="user@test.com",
                full_name="Test User",
                password="temp123456"
            )

    @pytest.mark.asyncio
    @patch('easylifeauth.services.email_service.aiosmtplib.send')
    async def test_send_welcome_email_with_tls(self, mock_send, email_service_with_tls):
        """Test sending welcome email with TLS"""
        mock_send.return_value = AsyncMock()

        await email_service_with_tls.send_welcome_email(
            to_email="user@test.com",
            full_name="Test User",
            password="temp123456"
        )

        mock_send.assert_called_once()
        # Verify TLS params were used
        call_kwargs = mock_send.call_args[1]
        assert call_kwargs.get("start_tls") is True

    @pytest.mark.asyncio
    @patch('easylifeauth.services.email_service.aiosmtplib.send')
    async def test_send_password_reset_email_success(self, mock_send, email_service):
        """Test sending password reset email successfully"""
        mock_send.return_value = AsyncMock()

        await email_service.send_password_reset_email(
            to_email="user@test.com",
            full_name="Test User",
            reset_token="abc123"
        )

        mock_send.assert_called_once()

    @pytest.mark.asyncio
    @patch('easylifeauth.services.email_service.aiosmtplib.send')
    async def test_send_password_reset_email_failure(self, mock_send, email_service):
        """Test sending password reset email with failure"""
        mock_send.side_effect = Exception("SMTP Error")

        with pytest.raises(EmailError):
            await email_service.send_password_reset_email(
                to_email="user@test.com",
                full_name="Test User",
                reset_token="abc123"
            )

    @pytest.mark.asyncio
    @patch('easylifeauth.services.email_service.aiosmtplib.send')
    async def test_send_password_reset_email_with_tls(self, mock_send, email_service_with_tls):
        """Test sending password reset email with TLS"""
        mock_send.return_value = AsyncMock()

        await email_service_with_tls.send_password_reset_email(
            to_email="user@test.com",
            full_name="Test User",
            reset_token="abc123"
        )

        mock_send.assert_called_once()
        call_kwargs = mock_send.call_args[1]
        assert call_kwargs.get("start_tls") is True

    @pytest.mark.asyncio
    @patch('easylifeauth.services.email_service.aiosmtplib.send')
    async def test_send_reset_email_with_tls(self, mock_send, email_service_with_tls):
        """Test sending reset email with TLS"""
        mock_send.return_value = AsyncMock()

        await email_service_with_tls.send_reset_email(
            to_email="user@test.com",
            reset_token="abc123",
            reset_url="http://example.com/reset"
        )

        mock_send.assert_called_once()
        call_kwargs = mock_send.call_args[1]
        assert call_kwargs.get("start_tls") is True

    @pytest.mark.asyncio
    @patch('easylifeauth.services.email_service.aiosmtplib.send')
    async def test_send_feedback_email_with_tls(self, mock_send, email_service_with_tls):
        """Test sending feedback email with TLS"""
        mock_send.return_value = AsyncMock()

        await email_service_with_tls.send_feedback_email(
            to_email="user@test.com",
            data={"rating": 5}
        )

        mock_send.assert_called_once()
        call_kwargs = mock_send.call_args[1]
        assert call_kwargs.get("start_tls") is True

    @pytest.mark.asyncio
    @patch('easylifeauth.services.email_service.aiosmtplib.send')
    async def test_send_scenario_email_with_tls(self, mock_send, email_service_with_tls):
        """Test sending scenario email with TLS"""
        mock_send.return_value = AsyncMock()

        await email_service_with_tls.send_scenario_email(
            to_email="user@test.com",
            data={
                "requestId": "REQ-SCR-0001",
                "scenarioName": "Test",
                "status": "S",
                "rowUpdateStp": "2024-01-01"
            }
        )

        mock_send.assert_called_once()
        call_kwargs = mock_send.call_args[1]
        assert call_kwargs.get("start_tls") is True

    @pytest.mark.asyncio
    @patch('easylifeauth.services.email_service.aiosmtplib.send')
    async def test_send_reset_email_no_auth(self, mock_send, email_service_no_auth):
        """Test sending reset email without authentication"""
        mock_send.return_value = AsyncMock()

        await email_service_no_auth.send_reset_email(
            to_email="user@test.com",
            reset_token="abc123",
            reset_url="http://example.com/reset"
        )

        mock_send.assert_called_once()
        call_kwargs = mock_send.call_args[1]
        # Should not have TLS or username/password
        assert "start_tls" not in call_kwargs or call_kwargs.get("start_tls") is None

    def test_generate_scenario_steps_template_non_list(self, email_service):
        """Test generating steps when steps/queries are not lists"""
        data = {
            "steps": "not a list",
            "stepQueries": "also not a list"
        }

        result = email_service._generate_scenario_steps_template(data)

        assert "<ol>" in result
        assert "</ol>" in result

    def test_email_service_default_config(self):
        """Test email service with default config values"""
        service = EmailService({})

        assert service.smtp_server == "localhost"
        assert service.smtp_port == 25
        assert service.email == "noreply@easylife.local"
        assert service.password is None
        assert service.use_tls is False
