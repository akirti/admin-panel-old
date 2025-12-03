"""Tests for Error classes"""
import pytest

from easylifeauth.errors.auth_error import AuthError
from easylifeauth.errors.domain_error import (
    DomainError, DomainNotFoundError, DomainKeyError,
    DomainNotAuthorizeError, DomainNotAuthenitcatedError, DomainBadError
)
from easylifeauth.errors.scenario_error import (
    ScenarioError, ScenarioNotFoundError, ScenarioKeyError,
    ScenarioNotAuthorizeError, ScenarioNotAuthenitcatedError, ScenarioBadError
)
from easylifeauth.errors.playboard_error import (
    PlayboardError, PlayboardNotFoundError, PlayboardKeyError,
    PlayboardNotAuthorizeError, PlayboardNotAuthenitcatedError, PlayboardBadError
)
from easylifeauth.errors.email_error import EmailError


class TestAuthError:
    """Tests for AuthError"""

    def test_auth_error_default(self):
        """Test AuthError with default status code"""
        error = AuthError("Test error")
        assert error.message == "Test error"
        assert error.status_code == 400
        assert str(error) == "Test error"

    def test_auth_error_custom_status(self):
        """Test AuthError with custom status code"""
        error = AuthError("Unauthorized", 401)
        assert error.status_code == 401


class TestDomainErrors:
    """Tests for Domain errors"""

    def test_domain_error(self):
        """Test DomainError"""
        error = DomainError("Domain error")
        assert error.message == "Domain error"
        assert error.status_code == 400

    def test_domain_not_found_error(self):
        """Test DomainNotFoundError"""
        error = DomainNotFoundError("Not found")
        assert error.status_code == 404

    def test_domain_key_error(self):
        """Test DomainKeyError"""
        error = DomainKeyError("Key error")
        assert error.status_code == 400

    def test_domain_not_authorize_error(self):
        """Test DomainNotAuthorizeError"""
        error = DomainNotAuthorizeError("Forbidden")
        assert error.status_code == 403

    def test_domain_not_authenticated_error(self):
        """Test DomainNotAuthenitcatedError"""
        error = DomainNotAuthenitcatedError("Unauthenticated")
        assert error.status_code == 401

    def test_domain_bad_error(self):
        """Test DomainBadError"""
        error = DomainBadError("Bad request")
        assert error.status_code == 400


class TestScenarioErrors:
    """Tests for Scenario errors"""

    def test_scenario_error(self):
        """Test ScenarioError"""
        error = ScenarioError("Scenario error")
        assert error.message == "Scenario error"
        assert error.status_code == 400

    def test_scenario_not_found_error(self):
        """Test ScenarioNotFoundError"""
        error = ScenarioNotFoundError("Not found")
        assert error.status_code == 404

    def test_scenario_key_error(self):
        """Test ScenarioKeyError"""
        error = ScenarioKeyError("Key error")
        assert error.status_code == 400

    def test_scenario_not_authorize_error(self):
        """Test ScenarioNotAuthorizeError"""
        error = ScenarioNotAuthorizeError("Forbidden")
        assert error.status_code == 403

    def test_scenario_not_authenticated_error(self):
        """Test ScenarioNotAuthenitcatedError"""
        error = ScenarioNotAuthenitcatedError("Unauthenticated")
        assert error.status_code == 401

    def test_scenario_bad_error(self):
        """Test ScenarioBadError"""
        error = ScenarioBadError("Bad request")
        assert error.status_code == 400


class TestPlayboardErrors:
    """Tests for Playboard errors"""

    def test_playboard_error(self):
        """Test PlayboardError"""
        error = PlayboardError("Playboard error")
        assert error.message == "Playboard error"
        assert error.status_code == 404  # Default is 404 for PlayboardError

    def test_playboard_not_found_error(self):
        """Test PlayboardNotFoundError"""
        error = PlayboardNotFoundError("Not found")
        assert error.status_code == 404

    def test_playboard_key_error(self):
        """Test PlayboardKeyError"""
        error = PlayboardKeyError("Key error")
        assert error.status_code == 400

    def test_playboard_not_authorize_error(self):
        """Test PlayboardNotAuthorizeError"""
        error = PlayboardNotAuthorizeError("Forbidden")
        assert error.status_code == 403

    def test_playboard_not_authenticated_error(self):
        """Test PlayboardNotAuthenitcatedError"""
        error = PlayboardNotAuthenitcatedError("Unauthenticated")
        assert error.status_code == 401

    def test_playboard_bad_error(self):
        """Test PlayboardBadError"""
        error = PlayboardBadError("Bad request")
        assert error.status_code == 400


class TestEmailError:
    """Tests for EmailError"""

    def test_email_error_default(self):
        """Test EmailError with default status code"""
        error = EmailError("Email failed")
        assert error.message == "Email failed"
        assert error.status_code == 400

    def test_email_error_custom_status(self):
        """Test EmailError with custom status code"""
        error = EmailError("Server error", 500)
        assert error.status_code == 500
