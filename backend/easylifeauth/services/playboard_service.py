"""Async Playboard Service"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from bson import ObjectId

from ..db.db_manager import DatabaseManager, is_valid_objectid
from ..errors.playboard_error import PlayboardNotFoundError, PlayboardBadError


UPDATE_ATTRS = [
    "dataDomain", "scenerioKey", "widgets", "order",
    "status", "program_key", "addon_configurations"
]
INSERT_ATTRS = UPDATE_ATTRS + []


class PlayboardService:
    """Async Playboard Service"""

    def __init__(self, db: DatabaseManager):
        self.db = db

    async def get_all(self) -> List[Dict[str, Any]]:
        """Get all active playboards"""
        cursor = self.db.playboards.find(
            filter={"status": "A"}
        ).sort("order", 1)
        
        result = await cursor.to_list(length=1000)
        for r in result:
            r["_id"] = str(r["_id"])
        return result

    async def get_all_by_data_domain_key(
        self,
        data_domain_key: str
    ) -> List[Dict[str, Any]]:
        """Get all playboards by domain key"""
        cursor = self.db.playboards.find(
            filter={"dataDomain": data_domain_key, "status": "A"}
        ).sort("order", 1)
        
        result = await cursor.to_list(length=1000)
        for r in result:
            r["_id"] = str(r["_id"])
        return result

    async def get_playboard_by_key(self, key: str) -> Optional[Dict[str, Any]]:
        """Get playboard by key"""
        result = await self.db.playboards.find_one(
            filter={"key": key, "status": "A"}
        )
        if result is not None:
            result["_id"] = str(result["_id"])
        return result

    async def get_playboard_by_scenario_key(
        self,
        scenario_key: str
    ) -> Optional[Dict[str, Any]]:
        """Get playboard by scenario key"""
        result = await self.db.playboards.find_one(
            filter={"scenerioKey": scenario_key, "status": "A"}
        )
        if result is not None:
            result["_id"] = str(result["_id"])
        return result

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        """Get playboard by id or key"""
        if is_valid_objectid(key):
            query = {"_id": ObjectId(key), "status": "A"}
        else:
            query = {
                "$or": [
                    {"key": key, "status": "A"},
                    {"scenerioKey": key, "status": "A"},
                    {"scenarioKey": key, "status": "A"}
                ]
            }
        
        result = await self.db.playboards.find_one(filter=query)
        if result is not None:
            result["_id"] = str(result["_id"])
        return result

    async def update(
        self,
        document: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Update playboard"""
        docid = document["_id"]
        update_attributes = {k: v for k, v in document.items() if k in UPDATE_ATTRS}
        update_attributes["row_update_user_id"] = user_id
        update_attributes["row_update_stp"] = datetime.now(timezone.utc)

        result = await self.db.playboards.update_one(
            {"_id": ObjectId(docid)},
            {"$set": update_attributes}
        )

        if result.matched_count == 0:
            raise PlayboardNotFoundError("Playboard not found")
        
        return await self.get(docid)

    async def update_status(
        self,
        docid: str,
        status: str
    ) -> Optional[Dict[str, Any]]:
        """Update playboard status"""
        if docid is None or status not in ["A", "I"]:
            raise PlayboardBadError("Bad values provided")
        
        result = await self.db.playboards.update_one(
            {"_id": ObjectId(docid)},
            {"$set": {"status": status}}
        )

        if result.matched_count == 0:
            raise PlayboardBadError("Playboard not found")
        
        return await self.get(docid)

    async def save(
        self,
        document: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Insert new playboard"""
        if document is None or not isinstance(document, dict):
            raise PlayboardBadError("Bad data provided")
        
        insertable = {k: v for k, v in document.items() if k in INSERT_ATTRS}
        insertable["status"] = "A"
        insertable["row_add_userid"] = user_id
        insertable["row_add_stp"] = datetime.now(timezone.utc)
        insertable["row_update_user_id"] = user_id
        insertable["row_update_stp"] = datetime.now(timezone.utc)

        result = await self.db.playboards.insert_one(insertable)
        new_doc_id = str(result.inserted_id)

        out_result = await self.db.playboards.find_one(
            {"_id": ObjectId(new_doc_id)}
        )
        out_result["_id"] = str(out_result["_id"])
        return out_result

    async def delete(self, key: str) -> Dict[str, str]:
        """Delete playboard (set status to I)"""
        if is_valid_objectid(key):
            query = {"_id": ObjectId(key)}
        else:
            query = {"$or": [{"key": key}, {"scenerioKey": key}]}
        
        result = await self.db.playboards.update_one(
            query,
            {"$set": {"status": "I", "row_update_stp": datetime.now(timezone.utc)}}
        )

        if result.matched_count == 0:
            raise PlayboardNotFoundError("Playboard not found")
        
        return {"message": "Playboard deleted successfully"}
