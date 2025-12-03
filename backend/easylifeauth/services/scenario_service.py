"""Async Scenario Service"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from bson import ObjectId

from ..db.db_manager import DatabaseManager, is_valid_objectid
from ..errors.scenario_error import ScenarioNotFoundError, ScenarioBadError


UPDATE_ATTRS = [
    "name", "status", "description", "path",
    "defaultSelected", "order", "icon", "dataDomain", "fullDescription"
]
INSERT_ATTRS = UPDATE_ATTRS + ["key", "actions"]


class ScenarioService:
    """Async Scenario Service"""

    def __init__(self, db: DatabaseManager):
        self.db = db

    async def get_all(self) -> List[Dict[str, Any]]:
        """Get all active scenarios"""
        cursor = self.db.easylife_scenerios.find(
            filter={"status": "A"},
            projection={"_id": 0}
        ).sort("order", 1)
        
        result = await cursor.to_list(length=1000)
        return result

    async def get_all_by_data_domain_key(
        self,
        data_domain_key: str
    ) -> List[Dict[str, Any]]:
        """Get all scenarios by domain key"""
        cursor = self.db.easylife_scenerios.find(
            filter={"dataDomain": data_domain_key, "status": "A"},
            projection={"_id": 0}
        ).sort("order", 1)
        
        result = await cursor.to_list(length=1000)
        return result

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Get scenario by key or id"""
        if is_valid_objectid(key):
            query = {"_id": ObjectId(key), "status": "A"}
        else:
            query = {"key": key, "status": "A"}

        result = await self.db.easylife_scenerios.find_one(query)
        
        if result is None:
            raise ScenarioNotFoundError("Scenario not found", 404)
        
        result["_id"] = str(result["_id"])
        return result

    async def get_scenario(self, docid: str) -> Optional[Dict[str, Any]]:
        """Get scenario by id"""
        result = await self.db.easylife_scenerios.find_one(
            filter={"_id": ObjectId(docid), "status": "A"}
        )
        
        if result is None:
            raise ScenarioNotFoundError("Scenario not found", 404)
        
        result["_id"] = str(result["_id"])
        return result

    async def update(
        self,
        document: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Update scenario"""
        docid = document["_id"]
        update_attributes = {k: v for k, v in document.items() if k in UPDATE_ATTRS}
        update_attributes["row_update_user_id"] = user_id
        update_attributes["row_update_stp"] = datetime.now(timezone.utc)

        result = await self.db.easylife_scenerios.update_one(
            {"_id": ObjectId(docid)},
            {"$set": update_attributes}
        )

        if result.matched_count == 0:
            raise ScenarioNotFoundError("Scenario not found")
        
        return await self.get_scenario(docid)

    async def update_status(
        self,
        docid: str,
        status: str
    ) -> Optional[Dict[str, Any]]:
        """Update scenario status"""
        if docid is None or status not in ["A", "I"]:
            raise ScenarioBadError("Bad values provided")
        
        result = await self.db.easylife_scenerios.update_one(
            {"_id": ObjectId(docid)},
            {"$set": {"status": status}}
        )

        if result.matched_count == 0:
            raise ScenarioBadError("Scenario not found")
        
        return await self.get_scenario(docid)

    async def save(
        self,
        document: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Insert new scenario"""
        if document is None or not isinstance(document, dict):
            raise ScenarioBadError("Bad data provided")
        
        insertable = {k: v for k, v in document.items() if k in INSERT_ATTRS}
        insertable["status"] = "A"
        insertable["row_add_userid"] = user_id
        insertable["row_add_stp"] = datetime.now(timezone.utc)
        insertable["row_update_user_id"] = user_id
        insertable["row_update_stp"] = datetime.now(timezone.utc)

        result = await self.db.easylife_scenerios.insert_one(insertable)
        new_doc_id = str(result.inserted_id)

        out_result = await self.db.easylife_scenerios.find_one({"_id": ObjectId(new_doc_id)})
        out_result["_id"] = str(out_result["_id"])
        return out_result

    async def delete(self, key: str) -> Dict[str, str]:
        """Delete scenario (set status to I)"""
        if is_valid_objectid(key):
            query = {"_id": ObjectId(key)}
        else:
            query = {"key": key}
        
        result = await self.db.easylife_scenerios.update_one(
            query,
            {"$set": {"status": "I", "row_update_stp": datetime.now(timezone.utc)}}
        )

        if result.matched_count == 0:
            raise ScenarioNotFoundError("Scenario not found")
        
        return {"message": "Scenario deleted successfully"}
