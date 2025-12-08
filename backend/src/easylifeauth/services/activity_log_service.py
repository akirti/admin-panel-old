"""
Activity Logging Service - Records user actions for audit trail.
"""
from datetime import datetime
from typing import Optional, Dict, Any
from ..db.db_manager import DatabaseManager


class ActivityLogService:
    """Service for logging user activities."""

    def __init__(self, db: DatabaseManager):
        self.db = db

    async def log(
        self,
        action: str,
        entity_type: str,
        entity_id: str,
        user_email: str,
        details: Optional[Dict[str, Any]] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Log an activity.

        Args:
            action: The action performed (create, update, delete, login, etc.)
            entity_type: Type of entity (user, role, group, domain, etc.)
            entity_id: ID of the entity affected
            user_email: Email of user who performed the action
            details: Additional details about the action
            old_values: Previous values (for updates)
            new_values: New values (for creates/updates)

        Returns:
            The inserted log ID or None if logging failed
        """
        if not hasattr(self.db, 'activity_logs') or self.db.activity_logs is None:
            return None

        log_entry = {
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id),
            "user_email": user_email,
            "timestamp": datetime.utcnow(),
            "details": details or {},
        }

        if old_values:
            log_entry["old_values"] = old_values
        if new_values:
            log_entry["new_values"] = new_values

        try:
            result = await self.db.activity_logs.insert_one(log_entry)
            return str(result.inserted_id)
        except Exception as e:
            print(f"Failed to log activity: {e}")
            return None


# Singleton instance holder
_activity_log_service: Optional[ActivityLogService] = None


def init_activity_log_service(db: DatabaseManager) -> ActivityLogService:
    """Initialize the activity log service."""
    global _activity_log_service
    _activity_log_service = ActivityLogService(db)
    return _activity_log_service


def get_activity_log_service() -> Optional[ActivityLogService]:
    """Get the activity log service instance."""
    return _activity_log_service


async def log_activity(
    action: str,
    entity_type: str,
    entity_id: str,
    user_email: str,
    details: Optional[Dict[str, Any]] = None,
    old_values: Optional[Dict[str, Any]] = None,
    new_values: Optional[Dict[str, Any]] = None
) -> Optional[str]:
    """
    Convenience function to log an activity.

    Can be called from anywhere after service is initialized.
    """
    service = get_activity_log_service()
    if service:
        return await service.log(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            user_email=user_email,
            details=details,
            old_values=old_values,
            new_values=new_values
        )
    return None
