"""Tests for Distribution List Service"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId

from easylifeauth.services.distribution_list_service import DistributionListService


VALID_OID = "507f1f77bcf86cd799439011"
VALID_OID_2 = "507f1f77bcf86cd799439012"
VALID_OID_3 = "507f1f77bcf86cd799439013"
INVALID_OID = "not-a-valid-objectid"
USER_ID = "507f1f77bcf86cd799439099"


class TestDistributionListService:
    """Tests for DistributionListService"""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database with distribution_lists collection"""
        db = MagicMock()
        db.distribution_lists = AsyncMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        """Create distribution list service with mocked db"""
        return DistributionListService(mock_db)

    @pytest.fixture
    def sample_dist_list(self):
        """Sample distribution list document"""
        return {
            "_id": ObjectId(VALID_OID),
            "key": "dev-team",
            "name": "Dev Team",
            "description": "Development team distribution list",
            "type": "team",
            "emails": ["alice@example.com", "bob@example.com"],
            "is_active": True,
            "created_at": datetime(2025, 1, 1, tzinfo=timezone.utc),
            "created_by": USER_ID,
            "updated_at": datetime(2025, 1, 1, tzinfo=timezone.utc),
            "updated_by": USER_ID,
        }

    @pytest.fixture
    def sample_dist_list_2(self):
        """Second sample distribution list document"""
        return {
            "_id": ObjectId(VALID_OID_2),
            "key": "qa-team",
            "name": "QA Team",
            "description": "QA team distribution list",
            "type": "team",
            "emails": ["charlie@example.com", "bob@example.com"],
            "is_active": True,
            "created_at": datetime(2025, 1, 2, tzinfo=timezone.utc),
            "created_by": USER_ID,
            "updated_at": datetime(2025, 1, 2, tzinfo=timezone.utc),
            "updated_by": USER_ID,
        }

    @pytest.fixture
    def inactive_dist_list(self):
        """Inactive distribution list document"""
        return {
            "_id": ObjectId(VALID_OID_3),
            "key": "archived-list",
            "name": "Archived List",
            "description": "An archived list",
            "type": "custom",
            "emails": ["old@example.com"],
            "is_active": False,
            "created_at": datetime(2024, 6, 1, tzinfo=timezone.utc),
            "created_by": USER_ID,
            "updated_at": datetime(2024, 12, 1, tzinfo=timezone.utc),
            "updated_by": USER_ID,
        }

    # ------------------------------------------------------------------ #
    #  get_all
    # ------------------------------------------------------------------ #

    @pytest.mark.asyncio
    async def test_get_all_active_only(self, service, mock_db, sample_dist_list):
        """Test get_all returns only active lists by default"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_dist_list])
        mock_db.distribution_lists.find = MagicMock(return_value=mock_cursor)

        result = await service.get_all()

        mock_db.distribution_lists.find.assert_called_once_with({"is_active": True})
        assert len(result) == 1
        assert result[0]["key"] == "dev-team"
        # _id should be converted to string
        assert isinstance(result[0]["_id"], str)

    @pytest.mark.asyncio
    async def test_get_all_include_inactive(
        self, service, mock_db, sample_dist_list, inactive_dist_list
    ):
        """Test get_all with include_inactive=True returns all lists"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(
            return_value=[sample_dist_list, inactive_dist_list]
        )
        mock_db.distribution_lists.find = MagicMock(return_value=mock_cursor)

        result = await service.get_all(include_inactive=True)

        mock_db.distribution_lists.find.assert_called_once_with({})
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_get_all_empty(self, service, mock_db):
        """Test get_all when no lists exist"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.distribution_lists.find = MagicMock(return_value=mock_cursor)

        result = await service.get_all()

        assert result == []

    @pytest.mark.asyncio
    async def test_get_all_sorts_by_name(self, service, mock_db):
        """Test get_all sorts results by name ascending"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.distribution_lists.find = MagicMock(return_value=mock_cursor)

        await service.get_all()

        mock_cursor.sort.assert_called_once_with("name", 1)

    @pytest.mark.asyncio
    async def test_get_all_converts_all_ids_to_string(
        self, service, mock_db, sample_dist_list, sample_dist_list_2
    ):
        """Test get_all converts ObjectId to string for all results"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(
            return_value=[sample_dist_list, sample_dist_list_2]
        )
        mock_db.distribution_lists.find = MagicMock(return_value=mock_cursor)

        result = await service.get_all()

        for item in result:
            assert isinstance(item["_id"], str)

    # ------------------------------------------------------------------ #
    #  get_by_id
    # ------------------------------------------------------------------ #

    @pytest.mark.asyncio
    async def test_get_by_id_success(self, service, mock_db, sample_dist_list):
        """Test get_by_id with a valid existing ID"""
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)

        result = await service.get_by_id(VALID_OID)

        assert result is not None
        assert result["key"] == "dev-team"
        assert isinstance(result["_id"], str)
        mock_db.distribution_lists.find_one.assert_called_once_with(
            {"_id": ObjectId(VALID_OID)}
        )

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, service, mock_db):
        """Test get_by_id returns None when ID does not exist"""
        mock_db.distribution_lists.find_one = AsyncMock(return_value=None)

        result = await service.get_by_id(VALID_OID)

        assert result is None

    @pytest.mark.asyncio
    async def test_get_by_id_invalid_objectid(self, service, mock_db):
        """Test get_by_id returns None for an invalid ObjectId"""
        result = await service.get_by_id(INVALID_OID)

        assert result is None
        mock_db.distribution_lists.find_one.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_by_id_empty_string(self, service, mock_db):
        """Test get_by_id returns None for an empty string"""
        result = await service.get_by_id("")

        assert result is None

    # ------------------------------------------------------------------ #
    #  get_by_key
    # ------------------------------------------------------------------ #

    @pytest.mark.asyncio
    async def test_get_by_key_success(self, service, mock_db, sample_dist_list):
        """Test get_by_key with an existing active key"""
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)

        result = await service.get_by_key("dev-team")

        assert result is not None
        assert result["key"] == "dev-team"
        assert isinstance(result["_id"], str)
        mock_db.distribution_lists.find_one.assert_called_once_with(
            {"key": "dev-team", "is_active": True}
        )

    @pytest.mark.asyncio
    async def test_get_by_key_not_found(self, service, mock_db):
        """Test get_by_key returns None when key does not exist"""
        mock_db.distribution_lists.find_one = AsyncMock(return_value=None)

        result = await service.get_by_key("nonexistent")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_by_key_inactive_not_returned(self, service, mock_db):
        """Test get_by_key filters by is_active=True"""
        mock_db.distribution_lists.find_one = AsyncMock(return_value=None)

        result = await service.get_by_key("archived-list")

        assert result is None
        mock_db.distribution_lists.find_one.assert_called_once_with(
            {"key": "archived-list", "is_active": True}
        )

    # ------------------------------------------------------------------ #
    #  get_by_type
    # ------------------------------------------------------------------ #

    @pytest.mark.asyncio
    async def test_get_by_type_success(
        self, service, mock_db, sample_dist_list, sample_dist_list_2
    ):
        """Test get_by_type returns active lists of given type"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(
            return_value=[sample_dist_list, sample_dist_list_2]
        )
        mock_db.distribution_lists.find = MagicMock(return_value=mock_cursor)

        result = await service.get_by_type("team")

        mock_db.distribution_lists.find.assert_called_once_with(
            {"type": "team", "is_active": True}
        )
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_get_by_type_empty(self, service, mock_db):
        """Test get_by_type returns empty list when no matches"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.distribution_lists.find = MagicMock(return_value=mock_cursor)

        result = await service.get_by_type("nonexistent-type")

        assert result == []

    @pytest.mark.asyncio
    async def test_get_by_type_sorts_by_name(self, service, mock_db):
        """Test get_by_type sorts results by name ascending"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.distribution_lists.find = MagicMock(return_value=mock_cursor)

        await service.get_by_type("team")

        mock_cursor.sort.assert_called_once_with("name", 1)

    @pytest.mark.asyncio
    async def test_get_by_type_converts_ids(self, service, mock_db, sample_dist_list):
        """Test get_by_type converts ObjectIds to strings"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[sample_dist_list])
        mock_db.distribution_lists.find = MagicMock(return_value=mock_cursor)

        result = await service.get_by_type("team")

        assert isinstance(result[0]["_id"], str)

    # ------------------------------------------------------------------ #
    #  get_emails_by_key
    # ------------------------------------------------------------------ #

    @pytest.mark.asyncio
    async def test_get_emails_by_key_success(self, service, mock_db, sample_dist_list):
        """Test get_emails_by_key returns emails for an existing key"""
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)

        result = await service.get_emails_by_key("dev-team")

        assert result == ["alice@example.com", "bob@example.com"]

    @pytest.mark.asyncio
    async def test_get_emails_by_key_not_found(self, service, mock_db):
        """Test get_emails_by_key returns empty list when key not found"""
        mock_db.distribution_lists.find_one = AsyncMock(return_value=None)

        result = await service.get_emails_by_key("nonexistent")

        assert result == []

    @pytest.mark.asyncio
    async def test_get_emails_by_key_no_emails_field(self, service, mock_db):
        """Test get_emails_by_key returns empty list when emails field is missing"""
        doc = {
            "_id": ObjectId(VALID_OID),
            "key": "empty-list",
            "name": "Empty List",
            "is_active": True,
        }
        mock_db.distribution_lists.find_one = AsyncMock(return_value=doc)

        result = await service.get_emails_by_key("empty-list")

        assert result == []

    # ------------------------------------------------------------------ #
    #  get_emails_by_type
    # ------------------------------------------------------------------ #

    @pytest.mark.asyncio
    async def test_get_emails_by_type_success(
        self, service, mock_db, sample_dist_list, sample_dist_list_2
    ):
        """Test get_emails_by_type returns unique emails across lists of a type"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(
            return_value=[sample_dist_list, sample_dist_list_2]
        )
        mock_db.distribution_lists.find = MagicMock(return_value=mock_cursor)

        result = await service.get_emails_by_type("team")

        # bob@example.com appears in both lists but should be deduplicated
        assert sorted(result) == sorted(
            ["alice@example.com", "bob@example.com", "charlie@example.com"]
        )

    @pytest.mark.asyncio
    async def test_get_emails_by_type_empty(self, service, mock_db):
        """Test get_emails_by_type returns empty list for nonexistent type"""
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_db.distribution_lists.find = MagicMock(return_value=mock_cursor)

        result = await service.get_emails_by_type("nonexistent")

        assert result == []

    @pytest.mark.asyncio
    async def test_get_emails_by_type_deduplication(self, service, mock_db):
        """Test get_emails_by_type deduplicates emails across multiple lists"""
        list_a = {
            "_id": ObjectId(VALID_OID),
            "key": "list-a",
            "emails": ["shared@example.com", "a@example.com"],
            "is_active": True,
        }
        list_b = {
            "_id": ObjectId(VALID_OID_2),
            "key": "list-b",
            "emails": ["shared@example.com", "b@example.com"],
            "is_active": True,
        }
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[list_a, list_b])
        mock_db.distribution_lists.find = MagicMock(return_value=mock_cursor)

        result = await service.get_emails_by_type("team")

        assert len(result) == 3
        assert set(result) == {"shared@example.com", "a@example.com", "b@example.com"}

    @pytest.mark.asyncio
    async def test_get_emails_by_type_missing_emails_field(self, service, mock_db):
        """Test get_emails_by_type handles lists without emails field"""
        doc = {
            "_id": ObjectId(VALID_OID),
            "key": "no-emails",
            "is_active": True,
        }
        mock_cursor = MagicMock()
        mock_cursor.sort = MagicMock(return_value=mock_cursor)
        mock_cursor.to_list = AsyncMock(return_value=[doc])
        mock_db.distribution_lists.find = MagicMock(return_value=mock_cursor)

        result = await service.get_emails_by_type("team")

        assert result == []

    # ------------------------------------------------------------------ #
    #  create
    # ------------------------------------------------------------------ #

    @pytest.mark.asyncio
    async def test_create_success(self, service, mock_db, sample_dist_list):
        """Test creating a new distribution list"""
        inserted_id = ObjectId()
        mock_db.distribution_lists.find_one = AsyncMock(
            side_effect=[None, {**sample_dist_list, "_id": inserted_id}]
        )
        mock_db.distribution_lists.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=inserted_id)
        )

        data = {
            "key": "dev-team",
            "name": "Dev Team",
            "description": "Development team",
            "type": "team",
            "emails": ["alice@example.com", "bob@example.com"],
        }
        result = await service.create(data, user_id=USER_ID)

        assert result is not None
        mock_db.distribution_lists.insert_one.assert_called_once()
        insert_arg = mock_db.distribution_lists.insert_one.call_args[0][0]
        assert insert_arg["key"] == "dev-team"
        assert insert_arg["name"] == "Dev Team"
        assert insert_arg["type"] == "team"
        assert insert_arg["emails"] == ["alice@example.com", "bob@example.com"]
        assert insert_arg["is_active"] is True
        assert insert_arg["created_by"] == USER_ID
        assert insert_arg["updated_by"] == USER_ID

    @pytest.mark.asyncio
    async def test_create_duplicate_key_raises_error(self, service, mock_db):
        """Test creating a list with a duplicate key raises ValueError"""
        mock_db.distribution_lists.find_one = AsyncMock(
            return_value={"_id": ObjectId(), "key": "existing-key"}
        )

        with pytest.raises(ValueError, match="already exists"):
            await service.create(
                {"key": "existing-key", "name": "Duplicate"},
                user_id=USER_ID,
            )

        mock_db.distribution_lists.insert_one.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_defaults(self, service, mock_db, sample_dist_list):
        """Test create applies default values for optional fields"""
        inserted_id = ObjectId()
        mock_db.distribution_lists.find_one = AsyncMock(
            side_effect=[None, {**sample_dist_list, "_id": inserted_id}]
        )
        mock_db.distribution_lists.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=inserted_id)
        )

        data = {"key": "minimal", "name": "Minimal List"}
        await service.create(data, user_id=USER_ID)

        insert_arg = mock_db.distribution_lists.insert_one.call_args[0][0]
        assert insert_arg["type"] == "custom"
        assert insert_arg["emails"] == []
        assert insert_arg["is_active"] is True

    @pytest.mark.asyncio
    async def test_create_without_user_id(self, service, mock_db, sample_dist_list):
        """Test create with user_id=None stores None for created_by/updated_by"""
        inserted_id = ObjectId()
        mock_db.distribution_lists.find_one = AsyncMock(
            side_effect=[None, {**sample_dist_list, "_id": inserted_id}]
        )
        mock_db.distribution_lists.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=inserted_id)
        )

        await service.create({"key": "no-user", "name": "No User"})

        insert_arg = mock_db.distribution_lists.insert_one.call_args[0][0]
        assert insert_arg["created_by"] is None
        assert insert_arg["updated_by"] is None

    @pytest.mark.asyncio
    async def test_create_sets_timestamps(self, service, mock_db, sample_dist_list):
        """Test create sets created_at and updated_at to current UTC time"""
        inserted_id = ObjectId()
        mock_db.distribution_lists.find_one = AsyncMock(
            side_effect=[None, {**sample_dist_list, "_id": inserted_id}]
        )
        mock_db.distribution_lists.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=inserted_id)
        )

        before = datetime.now(timezone.utc)
        await service.create({"key": "ts-test", "name": "Timestamp Test"}, user_id=USER_ID)
        after = datetime.now(timezone.utc)

        insert_arg = mock_db.distribution_lists.insert_one.call_args[0][0]
        assert before <= insert_arg["created_at"] <= after
        assert before <= insert_arg["updated_at"] <= after
        assert insert_arg["created_at"] == insert_arg["updated_at"]

    # ------------------------------------------------------------------ #
    #  update
    # ------------------------------------------------------------------ #

    @pytest.mark.asyncio
    async def test_update_success(self, service, mock_db, sample_dist_list):
        """Test updating a distribution list"""
        # Update data has no "key", so the duplicate key check is skipped.
        # Only find_one call is from get_by_id at the end.
        mock_db.distribution_lists.find_one = AsyncMock(
            return_value=sample_dist_list
        )
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )

        result = await service.update(
            VALID_OID,
            {"name": "Updated Name", "description": "Updated desc"},
            user_id=USER_ID,
        )

        assert result is not None
        mock_db.distribution_lists.update_one.assert_called_once()
        update_call = mock_db.distribution_lists.update_one.call_args
        assert update_call[0][0] == {"_id": ObjectId(VALID_OID)}
        set_fields = update_call[0][1]["$set"]
        assert set_fields["name"] == "Updated Name"
        assert set_fields["description"] == "Updated desc"
        assert "updated_at" in set_fields
        assert set_fields["updated_by"] == USER_ID

    @pytest.mark.asyncio
    async def test_update_invalid_objectid(self, service, mock_db):
        """Test update with invalid ObjectId returns None"""
        result = await service.update(INVALID_OID, {"name": "Test"})

        assert result is None

    @pytest.mark.asyncio
    async def test_update_not_found(self, service, mock_db):
        """Test update returns None when list does not exist"""
        mock_db.distribution_lists.find_one = AsyncMock(return_value=None)
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=0)
        )

        result = await service.update(VALID_OID, {"name": "Test"}, user_id=USER_ID)

        assert result is None

    @pytest.mark.asyncio
    async def test_update_key_conflict_raises_error(self, service, mock_db):
        """Test update raises ValueError when changing key to an existing one"""
        mock_db.distribution_lists.find_one = AsyncMock(
            return_value={"_id": ObjectId(VALID_OID_2), "key": "taken-key"}
        )

        with pytest.raises(ValueError, match="already exists"):
            await service.update(
                VALID_OID, {"key": "taken-key"}, user_id=USER_ID
            )

        mock_db.distribution_lists.update_one.assert_not_called()

    @pytest.mark.asyncio
    async def test_update_key_no_conflict_with_self(
        self, service, mock_db, sample_dist_list
    ):
        """Test update does not raise error when key matches own document"""
        # find_one for key conflict check returns None (no conflict)
        # find_one for get_by_id returns the document
        mock_db.distribution_lists.find_one = AsyncMock(
            side_effect=[None, sample_dist_list]
        )
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )

        result = await service.update(
            VALID_OID, {"key": "dev-team"}, user_id=USER_ID
        )

        assert result is not None

    @pytest.mark.asyncio
    async def test_update_only_allowed_fields(self, service, mock_db, sample_dist_list):
        """Test update only sets allowed fields and ignores unknown ones"""
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )

        await service.update(
            VALID_OID,
            {"name": "New", "unknown_field": "should_be_ignored", "emails": ["x@y.com"]},
            user_id=USER_ID,
        )

        set_fields = mock_db.distribution_lists.update_one.call_args[0][1]["$set"]
        assert "name" in set_fields
        assert "emails" in set_fields
        assert "unknown_field" not in set_fields

    @pytest.mark.asyncio
    async def test_update_sets_timestamp(self, service, mock_db, sample_dist_list):
        """Test update sets updated_at to current UTC time"""
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )

        before = datetime.now(timezone.utc)
        await service.update(VALID_OID, {"name": "Test"}, user_id=USER_ID)
        after = datetime.now(timezone.utc)

        set_fields = mock_db.distribution_lists.update_one.call_args[0][1]["$set"]
        assert before <= set_fields["updated_at"] <= after

    @pytest.mark.asyncio
    async def test_update_without_key_skips_conflict_check(
        self, service, mock_db, sample_dist_list
    ):
        """Test update without key field does not perform key conflict check"""
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )

        await service.update(VALID_OID, {"name": "Updated"}, user_id=USER_ID)

        # find_one should only be called once (for get_by_id), not for key check
        assert mock_db.distribution_lists.find_one.call_count == 1

    # ------------------------------------------------------------------ #
    #  add_email
    # ------------------------------------------------------------------ #

    @pytest.mark.asyncio
    async def test_add_email_success(self, service, mock_db, sample_dist_list):
        """Test adding an email to a distribution list"""
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)

        result = await service.add_email(VALID_OID, "new@example.com", user_id=USER_ID)

        assert result is not None
        update_call = mock_db.distribution_lists.update_one.call_args
        assert update_call[0][0] == {"_id": ObjectId(VALID_OID)}
        assert update_call[0][1]["$addToSet"] == {"emails": "new@example.com"}
        assert update_call[0][1]["$set"]["updated_by"] == USER_ID

    @pytest.mark.asyncio
    async def test_add_email_invalid_objectid(self, service, mock_db):
        """Test add_email returns None for invalid ObjectId"""
        result = await service.add_email(INVALID_OID, "test@example.com")

        assert result is None

    @pytest.mark.asyncio
    async def test_add_email_list_not_found(self, service, mock_db):
        """Test add_email returns None when list does not exist"""
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=0)
        )

        result = await service.add_email(VALID_OID, "test@example.com", user_id=USER_ID)

        assert result is None

    @pytest.mark.asyncio
    async def test_add_email_without_user_id(self, service, mock_db, sample_dist_list):
        """Test add_email with no user_id sets updated_by to None"""
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)

        await service.add_email(VALID_OID, "new@example.com")

        update_call = mock_db.distribution_lists.update_one.call_args
        assert update_call[0][1]["$set"]["updated_by"] is None

    @pytest.mark.asyncio
    async def test_add_email_uses_addtoset(self, service, mock_db, sample_dist_list):
        """Test add_email uses $addToSet to prevent duplicates"""
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)

        await service.add_email(VALID_OID, "alice@example.com", user_id=USER_ID)

        update_call = mock_db.distribution_lists.update_one.call_args
        assert "$addToSet" in update_call[0][1]

    # ------------------------------------------------------------------ #
    #  remove_email
    # ------------------------------------------------------------------ #

    @pytest.mark.asyncio
    async def test_remove_email_success(self, service, mock_db, sample_dist_list):
        """Test removing an email from a distribution list"""
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)

        result = await service.remove_email(
            VALID_OID, "bob@example.com", user_id=USER_ID
        )

        assert result is not None
        update_call = mock_db.distribution_lists.update_one.call_args
        assert update_call[0][0] == {"_id": ObjectId(VALID_OID)}
        assert update_call[0][1]["$pull"] == {"emails": "bob@example.com"}
        assert update_call[0][1]["$set"]["updated_by"] == USER_ID

    @pytest.mark.asyncio
    async def test_remove_email_invalid_objectid(self, service, mock_db):
        """Test remove_email returns None for invalid ObjectId"""
        result = await service.remove_email(INVALID_OID, "test@example.com")

        assert result is None

    @pytest.mark.asyncio
    async def test_remove_email_list_not_found(self, service, mock_db):
        """Test remove_email returns None when list does not exist"""
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=0)
        )

        result = await service.remove_email(
            VALID_OID, "test@example.com", user_id=USER_ID
        )

        assert result is None

    @pytest.mark.asyncio
    async def test_remove_email_without_user_id(self, service, mock_db, sample_dist_list):
        """Test remove_email with no user_id sets updated_by to None"""
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)

        await service.remove_email(VALID_OID, "bob@example.com")

        update_call = mock_db.distribution_lists.update_one.call_args
        assert update_call[0][1]["$set"]["updated_by"] is None

    @pytest.mark.asyncio
    async def test_remove_email_uses_pull(self, service, mock_db, sample_dist_list):
        """Test remove_email uses $pull to remove from array"""
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)

        await service.remove_email(VALID_OID, "bob@example.com", user_id=USER_ID)

        update_call = mock_db.distribution_lists.update_one.call_args
        assert "$pull" in update_call[0][1]

    # ------------------------------------------------------------------ #
    #  delete (soft delete)
    # ------------------------------------------------------------------ #

    @pytest.mark.asyncio
    async def test_delete_success(self, service, mock_db):
        """Test soft delete sets is_active to False"""
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )

        result = await service.delete(VALID_OID)

        assert result is True
        update_call = mock_db.distribution_lists.update_one.call_args
        assert update_call[0][0] == {"_id": ObjectId(VALID_OID)}
        set_fields = update_call[0][1]["$set"]
        assert set_fields["is_active"] is False
        assert "updated_at" in set_fields

    @pytest.mark.asyncio
    async def test_delete_invalid_objectid(self, service, mock_db):
        """Test delete returns False for invalid ObjectId"""
        result = await service.delete(INVALID_OID)

        assert result is False

    @pytest.mark.asyncio
    async def test_delete_not_found(self, service, mock_db):
        """Test delete returns False when list does not exist"""
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=0)
        )

        result = await service.delete(VALID_OID)

        assert result is False

    @pytest.mark.asyncio
    async def test_delete_sets_updated_at(self, service, mock_db):
        """Test delete sets updated_at timestamp"""
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )

        before = datetime.now(timezone.utc)
        await service.delete(VALID_OID)
        after = datetime.now(timezone.utc)

        set_fields = mock_db.distribution_lists.update_one.call_args[0][1]["$set"]
        assert before <= set_fields["updated_at"] <= after

    # ------------------------------------------------------------------ #
    #  hard_delete
    # ------------------------------------------------------------------ #

    @pytest.mark.asyncio
    async def test_hard_delete_success(self, service, mock_db):
        """Test hard delete permanently removes the document"""
        mock_db.distribution_lists.delete_one = AsyncMock(
            return_value=MagicMock(deleted_count=1)
        )

        result = await service.hard_delete(VALID_OID)

        assert result is True
        mock_db.distribution_lists.delete_one.assert_called_once_with(
            {"_id": ObjectId(VALID_OID)}
        )

    @pytest.mark.asyncio
    async def test_hard_delete_invalid_objectid(self, service, mock_db):
        """Test hard_delete returns False for invalid ObjectId"""
        result = await service.hard_delete(INVALID_OID)

        assert result is False

    @pytest.mark.asyncio
    async def test_hard_delete_not_found(self, service, mock_db):
        """Test hard_delete returns False when document does not exist"""
        mock_db.distribution_lists.delete_one = AsyncMock(
            return_value=MagicMock(deleted_count=0)
        )

        result = await service.hard_delete(VALID_OID)

        assert result is False

    # ------------------------------------------------------------------ #
    #  Edge cases and error handling
    # ------------------------------------------------------------------ #

    @pytest.mark.asyncio
    async def test_create_with_explicit_is_active_false(
        self, service, mock_db, sample_dist_list
    ):
        """Test creating a list with is_active=False"""
        inserted_id = ObjectId()
        mock_db.distribution_lists.find_one = AsyncMock(
            side_effect=[None, {**sample_dist_list, "_id": inserted_id}]
        )
        mock_db.distribution_lists.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=inserted_id)
        )

        await service.create(
            {"key": "inactive", "name": "Inactive", "is_active": False},
            user_id=USER_ID,
        )

        insert_arg = mock_db.distribution_lists.insert_one.call_args[0][0]
        assert insert_arg["is_active"] is False

    @pytest.mark.asyncio
    async def test_update_all_allowed_fields(self, service, mock_db, sample_dist_list):
        """Test update can set all six allowed fields"""
        mock_db.distribution_lists.find_one = AsyncMock(
            side_effect=[None, sample_dist_list]
        )
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )

        data = {
            "key": "new-key",
            "name": "New Name",
            "description": "New Description",
            "type": "notification",
            "emails": ["z@z.com"],
            "is_active": False,
        }
        await service.update(VALID_OID, data, user_id=USER_ID)

        set_fields = mock_db.distribution_lists.update_one.call_args[0][1]["$set"]
        for field in ["key", "name", "description", "type", "emails", "is_active"]:
            assert field in set_fields

    @pytest.mark.asyncio
    async def test_update_empty_data_still_sets_metadata(
        self, service, mock_db, sample_dist_list
    ):
        """Test update with empty data dict still sets updated_at and updated_by"""
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )

        await service.update(VALID_OID, {}, user_id=USER_ID)

        set_fields = mock_db.distribution_lists.update_one.call_args[0][1]["$set"]
        assert "updated_at" in set_fields
        assert set_fields["updated_by"] == USER_ID

    @pytest.mark.asyncio
    async def test_get_by_id_converts_objectid_to_string(
        self, service, mock_db, sample_dist_list
    ):
        """Test get_by_id properly converts ObjectId _id to string"""
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)

        result = await service.get_by_id(VALID_OID)

        assert isinstance(result["_id"], str)
        assert result["_id"] == str(ObjectId(VALID_OID))

    @pytest.mark.asyncio
    async def test_get_by_key_converts_objectid_to_string(
        self, service, mock_db, sample_dist_list
    ):
        """Test get_by_key properly converts ObjectId _id to string"""
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)

        result = await service.get_by_key("dev-team")

        assert isinstance(result["_id"], str)

    @pytest.mark.asyncio
    async def test_create_returns_get_by_id_result(
        self, service, mock_db, sample_dist_list
    ):
        """Test create returns the result of get_by_id with the new inserted_id"""
        inserted_id = ObjectId()
        returned_doc = {**sample_dist_list, "_id": inserted_id}
        mock_db.distribution_lists.find_one = AsyncMock(
            side_effect=[None, returned_doc]
        )
        mock_db.distribution_lists.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=inserted_id)
        )

        result = await service.create(
            {"key": "test", "name": "Test"}, user_id=USER_ID
        )

        assert result["_id"] == str(inserted_id)

    @pytest.mark.asyncio
    async def test_update_returns_get_by_id_result(
        self, service, mock_db, sample_dist_list
    ):
        """Test update returns the result of get_by_id after updating"""
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )

        result = await service.update(VALID_OID, {"name": "Updated"}, user_id=USER_ID)

        assert result["key"] == "dev-team"

    @pytest.mark.asyncio
    async def test_add_email_returns_get_by_id_result(
        self, service, mock_db, sample_dist_list
    ):
        """Test add_email returns the result of get_by_id after update"""
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)

        result = await service.add_email(VALID_OID, "new@example.com", user_id=USER_ID)

        assert result["key"] == "dev-team"

    @pytest.mark.asyncio
    async def test_remove_email_returns_get_by_id_result(
        self, service, mock_db, sample_dist_list
    ):
        """Test remove_email returns the result of get_by_id after update"""
        mock_db.distribution_lists.update_one = AsyncMock(
            return_value=MagicMock(matched_count=1)
        )
        mock_db.distribution_lists.find_one = AsyncMock(return_value=sample_dist_list)

        result = await service.remove_email(
            VALID_OID, "bob@example.com", user_id=USER_ID
        )

        assert result["key"] == "dev-team"
