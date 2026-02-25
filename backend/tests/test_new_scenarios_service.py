"""Tests for New Scenarios Service"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from bson import ObjectId

from easylifeauth.services.new_scenarios_service import NewScenarioService
from easylifeauth.errors.auth_error import AuthError


class TestNewScenarioService:
    """Tests for NewScenarioService"""

    @pytest.fixture
    def scenario_service(self, mock_db, mock_token_manager, mock_email_service):
        """Create scenario request service with mocks"""
        return NewScenarioService(mock_db, mock_token_manager, mock_email_service)

    @pytest.fixture
    def sample_user(self):
        """Sample user data for tests"""
        return {
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "full_name": "Test User",
            "username": "testuser",
            "roles": ["user"]
        }

    @pytest.fixture
    def sample_admin_user(self):
        """Sample admin user data for tests"""
        return {
            "user_id": "507f1f77bcf86cd799439012",
            "email": "admin@example.com",
            "full_name": "Admin User",
            "username": "admin",
            "roles": ["administrator"]
        }

    @pytest.mark.asyncio
    async def test_generate_next_id(self, scenario_service, mock_db):
        """Test generating next request ID"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[{"requestId": "REQ-SCR-0005"}])
        mock_db.scenario_requests.find = MagicMock(return_value=mock_cursor)

        result = await scenario_service.generate_next_id()

        assert result == "REQ-SCR-0006"

    @pytest.mark.asyncio
    async def test_generate_next_id_first(self, scenario_service, mock_db):
        """Test generating first request ID"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.scenario_requests.find = MagicMock(return_value=mock_cursor)

        result = await scenario_service.generate_next_id()

        assert result == "REQ-SCR-0001"

    @pytest.mark.asyncio
    async def test_save_success(self, scenario_service, mock_db, sample_scenario_request_data, sample_user):
        """Test saving scenario request"""
        # Mock generate_next_id
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.scenario_requests.find = MagicMock(return_value=mock_cursor)

        # Mock domain validation
        mock_db.domains.find_one = AsyncMock(return_value={"key": "test-domain", "status": "active"})

        mock_db.scenario_requests.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        mock_db.scenario_requests.find_one = AsyncMock(return_value=sample_scenario_request_data)

        result = await scenario_service.save(
            {
                "name": "Test Scenario",
                "description": "Test Description",
                "dataDomain": "test-domain",
                "email": "test@example.com"
            },
            current_user=sample_user
        )

        assert result is not None

    @pytest.mark.asyncio
    async def test_save_empty_data(self, scenario_service):
        """Test saving with empty data"""
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.save({})
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_save_none_data(self, scenario_service):
        """Test saving with None data"""
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.save(None)
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_save_not_dict(self, scenario_service):
        """Test saving with non-dict data"""
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.save("not a dict")
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_update_success_user(self, scenario_service, mock_db, sample_scenario_request_data, sample_user):
        """Test updating scenario request as user (creator)"""
        # Set user_id to match the request creator
        sample_scenario_request_data["user_id"] = sample_user["user_id"]

        mock_db.scenario_requests.find_one = AsyncMock(return_value=sample_scenario_request_data)
        mock_db.scenario_requests.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )

        result = await scenario_service.update(
            {
                "request_id": "REQ-SCR-0001",
                "description": "Updated Description"
            },
            current_user=sample_user
        )

        assert result is not None

    @pytest.mark.asyncio
    async def test_update_success_admin(self, scenario_service, mock_db, sample_scenario_request_data, sample_admin_user):
        """Test updating scenario request as admin"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value=sample_scenario_request_data)
        mock_db.scenario_requests.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )

        result = await scenario_service.update(
            {
                "request_id": "REQ-SCR-0001",
                "status": "P",
                "status_comment": "Processing request"
            },
            current_user=sample_admin_user
        )

        assert result is not None

    @pytest.mark.asyncio
    async def test_update_empty_data(self, scenario_service, sample_user):
        """Test updating with empty data"""
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.update({}, current_user=sample_user)
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_update_missing_request_id(self, scenario_service, sample_user):
        """Test updating without request_id"""
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.update(
                {"description": "Name"},
                current_user=sample_user
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_update_unauthorized_user(self, scenario_service, mock_db, sample_scenario_request_data, sample_user):
        """Test updating when user is not creator and not admin"""
        # Set different user_id so user is not the creator
        sample_scenario_request_data["user_id"] = "different_user_id"
        mock_db.scenario_requests.find_one = AsyncMock(return_value=sample_scenario_request_data)

        with pytest.raises(AuthError) as exc_info:
            await scenario_service.update(
                {"request_id": "REQ-SCR-0001", "description": "Name"},
                current_user=sample_user
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_get_success(self, scenario_service, mock_db, sample_scenario_request_data):
        """Test getting scenario request"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value=sample_scenario_request_data)

        result = await scenario_service.get("REQ-SCR-0001")

        assert result["requestId"] == "REQ-SCR-0001"

    @pytest.mark.asyncio
    async def test_get_missing_id(self, scenario_service):
        """Test getting without request_id"""
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.get(None)
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_get_not_found(self, scenario_service, mock_db):
        """Test getting non-existent request"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value=None)

        with pytest.raises(AuthError) as exc_info:
            await scenario_service.get("REQ-SCR-9999")
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_all_success(self, scenario_service, mock_db, sample_scenario_request_data):
        """Test getting all scenario requests"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_scenario_request_data])
        mock_db.scenario_requests.find = MagicMock(return_value=mock_cursor)
        mock_db.scenario_requests.count_documents = AsyncMock(return_value=1)

        result = await scenario_service.get_all(
            user_id="507f1f77bcf86cd799439011",
            pagination={"page": 0, "limit": 25}
        )

        assert "data" in result
        assert "pagination" in result

    @pytest.mark.asyncio
    async def test_get_all_admin_no_user_filter(self, scenario_service, mock_db, sample_scenario_request_data):
        """Test getting all requests as admin (no user filter)"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_scenario_request_data])
        mock_db.scenario_requests.find = MagicMock(return_value=mock_cursor)
        mock_db.scenario_requests.count_documents = AsyncMock(return_value=1)

        result = await scenario_service.get_all(
            user_id=None,  # Admin sees all
            pagination={"page": 0, "limit": 25}
        )

        assert "data" in result

    @pytest.mark.asyncio
    async def test_get_user_by_id(self, scenario_service, mock_db, sample_user_data):
        """Test getting user by email"""
        sample_user_data["_id"] = ObjectId(sample_user_data["_id"])
        mock_db.users.find_one = AsyncMock(return_value=sample_user_data)

        result = await scenario_service.get_user_by_id("test@example.com")

        assert result is not None

    @pytest.mark.asyncio
    async def test_get_user_by_id_not_found(self, scenario_service, mock_db):
        """Test getting non-existent user"""
        mock_db.users.find_one = AsyncMock(return_value=None)

        result = await scenario_service.get_user_by_id("notfound@example.com")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_by_id_exception(self, scenario_service, mock_db):
        """Test getting user with exception"""
        mock_db.users.find_one = AsyncMock(side_effect=Exception("DB Error"))

        result = await scenario_service.get_user_by_id("test@example.com")

        assert result is None

    @pytest.mark.asyncio
    async def test_search_users(self, scenario_service, mock_db, sample_user_data):
        """Test searching users for autocomplete"""
        sample_user_data["_id"] = ObjectId(sample_user_data["_id"])
        mock_cursor = MagicMock()
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_user_data])
        mock_db.users.find = MagicMock(return_value=mock_cursor)

        result = await scenario_service.search_users("test")

        assert len(result) >= 0

    @pytest.mark.asyncio
    async def test_get_domains(self, scenario_service, mock_db):
        """Test getting domains for dropdown"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[{"key": "test-domain", "name": "Test Domain"}])
        mock_db.domains.find = MagicMock(return_value=mock_cursor)

        result = await scenario_service.get_domains()

        assert len(result) == 1
        assert result[0]["key"] == "test-domain"

    @pytest.mark.asyncio
    async def test_save_invalid_domain(self, scenario_service, mock_db):
        """Test saving with invalid domain"""
        # Mock generate_next_id
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.scenario_requests.find = MagicMock(return_value=mock_cursor)

        # Domain not found
        mock_db.domains.find_one = AsyncMock(return_value=None)

        with pytest.raises(AuthError) as exc_info:
            await scenario_service.save({
                "name": "Test",
                "description": "Test",
                "dataDomain": "invalid-domain"
            })
        assert exc_info.value.status_code == 400
        assert "Invalid domain" in str(exc_info.value.message)

    @pytest.mark.asyncio
    async def test_save_missing_name(self, scenario_service):
        """Test saving without name"""
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.save({
                "dataDomain": "test",
                "description": "Test"
            })
        assert exc_info.value.status_code == 400
        assert "name is required" in str(exc_info.value.message)

    @pytest.mark.asyncio
    async def test_save_missing_description(self, scenario_service):
        """Test saving without description"""
        with pytest.raises(AuthError) as exc_info:
            await scenario_service.save({
                "dataDomain": "test",
                "name": "Test"
            })
        assert exc_info.value.status_code == 400
        assert "description is required" in str(exc_info.value.message)

    @pytest.mark.asyncio
    async def test_get_user_info_success(self, scenario_service, mock_db):
        """Test getting user info by ID"""
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId("507f1f77bcf86cd799439011"),
            "email": "user@example.com",
            "full_name": "Test User",
            "username": "testuser"
        })

        result = await scenario_service._get_user_info("507f1f77bcf86cd799439011")

        assert result is not None
        assert result["email"] == "user@example.com"
        assert result["user_id"] == "507f1f77bcf86cd799439011"

    @pytest.mark.asyncio
    async def test_get_user_info_not_found(self, scenario_service, mock_db):
        """Test getting user info when not found"""
        mock_db.users.find_one = AsyncMock(return_value=None)

        result = await scenario_service._get_user_info("507f1f77bcf86cd799439011")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_info_invalid_id(self, scenario_service, mock_db):
        """Test getting user info with invalid ObjectId"""
        mock_db.users.find_one = AsyncMock(side_effect=Exception("Invalid ObjectId"))

        result = await scenario_service._get_user_info("invalid")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_domain_info_success(self, scenario_service, mock_db):
        """Test getting domain info"""
        mock_db.domains.find_one = AsyncMock(return_value={
            "key": "test-domain",
            "name": "Test Domain",
            "status": "active"
        })

        result = await scenario_service._get_domain_info("test-domain")

        assert result is not None
        assert result["key"] == "test-domain"

    @pytest.mark.asyncio
    async def test_send_notifications_no_email_service(self, mock_db, mock_token_manager):
        """Test send notifications without email service"""
        service = NewScenarioService(mock_db, mock_token_manager, email_service=None)

        # Should not raise
        await service._send_notifications({"email": "test@example.com"}, "created")

    @pytest.mark.asyncio
    async def test_send_notifications_with_recipients(self, scenario_service, mock_email_service):
        """Test send notifications with multiple recipients"""
        mock_email_service.send_scenario_email = AsyncMock()

        await scenario_service._send_notifications(
            {
                "email": "creator@example.com",
                "email_recipients": ["recipient1@example.com", "recipient2@example.com"],
                "work_flow": [
                    {"assigned_to_email": "assignee@example.com"}
                ]
            },
            "created",
            additional_recipients=["extra@example.com"]
        )

        # Should have called for each unique recipient
        assert mock_email_service.send_scenario_email.call_count >= 1

    @pytest.mark.asyncio
    async def test_send_notifications_email_failure(self, scenario_service, mock_email_service):
        """Test send notifications handles email failure"""
        mock_email_service.send_scenario_email = AsyncMock(
            side_effect=Exception("SMTP error")
        )

        # Should not raise, just log the error
        await scenario_service._send_notifications(
            {"email": "test@example.com"},
            "created"
        )

    @pytest.mark.asyncio
    async def test_create_jira_ticket_no_jira_service(self, mock_db, mock_token_manager, mock_email_service):
        """Test create jira ticket without jira service"""
        service = NewScenarioService(
            mock_db, mock_token_manager, mock_email_service, jira_service=None
        )

        result = await service._create_jira_ticket({"requestId": "REQ-SCR-0001"})

        assert result is None

    @pytest.mark.asyncio
    async def test_create_jira_ticket_success(self, mock_db, mock_token_manager, mock_email_service):
        """Test create jira ticket success"""
        mock_jira = MagicMock()
        mock_jira.create_ticket = AsyncMock(return_value={
            "ticket_key": "JIRA-123",
            "sync_status": "synced"
        })

        service = NewScenarioService(
            mock_db, mock_token_manager, mock_email_service, jira_service=mock_jira
        )

        result = await service._create_jira_ticket({"requestId": "REQ-SCR-0001"})

        assert result is not None
        assert result["ticket_key"] == "JIRA-123"

    @pytest.mark.asyncio
    async def test_create_jira_ticket_failure(self, mock_db, mock_token_manager, mock_email_service):
        """Test create jira ticket failure"""
        mock_jira = MagicMock()
        mock_jira.create_ticket = AsyncMock(side_effect=Exception("Jira API error"))

        service = NewScenarioService(
            mock_db, mock_token_manager, mock_email_service, jira_service=mock_jira
        )

        result = await service._create_jira_ticket({"requestId": "REQ-SCR-0001"})

        assert result is not None
        assert result["sync_status"] == "failed"

    @pytest.mark.asyncio
    async def test_update_jira_ticket_no_service(self, mock_db, mock_token_manager, mock_email_service):
        """Test update jira ticket without jira service"""
        service = NewScenarioService(
            mock_db, mock_token_manager, mock_email_service, jira_service=None
        )

        # Should not raise
        await service._update_jira_ticket({"requestId": "REQ-SCR-0001"}, "status_change")

    @pytest.mark.asyncio
    async def test_update_jira_ticket_no_ticket_key(self, mock_db, mock_token_manager, mock_email_service):
        """Test update jira ticket without ticket key"""
        mock_jira = MagicMock()
        service = NewScenarioService(
            mock_db, mock_token_manager, mock_email_service, jira_service=mock_jira
        )

        # Should not call jira service
        await service._update_jira_ticket({"requestId": "REQ-SCR-0001"}, "status_change")

        mock_jira.sync_status_change.assert_not_called() if hasattr(mock_jira, 'sync_status_change') else None

    @pytest.mark.asyncio
    async def test_update_jira_ticket_status_change(self, mock_db, mock_token_manager, mock_email_service):
        """Test update jira ticket on status change"""
        mock_jira = MagicMock()
        mock_jira.sync_status_change = AsyncMock(return_value={
            "last_synced": "2024-01-01T00:00:00Z",
            "sync_status": "synced"
        })
        mock_db.scenario_requests.update_one = AsyncMock()

        service = NewScenarioService(
            mock_db, mock_token_manager, mock_email_service, jira_service=mock_jira
        )

        await service._update_jira_ticket(
            {
                "requestId": "REQ-SCR-0001",
                "jira_integration": {"ticket_key": "JIRA-123"},
                "status": "P"
            },
            "status_change",
            status_comment="Processing"
        )

        mock_jira.sync_status_change.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_jira_ticket_status_change_with_target_date(self, mock_db, mock_token_manager, mock_email_service):
        """Test update jira ticket on status change with target date"""
        mock_jira = MagicMock()
        mock_jira.sync_status_change = AsyncMock(return_value={
            "last_synced": "2024-01-01T00:00:00Z",
            "sync_status": "synced"
        })
        mock_jira.update_due_date = AsyncMock()
        mock_db.scenario_requests.update_one = AsyncMock()

        service = NewScenarioService(
            mock_db, mock_token_manager, mock_email_service, jira_service=mock_jira
        )

        await service._update_jira_ticket(
            {
                "requestId": "REQ-SCR-0001",
                "jira_integration": {"ticket_key": "JIRA-123"},
                "status": "P"
            },
            "status_change",
            status_comment="Processing",
            new_target_date="2024-06-01"
        )

        mock_jira.update_due_date.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_jira_ticket_comment(self, mock_db, mock_token_manager, mock_email_service):
        """Test update jira ticket on new comment"""
        mock_jira = MagicMock()
        mock_jira._strip_html = MagicMock(return_value="Test comment")
        mock_jira.add_comment = AsyncMock(return_value={
            "last_synced": "2024-01-01T00:00:00Z",
            "sync_status": "synced"
        })
        mock_db.scenario_requests.update_one = AsyncMock()

        service = NewScenarioService(
            mock_db, mock_token_manager, mock_email_service, jira_service=mock_jira
        )

        await service._update_jira_ticket(
            {
                "requestId": "REQ-SCR-0001",
                "jira_integration": {"ticket_key": "JIRA-123"},
                "comments": [{"comment": "Test comment", "username": "testuser"}]
            },
            "comment"
        )

        mock_jira.add_comment.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_jira_ticket_description(self, mock_db, mock_token_manager, mock_email_service):
        """Test update jira ticket description"""
        mock_jira = MagicMock()
        mock_jira.update_description = AsyncMock(return_value={
            "last_synced": "2024-01-01T00:00:00Z",
            "sync_status": "synced"
        })
        mock_db.scenario_requests.update_one = AsyncMock()

        service = NewScenarioService(
            mock_db, mock_token_manager, mock_email_service, jira_service=mock_jira
        )

        await service._update_jira_ticket(
            {
                "requestId": "REQ-SCR-0001",
                "jira_integration": {"ticket_key": "JIRA-123"},
                "description": "Updated description"
            },
            "description"
        )

        mock_jira.update_description.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_jira_ticket_general(self, mock_db, mock_token_manager, mock_email_service):
        """Test update jira ticket general update"""
        mock_jira = MagicMock()
        mock_jira.update_ticket = AsyncMock(return_value={
            "last_synced": "2024-01-01T00:00:00Z",
            "sync_status": "synced"
        })
        mock_db.scenario_requests.update_one = AsyncMock()

        service = NewScenarioService(
            mock_db, mock_token_manager, mock_email_service, jira_service=mock_jira
        )

        await service._update_jira_ticket(
            {
                "requestId": "REQ-SCR-0001",
                "jira_integration": {"ticket_key": "JIRA-123"}
            },
            "general"
        )

        mock_jira.update_ticket.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_jira_ticket_exception(self, mock_db, mock_token_manager, mock_email_service):
        """Test update jira ticket handles exceptions"""
        mock_jira = MagicMock()
        mock_jira.sync_status_change = AsyncMock(side_effect=Exception("API error"))

        service = NewScenarioService(
            mock_db, mock_token_manager, mock_email_service, jira_service=mock_jira
        )

        # Should not raise
        await service._update_jira_ticket(
            {
                "requestId": "REQ-SCR-0001",
                "jira_integration": {"ticket_key": "JIRA-123"},
                "status": "P"
            },
            "status_change"
        )

    @pytest.mark.asyncio
    async def test_add_workflow_entry(self, scenario_service, mock_db):
        """Test adding workflow entry"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "work_flow": []
        })
        mock_db.scenario_requests.update_one = AsyncMock()

        result = await scenario_service._add_workflow_entry(
            request_id="REQ-SCR-0001",
            from_status="S",
            to_status="P",
            assigned_by={"user_id": "123", "email": "admin@test.com", "full_name": "Admin"},
            assigned_to={"user_id": "456", "email": "user@test.com", "full_name": "User"},
            comment="Status changed"
        )

        assert result["from_status"] == "S"
        assert result["to_status"] == "P"
        assert result["flowOrder"] == 1

    @pytest.mark.asyncio
    async def test_add_workflow_entry_without_assigned_to(self, scenario_service, mock_db):
        """Test adding workflow entry without assigned_to"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "work_flow": [{"flowOrder": 1}]
        })
        mock_db.scenario_requests.update_one = AsyncMock()

        result = await scenario_service._add_workflow_entry(
            request_id="REQ-SCR-0001",
            from_status="P",
            to_status="A",
            assigned_by={"user_id": "123", "email": "admin@test.com", "username": "admin"}
        )

        assert result["flowOrder"] == 2
        assert "assigned_to" not in result

    def test_can_edit_request_as_admin(self, scenario_service, sample_admin_user):
        """Test admin can edit any request"""
        result = scenario_service._can_edit_request(
            user_id=sample_admin_user["user_id"],
            roles=sample_admin_user["roles"],
            scenario_request={"user_id": "different_user"}
        )
        assert result is True

    def test_can_edit_request_as_creator(self, scenario_service, sample_user):
        """Test creator can edit own request"""
        result = scenario_service._can_edit_request(
            user_id=sample_user["user_id"],
            roles=sample_user["roles"],
            scenario_request={"user_id": sample_user["user_id"]}
        )
        assert result is True

    def test_cannot_edit_request_different_user(self, scenario_service, sample_user):
        """Test different user cannot edit request"""
        result = scenario_service._can_edit_request(
            user_id=sample_user["user_id"],
            roles=sample_user["roles"],
            scenario_request={"user_id": "different_user_id"}
        )
        assert result is False

    def test_get_allowed_fields_admin(self, scenario_service, sample_admin_user):
        """Test admin gets admin editable fields"""
        from easylifeauth.models.scenario_request import ADMIN_EDITABLE_FIELDS

        result = scenario_service._get_allowed_fields(
            user_id=sample_admin_user["user_id"],
            roles=sample_admin_user["roles"],
            scenario_request={}
        )
        assert result == ADMIN_EDITABLE_FIELDS

    def test_get_allowed_fields_creator(self, scenario_service, sample_user):
        """Test creator gets user editable fields"""
        from easylifeauth.models.scenario_request import USER_EDITABLE_FIELDS

        result = scenario_service._get_allowed_fields(
            user_id=sample_user["user_id"],
            roles=sample_user["roles"],
            scenario_request={"user_id": sample_user["user_id"]}
        )
        assert result == USER_EDITABLE_FIELDS

    def test_get_allowed_fields_no_permission(self, scenario_service, sample_user):
        """Test non-creator gets empty fields"""
        result = scenario_service._get_allowed_fields(
            user_id=sample_user["user_id"],
            roles=sample_user["roles"],
            scenario_request={"user_id": "different_user"}
        )
        assert result == set()


class TestNewScenarioServiceFileOperations:
    """Tests for file operations in NewScenarioService"""

    @pytest.fixture
    def mock_file_storage(self):
        """Create mock file storage service"""
        mock = MagicMock()
        mock.upload_file = AsyncMock(return_value={
            "file_name": "test.csv",
            "gcs_path": "requests/REQ-SCR-0001/files/test.csv",
            "file_type": "csv"
        })
        mock.download_file = AsyncMock(return_value=(b"file content", "test.csv"))
        mock.get_file_content_for_preview = AsyncMock(return_value={
            "type": "text",
            "content": "preview content"
        })
        return mock

    @pytest.fixture
    def service_with_file_storage(self, mock_db, mock_token_manager, mock_email_service, mock_file_storage):
        """Create service with file storage"""
        return NewScenarioService(
            mock_db, mock_token_manager, mock_email_service,
            jira_service=None, file_storage_service=mock_file_storage
        )

    @pytest.fixture
    def sample_user(self):
        """Sample user data"""
        return {
            "user_id": "507f1f77bcf86cd799439011",
            "email": "test@example.com",
            "roles": ["user"]
        }

    @pytest.fixture
    def sample_admin(self):
        """Sample admin data"""
        return {
            "user_id": "507f1f77bcf86cd799439012",
            "email": "admin@example.com",
            "roles": ["administrator"]
        }

    @pytest.mark.asyncio
    async def test_upload_file_no_storage(self, mock_db, mock_token_manager, mock_email_service, sample_user):
        """Test upload file without file storage configured"""
        service = NewScenarioService(mock_db, mock_token_manager, mock_email_service)

        with pytest.raises(AuthError) as exc_info:
            await service.upload_file(
                "REQ-SCR-0001", "test.csv", b"data", "files", sample_user
            )
        assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_upload_file_request_not_found(self, service_with_file_storage, mock_db, sample_user):
        """Test upload file when request not found"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value=None)

        with pytest.raises(AuthError) as exc_info:
            await service_with_file_storage.upload_file(
                "REQ-SCR-9999", "test.csv", b"data", "files", sample_user
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_upload_file_success_user(self, service_with_file_storage, mock_db, mock_file_storage, sample_user):
        """Test successful file upload as creator"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "user_id": sample_user["user_id"],
            "status": "S"
        })
        mock_db.scenario_requests.update_one = AsyncMock()

        result = await service_with_file_storage.upload_file(
            "REQ-SCR-0001", "test.csv", b"data", "files", sample_user
        )

        assert result is not None
        assert result["file_name"] == "test.csv"

    @pytest.mark.asyncio
    async def test_upload_file_forbidden(self, service_with_file_storage, mock_db, sample_user):
        """Test upload file without permission"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "user_id": "different_user",
            "status": "S"
        })

        with pytest.raises(AuthError) as exc_info:
            await service_with_file_storage.upload_file(
                "REQ-SCR-0001", "test.csv", b"data", "files", sample_user
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_upload_bucket_file_admin(self, service_with_file_storage, mock_db, mock_file_storage, sample_admin):
        """Test bucket file upload as admin"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "user_id": "some_user",
            "status": "accepted"  # ScenarioRequestStatusTypes.ACCEPTED.value
        })
        mock_db.scenario_requests.update_one = AsyncMock()

        result = await service_with_file_storage.upload_file(
            "REQ-SCR-0001", "output.csv", b"data", "buckets", sample_admin, "Output file"
        )

        assert result is not None

    @pytest.mark.asyncio
    async def test_upload_bucket_file_non_admin(self, service_with_file_storage, mock_db, sample_user):
        """Test bucket file upload as non-admin fails"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "user_id": sample_user["user_id"],
            "status": "accepted"
        })

        with pytest.raises(AuthError) as exc_info:
            await service_with_file_storage.upload_file(
                "REQ-SCR-0001", "output.csv", b"data", "buckets", sample_user
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_upload_bucket_file_wrong_status(self, service_with_file_storage, mock_db, sample_admin):
        """Test bucket file upload with wrong status fails"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "user_id": "some_user",
            "status": "submitted"  # Submitted - not yet accepted
        })

        with pytest.raises(AuthError) as exc_info:
            await service_with_file_storage.upload_file(
                "REQ-SCR-0001", "output.csv", b"data", "buckets", sample_admin
            )
        assert exc_info.value.status_code == 400

    @pytest.mark.asyncio
    async def test_upload_file_storage_failure(self, service_with_file_storage, mock_db, mock_file_storage, sample_user):
        """Test upload when file storage fails"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "user_id": sample_user["user_id"],
            "status": "S"
        })
        mock_file_storage.upload_file = AsyncMock(return_value=None)

        with pytest.raises(AuthError) as exc_info:
            await service_with_file_storage.upload_file(
                "REQ-SCR-0001", "test.csv", b"data", "files", sample_user
            )
        assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_get_file_preview_no_storage(self, mock_db, mock_token_manager, mock_email_service, sample_user):
        """Test get file preview without storage configured"""
        service = NewScenarioService(mock_db, mock_token_manager, mock_email_service)

        with pytest.raises(AuthError) as exc_info:
            await service.get_file_preview("REQ-SCR-0001", "path/file.csv", sample_user)
        assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_get_file_preview_request_not_found(self, service_with_file_storage, mock_db, sample_user):
        """Test get file preview when request not found"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value=None)

        with pytest.raises(AuthError) as exc_info:
            await service_with_file_storage.get_file_preview(
                "REQ-SCR-9999", "path/file.csv", sample_user
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_file_preview_file_not_found(self, service_with_file_storage, mock_db, sample_user):
        """Test get file preview when file not in request"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "files": [],
            "buckets": []
        })

        with pytest.raises(AuthError) as exc_info:
            await service_with_file_storage.get_file_preview(
                "REQ-SCR-0001", "path/nonexistent.csv", sample_user
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_file_preview_success(self, service_with_file_storage, mock_db, mock_file_storage, sample_user):
        """Test successful file preview"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "files": [{"gcs_path": "path/file.csv", "file_type": "csv"}],
            "buckets": []
        })

        result = await service_with_file_storage.get_file_preview(
            "REQ-SCR-0001", "path/file.csv", sample_user
        )

        assert result is not None
        assert result["type"] == "text"

    @pytest.mark.asyncio
    async def test_get_file_preview_from_buckets(self, service_with_file_storage, mock_db, mock_file_storage, sample_user):
        """Test file preview from buckets array"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "files": [],
            "buckets": [{"gcs_path": "path/bucket_file.csv", "file_type": "csv"}]
        })

        result = await service_with_file_storage.get_file_preview(
            "REQ-SCR-0001", "path/bucket_file.csv", sample_user
        )

        assert result is not None

    @pytest.mark.asyncio
    async def test_get_file_preview_null_result(self, service_with_file_storage, mock_db, mock_file_storage, sample_user):
        """Test file preview when storage returns None"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "files": [{"gcs_path": "path/file.csv", "file_type": "csv"}],
            "buckets": []
        })
        mock_file_storage.get_file_content_for_preview = AsyncMock(return_value=None)

        result = await service_with_file_storage.get_file_preview(
            "REQ-SCR-0001", "path/file.csv", sample_user
        )

        assert result["type"] == "error"

    @pytest.mark.asyncio
    async def test_download_file_no_storage(self, mock_db, mock_token_manager, mock_email_service, sample_user):
        """Test download file without storage configured"""
        service = NewScenarioService(mock_db, mock_token_manager, mock_email_service)

        with pytest.raises(AuthError) as exc_info:
            await service.download_file("REQ-SCR-0001", "path/file.csv", sample_user)
        assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_download_file_request_not_found(self, service_with_file_storage, mock_db, sample_user):
        """Test download file when request not found"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value=None)

        with pytest.raises(AuthError) as exc_info:
            await service_with_file_storage.download_file(
                "REQ-SCR-9999", "path/file.csv", sample_user
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_download_file_success(self, service_with_file_storage, mock_db, mock_file_storage, sample_user):
        """Test successful file download"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001"
        })

        result = await service_with_file_storage.download_file(
            "REQ-SCR-0001", "path/file.csv", sample_user
        )

        assert result is not None
        assert result[0] == b"file content"


class TestNewScenarioServiceUpdateAdvanced:
    """Advanced tests for update method"""

    @pytest.fixture
    def scenario_service(self, mock_db, mock_token_manager, mock_email_service):
        """Create scenario request service"""
        return NewScenarioService(mock_db, mock_token_manager, mock_email_service)

    @pytest.fixture
    def sample_admin(self):
        """Sample admin data"""
        return {
            "user_id": "507f1f77bcf86cd799439012",
            "email": "admin@example.com",
            "full_name": "Admin User",
            "roles": ["administrator"]
        }

    @pytest.mark.asyncio
    async def test_update_not_found(self, scenario_service, mock_db, sample_admin):
        """Test updating non-existent request"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value=None)

        with pytest.raises(AuthError) as exc_info:
            await scenario_service.update(
                {"request_id": "REQ-SCR-9999", "description": "Test"},
                sample_admin
            )
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_update_status_change_without_comment(self, scenario_service, mock_db, sample_admin):
        """Test status change without comment fails"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "status": "S",
            "_id": ObjectId()
        })

        with pytest.raises(AuthError) as exc_info:
            await scenario_service.update(
                {"request_id": "REQ-SCR-0001", "status": "P"},
                sample_admin
            )
        assert exc_info.value.status_code == 400
        assert "Comment is required" in str(exc_info.value.message)

    @pytest.mark.asyncio
    async def test_update_new_comment(self, scenario_service, mock_db, sample_admin):
        """Test adding new comment"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "status": "S",
            "_id": ObjectId(),
            "comments": []
        })
        mock_db.scenario_requests.update_one = AsyncMock()

        result = await scenario_service.update(
            {
                "request_id": "REQ-SCR-0001",
                "new_comment": {"comment": "Test comment"}
            },
            sample_admin
        )

        # Should have called update_one for adding comment
        assert mock_db.scenario_requests.update_one.call_count >= 1

    @pytest.mark.asyncio
    async def test_update_comment_by_non_creator(self, scenario_service, mock_db):
        """Test that any logged-in user can comment even if not the creator"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "user_id": "creator_user_id",
            "email": "creator@example.com",
            "status": "S",
            "_id": ObjectId(),
            "comments": []
        })
        mock_db.scenario_requests.update_one = AsyncMock()

        non_creator = {
            "user_id": "different_user_id",
            "email": "viewer@example.com",
            "full_name": "Viewer User",
            "roles": ["viewer"]
        }

        result = await scenario_service.update(
            {
                "request_id": "REQ-SCR-0001",
                "new_comment": {"comment": "I have a question about this"}
            },
            non_creator
        )

        # Comment should be added successfully
        assert mock_db.scenario_requests.update_one.call_count >= 1

    @pytest.mark.asyncio
    async def test_update_edit_blocked_for_non_creator(self, scenario_service, mock_db):
        """Test that non-creator cannot edit fields (only comment)"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "user_id": "creator_user_id",
            "email": "creator@example.com",
            "status": "S",
            "_id": ObjectId()
        })

        non_creator = {
            "user_id": "different_user_id",
            "email": "viewer@example.com",
            "roles": ["viewer"]
        }

        with pytest.raises(AuthError) as exc_info:
            await scenario_service.update(
                {
                    "request_id": "REQ-SCR-0001",
                    "description": "Trying to edit someone else's request"
                },
                non_creator
            )
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_update_new_workflow(self, scenario_service, mock_db, sample_admin):
        """Test adding new workflow entry"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "status": "S",
            "_id": ObjectId(),
            "work_flow": []
        })
        mock_db.scenario_requests.update_one = AsyncMock()
        mock_db.users.find_one = AsyncMock(return_value={
            "_id": ObjectId(),
            "email": "assignee@test.com",
            "full_name": "Assignee"
        })

        result = await scenario_service.update(
            {
                "request_id": "REQ-SCR-0001",
                "new_workflow": {
                    "assigned_to": "507f1f77bcf86cd799439013",
                    "to_status": "P",
                    "comment": "Assigning"
                }
            },
            sample_admin
        )

        assert result is not None

    @pytest.mark.asyncio
    async def test_update_add_jira_links(self, scenario_service, mock_db, sample_admin):
        """Test adding jira links"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "status": "S",
            "_id": ObjectId(),
            "jira_links": []
        })
        mock_db.scenario_requests.update_one = AsyncMock()

        result = await scenario_service.update(
            {
                "request_id": "REQ-SCR-0001",
                "jira_links": [
                    {"url": "https://jira.example.com/JIRA-123", "description": "Related ticket"}
                ]
            },
            sample_admin
        )

        # Should have called update for adding links
        calls = [str(c) for c in mock_db.scenario_requests.update_one.call_args_list]
        assert any("jira_links" in str(c) for c in calls)

    @pytest.mark.asyncio
    async def test_update_remove_jira_link(self, scenario_service, mock_db, sample_admin):
        """Test removing jira link by index"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "status": "S",
            "_id": ObjectId(),
            "jira_links": [{"url": "https://jira.example.com/JIRA-123"}]
        })
        mock_db.scenario_requests.update_one = AsyncMock()

        result = await scenario_service.update(
            {
                "request_id": "REQ-SCR-0001",
                "remove_jira_link_index": 0
            },
            sample_admin
        )

        # Should have called unset and pull
        assert mock_db.scenario_requests.update_one.call_count >= 2

    @pytest.mark.asyncio
    async def test_update_using_requestId_key(self, scenario_service, mock_db, sample_admin):
        """Test update using requestId instead of request_id"""
        mock_db.scenario_requests.find_one = AsyncMock(return_value={
            "requestId": "REQ-SCR-0001",
            "status": "S",
            "_id": ObjectId()
        })
        mock_db.scenario_requests.update_one = AsyncMock()

        result = await scenario_service.update(
            {"requestId": "REQ-SCR-0001", "description": "Updated"},
            sample_admin
        )

        assert result is not None

    @pytest.mark.asyncio
    async def test_get_all_with_pagination_params(self, scenario_service, mock_db):
        """Test get_all with various pagination parameters"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.skip = MagicMock(return_value=mock_cursor)
        mock_cursor.limit = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.scenario_requests.find = MagicMock(return_value=mock_cursor)
        mock_db.scenario_requests.count_documents = AsyncMock(return_value=0)

        result = await scenario_service.get_all(
            pagination={
                "limit": "10",  # String values should be converted
                "skip": "5",
                "page": "2",
                "total": "100"
            }
        )

        assert "pagination" in result
        assert result["pagination"]["limit"] == 10
