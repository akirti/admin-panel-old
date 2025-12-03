"""Async Domain Service"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from bson import ObjectId

from ..db.db_manager import DatabaseManager, is_valid_objectid
from ..errors.domain_error import DomainNotFoundError, DomainBadError


UPDATE_ATTRS = [
    "name", "status", "description", "path",
    "defaultSelected", "order", "icon"
]
INSERT_ATTRS = ["key", "actions", "dataDomain", "type", "subDomain"] + UPDATE_ATTRS


class DataDomainService:
    """Async Domain Service"""

    def __init__(self, db: DatabaseManager):
        self.db = db

    async def get_all(self) -> List[Dict[str, Any]]:
        """Get all active domains"""
        cursor = self.db.easylife_domain.find(
            filter={"status": "A"},
            projection={"_id": 0}
        ).sort("order", 1)
        
        result = await cursor.to_list(length=1000)
        return result

    async def get_domain_by_key(self, key: str) -> Optional[Dict[str, Any]]:
        """Get domain by key"""
        result = await self.db.easylife_domain.find_one(
            filter={"key": key, "status": "A"}
        )
        if result is not None:
            result["_id"] = str(result["_id"])
        return result

    async def get(self, docid: str) -> Optional[Dict[str, Any]]:
        """Get domain by id or key"""
        if is_valid_objectid(docid):
            query = {"_id": ObjectId(docid), "status": "A"}
        else:
            query = {"key": docid, "status": "A"}

        result = await self.db.easylife_domain.find_one(filter=query)

        if result is not None:
            result["_id"] = str(result["_id"])
        return result

    async def update(
        self,
        document: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Update domain"""
        docid = document["_id"]
        update_attributes = {k: v for k, v in document.items() if k in UPDATE_ATTRS}
        update_attributes["row_update_user_id"] = user_id
        update_attributes["row_update_stp"] = datetime.now(timezone.utc)
        
        result = await self.db.easylife_domain.update_one(
            {"_id": ObjectId(docid)},
            {"$set": update_attributes}
        )

        if result.matched_count == 0:
            raise DomainNotFoundError("Domain not found")
        
        return await self.get(docid)

    async def update_status(
        self,
        docid: str,
        status: str
    ) -> Optional[Dict[str, Any]]:
        """Update domain status"""
        if docid is None or status not in ["A", "I"]:
            raise DomainBadError("Bad values provided")
        
        result = await self.db.easylife_domain.update_one(
            {"_id": ObjectId(docid)},
            {"$set": {"status": status}}
        )

        if result.matched_count == 0:
            raise DomainNotFoundError("Domain not found")
        
        return await self.get(docid)

    async def save(
        self,
        document: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Insert new domain"""
        if document is None or not isinstance(document, dict):
            raise DomainBadError("Bad data provided")
        
        insertable = {k: v for k, v in document.items() if k in INSERT_ATTRS}
        insertable["status"] = "A"
        insertable["row_add_userid"] = user_id
        insertable["row_add_stp"] = datetime.now(timezone.utc)
        insertable["row_update_user_id"] = user_id
        insertable["row_update_stp"] = datetime.now(timezone.utc)

        result = await self.db.easylife_domain.insert_one(insertable)
        new_doc_id = str(result.inserted_id)

        out_result = await self.db.easylife_domain.find_one({"_id": ObjectId(new_doc_id)})
        out_result["_id"] = str(out_result["_id"])
        return out_result

    async def delete(self, docid: str) -> Dict[str, str]:
        """Delete domain (set status to I)"""
        if is_valid_objectid(docid):
            query = {"_id": ObjectId(docid)}
        else:
            query = {"key": docid}
        
        result = await self.db.easylife_domain.update_one(
            query,
            {"$set": {"status": "I", "row_update_stp": datetime.now(timezone.utc)}}
        )

        if result.matched_count == 0:
            raise DomainNotFoundError("Domain not found")
        
        return {"message": "Domain deleted successfully"}
