"""Async Distribution List Service"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from bson import ObjectId

from ..db.db_manager import DatabaseManager, is_valid_objectid


class DistributionListService:
    """Async Distribution List Service for managing email distribution lists"""

    def __init__(self, db: DatabaseManager):
        self.db = db

    async def get_all(self, include_inactive: bool = False) -> List[Dict[str, Any]]:
        """Get all distribution lists"""
        query = {} if include_inactive else {"is_active": True}
        cursor = self.db.distribution_lists.find(query).sort("name", 1)

        result = await cursor.to_list(length=1000)
        for r in result:
            r["_id"] = str(r["_id"])
        return result

    async def get_by_id(self, list_id: str) -> Optional[Dict[str, Any]]:
        """Get distribution list by ID"""
        if not is_valid_objectid(list_id):
            return None

        result = await self.db.distribution_lists.find_one(
            {"_id": ObjectId(list_id)}
        )
        if result:
            result["_id"] = str(result["_id"])
        return result

    async def get_by_key(self, key: str) -> Optional[Dict[str, Any]]:
        """Get distribution list by key"""
        result = await self.db.distribution_lists.find_one(
            {"key": key, "is_active": True}
        )
        if result:
            result["_id"] = str(result["_id"])
        return result

    async def get_by_type(self, list_type: str) -> List[Dict[str, Any]]:
        """Get all distribution lists by type"""
        cursor = self.db.distribution_lists.find(
            {"type": list_type, "is_active": True}
        ).sort("name", 1)

        result = await cursor.to_list(length=1000)
        for r in result:
            r["_id"] = str(r["_id"])
        return result

    async def get_emails_by_key(self, key: str) -> List[str]:
        """Get email addresses for a distribution list by key"""
        dist_list = await self.get_by_key(key)
        if dist_list:
            return dist_list.get("emails", [])
        return []

    async def get_emails_by_type(self, list_type: str) -> List[str]:
        """Get all unique email addresses from all lists of a given type"""
        lists = await self.get_by_type(list_type)
        all_emails = set()
        for dist_list in lists:
            all_emails.update(dist_list.get("emails", []))
        return list(all_emails)

    async def create(
        self,
        data: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new distribution list"""
        # Check if key already exists
        existing = await self.db.distribution_lists.find_one({"key": data.get("key")})
        if existing:
            raise ValueError(f"Distribution list with key '{data.get('key')}' already exists")

        now = datetime.now(timezone.utc)
        document = {
            "key": data.get("key"),
            "name": data.get("name"),
            "description": data.get("description"),
            "type": data.get("type", "custom"),
            "emails": data.get("emails", []),
            "is_active": data.get("is_active", True),
            "created_at": now,
            "created_by": user_id,
            "updated_at": now,
            "updated_by": user_id
        }

        result = await self.db.distribution_lists.insert_one(document)
        return await self.get_by_id(str(result.inserted_id))

    async def update(
        self,
        list_id: str,
        data: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Update a distribution list"""
        if not is_valid_objectid(list_id):
            return None

        # Check if key change would conflict with existing list
        if "key" in data:
            existing = await self.db.distribution_lists.find_one({
                "key": data["key"],
                "_id": {"$ne": ObjectId(list_id)}
            })
            if existing:
                raise ValueError(f"Distribution list with key '{data['key']}' already exists")

        update_fields = {}
        for field in ["key", "name", "description", "type", "emails", "is_active"]:
            if field in data:
                update_fields[field] = data[field]

        update_fields["updated_at"] = datetime.now(timezone.utc)
        update_fields["updated_by"] = user_id

        result = await self.db.distribution_lists.update_one(
            {"_id": ObjectId(list_id)},
            {"$set": update_fields}
        )

        if result.matched_count == 0:
            return None

        return await self.get_by_id(list_id)

    async def add_email(
        self,
        list_id: str,
        email: str,
        user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Add an email to a distribution list"""
        if not is_valid_objectid(list_id):
            return None

        result = await self.db.distribution_lists.update_one(
            {"_id": ObjectId(list_id)},
            {
                "$addToSet": {"emails": email},
                "$set": {
                    "updated_at": datetime.now(timezone.utc),
                    "updated_by": user_id
                }
            }
        )

        if result.matched_count == 0:
            return None

        return await self.get_by_id(list_id)

    async def remove_email(
        self,
        list_id: str,
        email: str,
        user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Remove an email from a distribution list"""
        if not is_valid_objectid(list_id):
            return None

        result = await self.db.distribution_lists.update_one(
            {"_id": ObjectId(list_id)},
            {
                "$pull": {"emails": email},
                "$set": {
                    "updated_at": datetime.now(timezone.utc),
                    "updated_by": user_id
                }
            }
        )

        if result.matched_count == 0:
            return None

        return await self.get_by_id(list_id)

    async def delete(self, list_id: str) -> bool:
        """Soft delete a distribution list (set is_active to False)"""
        if not is_valid_objectid(list_id):
            return False

        result = await self.db.distribution_lists.update_one(
            {"_id": ObjectId(list_id)},
            {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc)}}
        )

        return result.matched_count > 0

    async def hard_delete(self, list_id: str) -> bool:
        """Permanently delete a distribution list"""
        if not is_valid_objectid(list_id):
            return False

        result = await self.db.distribution_lists.delete_one(
            {"_id": ObjectId(list_id)}
        )

        return result.deleted_count > 0
