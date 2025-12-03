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
        result = email_service.prepare_email_template(
            to_email="user@test.com",
            reset_token="abc123",
            reset_url="http://example.com/reset"
        )
        
        assert isinstance(result, MIMEMultipart)
        assert result["To"] == "user@test.com"
        assert result["Subject"] == "Password Reset Request"

    def test_prepare_feedback_email_template(self, email_service):
        """Test preparing feedback email template"""
        result = email_service.prepare_feedback_email_template(
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
        result = email_service.prepare_feedback_email_template(
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
        
        result = email_service.generate_senario_steps_template(data)
        
        assert "<ol>" in result
        assert "Step 1" in result
        assert "SELECT 1" in result

    def test_generate_scenario_steps_template_empty(self, email_service):
        """Test generating steps with empty data"""
        result = email_service.generate_senario_steps_template({})
        
        assert "<ol>" in result
        assert "</ol>" in result

    def test_generate_scenario_steps_template_mismatched(self, email_service):
        """Test generating steps with mismatched lengths"""
        data = {
            "steps": ["Step 1", "Step 2", "Step 3"],
            "stepQueries": ["Query 1"]
        }
        
        result = email_service.generate_senario_steps_template(data)
        
        assert "Step 1" in result
        assert "Step 3" in result

    def test_prepare_new_scenario_email_template(self, email_service):
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
        
        result = email_service.prepare_new_scenario_email_template(
            to_email="user@test.com",
            data=data
        )
        
        assert isinstance(result, MIMEMultipart)
        assert "REQ-SCR-0001" in result["Subject"]

    def test_prepare_new_scenario_email_template_with_comments(self, email_service):
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
        
        result = email_service.prepare_new_scenario_email_template(
            to_email="user@test.com",
            data=data
        )
        
        assert isinstance(result, MIMEMultipart)

    @patch('smtplib.SMTP')
    def test_send_reset_email_success(self, mock_smtp, email_service):
        """Test sending reset email successfully"""
        mock_server = MagicMock()
        mock_smtp.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp.return_value.__exit__ = MagicMock(return_value=False)
        
        # Should not raise
        email_service.send_reset_email(
            to_email="user@test.com",
            reset_token="abc123",
            reset_url="http://example.com/reset"
        )
        
        mock_server.send_message.assert_called_once()

    @patch('smtplib.SMTP')
    def test_send_reset_email_failure(self, mock_smtp, email_service):
        """Test sending reset email with failure"""
        mock_smtp.return_value.__enter__ = MagicMock(
            side_effect=Exception("SMTP Error")
        )
        
        with pytest.raises(EmailError):
            email_service.send_reset_email(
                to_email="user@test.com",
                reset_token="abc123",
                reset_url="http://example.com/reset"
            )

    @patch('smtplib.SMTP')
    def test_send_feedback_email_success(self, mock_smtp, email_service):
        """Test sending feedback email successfully"""
        mock_server = MagicMock()
        mock_smtp.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp.return_value.__exit__ = MagicMock(return_value=False)
        
        email_service.send_feedback_email(
            to_email="user@test.com",
            data={"rating": 5}
        )
        
        mock_server.send_message.assert_called_once()

    @patch('smtplib.SMTP')
    def test_send_feedback_email_failure(self, mock_smtp, email_service):
        """Test sending feedback email with failure"""
        mock_smtp.return_value.__enter__ = MagicMock(
            side_effect=Exception("SMTP Error")
        )
        
        with pytest.raises(EmailError):
            email_service.send_feedback_email(
                to_email="user@test.com",
                data={"rating": 5}
            )

    @patch('smtplib.SMTP')
    def test_send_scenario_email_success(self, mock_smtp, email_service):
        """Test sending scenario email successfully"""
        mock_server = MagicMock()
        mock_smtp.return_value.__enter__ = MagicMock(return_value=mock_server)
        mock_smtp.return_value.__exit__ = MagicMock(return_value=False)
        
        email_service.send_scenario_email(
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
        
        mock_server.send_message.assert_called_once()

    @patch('smtplib.SMTP')
    def test_send_scenario_email_failure(self, mock_smtp, email_service):
        """Test sending scenario email with failure"""
        mock_smtp.return_value.__enter__ = MagicMock(
            side_effect=Exception("SMTP Error")
        )
        
        with pytest.raises(EmailError):
            email_service.send_scenario_email(
                to_email="user@test.com",
                data={
                    "requestId": "REQ-SCR-0001",
                    "scenarioName": "Test",
                    "status": "S",
                    "rowUpdateStp": "2024-01-01"
                }
            )
