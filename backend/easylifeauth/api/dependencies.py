"""Async FastAPI Dependencies"""
from typing import Optional, Dict, Any
from fastapi import Depends

from ..db.db_manager import DatabaseManager
from ..services.token_manager import TokenManager
from ..services.user_service import UserService
from ..services.admin_service import AdminService
from ..services.password_service import PasswordResetService
from ..services.email_service import EmailService
from ..services.domain_service import DataDomainService
from ..services.scenario_service import ScenarioService
from ..services.playboard_service import PlayboardService
from ..services.feedback_service import FeedbackService
from ..services.new_scenarios_service import NewScenarioService
from ..services.jira_service import JiraService
from ..services.file_storage_service import FileStorageService
from ..services.activity_log_service import ActivityLogService, init_activity_log_service
from ..security.access_control import CurrentUser, get_current_user, set_token_manager


# Global service instances (initialized in app.py)
_db: Optional[DatabaseManager] = None
_token_manager: Optional[TokenManager] = None
_user_service: Optional[UserService] = None
_admin_service: Optional[AdminService] = None
_password_service: Optional[PasswordResetService] = None
_email_service: Optional[EmailService] = None
_domain_service: Optional[DataDomainService] = None
_scenario_service: Optional[ScenarioService] = None
_playboard_service: Optional[PlayboardService] = None
_feedback_service: Optional[FeedbackService] = None
_scenario_request_service: Optional[NewScenarioService] = None
_jira_service: Optional[JiraService] = None
_file_storage_service: Optional[FileStorageService] = None
_activity_log_service: Optional[ActivityLogService] = None


def init_dependencies(
    db: DatabaseManager,
    token_manager: TokenManager,
    email_service: Optional[EmailService] = None,
    jira_config: Optional[Dict[str, Any]] = None,
    file_storage_config: Optional[Dict[str, Any]] = None,
    gcs_config: Optional[Dict[str, Any]] = None
) -> None:
    """Initialize all dependencies"""
    global _db, _token_manager, _user_service, _admin_service
    global _password_service, _email_service, _domain_service
    global _scenario_service, _playboard_service, _feedback_service
    global _scenario_request_service, _jira_service, _file_storage_service
    global _activity_log_service

    _db = db
    _token_manager = token_manager
    _email_service = email_service

    # Set token manager for access control
    set_token_manager(token_manager)

    # Initialize Jira service if configured
    _jira_service = None
    if jira_config:
        _jira_service = JiraService(jira_config)
        if _jira_service.enabled:
            print("✓ Jira integration configured")

    # Initialize file storage service if configured
    _file_storage_service = None
    if file_storage_config:
        _file_storage_service = FileStorageService(file_storage_config)
        if _file_storage_service.enabled:
            print(f"✓ File storage configured ({_file_storage_service.storage_type})")
    else:
        # Default to local storage
        _file_storage_service = FileStorageService({"type": "local"})
        print("✓ File storage configured (local)")

    # Initialize services
    _user_service = UserService(db, token_manager)
    _admin_service = AdminService(db)
    _password_service = PasswordResetService(db, token_manager, email_service)
    _domain_service = DataDomainService(db)
    _scenario_service = ScenarioService(db)
    _playboard_service = PlayboardService(db)
    _feedback_service = FeedbackService(db, token_manager, email_service)
    _scenario_request_service = NewScenarioService(
        db, token_manager, email_service, _jira_service, _file_storage_service
    )

    # Initialize activity log service
    _activity_log_service = init_activity_log_service(db)
    print("✓ Activity logging service initialized")

    # Initialize bulk upload services with GCS config
    from .bulk_upload_routes import init_bulk_services
    init_bulk_services(db, gcs_config)
    if gcs_config:
        print("✓ Bulk upload services initialized (with GCS)")
    else:
        print("✓ Bulk upload services initialized (local only)")

    # Initialize configurations GCS service
    from .configurations_routes import init_gcs_service
    init_gcs_service(gcs_config)


def get_db() -> DatabaseManager:
    """Get database manager"""
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db


def get_token_manager() -> TokenManager:
    """Get token manager"""
    if _token_manager is None:
        raise RuntimeError("Token manager not initialized")
    return _token_manager


def get_user_service() -> UserService:
    """Get user service"""
    if _user_service is None:
        raise RuntimeError("User service not initialized")
    return _user_service


def get_admin_service() -> AdminService:
    """Get admin service"""
    if _admin_service is None:
        raise RuntimeError("Admin service not initialized")
    return _admin_service


def get_password_service() -> PasswordResetService:
    """Get password service"""
    if _password_service is None:
        raise RuntimeError("Password service not initialized")
    return _password_service


def get_email_service() -> Optional[EmailService]:
    """Get email service"""
    return _email_service


def get_domain_service() -> DataDomainService:
    """Get domain service"""
    if _domain_service is None:
        raise RuntimeError("Domain service not initialized")
    return _domain_service


def get_scenario_service() -> ScenarioService:
    """Get scenario service"""
    if _scenario_service is None:
        raise RuntimeError("Scenario service not initialized")
    return _scenario_service


def get_playboard_service() -> PlayboardService:
    """Get playboard service"""
    if _playboard_service is None:
        raise RuntimeError("Playboard service not initialized")
    return _playboard_service


def get_feedback_service() -> FeedbackService:
    """Get feedback service"""
    if _feedback_service is None:
        raise RuntimeError("Feedback service not initialized")
    return _feedback_service


def get_scenario_request_service() -> NewScenarioService:
    """Get scenario request service"""
    if _scenario_request_service is None:
        raise RuntimeError("Scenario request service not initialized")
    return _scenario_request_service


def get_jira_service() -> Optional[JiraService]:
    """Get Jira service"""
    return _jira_service


def get_file_storage_service() -> Optional[FileStorageService]:
    """Get file storage service"""
    return _file_storage_service


def get_activity_log_service() -> Optional[ActivityLogService]:
    """Get activity log service"""
    return _activity_log_service


# Re-export get_current_user
__all__ = [
    "init_dependencies",
    "get_db",
    "get_token_manager",
    "get_user_service",
    "get_admin_service",
    "get_password_service",
    "get_email_service",
    "get_domain_service",
    "get_scenario_service",
    "get_playboard_service",
    "get_feedback_service",
    "get_scenario_request_service",
    "get_jira_service",
    "get_file_storage_service",
    "get_activity_log_service",
    "get_current_user",
]
