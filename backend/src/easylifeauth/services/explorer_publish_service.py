"""Maps EasyWeaver processes to Explorer scenarios + playboards."""
from __future__ import annotations
import re
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

PARAM_TYPE_MAP = {
    "string": "input",
    "number": "input",
    "date": "date-picker",
    "datetime": "date-picker",
    "boolean": "checkbox",
    "boolean_yesno": "toggleButton",
    "boolean_truefalse": "toggleButton",
    "select": "dropdown",
    "multi_select": "multiselect",
}


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    return re.sub(r"-+", "-", text).strip("-")


def map_param_to_filter(param_name: str, param: dict) -> dict:
    param_type = param.get("type", "string")
    filter_type = PARAM_TYPE_MAP.get(param_type, "input")

    attributes = [
        {"key": "type", "value": filter_type},
        {"key": "defaultValue", "value": param.get("default", "")},
        {"key": "placeholder", "value": param.get("label", param_name)},
    ]

    options = param.get("options", [])
    if options:
        attributes.append({"key": "options", "value": ",".join(str(o) for o in options)})

    if param_type in ("date", "datetime"):
        attributes.append({"key": "format", "value": "YYYYMMDD"})

    if param_type == "boolean_yesno":
        attributes.extend([{"key": "onValue", "value": "yes"}, {"key": "offValue", "value": "no"}])
    elif param_type == "boolean_truefalse":
        attributes.extend([{"key": "onValue", "value": "true"}, {"key": "offValue", "value": "false"}])

    validators = []
    if param_type == "number":
        validators.append({"type": "numberofdigits", "message": f"{param_name} must be numeric"})

    return {
        "dataKey": param_name,
        "displayName": param.get("label") or param_name.replace("_", " ").title(),
        "index": 0, "visible": True, "status": "Y",
        "attributes": attributes, "validators": validators,
    }


class ExplorerPublishService:
    def __init__(self, db, ew_client):
        self.db = db
        self.ew_client = ew_client

    async def publish(self, process_id: str, name: str, description: str,
                      domain_key: str, token: str, user_email: str,
                      icon: str = None, tags: list = None,
                      republish: bool = False) -> dict:
        domain = await self.db.domains.find_one({"key": domain_key, "status": "A"})
        if not domain:
            raise ValueError(f"Domain '{domain_key}' not found or inactive")

        process = await self.ew_client.get_process(process_id, token)
        if not process:
            raise ValueError(f"Process '{process_id}' not found in EasyWeaver")

        short_id = process_id[-6:] if len(process_id) > 6 else process_id
        scenario_key = f"{slugify(name)}-{short_id}"

        filters = []
        params = process.get("params", {})
        for param_name, param_def in params.items():
            filters.append(map_param_to_filter(param_name, param_def))

        logic_args = {"0": {"query_params": {}}}
        for param_name, param_def in params.items():
            if param_def.get("default") is not None:
                logic_args["0"]["query_params"][param_name] = param_def["default"]

        now = datetime.now(timezone.utc)

        scenario_doc = {
            "key": scenario_key, "name": name, "dataDomain": domain_key,
            "description": description, "path": f"/{domain_key}/{scenario_key}",
            "icon": icon or "", "order": 0, "status": "A", "actions": [],
            "created_at": now, "updated_at": now, "created_by": user_email,
        }

        source_id = ""
        config = process.get("config", {})
        if isinstance(config, dict):
            source_id = config.get("source_id", "")

        playboard_doc = {
            "key": scenario_key, "name": name, "description": description,
            "scenarioKey": scenario_key, "dataDomain": domain_key,
            "program_key": f"ew:{process_id}",
            "widgets": {
                "filters": filters,
                "pagination": {"attributes": [
                    {"key": "defaultValue", "value": 10},
                    {"key": "options", "value": "10,20,30,40,50"},
                ]},
                "grid": {"layout": {"ispaginated": True}},
            },
            "logic_args": logic_args,
            "data": {
                "data_source": "easyweaver", "ew_process_id": process_id,
                "ew_source_id": source_id, "ew_process_version": process.get("version", 1),
            },
            "order": 0, "status": "A",
            "created_at": now, "updated_at": now, "created_by": user_email,
        }

        if republish:
            existing_scenario = await self.db.domain_scenarios.find_one({"key": scenario_key})
            if existing_scenario:
                await self.db.domain_scenarios.update_one(
                    {"key": scenario_key},
                    {"$set": {"description": description, "updated_at": now, "updated_by": user_email}},
                )
            existing_pb = await self.db.playboards.find_one({"key": scenario_key})
            if existing_pb:
                await self.db.playboards.update_one(
                    {"key": scenario_key},
                    {"$set": {"widgets": playboard_doc["widgets"], "logic_args": playboard_doc["logic_args"],
                              "data": playboard_doc["data"], "updated_at": now, "updated_by": user_email}},
                )
        else:
            await self.db.domain_scenarios.insert_one(scenario_doc)
            await self.db.playboards.insert_one(playboard_doc)

        return {
            "scenario_key": scenario_key, "playboard_key": scenario_key,
            "message": f"Published to Explorer under {domain['name']} domain",
        }
