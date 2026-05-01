"""Tests for process-to-scenario/playboard mapping."""
import pytest
from unittest.mock import AsyncMock, MagicMock


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.domain_scenarios = AsyncMock()
    db.playboards = AsyncMock()
    db.domains = AsyncMock()
    return db


@pytest.fixture
def mock_ew_client():
    client = AsyncMock()
    client.get_process.return_value = {
        "id": "proc-001",
        "name": "Sales Report",
        "description": "Monthly sales data",
        "params": {
            "customer_number": {"type": "string", "label": "Customer Number", "default": ""},
            "region": {"type": "select", "label": "Region", "options": ["US", "EU", "APAC"], "default": "US"},
            "start_date": {"type": "date", "label": "Start Date", "default": "2026-01-01"},
            "active_only": {"type": "boolean", "label": "Active Only", "default": True},
            "status": {"type": "multi_select", "label": "Status", "options": ["open", "closed", "pending"]},
            "include_totals": {"type": "boolean_yesno", "label": "Include Totals", "default": "yes"},
        },
        "config": {"source_id": "pg-sales"},
        "tags": ["sales"],
        "version": 1,
    }
    return client


@pytest.fixture
def publish_service(mock_db, mock_ew_client):
    from easylifeauth.services.explorer_publish_service import ExplorerPublishService
    return ExplorerPublishService(mock_db, mock_ew_client)


def test_map_string_param_to_input_filter():
    from easylifeauth.services.explorer_publish_service import map_param_to_filter
    param = {"type": "string", "label": "Customer Number", "default": ""}
    f = map_param_to_filter("customer_number", param)
    assert f["dataKey"] == "customer_number"
    assert f["displayName"] == "Customer Number"
    attrs = {a["key"]: a["value"] for a in f["attributes"]}
    assert attrs["type"] == "input"


def test_map_select_param_to_dropdown_filter():
    from easylifeauth.services.explorer_publish_service import map_param_to_filter
    param = {"type": "select", "label": "Region", "options": ["US", "EU"], "default": "US"}
    f = map_param_to_filter("region", param)
    attrs = {a["key"]: a["value"] for a in f["attributes"]}
    assert attrs["type"] == "dropdown"
    assert attrs["options"] == "US,EU"
    assert attrs["defaultValue"] == "US"


def test_map_date_param_to_datepicker_filter():
    from easylifeauth.services.explorer_publish_service import map_param_to_filter
    param = {"type": "date", "label": "Start Date", "default": "2026-01-01"}
    f = map_param_to_filter("start_date", param)
    attrs = {a["key"]: a["value"] for a in f["attributes"]}
    assert attrs["type"] == "date-picker"
    assert attrs["format"] == "YYYYMMDD"


def test_map_multi_select_param():
    from easylifeauth.services.explorer_publish_service import map_param_to_filter
    param = {"type": "multi_select", "label": "Status", "options": ["open", "closed", "pending"]}
    f = map_param_to_filter("status", param)
    attrs = {a["key"]: a["value"] for a in f["attributes"]}
    assert attrs["type"] == "multiselect"
    assert attrs["options"] == "open,closed,pending"


def test_map_boolean_yesno_to_toggle():
    from easylifeauth.services.explorer_publish_service import map_param_to_filter
    param = {"type": "boolean_yesno", "label": "Include Totals", "default": "yes"}
    f = map_param_to_filter("include_totals", param)
    attrs = {a["key"]: a["value"] for a in f["attributes"]}
    assert attrs["type"] == "toggleButton"


@pytest.mark.asyncio
async def test_publish_creates_scenario_and_playboard(publish_service, mock_db):
    mock_db.domains.find_one.return_value = {"key": "sales", "name": "Sales", "status": "A"}
    mock_db.domain_scenarios.find_one.return_value = None
    mock_db.domain_scenarios.insert_one.return_value = AsyncMock(inserted_id="s-id")
    mock_db.playboards.insert_one.return_value = AsyncMock(inserted_id="p-id")

    result = await publish_service.publish(
        process_id="proc-001", name="Sales Report", description="Monthly sales",
        domain_key="sales", token="Bearer test-jwt", user_email="admin@test.com",
    )

    assert result["scenario_key"] is not None
    assert result["playboard_key"] is not None
    mock_db.domain_scenarios.insert_one.assert_called_once()
    mock_db.playboards.insert_one.assert_called_once()

    scenario_doc = mock_db.domain_scenarios.insert_one.call_args[0][0]
    assert scenario_doc["dataDomain"] == "sales"
    assert scenario_doc["name"] == "Sales Report"

    pb_doc = mock_db.playboards.insert_one.call_args[0][0]
    assert pb_doc["data"]["data_source"] == "easyweaver"
    assert pb_doc["data"]["ew_process_id"] == "proc-001"
    assert len(pb_doc["widgets"]["filters"]) == 6


@pytest.mark.asyncio
async def test_republish_updates_existing(publish_service, mock_db):
    mock_db.domains.find_one.return_value = {"key": "sales", "name": "Sales", "status": "A"}
    mock_db.domain_scenarios.find_one.return_value = {"key": "sales-report-proc01", "_id": "s-id"}
    mock_db.domain_scenarios.update_one.return_value = AsyncMock(modified_count=1)
    mock_db.playboards.find_one.return_value = {"key": "sales-report-proc01", "_id": "p-id"}
    mock_db.playboards.update_one.return_value = AsyncMock(modified_count=1)

    result = await publish_service.publish(
        process_id="proc-001", name="Sales Report", description="Updated",
        domain_key="sales", token="Bearer test-jwt", user_email="admin@test.com",
        republish=True,
    )

    mock_db.domain_scenarios.update_one.assert_called_once()
    mock_db.playboards.update_one.assert_called_once()


@pytest.mark.asyncio
async def test_publish_invalid_domain_raises(publish_service, mock_db):
    mock_db.domains.find_one.return_value = None
    with pytest.raises(ValueError, match="(?i)domain"):
        await publish_service.publish(
            process_id="proc-001", name="Test", description="Test",
            domain_key="nonexistent", token="Bearer t", user_email="a@b.com",
        )
