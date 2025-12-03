"""Database and Role Constants"""
from enum import Enum


class Roles(Enum):
    """User Roles"""
    VIEWER = "viewer"
    USER = "user"
    EDITOR = "editor"
    GROUP_ADMINISTRATOR = "group-administrator"
    GROUP_EDITOR = "group-editor"
    ADMINISTRATOR = "administrator"
    SUPER_ADMINISTRATOR = "super-administrator"


class Groups(Enum):
    """User Groups"""
    VIEWER = "viewer"
    USER = "user"
    EDITOR = "editor"
    GROUP_ADMINISTRATOR = "group-administrator"
    GROUP_EDITOR = "group-editor"
    ADMINISTRATOR = "administrator"
    ALL_DOMAIN = "all"


ROLES = [member.value for member in Roles]
GROUPS = [member.value for member in Groups]
EDITORS = ["administrator", "super-administrator", "editor", "group-administrator", "group-editor"]
ADMIN_ROLES = ["administrator", "super-administrator"]
GROUP_ADMIN_ROLES = ["group-administrator", "group-editor"]
