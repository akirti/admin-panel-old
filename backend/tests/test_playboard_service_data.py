"""Tests that PlayboardService can update the 'data' field."""
import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.playboards = AsyncMock()
    return db


@pytest.fixture
def playboard_service(mock_db):
    from easylifeauth.services.playboard_service import PlayboardService
    return PlayboardService(mock_db)


@pytest.mark.asyncio
async def test_update_preserves_data_field(playboard_service, mock_db):
    """UPDATE_ATTRS must include 'data' so playboard.data can be updated."""
    existing_doc = {
        "_id": "665f1a2b3c4d5e6f7a8b9c0d",
        "key": "test-pb",
        "name": "Test",
        "data": {"old_key": "old_value"},
    }
    mock_db.playboards.find_one.return_value = {
        **existing_doc,
        "status": "A",
    }
    mock_db.playboards.update_one.return_value = AsyncMock(matched_count=1)

    update_payload = {
        "_id": "665f1a2b3c4d5e6f7a8b9c0d",
        "data": {"data_source": "easyweaver", "ew_process_id": "proc-001"},
        "widgets": {"filters": []},
    }

    result = await playboard_service.update(update_payload, "admin@test.com")

    call_args = mock_db.playboards.update_one.call_args
    set_dict = call_args[0][1]["$set"]
    assert "data" in set_dict
    assert set_dict["data"]["data_source"] == "easyweaver"
    assert set_dict["data"]["ew_process_id"] == "proc-001"
