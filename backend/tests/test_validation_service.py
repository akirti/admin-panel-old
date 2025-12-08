"""Tests for Validation Service"""
import pytest

from easylifeauth.services.validation_service import (
    ValidationService,
    ValidationError,
    validate_domain_data,
    validate_scenario_data
)


class TestValidationError:
    """Tests for ValidationError class"""

    def test_validation_error_creation(self):
        """Test ValidationError creation"""
        error = ValidationError("email", "Invalid email format")
        assert error.field == "email"
        assert error.message == "Invalid email format"
        assert str(error) == "email: Invalid email format"


class TestValidateRequired:
    """Tests for validate_required method"""

    def test_validate_required_with_value(self):
        """Test validation passes with valid value"""
        # Should not raise
        ValidationService.validate_required("value", "field")

    def test_validate_required_with_none(self):
        """Test validation fails with None"""
        with pytest.raises(ValidationError) as exc:
            ValidationService.validate_required(None, "field")
        assert exc.value.field == "field"

    def test_validate_required_with_empty_string(self):
        """Test validation fails with empty string"""
        with pytest.raises(ValidationError):
            ValidationService.validate_required("", "field")

    def test_validate_required_with_whitespace(self):
        """Test validation fails with whitespace only"""
        with pytest.raises(ValidationError):
            ValidationService.validate_required("   ", "field")


class TestValidateEmail:
    """Tests for validate_email method"""

    def test_validate_email_valid(self):
        """Test valid email passes"""
        ValidationService.validate_email("test@example.com")

    def test_validate_email_empty(self):
        """Test empty email fails"""
        with pytest.raises(ValidationError) as exc:
            ValidationService.validate_email("")
        assert "required" in exc.value.message.lower()

    def test_validate_email_invalid_format(self):
        """Test invalid email format fails"""
        with pytest.raises(ValidationError) as exc:
            ValidationService.validate_email("invalid-email")
        assert "invalid email format" in exc.value.message.lower()

    def test_validate_email_no_domain(self):
        """Test email without domain fails"""
        with pytest.raises(ValidationError):
            ValidationService.validate_email("test@")

    def test_validate_email_custom_field_name(self):
        """Test custom field name is used"""
        with pytest.raises(ValidationError) as exc:
            ValidationService.validate_email("", "user_email")
        assert exc.value.field == "user_email"


class TestValidateUsername:
    """Tests for validate_username method"""

    def test_validate_username_valid(self):
        """Test valid username passes"""
        ValidationService.validate_username("testuser123")

    def test_validate_username_empty(self):
        """Test empty username fails"""
        with pytest.raises(ValidationError):
            ValidationService.validate_username("")

    def test_validate_username_with_hyphens(self):
        """Test username with hyphens passes"""
        ValidationService.validate_username("test-user")

    def test_validate_username_with_underscores(self):
        """Test username with underscores passes"""
        ValidationService.validate_username("test_user")

    def test_validate_username_too_short(self):
        """Test username too short fails"""
        with pytest.raises(ValidationError):
            ValidationService.validate_username("ab")

    def test_validate_username_with_spaces(self):
        """Test username with spaces fails"""
        with pytest.raises(ValidationError):
            ValidationService.validate_username("test user")

    def test_validate_username_with_special_chars(self):
        """Test username with special characters fails"""
        with pytest.raises(ValidationError):
            ValidationService.validate_username("test@user")


class TestValidateKey:
    """Tests for validate_key method"""

    def test_validate_key_valid(self):
        """Test valid key passes"""
        ValidationService.validate_key("my-key_123")

    def test_validate_key_empty(self):
        """Test empty key fails"""
        with pytest.raises(ValidationError):
            ValidationService.validate_key("")

    def test_validate_key_with_dot(self):
        """Test key with dot passes"""
        ValidationService.validate_key("my.key")

    def test_validate_key_with_spaces(self):
        """Test key with spaces fails"""
        with pytest.raises(ValidationError):
            ValidationService.validate_key("my key")


class TestValidateStringLength:
    """Tests for validate_string_length method"""

    def test_validate_string_length_valid(self):
        """Test valid string length passes"""
        ValidationService.validate_string_length("test", "field", min_length=2, max_length=10)

    def test_validate_string_length_none(self):
        """Test None value is allowed"""
        ValidationService.validate_string_length(None, "field", min_length=2)

    def test_validate_string_length_too_short(self):
        """Test string too short fails"""
        with pytest.raises(ValidationError) as exc:
            ValidationService.validate_string_length("a", "field", min_length=5)
        assert "at least 5" in exc.value.message

    def test_validate_string_length_too_long(self):
        """Test string too long fails"""
        with pytest.raises(ValidationError) as exc:
            ValidationService.validate_string_length("a" * 100, "field", max_length=50)
        assert "exceed 50" in exc.value.message


