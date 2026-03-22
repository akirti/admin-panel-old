"""UI Template Management Service"""
import logging
import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from bson import ObjectId

logger = logging.getLogger(__name__)

JIRA_KEY_PATTERN = re.compile(r"^[A-Z]+-\d+$")

# MongoDB query operator constants
_REGEX = "$regex"
_OPTIONS = "$options"
_CASE_INSENSITIVE = "i"


class UITemplateService:
    """Service for managing UI templates with versioning and widget overrides."""

    COLLECTION_NAME = "ui_templates"

    def __init__(self, db):
        self.db = db

    def _get_collection(self):
        return self.db.db[self.COLLECTION_NAME]

    @staticmethod
    def _text_search_query(search: str) -> Dict[str, Any]:
        """Build a case-insensitive text search query across name, page, component."""
        pattern = {_REGEX: search, _OPTIONS: _CASE_INSENSITIVE}
        return {
            "$or": [
                {"name": pattern},
                {"page": pattern},
                {"component": pattern},
            ]
        }

    # ── List / Count ─────────────────────────────────────────

    async def list_templates(
        self,
        page: int = 0,
        limit: int = 25,
        search: Optional[str] = None,
        status: Optional[str] = None,
        page_code: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        collection = self._get_collection()
        query: Dict[str, Any] = {}

        if status:
            query["status"] = status
        if page_code:
            query["page"] = page_code
        if search:
            query.update(self._text_search_query(search))

        cursor = (
            collection.find(query)
            .sort("rowAddStp", -1)
            .skip(page * limit)
            .limit(limit)
        )
        templates = await cursor.to_list(length=limit)

        for t in templates:
            t["_id"] = str(t["_id"])
        return templates

    async def count_templates(
        self,
        search: Optional[str] = None,
        status: Optional[str] = None,
        page_code: Optional[str] = None,
    ) -> int:
        collection = self._get_collection()
        query: Dict[str, Any] = {}

        if status:
            query["status"] = status
        if page_code:
            query["page"] = page_code
        if search:
            query.update(self._text_search_query(search))

        return await collection.count_documents(query)

    # ── Single getters ───────────────────────────────────────

    async def get_by_id(self, template_id: str) -> Optional[Dict[str, Any]]:
        collection = self._get_collection()
        try:
            doc = await collection.find_one({"_id": ObjectId(template_id)})
            if doc:
                doc["_id"] = str(doc["_id"])
            return doc
        except Exception as e:
            logger.error("Error getting template by ID: %s", e)
            return None

    async def get_by_page(
        self, page: str, component: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        collection = self._get_collection()
        query: Dict[str, Any] = {"page": page, "status": {"$in": ["A", "Y"]}}
        if component:
            query["component"] = component

        doc = await collection.find_one(query, sort=[("rowAddStp", -1)])
        if doc:
            doc["_id"] = str(doc["_id"])
        return doc

    # ── Create ───────────────────────────────────────────────

    async def create_template(
        self, data: Dict[str, Any], user_email: str
    ) -> Dict[str, Any]:
        collection = self._get_collection()

        # Validate Jira keys in comments
        for c in data.get("comments", []):
            self._validate_jira_keys(c.get("reason", []))

        now = datetime.now(timezone.utc).isoformat()
        data["rowAddUserId"] = user_email
        data["rowAddStp"] = now
        data["rowUpdateUserId"] = user_email
        data["rowUpdateStp"] = now

        result = await collection.insert_one(data)
        data["_id"] = str(result.inserted_id)
        return data

    # ── Update (in-place, no version change) ─────────────────

    async def update_template(
        self, template_id: str, data: Dict[str, Any], user_email: str
    ) -> Optional[Dict[str, Any]]:
        collection = self._get_collection()

        # Strip None values
        update_data = {k: v for k, v in data.items() if v is not None}
        if not update_data:
            return await self.get_by_id(template_id)

        update_data["rowUpdateUserId"] = user_email
        update_data["rowUpdateStp"] = datetime.now(timezone.utc).isoformat()

        try:
            result = await collection.find_one_and_update(
                {"_id": ObjectId(template_id)},
                {"$set": update_data},
                return_document=True,
            )
            if result:
                result["_id"] = str(result["_id"])
            return result
        except Exception as e:
            logger.error("Error updating template: %s", e)
            return None

    # ── Version bump (full document copy) ────────────────────

    async def bump_version(
        self, template_id: str, version_data: Dict[str, Any], user_email: str
    ) -> Optional[Dict[str, Any]]:
        collection = self._get_collection()

        old_doc = await collection.find_one({"_id": ObjectId(template_id)})
        if not old_doc:
            return None

        comment = version_data.get("comment", {})
        self._validate_jira_keys(comment.get("reason", []))

        now = datetime.now(timezone.utc).isoformat()

        # Mark old doc as inactive
        await collection.update_one(
            {"_id": ObjectId(template_id)},
            {
                "$set": {
                    "status": "I",
                    "rowDeleteUserId": user_email,
                    "rowDeleteStp": now,
                }
            },
        )

        # Build new doc from old
        new_doc = {k: v for k, v in old_doc.items() if k != "_id"}
        new_doc["version"] = version_data["version"]
        new_doc["status"] = "A"
        new_doc["rowAddUserId"] = user_email
        new_doc["rowAddStp"] = now
        new_doc["rowUpdateUserId"] = user_email
        new_doc["rowUpdateStp"] = now
        new_doc.pop("rowDeleteUserId", None)
        new_doc.pop("rowDeleteStp", None)

        # Append the version bump comment
        comments = new_doc.get("comments", [])
        comments.append(comment)
        new_doc["comments"] = comments

        result = await collection.insert_one(new_doc)
        new_doc["_id"] = str(result.inserted_id)
        return new_doc

    # ── Soft delete ──────────────────────────────────────────

    async def delete_template(
        self, template_id: str, user_email: str
    ) -> bool:
        collection = self._get_collection()
        now = datetime.now(timezone.utc).isoformat()
        result = await collection.update_one(
            {"_id": ObjectId(template_id)},
            {
                "$set": {
                    "status": "I",
                    "rowDeleteUserId": user_email,
                    "rowDeleteStp": now,
                }
            },
        )
        return result.modified_count > 0

    # ── Toggle status ────────────────────────────────────────

    async def toggle_status(
        self, template_id: str, user_email: str
    ) -> Optional[Dict[str, Any]]:
        doc = await self.get_by_id(template_id)
        if not doc:
            return None

        new_status = "I" if doc.get("status") in ["A", "Y", "active", True] else "A"
        return await self.update_template(
            template_id, {"status": new_status}, user_email
        )

    # ── Widget reorder ───────────────────────────────────────

    async def reorder_widgets(
        self, template_id: str, widget_keys_ordered: List[str], user_email: str
    ) -> Optional[Dict[str, Any]]:
        doc = await self.get_by_id(template_id)
        if not doc:
            return None

        widgets = doc.get("widgets", [])
        key_to_widget = {w["key"]: w for w in widgets}

        reordered = []
        for idx, wk in enumerate(widget_keys_ordered):
            if wk in key_to_widget:
                w = key_to_widget[wk]
                w["index"] = idx
                reordered.append(w)

        # Append any widgets not in the ordered list
        for w in widgets:
            if w["key"] not in widget_keys_ordered:
                w["index"] = len(reordered)
                reordered.append(w)

        return await self.update_template(
            template_id, {"widgets": reordered}, user_email
        )

    # ── Add comment ──────────────────────────────────────────

    async def add_comment(
        self, template_id: str, comment: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        collection = self._get_collection()

        self._validate_jira_keys(comment.get("reason", []))

        if not comment.get("timestamp"):
            comment["timestamp"] = datetime.now(timezone.utc).isoformat()

        try:
            result = await collection.find_one_and_update(
                {"_id": ObjectId(template_id)},
                {"$push": {"comments": comment}},
                return_document=True,
            )
            if result:
                result["_id"] = str(result["_id"])
            return result
        except Exception as e:
            logger.error("Error adding comment: %s", e)
            return None

    # ── Widget attribute update ───────────────────────────────

    async def update_widget_attributes(
        self,
        template_id: str,
        widget_key: str,
        attributes: List[Dict[str, Any]],
        user_email: str,
    ) -> Optional[Dict[str, Any]]:
        doc = await self.get_by_id(template_id)
        if not doc:
            return None

        widgets = doc.get("widgets", [])
        updated = False
        for w in widgets:
            if w["key"] == widget_key:
                w["attributes"] = attributes
                updated = True
                break

        if not updated:
            return None

        return await self.update_template(
            template_id, {"widgets": widgets}, user_email
        )

    # ── Widget override set / remove ─────────────────────────

    async def set_widget_override(
        self,
        template_id: str,
        widget_key: str,
        override_key: str,
        override: Dict[str, Any],
        user_email: str,
    ) -> Optional[Dict[str, Any]]:
        doc = await self.get_by_id(template_id)
        if not doc:
            return None

        widgets = doc.get("widgets", [])
        updated = False
        for w in widgets:
            if w["key"] == widget_key:
                overrides = w.get("overrides", {})
                overrides[override_key] = override
                w["overrides"] = overrides
                updated = True
                break

        if not updated:
            return None

        return await self.update_template(
            template_id, {"widgets": widgets}, user_email
        )

    async def remove_widget_override(
        self,
        template_id: str,
        widget_key: str,
        override_key: str,
        user_email: str,
    ) -> Optional[Dict[str, Any]]:
        doc = await self.get_by_id(template_id)
        if not doc:
            return None

        widgets = doc.get("widgets", [])
        updated = False
        for w in widgets:
            if w["key"] == widget_key:
                overrides = w.get("overrides", {})
                if override_key in overrides:
                    del overrides[override_key]
                    w["overrides"] = overrides
                    updated = True
                break

        if not updated:
            return None

        return await self.update_template(
            template_id, {"widgets": widgets}, user_email
        )

    # ── Helpers ───────────────────────────────────────────────

    @staticmethod
    def _validate_jira_keys(keys: List[str]) -> None:
        for key in keys:
            if not JIRA_KEY_PATTERN.match(key):
                raise ValueError(
                    f"Invalid Jira ticket key: '{key}'. Expected format: PROJ-123"
                )
