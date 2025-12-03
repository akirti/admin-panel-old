"""Tests for Constants"""
import pytest

from easylifeauth.db.constants import Roles, Groups, ROLES, GROUPS, EDITORS


class TestRoles:
    """Tests for Roles enum"""

    def test_roles_values(self):
        """Test all role values"""
        assert Roles.VIEWER.value == "viewer"
        assert Roles.USER.value == "user"
        assert Roles.EDITOR.value == "editor"
        assert Roles.GROUP_ADMINISTRATOR.value == "group-administrator"
        assert Roles.GROUP_EDITOR.value == "group-editor"
        assert Roles.ADMINISTRATOR.value == "administrator"

    def test_roles_list(self):
        """Test ROLES list contains all values"""
        assert "viewer" in ROLES
        assert "user" in ROLES
        assert "editor" in ROLES
        assert "group-administrator" in ROLES
        assert "group-editor" in ROLES
        assert "administrator" in ROLES


class TestGroups:
    """Tests for Groups enum"""

    def test_groups_values(self):
        """Test all group values"""
        assert Groups.VIEWER.value == "viewer"
        assert Groups.USER.value == "user"
        assert Groups.EDITOR.value == "editor"
        assert Groups.GROUP_ADMINISTRATOR.value == "group-administrator"
        assert Groups.GROUP_EDITOR.value == "group-editor"
        assert Groups.ADMINISTRATOR.value == "administrator"
        assert Groups.ALL_DOMAIN.value == "all"

    def test_groups_list(self):
        """Test GROUPS list contains all values"""
        assert "viewer" in GROUPS
        assert "user" in GROUPS
        assert "editor" in GROUPS
        assert "group-administrator" in GROUPS
        assert "group-editor" in GROUPS
        assert "administrator" in GROUPS
        assert "all" in GROUPS


class TestEditors:
    """Tests for EDITORS list"""

    def test_editors_list(self):
        """Test EDITORS list contains correct roles"""
        assert "administrator" in EDITORS
        assert "editor" in EDITORS
        assert "group-administrator" in EDITORS
        assert "group-editor" in EDITORS
        assert "viewer" not in EDITORS
        assert "user" not in EDITORS
