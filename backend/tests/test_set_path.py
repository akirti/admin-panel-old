"""Tests for the set_path() function in main.py."""
import os
import sys
from unittest.mock import patch

import pytest

from main import set_path


class TestSetPath:
    """Validate set_path() adds correct directories to sys.path."""

    def test_returns_module_root(self):
        """set_path() should return the directory containing main.py (src/)."""
        result = set_path()
        main_py_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
        assert result == main_py_dir

    def test_module_root_in_sys_path(self):
        """The src/ directory should be in sys.path after calling set_path()."""
        set_path()
        main_py_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
        assert main_py_dir in sys.path

    def test_parent_dir_in_sys_path(self):
        """The parent of src/ (backend/) should be in sys.path after calling set_path()."""
        set_path()
        parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        assert parent_dir in sys.path

    def test_no_duplicate_module_root(self):
        """Calling set_path() twice should not add MODULE_ROOT to sys.path twice."""
        set_path()
        main_py_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
        count_before = sys.path.count(main_py_dir)
        set_path()
        count_after = sys.path.count(main_py_dir)
        assert count_after == count_before

    def test_no_duplicate_src_path(self):
        """Calling set_path() twice should not add SRC_PATH to sys.path twice."""
        set_path()
        parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        count_before = sys.path.count(parent_dir)
        set_path()
        count_after = sys.path.count(parent_dir)
        assert count_after == count_before

    def test_adds_missing_module_root(self):
        """If MODULE_ROOT is not in sys.path, set_path() should add it."""
        main_py_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
        original_path = sys.path.copy()
        # Remove all occurrences
        sys.path[:] = [p for p in sys.path if p != main_py_dir]
        try:
            set_path()
            assert main_py_dir in sys.path
        finally:
            sys.path[:] = original_path

    def test_adds_missing_src_path(self):
        """If SRC_PATH (parent) is not in sys.path, set_path() should add it."""
        parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        original_path = sys.path.copy()
        sys.path[:] = [p for p in sys.path if p != parent_dir]
        try:
            set_path()
            assert parent_dir in sys.path
        finally:
            sys.path[:] = original_path
