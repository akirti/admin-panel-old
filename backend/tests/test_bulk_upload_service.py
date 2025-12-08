"""Tests for Bulk Upload Service"""
import pytest
import pandas as pd
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId

from easylifeauth.services.bulk_upload_service import BulkUploadService, BulkUploadResult


class TestBulkUploadResult:
    """Tests for BulkUploadResult class"""

    def test_default_creation(self):
        """Test default result creation"""
        result = BulkUploadResult()
        assert result.total == 0
        assert result.successful == 0
        assert result.failed == 0
        assert result.errors == []

    def test_creation_with_values(self):
        """Test result creation with values"""
        result = BulkUploadResult(total=10, successful=8, failed=2, errors=[{"row": 1, "error": "test"}])
        assert result.total == 10
        assert result.successful == 8
        assert result.failed == 2
        assert len(result.errors) == 1

    def test_to_dict(self):
        """Test to_dict method"""
        result = BulkUploadResult(total=5, successful=4, failed=1)
        d = result.to_dict()
        assert d["total"] == 5
        assert d["successful"] == 4
        assert d["failed"] == 1


class TestBulkUploadService:
    """Tests for BulkUploadService"""

    @pytest.fixture
    def mock_db(self):
        """Create mock database"""
        db = MagicMock()
        db.users = MagicMock()
        db.users.find_one = AsyncMock(return_value=None)
        db.users.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        db.users.update_one = AsyncMock()
        db.roles = MagicMock()
        db.roles.find_one = AsyncMock(return_value=None)
        db.roles.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        db.roles.update_one = AsyncMock()
        db.groups = MagicMock()
        db.groups.find_one = AsyncMock(return_value=None)
        db.groups.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        db.groups.update_one = AsyncMock()
        db.domains = MagicMock()
        db.domains.find_one = AsyncMock(return_value=None)
        db.domains.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        db.domains.update_one = AsyncMock()
        db.domain_scenarios = MagicMock()
        db.domain_scenarios.find_one = AsyncMock(return_value=None)
        db.domain_scenarios.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        db.domain_scenarios.update_one = AsyncMock()
        db.permissions = MagicMock()
        db.permissions.find_one = AsyncMock(return_value=None)
        db.permissions.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        db.permissions.update_one = AsyncMock()
        db.customers = MagicMock()
        db.customers.find_one = AsyncMock(return_value=None)
        db.customers.insert_one = AsyncMock(return_value=MagicMock(inserted_id=ObjectId()))
        db.customers.update_one = AsyncMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        """Create bulk upload service"""
        return BulkUploadService(mock_db)

    def test_validate_columns_valid(self, service):
        """Test column validation with valid columns"""
        df = pd.DataFrame({"email": ["test@example.com"]})
        missing = service.validate_columns(df, "users")
        assert len(missing) == 0

    def test_validate_columns_missing(self, service):
        """Test column validation with missing columns"""
        df = pd.DataFrame({"name": ["Test"]})
        missing = service.validate_columns(df, "users")
        assert "email" in missing

    def test_parse_file_csv(self, service):
        """Test parsing CSV file"""
        csv_content = b"email,username\ntest@example.com,testuser"
        df = service.parse_file(csv_content, "test.csv")
        assert len(df) == 1
        assert df.iloc[0]["email"] == "test@example.com"

    def test_parse_file_unsupported_format(self, service):
        """Test parsing unsupported file format"""
        with pytest.raises(ValueError) as exc:
            service.parse_file(b"content", "test.txt")
        assert "unsupported file format" in str(exc.value).lower()

    def test_parse_file_invalid_content(self, service):
        """Test parsing invalid file content"""
        with pytest.raises(ValueError) as exc:
            service.parse_file(b"invalid xlsx content", "test.xlsx")
        assert "failed to parse" in str(exc.value).lower()

    def test_parse_list_field_empty(self, service):
        """Test parsing empty list field"""
        result = service._parse_list_field("")
        assert result == []

    def test_parse_list_field_none(self, service):
        """Test parsing None list field"""
        result = service._parse_list_field(None)
        assert result == []

    def test_parse_list_field_pandas_na(self, service):
        """Test parsing pandas NA value"""
        import pandas as pd
        result = service._parse_list_field(pd.NA)
        assert result == []

    def test_parse_list_field_string(self, service):
        """Test parsing comma-separated string"""
        result = service._parse_list_field("a, b, c")
        assert result == ["a", "b", "c"]

    def test_parse_bool_field_true_string(self, service):
        """Test parsing 'true' string"""
        assert service._parse_bool_field("true") is True
        assert service._parse_bool_field("1") is True
        assert service._parse_bool_field("yes") is True
        assert service._parse_bool_field("active") is True

    def test_parse_bool_field_false_string(self, service):
        """Test parsing false string"""
        assert service._parse_bool_field("false") is False

    def test_parse_bool_field_none(self, service):
        """Test parsing None returns True"""
        import pandas as pd
        assert service._parse_bool_field(pd.NA) is True

    def test_parse_bool_field_bool(self, service):
        """Test parsing actual boolean"""
        assert service._parse_bool_field(True) is True
        assert service._parse_bool_field(False) is False

    def test_parse_int_field_valid(self, service):
        """Test parsing valid integer"""
        assert service._parse_int_field(5) == 5
        assert service._parse_int_field("10") == 10

    def test_parse_int_field_invalid(self, service):
        """Test parsing invalid integer returns default"""
        assert service._parse_int_field("not a number") == 0
        assert service._parse_int_field("not a number", default=5) == 5

    def test_parse_int_field_none(self, service):
        """Test parsing None returns default"""
        import pandas as pd
        assert service._parse_int_field(pd.NA) == 0

    def test_validate_email_valid(self, service):
        """Test email validation with valid email"""
        assert service._validate_email("test@example.com") is True

    def test_validate_email_invalid(self, service):
        """Test email validation with invalid email"""
        assert service._validate_email("invalid") is False
        assert service._validate_email("test@") is False

    def test_generate_temp_password(self, service):
        """Test temporary password generation"""
        password = service._generate_temp_password()
        assert len(password) > 0

    @pytest.mark.asyncio
    async def test_process_users_success(self, service, mock_db):
        """Test processing users successfully"""
        df = pd.DataFrame({
            "email": ["test@example.com"],
            "username": ["testuser"],
            "full_name": ["Test User"],
            "roles": ["user"],
            "groups": ["viewer"],
            "is_active": [True]
        })

        result = await service.process_users(df, send_password_emails=False)
        assert result.successful == 1
        assert result.failed == 0

    @pytest.mark.asyncio
    async def test_process_users_invalid_email(self, service, mock_db):
        """Test processing user with invalid email"""
        df = pd.DataFrame({
            "email": ["invalid-email"],
            "username": ["testuser"]
        })

        result = await service.process_users(df, send_password_emails=False)
        assert result.failed == 1
        assert result.successful == 0

    @pytest.mark.asyncio
    async def test_process_users_missing_email(self, service, mock_db):
        """Test processing user with missing email"""
        df = pd.DataFrame({
            "email": [""],
            "username": ["testuser"]
        })

        result = await service.process_users(df, send_password_emails=False)
        assert result.failed == 1

    @pytest.mark.asyncio
    async def test_process_users_existing_user(self, service, mock_db):
        """Test processing existing user (update)"""
        mock_db.users.find_one = AsyncMock(return_value={"email": "test@example.com"})

        df = pd.DataFrame({
            "email": ["test@example.com"],
            "username": ["testuser"]
        })

        result = await service.process_users(df, send_password_emails=False)
        assert result.successful == 1
        mock_db.users.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_users_invalid_username(self, service, mock_db):
        """Test processing user with invalid username"""
        df = pd.DataFrame({
            "email": ["test@example.com"],
            "username": ["test@user!"]  # Invalid characters
        })

        result = await service.process_users(df, send_password_emails=False)
        assert result.failed == 1

    @pytest.mark.asyncio
    async def test_process_users_with_password_hasher(self, mock_db):
        """Test processing users with password hasher"""
        hasher = MagicMock(return_value="hashed_password")
        service = BulkUploadService(mock_db, password_hasher=hasher)

        df = pd.DataFrame({
            "email": ["test@example.com"],
            "username": ["testuser"]
        })

        result = await service.process_users(df, send_password_emails=False)
        assert result.successful == 1
        hasher.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_users_with_email_service(self, mock_db):
        """Test processing users with email service"""
        email_service = MagicMock()
        email_service.send_welcome_email = AsyncMock()
        service = BulkUploadService(mock_db, email_service=email_service)

        df = pd.DataFrame({
            "email": ["test@example.com"],
            "username": ["testuser"]
        })

        result = await service.process_users(df, send_password_emails=True)
        assert result.successful == 1
        email_service.send_welcome_email.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_users_email_service_error(self, mock_db):
        """Test processing users when email service fails"""
        email_service = MagicMock()
        email_service.send_welcome_email = AsyncMock(side_effect=Exception("Email failed"))
        service = BulkUploadService(mock_db, email_service=email_service)

        df = pd.DataFrame({
            "email": ["test@example.com"],
            "username": ["testuser"]
        })

        # Should still succeed, just log the warning
        result = await service.process_users(df, send_password_emails=True)
        assert result.successful == 1

    @pytest.mark.asyncio
    async def test_process_roles_success(self, service, mock_db):
        """Test processing roles successfully"""
        df = pd.DataFrame({
            "roleId": ["admin"],
            "name": ["Administrator"],
            "description": ["Admin role"],
            "status": ["active"],
            "priority": [1]
        })

        result = await service.process_roles(df)
        assert result.successful == 1

    @pytest.mark.asyncio
    async def test_process_roles_missing_id(self, service, mock_db):
        """Test processing role with missing roleId"""
        df = pd.DataFrame({
            "roleId": [""],
            "name": ["Admin"]
        })

        result = await service.process_roles(df)
        assert result.failed == 1

    @pytest.mark.asyncio
    async def test_process_roles_existing(self, service, mock_db):
        """Test processing existing role (update)"""
        mock_db.roles.find_one = AsyncMock(return_value={"roleId": "admin"})

        df = pd.DataFrame({
            "roleId": ["admin"],
            "name": ["Administrator"]
        })

        result = await service.process_roles(df)
        assert result.successful == 1
        mock_db.roles.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_groups_success(self, service, mock_db):
        """Test processing groups successfully"""
        df = pd.DataFrame({
            "groupId": ["viewers"],
            "name": ["Viewers"],
            "status": ["active"]
        })

        result = await service.process_groups(df)
        assert result.successful == 1

    @pytest.mark.asyncio
    async def test_process_groups_missing_id(self, service, mock_db):
        """Test processing group with missing groupId"""
        df = pd.DataFrame({
            "groupId": [""],
            "name": ["Group"]
        })

        result = await service.process_groups(df)
        assert result.failed == 1

    @pytest.mark.asyncio
    async def test_process_groups_existing(self, service, mock_db):
        """Test processing existing group (update)"""
        mock_db.groups.find_one = AsyncMock(return_value={"groupId": "viewers"})

        df = pd.DataFrame({
            "groupId": ["viewers"],
            "name": ["Viewers"]
        })

        result = await service.process_groups(df)
        assert result.successful == 1
        mock_db.groups.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_domains_success(self, service, mock_db):
        """Test processing domains successfully"""
        df = pd.DataFrame({
            "key": ["domain1"],
            "name": ["Domain 1"],
            "path": ["/domain1"],
            "status": ["active"]
        })

        result = await service.process_domains(df)
        assert result.successful == 1

    @pytest.mark.asyncio
    async def test_process_domains_missing_key(self, service, mock_db):
        """Test processing domain with missing key"""
        df = pd.DataFrame({
            "key": [""],
            "name": ["Domain"]
        })

        result = await service.process_domains(df)
        assert result.failed == 1

    @pytest.mark.asyncio
    async def test_process_domains_existing(self, service, mock_db):
        """Test processing existing domain (update)"""
        mock_db.domains.find_one = AsyncMock(return_value={"key": "domain1"})

        df = pd.DataFrame({
            "key": ["domain1"],
            "name": ["Domain 1"]
        })

        result = await service.process_domains(df)
        assert result.successful == 1
        mock_db.domains.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_domain_scenarios_success(self, service, mock_db):
        """Test processing domain scenarios successfully"""
        df = pd.DataFrame({
            "key": ["scenario1"],
            "name": ["Scenario 1"],
            "domainKey": ["domain1"],
            "status": ["active"]
        })

        result = await service.process_domain_scenarios(df)
        assert result.successful == 1

    @pytest.mark.asyncio
    async def test_process_domain_scenarios_missing_key(self, service, mock_db):
        """Test processing domain scenario with missing key"""
        df = pd.DataFrame({
            "key": [""],
            "name": ["Scenario"],
            "domainKey": ["domain1"]
        })

        result = await service.process_domain_scenarios(df)
        assert result.failed == 1

    @pytest.mark.asyncio
    async def test_process_domain_scenarios_existing(self, service, mock_db):
        """Test processing existing domain scenario (update)"""
        mock_db.domain_scenarios.find_one = AsyncMock(return_value={"key": "scenario1"})

        df = pd.DataFrame({
            "key": ["scenario1"],
            "name": ["Scenario 1"],
            "domainKey": ["domain1"]
        })

        result = await service.process_domain_scenarios(df)
        assert result.successful == 1
        mock_db.domain_scenarios.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_customers_success(self, service, mock_db):
        """Test processing customers successfully"""
        df = pd.DataFrame({
            "customerId": ["cust1"],
            "name": ["Customer 1"],
            "status": ["active"]
        })

        result = await service.process_customers(df)
        assert result.successful == 1

    @pytest.mark.asyncio
    async def test_process_customers_missing_id(self, service, mock_db):
        """Test processing customer with missing customerId"""
        df = pd.DataFrame({
            "customerId": [""],
            "name": ["Customer"]
        })

        result = await service.process_customers(df)
        assert result.failed == 1

    @pytest.mark.asyncio
    async def test_process_customers_missing_name(self, service, mock_db):
        """Test processing customer with missing name"""
        df = pd.DataFrame({
            "customerId": ["cust1"],
            "name": [""]
        })

        result = await service.process_customers(df)
        assert result.failed == 1

    @pytest.mark.asyncio
    async def test_process_customers_existing(self, service, mock_db):
        """Test processing existing customer (update)"""
        mock_db.customers.find_one = AsyncMock(return_value={"customerId": "cust1"})

        df = pd.DataFrame({
            "customerId": ["cust1"],
            "name": ["Customer 1"]
        })

        result = await service.process_customers(df)
        assert result.successful == 1
        mock_db.customers.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_permissions_success(self, service, mock_db):
        """Test processing permissions successfully"""
        df = pd.DataFrame({
            "key": ["perm1"],
            "name": ["Permission 1"],
            "module": ["users"],
            "actions": ["read,write"]
        })

        result = await service.process_permissions(df)
        assert result.successful == 1

    @pytest.mark.asyncio
    async def test_process_permissions_missing_key(self, service, mock_db):
        """Test processing permission with missing key"""
        df = pd.DataFrame({
            "key": [""],
            "name": ["Permission"],
            "module": ["users"]
        })

        result = await service.process_permissions(df)
        assert result.failed == 1

    @pytest.mark.asyncio
    async def test_process_permissions_missing_name(self, service, mock_db):
        """Test processing permission with missing name"""
        df = pd.DataFrame({
            "key": ["perm1"],
            "name": [""],
            "module": ["users"]
        })

        result = await service.process_permissions(df)
        assert result.failed == 1

    @pytest.mark.asyncio
    async def test_process_permissions_missing_module(self, service, mock_db):
        """Test processing permission with missing module"""
        df = pd.DataFrame({
            "key": ["perm1"],
            "name": ["Permission"],
            "module": [""]
        })

        result = await service.process_permissions(df)
        assert result.failed == 1

    @pytest.mark.asyncio
    async def test_process_permissions_existing(self, service, mock_db):
        """Test processing existing permission (update)"""
        mock_db.permissions.find_one = AsyncMock(return_value={"key": "perm1"})

        df = pd.DataFrame({
            "key": ["perm1"],
            "name": ["Permission 1"],
            "module": ["users"]
        })

        result = await service.process_permissions(df)
        assert result.successful == 1
        mock_db.permissions.update_one.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_entity_users(self, service, mock_db):
        """Test process_entity for users"""
        csv_content = b"email,username\ntest@example.com,testuser"

        result = await service.process_entity("users", csv_content, "test.csv", send_password_emails=False)
        assert result.successful == 1

    @pytest.mark.asyncio
    async def test_process_entity_roles(self, service, mock_db):
        """Test process_entity for roles"""
        csv_content = b"roleId,name\nadmin,Administrator"

        result = await service.process_entity("roles", csv_content, "test.csv")
        assert result.successful == 1

    @pytest.mark.asyncio
    async def test_process_entity_empty_file(self, service, mock_db):
        """Test process_entity with empty file"""
        csv_content = b"email,username\n"

        with pytest.raises(ValueError) as exc:
            await service.process_entity("users", csv_content, "test.csv")
        assert "empty" in str(exc.value).lower()

    @pytest.mark.asyncio
    async def test_process_entity_missing_columns(self, service, mock_db):
        """Test process_entity with missing required columns"""
        csv_content = b"name,description\nTest,Desc"

        with pytest.raises(ValueError) as exc:
            await service.process_entity("users", csv_content, "test.csv")
        assert "missing required columns" in str(exc.value).lower()

    @pytest.mark.asyncio
    async def test_process_entity_unknown_type(self, service, mock_db):
        """Test process_entity with unknown entity type"""
        csv_content = b"email,username\ntest@example.com,test"

        with pytest.raises(ValueError) as exc:
            await service.process_entity("unknown", csv_content, "test.csv")
        assert "unknown entity type" in str(exc.value).lower()

    def test_get_template_users(self, service):
        """Test getting template for users"""
        template = service.get_template("users")
        assert "email" in template.columns
        assert "username" in template.columns

    def test_get_template_roles(self, service):
        """Test getting template for roles"""
        template = service.get_template("roles")
        assert "roleId" in template.columns
        assert "name" in template.columns

    def test_get_template_unknown(self, service):
        """Test getting template for unknown entity type"""
        with pytest.raises(ValueError) as exc:
            service.get_template("unknown")
        assert "unknown entity type" in str(exc.value).lower()