class TestValidateChoice:
    """Tests for validate_choice method"""

    def test_validate_choice_valid(self):
        """Test valid choice passes"""
        ValidationService.validate_choice("active", ["active", "inactive"], "status")

    def test_validate_choice_invalid(self):
        """Test invalid choice fails"""
        with pytest.raises(ValidationError) as exc:
            ValidationService.validate_choice("unknown", ["active", "inactive"], "status")
        assert "must be one of" in exc.value.message.lower()


class TestValidateList:
    """Tests for validate_list method"""

    def test_validate_list_valid(self):
        """Test valid list passes"""
        ValidationService.validate_list(["a", "b"], "field")

    def test_validate_list_none_allowed(self):
        """Test None is allowed when allow_empty=True"""
        ValidationService.validate_list(None, "field", allow_empty=True)

    def test_validate_list_none_not_allowed(self):
        """Test None fails when allow_empty=False"""
        with pytest.raises(ValidationError):
            ValidationService.validate_list(None, "field", allow_empty=False)

    def test_validate_list_not_a_list(self):
        """Test non-list value fails"""
        with pytest.raises(ValidationError) as exc:
            ValidationService.validate_list("not a list", "field")
        assert "must be a list" in exc.value.message.lower()

    def test_validate_list_empty_not_allowed(self):
        """Test empty list fails when allow_empty=False"""
        with pytest.raises(ValidationError):
            ValidationService.validate_list([], "field", allow_empty=False)


class TestValidateInteger:
    """Tests for validate_integer method"""

    def test_validate_integer_valid(self):
        """Test valid integer passes"""
        ValidationService.validate_integer(5, "field", min_value=0, max_value=10)

    def test_validate_integer_none(self):
        """Test None is allowed"""
        ValidationService.validate_integer(None, "field", min_value=0)

    def test_validate_integer_string_number(self):
        """Test string number passes"""
        ValidationService.validate_integer("5", "field")

    def test_validate_integer_invalid(self):
        """Test invalid integer fails"""
        with pytest.raises(ValidationError):
            ValidationService.validate_integer("not a number", "field")

    def test_validate_integer_too_small(self):
        """Test integer below minimum fails"""
        with pytest.raises(ValidationError) as exc:
            ValidationService.validate_integer(0, "field", min_value=5)
        assert "at least 5" in exc.value.message

    def test_validate_integer_too_large(self):
        """Test integer above maximum fails"""
        with pytest.raises(ValidationError) as exc:
            ValidationService.validate_integer(100, "field", max_value=50)
        assert "exceed 50" in exc.value.message


class TestValidateBoolean:
    """Tests for validate_boolean method"""

    def test_validate_boolean_true(self):
        """Test True passes"""
        ValidationService.validate_boolean(True, "field")

    def test_validate_boolean_false(self):
        """Test False passes"""
        ValidationService.validate_boolean(False, "field")

    def test_validate_boolean_none(self):
        """Test None is allowed"""
        ValidationService.validate_boolean(None, "field")

    def test_validate_boolean_string(self):
        """Test string fails"""
        with pytest.raises(ValidationError):
            ValidationService.validate_boolean("true", "field")

    def test_validate_boolean_integer(self):
        """Test integer fails"""
        with pytest.raises(ValidationError):
            ValidationService.validate_boolean(1, "field")


class TestValidateUserData:
    """Tests for validate_user_data method"""

    def test_validate_user_data_valid(self):
        """Test valid user data passes"""
        errors = ValidationService.validate_user_data({
            "email": "test@example.com",
            "username": "testuser",
            "full_name": "Test User",
            "roles": ["user"],
            "groups": ["viewer"],
            "is_active": True
        })
        assert len(errors) == 0

    def test_validate_user_data_missing_email(self):
        """Test missing email fails"""
        errors = ValidationService.validate_user_data({})
        assert any("email" in e.lower() for e in errors)

    def test_validate_user_data_invalid_email(self):
        """Test invalid email fails"""
        errors = ValidationService.validate_user_data({
            "email": "invalid"
        })
        assert len(errors) > 0

    def test_validate_user_data_invalid_username(self):
        """Test invalid username fails"""
        errors = ValidationService.validate_user_data({
            "email": "test@example.com",
            "username": "a"  # Too short
        })
        assert any("username" in e.lower() for e in errors)

    def test_validate_user_data_long_full_name(self):
        """Test too long full_name fails"""
        errors = ValidationService.validate_user_data({
            "email": "test@example.com",
            "full_name": "a" * 300
        })
        assert any("full_name" in e.lower() for e in errors)

    def test_validate_user_data_invalid_roles(self):
        """Test invalid roles fails"""
        errors = ValidationService.validate_user_data({
            "email": "test@example.com",
            "roles": "not a list"
        })
        assert any("roles" in e.lower() for e in errors)

    def test_validate_user_data_invalid_is_active(self):
        """Test invalid is_active fails"""
        errors = ValidationService.validate_user_data({
            "email": "test@example.com",
            "is_active": "yes"
        })
        assert any("is_active" in e.lower() for e in errors)


