"""Async New Scenario Request Service"""
from typing import Dict, Any, List, Optional
import re
from enum import Enum
from bson import ObjectId
from datetime import datetime, timezone

from ..db.db_manager import DatabaseManager, distribute_limit
from ..db.constants import EDITORS
from .token_manager import TokenManager
from .email_service import EmailService
from ..errors.auth_error import AuthError


class ScenarioStatus(Enum):
    """New Scenario Request Process status"""
    SUBMITTED = "S"
    IN_PROGRESS = "P"
    DEVELOPMENT = "D"
    REVIEW = "R"
    DEPLOYED = "Y"
    ACTIVE = "A"
    INACTIVE = "I"
    REJECTED = "X"


class NewScenarioService:
    """Async New Scenario Request Service"""
    
    def __init__(
        self,
        db: DatabaseManager,
        token_manager: TokenManager,
        email_service: Optional[EmailService] = None
    ):
        self.db = db
        self.token_manager = token_manager
        self.email_service = email_service

    async def generate_next_id(self, prefix: str = "REQ-SCR") -> str:
        """Generate next request ID"""
        pattern = re.compile(f"^{prefix}-\\d+$")
        
        cursor = self.db.scenario_requests.find(
            {"requestId": {"$regex": pattern.pattern}}
        ).sort("requestId", -1).limit(1)
        
        docs = await cursor.to_list(length=1)
        max_number = 0
        
        for doc in docs:
            match = re.search(rf"{prefix}-(\d+)", doc["requestId"])
            if match:
                num = int(match.group(1))
                max_number = max(max_number, num)
        
        next_number = max_number + 1
        new_id = f"{prefix}-{str(next_number).zfill(4)}"
        return new_id

    async def save(self, ask_scenario: Dict[str, Any]) -> Dict[str, Any]:
        """Save new scenario request"""
        if not ask_scenario or not isinstance(ask_scenario, dict):
            raise AuthError("New scenario data is not provided", 400)
        
        ask_scenario["requestId"] = await self.generate_next_id()
        ask_scenario["rowAddStp"] = datetime.now(timezone.utc)
        ask_scenario["rowUpdateStp"] = datetime.now(timezone.utc)
        ask_scenario["status"] = ScenarioStatus.SUBMITTED.value

        result = await self.db.scenario_requests.insert_one(ask_scenario)
        new_scenario_id = str(result.inserted_id)
        
        out_result = await self.db.scenario_requests.find_one(
            {"_id": ObjectId(new_scenario_id)}
        )
        out_result.pop("_id", None)

        # Send email notification
        if self.email_service:
            try:
                email = ask_scenario.get('email')
                if email:
                    await self.email_service.send_scenario_email(to_email=email, data=ask_scenario)
            except Exception as e:
                print(f"Failed to send scenario email: {e}")

        return out_result

    async def update(
        self,
        update_ask_scenario: Dict[str, Any],
        user_role: List[str]
    ) -> Dict[str, Any]:
        """Update scenario request"""
        if not update_ask_scenario or not isinstance(update_ask_scenario, dict):
            raise AuthError("No scenario update data provided", 400)

        request_id = update_ask_scenario.get("request_id")
        update_ask_scenario["rowUpdateStp"] = datetime.now(timezone.utc)
        
        if not request_id:
            raise AuthError("request_id is required", 400)

        user_fields = {
            "dataDomain", "scenarioName", "description", "databases",
            "steps", "stepQueries", "resultSize", "filters",
            "name", "email", "comments"
        }
        admin_fields = {
            "status", "assignedTo", "scenarioKey",
            "configName", "fulfilmentDate", "comments"
        }

        if "user" in user_role:
            allowed_fields = user_fields
        elif any(r in user_role for r in EDITORS):
            allowed_fields = user_fields.union(admin_fields)
        else:
            raise AuthError("Unauthorized role", 403)

        update_fields = {
            k: v for k, v in update_ask_scenario.items()
            if k in allowed_fields
        }

        if not update_fields:
            raise AuthError("No valid fields to update", 400)

        result = await self.db.scenario_requests.update_one(
            {"requestId": request_id},
            {"$set": update_fields}
        )

        updated = await self.db.scenario_requests.find_one({"requestId": request_id})
        if updated:
            updated["_id"] = str(updated["_id"])

        # Send email notification
        if self.email_service and updated:
            try:
                email = updated.get('email')
                if email:
                    await self.email_service.send_scenario_email(to_email=email, data=updated)
            except Exception as e:
                print(f"Failed to send scenario email: {e}")

        return updated

    async def get(self, request_id: str) -> Dict[str, Any]:
        """Get scenario request by requestId"""
        if not request_id:
            raise AuthError("request_id is required", 400)

        result = await self.db.scenario_requests.find_one({"requestId": request_id})

        if not result:
            raise AuthError("Scenario not found", 404)

        result["_id"] = str(result["_id"])
        return result

    async def get_all(
        self,
        user_id: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Get all scenario requests with pagination"""
        query = {}
        if user_id is not None:
            query = {"user_id": user_id}
        
        limit = 25
        skip = 0
        page = 0
        total = None
        pages = []
        pagination = kwargs.get("pagination", {})
        
        if "limit" in pagination:
            limit = int(pagination["limit"]) if isinstance(pagination["limit"], str) else pagination["limit"]
        if "skip" in pagination:
            skip = int(pagination["skip"]) if isinstance(pagination["skip"], str) else pagination["skip"]
        if "page" in pagination:
            page = int(pagination["page"]) if isinstance(pagination["page"], str) else pagination["page"]
            skip = page * limit
        if "total" in pagination:
            total = int(pagination["total"]) if isinstance(pagination["total"], str) else pagination["total"]
        
        if total is None:
            total = await self.db.scenario_requests.count_documents(query)
            if total > 0:
                pages = distribute_limit(limit=total)
            else:
                pages = [limit]
        
        next_pagination = {
            **pagination,
            "page": page + 1,
            "skip": skip,
            "limit": limit,
            "total": total,
            "current": page,
            "pages": pages
        }
        
        cursor = self.db.scenario_requests.find(
            query,
            {"_id": 0}
        ).sort([
            ("requestId", -1),
            ("requestType", -1),
            ("dataDomain", -1),
            ("rowAddStp", -1),
            ("rowUpdateStp", -1)
        ]).skip(skip).limit(limit)
        
        result = await cursor.to_list(length=limit)
        
        return {"data": result, "pagination": next_pagination}

    async def get_user_by_id(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email"""
        try:
            user = await self.db.users.find_one({"email": email})
            if user:
                user["_id"] = str(user["_id"])
                user.pop("password_hash", None)
                return user
            return None
        except Exception:
            return None
