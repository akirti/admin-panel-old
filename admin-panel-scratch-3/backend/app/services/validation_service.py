"""
Validation service for comprehensive data validation.
"""
import re
from typing import Dict, List, Any, Optional
from datetime import datetime


class ValidationError(Exception):
    """Custom validation error with field information."""
    def __init__(self, field: str, message: str):
        self.field = field
        self.message = message
        super().__init__(f"{field}: {message}")


class ValidationService:
    """Service for validating entity data."""

    # Email validation pattern
    EMAIL_PATTERN = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

    # Username validation pattern (alphanumeric, hyphens, underscores)
    USERNAME_PATTERN = r'^[a-zA-Z0-9_-]{3,50}$'

    # Key/ID validation pattern (alphanumeric, hyphens, underscores, dots)
    KEY_PATTERN = r'^[a-zA-Z0-9_.-]{1,100}$'

    @staticmethod
    def validate_required(value: Any, field_name: str) -> None:
        """Validate that a field is not empty."""
        if value is None or (isinstance(value, str) and not value.strip()):
            raise ValidationError(field_name, "This field is required")

    @staticmethod
    def validate_email(email: str, field_name: str = "email") -> None:
        """Validate email format."""
        if not email:
            raise ValidationError(field_name, "Email is required")
        if not re.match(ValidationService.EMAIL_PATTERN, email):
            raise ValidationError(field_name, "Invalid email format")

    @staticmethod
    def validate_username(username: str, field_name: str = "username") -> None:
        """Validate username format."""
        if not username:
            raise ValidationError(field_name, "Username is required")
        if not re.match(ValidationService.USERNAME_PATTERN, username):
            raise ValidationError(
                field_name,
                "Username must be 3-50 characters long and contain only letters, numbers, hyphens, and underscores"
            )

    @staticmethod
    def validate_key(key: str, field_name: str = "key") -> None:
        """Validate key/ID format."""
        if not key:
            raise ValidationError(field_name, "Key is required")
        if not re.match(ValidationService.KEY_PATTERN, key):
            raise ValidationError(
                field_name,
                "Key must contain only letters, numbers, hyphens, underscores, and dots"
            )

    @staticmethod
    def validate_string_length(
        value: str,
        field_name: str,
        min_length: Optional[int] = None,
        max_length: Optional[int] = None
    ) -> None:
        """Validate string length."""
        if value is None:
            return

        length = len(value)
        if min_length is not None and length < min_length:
            raise ValidationError(field_name, f"Must be at least {min_length} characters long")
        if max_length is not None and length > max_length:
            raise ValidationError(field_name, f"Must not exceed {max_length} characters")

    @staticmethod
    def validate_choice(value: Any, choices: List[Any], field_name: str) -> None:
        """Validate that value is in allowed choices."""
        if value not in choices:
            raise ValidationError(field_name, f"Must be one of: {', '.join(str(c) for c in choices)}")

    @staticmethod
    def validate_list(value: Any, field_name: str, allow_empty: bool = True) -> None:
        """Validate that value is a list."""
        if value is None:
            if not allow_empty:
                raise ValidationError(field_name, "This field is required")
            return

        if not isinstance(value, list):
            raise ValidationError(field_name, "Must be a list")

        if not allow_empty and len(value) == 0:
            raise ValidationError(field_name, "Cannot be empty")

    @staticmethod
    def validate_integer(
        value: Any,
        field_name: str,
        min_value: Optional[int] = None,
        max_value: Optional[int] = None
    ) -> None:
        """Validate integer value and range."""
        if value is None:
            return

        try:
            int_value = int(value)
        except (ValueError, TypeError):
            raise ValidationError(field_name, "Must be a valid integer")

        if min_value is not None and int_value < min_value:
            raise ValidationError(field_name, f"Must be at least {min_value}")
        if max_value is not None and int_value > max_value:
            raise ValidationError(field_name, f"Must not exceed {max_value}")

    @staticmethod
    def validate_boolean(value: Any, field_name: str) -> None:
        """Validate boolean value."""
        if value is None:
            return
        if not isinstance(value, bool):
            raise ValidationError(field_name, "Must be a boolean (true/false)")

    @staticmethod
    def validate_user_data(data: Dict[str, Any]) -> List[str]:
        """Validate user creation/update data."""
        errors = []

        try:
            ValidationService.validate_required(data.get("email"), "email")
            ValidationService.validate_email(data.get("email", ""), "email")
        except ValidationError as e:
            errors.append(str(e))

        # Username is optional but if provided must be valid
        if data.get("username"):
            try:
                ValidationService.validate_string_length(data["username"], "username", min_length=3, max_length=50)
            except ValidationError as e:
                errors.append(str(e))

        if data.get("full_name"):
            try:
                ValidationService.validate_string_length(data["full_name"], "full_name", max_length=200)
            except ValidationError as e:
                errors.append(str(e))

        # Validate lists
        for field in ["roles", "groups", "customers"]:
            if field in data:
                try:
                    ValidationService.validate_list(data[field], field, allow_empty=True)
                except ValidationError as e:
                    errors.append(str(e))

        if "is_active" in data:
            try:
                ValidationService.validate_boolean(data["is_active"], "is_active")
            except ValidationError as e:
                errors.append(str(e))

        return errors

    @staticmethod
    def validate_role_data(data: Dict[str, Any]) -> List[str]:
        """Validate role creation/update data."""
        errors = []

        try:
            ValidationService.validate_required(data.get("roleId"), "roleId")
            ValidationService.validate_key(data.get("roleId", ""), "roleId")
        except ValidationError as e:
            errors.append(str(e))

        try:
            ValidationService.validate_required(data.get("name"), "name")
            ValidationService.validate_string_length(data.get("name", ""), "name", min_length=1, max_length=100)
        except ValidationError as e:
            errors.append(str(e))

        if data.get("description"):
            try:
                ValidationService.validate_string_length(data["description"], "description", max_length=500)
            except ValidationError as e:
                errors.append(str(e))

        if "status" in data:
            try:
                ValidationService.validate_choice(data["status"], ["active", "inactive"], "status")
            except ValidationError as e:
                errors.append(str(e))

        if "priority" in data:
            try:
                ValidationService.validate_integer(data["priority"], "priority", min_value=0, max_value=1000)
            except ValidationError as e:
                errors.append(str(e))

        return errors

    @staticmethod
    def validate_group_data(data: Dict[str, Any]) -> List[str]:
        """Validate group creation/update data."""
        errors = []

        try:
            ValidationService.validate_required(data.get("groupId"), "groupId")
            ValidationService.validate_key(data.get("groupId", ""), "groupId")
        except ValidationError as e:
            errors.append(str(e))

        try:
            ValidationService.validate_required(data.get("name"), "name")
            ValidationService.validate_string_length(data.get("name", ""), "name", min_length=1, max_length=100)
        except ValidationError as e:
            errors.append(str(e))

        if data.get("description"):
            try:
                ValidationService.validate_string_length(data["description"], "description", max_length=500)
            except ValidationError as e:
                errors.append(str(e))

        if "status" in data:
            try:
                ValidationService.validate_choice(data["status"], ["active", "inactive"], "status")
            except ValidationError as e:
                errors.append(str(e))

        return errors

    @staticmethod
    def validate_permission_data(data: Dict[str, Any]) -> List[str]:
        """Validate permission creation/update data."""
        errors = []

        try:
            ValidationService.validate_required(data.get("key"), "key")
            ValidationService.validate_key(data.get("key", ""), "key")
        except ValidationError as e:
            errors.append(str(e))

        try:
            ValidationService.validate_required(data.get("name"), "name")
            ValidationService.validate_string_length(data.get("name", ""), "name", min_length=1, max_length=100)
        except ValidationError as e:
            errors.append(str(e))

        try:
            ValidationService.validate_required(data.get("module"), "module")
            ValidationService.validate_string_length(data.get("module", ""), "module", min_length=1, max_length=50)
        except ValidationError as e:
            errors.append(str(e))

        if "actions" in data:
            try:
                ValidationService.validate_list(data["actions"], "actions", allow_empty=False)
            except ValidationError as e:
                errors.append(str(e))

        return errors

    @staticmethod
    def validate_customer_data(data: Dict[str, Any]) -> List[str]:
        """Validate customer creation/update data."""
        errors = []

        try:
            ValidationService.validate_required(data.get("customerId"), "customerId")
            ValidationService.validate_key(data.get("customerId", ""), "customerId")
        except ValidationError as e:
            errors.append(str(e))

        try:
            ValidationService.validate_required(data.get("name"), "name")
            ValidationService.validate_string_length(data.get("name", ""), "name", min_length=1, max_length=100)
        except ValidationError as e:
            errors.append(str(e))

        if data.get("description"):
            try:
                ValidationService.validate_string_length(data["description"], "description", max_length=500)
            except ValidationError as e:
                errors.append(str(e))

        if "status" in data:
            try:
                ValidationService.validate_choice(data["status"], ["active", "inactive"], "status")
            except ValidationError as e:
                errors.append(str(e))

        return errors

    @staticmethod
    def validate_domain_data(data: Dict[str, Any]) -> List[str]:
        """Validate domain creation/update data."""
        errors = []

        try:
            ValidationService.validate_required(data.get("key"), "key")
            ValidationService.validate_key(data.get("key", ""), "key")
        except ValidationError as e:
            errors.append(str(e))

        try:
            ValidationService.validate_required(data.get("name"), "name")
            ValidationService.validate_string_length(data.get("name", ""), "name", min_length=1, max_length=100)
        except ValidationError as e:
            errors.append(str(e))

        if "status" in data:
            try:
                ValidationService.validate_choice(data["status"], ["active", "inactive"], "status")
            except ValidationError as e:
                errors.append(str(e))

        if "order" in data:
            try:
                ValidationService.validate_integer(data["order"], "order", min_value=0)
            except ValidationError as e:
                errors.append(str(e))

        return errors


# Global validation service instance
validation_service = ValidationService()