class TestValidateRoleData:
    """Tests for validate_role_data method"""

    def test_validate_role_data_valid(self):
        """Test valid role data passes"""
        errors = ValidationService.validate_role_data({
            "roleId": "admin",
            "name": "Administrator",
            "description": "Admin role",
            "status": "active",
            "priority": 10
        })
        assert len(errors) == 0

    def test_validate_role_data_missing_roleId(self):
        """Test missing roleId fails"""
        errors = ValidationService.validate_role_data({
            "name": "Role"
        })
        assert any("roleId" in e for e in errors)

    def test_validate_role_data_missing_name(self):
        """Test missing name fails"""
        errors = ValidationService.validate_role_data({
            "roleId": "role-id"
        })
        assert any("name" in e for e in errors)

    def test_validate_role_data_invalid_status(self):
        """Test invalid status fails"""
        errors = ValidationService.validate_role_data({
            "roleId": "role-id",
            "name": "Role",
            "status": "unknown"
        })
        assert any("status" in e for e in errors)

    def test_validate_role_data_invalid_priority(self):
        """Test invalid priority fails"""
        errors = ValidationService.validate_role_data({
            "roleId": "role-id",
            "name": "Role",
            "priority": -1
        })
        assert any("priority" in e for e in errors)

    def test_validate_role_data_long_description(self):
        """Test too long description fails"""
        errors = ValidationService.validate_role_data({
            "roleId": "role-id",
            "name": "Role",
            "description": "a" * 600
        })
        assert any("description" in e for e in errors)


class TestValidateGroupData:
    """Tests for validate_group_data method"""

    def test_validate_group_data_valid(self):
        """Test valid group data passes"""
        errors = ValidationService.validate_group_data({
            "groupId": "viewers",
            "name": "Viewers Group",
            "description": "Can view content",
            "status": "active"
        })
        assert len(errors) == 0

    def test_validate_group_data_missing_groupId(self):
        """Test missing groupId fails"""
        errors = ValidationService.validate_group_data({
            "name": "Group"
        })
        assert any("groupId" in e for e in errors)

    def test_validate_group_data_missing_name(self):
        """Test missing name fails"""
        errors = ValidationService.validate_group_data({
            "groupId": "group-id"
        })
        assert any("name" in e for e in errors)

    def test_validate_group_data_invalid_status(self):
        """Test invalid status fails"""
        errors = ValidationService.validate_group_data({
            "groupId": "group-id",
            "name": "Group",
            "status": "pending"
        })
        assert any("status" in e for e in errors)

    def test_validate_group_data_long_description(self):
        """Test too long description fails"""
        errors = ValidationService.validate_group_data({
            "groupId": "group-id",
            "name": "Group",
            "description": "a" * 600
        })
        assert any("description" in e for e in errors)


class TestValidateDomainData:
    """Tests for validate_domain_data method"""

    def test_validate_domain_data_valid(self):
        """Test valid domain data passes"""
        errors = ValidationService.validate_domain_data({
            "key": "domain-key",
            "name": "Domain Name",
            "status": "active",
            "order": 1
        })
        assert len(errors) == 0

    def test_validate_domain_data_missing_key(self):
        """Test missing key fails"""
        errors = ValidationService.validate_domain_data({
            "name": "Domain"
        })
        assert any("key" in e for e in errors)

    def test_validate_domain_data_missing_name(self):
        """Test missing name fails"""
        errors = ValidationService.validate_domain_data({
            "key": "domain-key"
        })
        assert any("name" in e for e in errors)

    def test_validate_domain_data_invalid_status(self):
        """Test invalid status fails"""
        errors = ValidationService.validate_domain_data({
            "key": "domain-key",
            "name": "Domain",
            "status": "unknown"
        })
        assert any("status" in e for e in errors)

    def test_validate_domain_data_invalid_order(self):
        """Test invalid order fails"""
        errors = ValidationService.validate_domain_data({
            "key": "domain-key",
            "name": "Domain",
            "order": -5
        })
        assert any("order" in e for e in errors)


class TestValidateScenarioData:
    """Tests for validate_scenario_data method"""

    def test_validate_scenario_data_valid(self):
        """Test valid scenario data passes"""
        errors = ValidationService.validate_scenario_data({
            "key": "scenario-key",
            "name": "Scenario Name",
            "domainKey": "domain-key"
        })
        assert len(errors) == 0

    def test_validate_scenario_data_missing_domainKey(self):
        """Test missing domainKey fails"""
        errors = ValidationService.validate_scenario_data({
            "key": "scenario-key",
            "name": "Scenario"
        })
        assert any("domainKey" in e for e in errors)


class TestHelperFunctions:
    """Tests for helper function aliases"""

    def test_validate_domain_data_helper(self):
        """Test validate_domain_data helper function"""
        errors = validate_domain_data({
            "key": "test",
            "name": "Test"
        })
        assert len(errors) == 0

    def test_validate_scenario_data_helper(self):
        """Test validate_scenario_data helper function"""
        errors = validate_scenario_data({
            "key": "test",
            "name": "Test",
            "domainKey": "domain"
        })
        assert len(errors) == 0
