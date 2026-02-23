"""Lookup Enums and Constants"""
from enum import Enum


class GroupTypes(str, Enum):
    domain = "domain"
    authentication = "authentication"
    bookmark = "bookmark"
    system = "system"
    customers = "customers"

class DomainTypes(str, Enum):
    authentication = "authentication"
    custom = "custom"
    system = "system"

class StatusTypes(str, Enum):
    active = "active"
    inactive = "inactive"


class SharingTypes(str, Enum):
    public = "public"
    private = "private"
    group = "group"
    email = "email"


class ScenarioRequestStatusTypes(str, Enum):
    """New Scenario Request Process status"""
    SUBMITTED = "submitted"
    REVIEW = "review"
    REJECTED = "rejected"
    ACCEPTED = "accepted"
    IN_PROGRESS = "in-progress"
    DEVELOPMENT = "development"
    TESTING = "testing"
    DEPLOYED = "deployed"
    FILES = "snapshot"
    ACTIVE = "active"
    INACTIVE = "inactive"


REQUEST_STATUS_DESC = {member.value: member.name.title() for member in ScenarioRequestStatusTypes}


class RequestType(str, Enum):
    """Scenario Request Type"""
    scenario = "scenario"
    scenario_update = "scenario_update"
    update_feature = "update_feature"
    new_feature = "new_feature"
    add_user = "add_user"
    drop_user = "drop_user"


# Status transitions for workflow
STATUS_TRANSITIONS = {
    ScenarioRequestStatusTypes.SUBMITTED: [
        ScenarioRequestStatusTypes.REVIEW,
        ScenarioRequestStatusTypes.REJECTED
    ],
    ScenarioRequestStatusTypes.REVIEW: [
        ScenarioRequestStatusTypes.ACCEPTED,
        ScenarioRequestStatusTypes.REJECTED,
        ScenarioRequestStatusTypes.SUBMITTED
    ],
    ScenarioRequestStatusTypes.ACCEPTED: [
        ScenarioRequestStatusTypes.IN_PROGRESS,
        ScenarioRequestStatusTypes.REJECTED
    ],
    ScenarioRequestStatusTypes.IN_PROGRESS: [
        ScenarioRequestStatusTypes.DEVELOPMENT,
        ScenarioRequestStatusTypes.REVIEW
    ],
    ScenarioRequestStatusTypes.DEVELOPMENT: [
        ScenarioRequestStatusTypes.TESTING,
        ScenarioRequestStatusTypes.IN_PROGRESS
    ],
    ScenarioRequestStatusTypes.TESTING: [
        ScenarioRequestStatusTypes.DEPLOYED,
        ScenarioRequestStatusTypes.DEVELOPMENT
    ],
    ScenarioRequestStatusTypes.DEPLOYED: [
        ScenarioRequestStatusTypes.ACTIVE,
        ScenarioRequestStatusTypes.FILES
    ],
    ScenarioRequestStatusTypes.FILES: [
        ScenarioRequestStatusTypes.ACTIVE
    ],
    ScenarioRequestStatusTypes.ACTIVE: [
        ScenarioRequestStatusTypes.INACTIVE
    ],
    ScenarioRequestStatusTypes.INACTIVE: [
        ScenarioRequestStatusTypes.ACTIVE
    ]
}
