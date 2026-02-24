"""Tests for Error Log Service"""
import json
import gzip
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
from pathlib import Path
from bson import ObjectId

from easylifeauth.services.error_log_service import (
    ErrorLogEntry,
    ErrorLogService,
    init_error_log_service,
    get_error_log_service,
    log_error,
    DEFAULT_CONFIG,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_error_doc(**overrides):
    """Build a sample MongoDB error-log document."""
    doc = {
        "_id": ObjectId(),
        "timestamp": datetime.now(timezone.utc),
        "level": "ERROR",
        "error_type": "ValueError",
        "message": "something went wrong",
        "stack_trace": "Traceback ...",
        "request_context": {},
        "additional_data": {},
        "created_at": datetime.now(timezone.utc),
    }
    doc.update(overrides)
    return doc


def _make_archive_doc(**overrides):
    """Build a sample archive metadata document."""
    doc = {
        "_id": ObjectId(),
        "archive_id": "abc12345",
        "gcs_path": "error_logs/errors_2026-01-01_00-00-00_abc12345.jsonl.gz",
        "bucket_name": "test-bucket",
        "file_name": "errors_2026-01-01_00-00-00_abc12345.jsonl.gz",
        "original_size": 10240,
        "compressed_size": 2048,
        "error_count": 50,
        "date_range": {"start": "2026-01-01T00:00:00", "end": "2026-01-01T23:59:59"},
        "created_at": datetime.now(timezone.utc),
    }
    doc.update(overrides)
    return doc


def _async_cursor_from_list(docs):
    """Return a MagicMock that behaves like an async MongoDB cursor.

    Supports ``async for doc in cursor`` iteration.
    """
    async def _aiter():
        for d in docs:
            yield d

    cursor = MagicMock()
    cursor.__aiter__ = lambda self: _aiter()
    cursor.to_list = AsyncMock(return_value=list(docs))
    return cursor


def _chainable_cursor_from_list(docs):
    """Return a MagicMock cursor that supports .sort().skip().limit() chaining
    and ``async for`` iteration."""
    async def _aiter():
        for d in docs:
            yield d

    cursor = MagicMock()
    cursor.__aiter__ = lambda self: _aiter()
    cursor.to_list = AsyncMock(return_value=list(docs))
    # Chaining: sort/skip/limit each return the same cursor
    cursor.sort = MagicMock(return_value=cursor)
    cursor.skip = MagicMock(return_value=cursor)
    cursor.limit = MagicMock(return_value=cursor)
    return cursor


# ========================================================================
# ErrorLogEntry
# ========================================================================

class TestErrorLogEntry:
    """Tests for the ErrorLogEntry data class."""

    def test_to_dict_basic(self):
        ts = datetime(2026, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        entry = ErrorLogEntry(
            level="error",
            error_type="ValueError",
            message="bad value",
            timestamp=ts,
        )
        d = entry.to_dict()
        assert d["level"] == "ERROR"
        assert d["error_type"] == "ValueError"
        assert d["message"] == "bad value"
        assert d["timestamp"] == ts.isoformat()
        assert d["stack_trace"] is None
        assert d["request_context"] == {}
        assert d["additional_data"] == {}

    def test_to_dict_with_optional_fields(self):
        entry = ErrorLogEntry(
            level="CRITICAL",
            error_type="RuntimeError",
            message="crash",
            stack_trace="Traceback ...",
            request_context={"path": "/api"},
            additional_data={"key": "val"},
        )
        d = entry.to_dict()
        assert d["stack_trace"] == "Traceback ..."
        assert d["request_context"] == {"path": "/api"}
        assert d["additional_data"] == {"key": "val"}

    def test_to_mongodb_doc(self):
        entry = ErrorLogEntry(
            level="WARNING",
            error_type="DeprecationWarning",
            message="deprecated",
        )
        doc = entry.to_mongodb_doc()
        assert isinstance(doc["timestamp"], datetime)
        assert isinstance(doc["created_at"], datetime)
        assert doc["level"] == "WARNING"

    def test_level_uppercased(self):
        entry = ErrorLogEntry(level="warning", error_type="X", message="m")
        assert entry.level == "WARNING"

    def test_default_timestamp(self):
        before = datetime.now(timezone.utc)
        entry = ErrorLogEntry(level="ERROR", error_type="X", message="m")
        after = datetime.now(timezone.utc)
        assert before <= entry.timestamp <= after

    def test_from_exception(self):
        try:
            raise ValueError("test error")
        except ValueError as exc:
            entry = ErrorLogEntry.from_exception(
                exc,
                level="CRITICAL",
                request_context={"path": "/test"},
                additional_data={"extra": True},
            )

        assert entry.error_type == "ValueError"
        assert entry.message == "test error"
        assert entry.level == "CRITICAL"
        assert "Traceback" in entry.stack_trace
        assert entry.request_context == {"path": "/test"}
        assert entry.additional_data == {"extra": True}

    def test_from_exception_defaults(self):
        try:
            raise RuntimeError("boom")
        except RuntimeError as exc:
            entry = ErrorLogEntry.from_exception(exc)

        assert entry.level == "ERROR"
        assert entry.request_context == {}
        assert entry.additional_data == {}


# ========================================================================
# ErrorLogService - Initialization
# ========================================================================

class TestErrorLogServiceInit:
    """Tests for ErrorLogService construction."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = MagicMock()
        return db

    @patch.object(Path, "mkdir")
    def test_default_config(self, mock_mkdir, mock_db):
        service = ErrorLogService(mock_db)
        assert service.config["max_file_size_mb"] == 5
        assert service.config["compress_archives"] is True
        assert service.config["mongodb_ttl_days"] == 30
        mock_mkdir.assert_called_once()

    @patch.object(Path, "mkdir")
    def test_custom_config_merges(self, mock_mkdir, mock_db):
        service = ErrorLogService(mock_db, config={"max_file_size_mb": 10})
        assert service.config["max_file_size_mb"] == 10
        # Defaults are preserved
        assert service.config["compress_archives"] is True

    @patch.object(Path, "mkdir", side_effect=PermissionError("denied"))
    def test_ensure_log_dir_handles_failure(self, mock_mkdir, mock_db):
        """Should not raise even if mkdir fails."""
        service = ErrorLogService(mock_db)
        assert service is not None

    @patch.object(Path, "mkdir")
    def test_gcs_service_optional(self, mock_mkdir, mock_db):
        service = ErrorLogService(mock_db, gcs_service=None)
        assert service.gcs_service is None


# ========================================================================
# ErrorLogService._write_to_mongodb
# ========================================================================

class TestWriteToMongoDB:
    """Tests for the _write_to_mongodb method."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_logs.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        db.error_log_archives = MagicMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        with patch.object(Path, "mkdir"):
            return ErrorLogService(mock_db)

    @pytest.mark.asyncio
    async def test_write_success(self, service, mock_db):
        entry = ErrorLogEntry(level="ERROR", error_type="X", message="m")
        result = await service._write_to_mongodb(entry)
        assert result is not None
        mock_db.error_logs.insert_one.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_write_returns_none_when_collection_missing(self):
        db = MagicMock(spec=[])  # no attributes at all
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db)
        entry = ErrorLogEntry(level="ERROR", error_type="X", message="m")
        result = await service._write_to_mongodb(entry)
        assert result is None

    @pytest.mark.asyncio
    async def test_write_returns_none_when_collection_is_none(self):
        db = MagicMock()
        db.error_logs = None
        db.error_log_archives = MagicMock()
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db)
        entry = ErrorLogEntry(level="ERROR", error_type="X", message="m")
        result = await service._write_to_mongodb(entry)
        assert result is None

    @pytest.mark.asyncio
    async def test_write_handles_insert_exception(self, mock_db):
        mock_db.error_logs.insert_one = AsyncMock(side_effect=Exception("DB down"))
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        entry = ErrorLogEntry(level="ERROR", error_type="X", message="m")
        result = await service._write_to_mongodb(entry)
        assert result is None


# ========================================================================
# ErrorLogService._write_to_file / _sync_write_to_file
# ========================================================================

class TestWriteToFile:
    """Tests for file-writing helpers."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = MagicMock()
        return db

    def test_sync_write_to_file_success(self, mock_db, tmp_path):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        service.current_log_path = tmp_path / "test.jsonl"
        result = service._sync_write_to_file('{"msg":"hello"}')
        assert result is True
        assert service.current_log_path.exists()
        content = service.current_log_path.read_text()
        assert '{"msg":"hello"}' in content

    def test_sync_write_to_file_failure(self, mock_db):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        # Point to an invalid path to trigger write failure
        service.current_log_path = Path("/nonexistent_dir_xyz/test.jsonl")
        result = service._sync_write_to_file('{"msg":"hello"}')
        assert result is False

    @pytest.mark.asyncio
    async def test_write_to_file_async(self, mock_db, tmp_path):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        service.current_log_path = tmp_path / "test.jsonl"
        entry = ErrorLogEntry(level="ERROR", error_type="ValueError", message="bad")
        result = await service._write_to_file(entry)
        assert result is True
        content = service.current_log_path.read_text()
        assert "ValueError" in content


# ========================================================================
# ErrorLogService._sync_read_current_log
# ========================================================================

class TestSyncReadCurrentLog:
    """Tests for reading the current log file."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = MagicMock()
        return db

    def test_read_returns_empty_when_file_missing(self, mock_db):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        service.current_log_path = Path("/nonexistent/log.jsonl")
        result = service._sync_read_current_log(100)
        assert result == []

    def test_read_returns_entries_in_reverse(self, mock_db, tmp_path):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        log_file = tmp_path / "test.jsonl"
        lines = [
            json.dumps({"message": "first", "level": "ERROR"}),
            json.dumps({"message": "second", "level": "WARNING"}),
            json.dumps({"message": "third", "level": "CRITICAL"}),
        ]
        log_file.write_text("\n".join(lines) + "\n")
        service.current_log_path = log_file

        result = service._sync_read_current_log(10)
        assert len(result) == 3
        # Most recent first
        assert result[0]["message"] == "third"
        assert result[-1]["message"] == "first"

    def test_read_respects_limit(self, mock_db, tmp_path):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        log_file = tmp_path / "test.jsonl"
        lines = [json.dumps({"message": f"msg{i}"}) for i in range(10)]
        log_file.write_text("\n".join(lines) + "\n")
        service.current_log_path = log_file

        result = service._sync_read_current_log(3)
        assert len(result) == 3

    def test_read_skips_invalid_json(self, mock_db, tmp_path):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        log_file = tmp_path / "test.jsonl"
        log_file.write_text('{"message":"ok"}\nNOT JSON\n{"message":"also ok"}\n')
        service.current_log_path = log_file

        result = service._sync_read_current_log(10)
        assert len(result) == 2

    def test_read_handles_exception(self, mock_db):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        # A directory instead of a file will cause an error
        service.current_log_path = MagicMock()
        service.current_log_path.exists.side_effect = PermissionError("denied")
        result = service._sync_read_current_log(10)
        assert result == []


# ========================================================================
# ErrorLogService._get_file_size_mb
# ========================================================================

class TestGetFileSizeMb:
    """Tests for _get_file_size_mb."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = MagicMock()
        return db

    def test_returns_zero_when_file_missing(self, mock_db):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        service.current_log_path = Path("/nonexistent/log.jsonl")
        assert service._get_file_size_mb() == 0.0

    def test_returns_size_in_mb(self, mock_db, tmp_path):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        log_file = tmp_path / "test.jsonl"
        log_file.write_bytes(b"x" * (1024 * 1024 * 2))  # 2 MB
        service.current_log_path = log_file
        assert abs(service._get_file_size_mb() - 2.0) < 0.01

    def test_handles_exception(self, mock_db):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        service.current_log_path = MagicMock()
        service.current_log_path.exists.side_effect = OSError("boom")
        assert service._get_file_size_mb() == 0.0


# ========================================================================
# ErrorLogService.log_error
# ========================================================================

class TestLogError:
    """Tests for the log_error instance method."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_logs.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        db.error_log_archives = MagicMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        with patch.object(Path, "mkdir"):
            svc = ErrorLogService(mock_db)
        svc._write_to_file = AsyncMock(return_value=True)
        svc._check_and_archive = AsyncMock(return_value=None)
        return svc

    @pytest.mark.asyncio
    async def test_log_error_success(self, service, mock_db):
        exc = ValueError("test value error")
        result = await service.log_error(error=exc)
        assert result is not None
        mock_db.error_logs.insert_one.assert_awaited_once()
        service._write_to_file.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_log_error_with_request_context(self, service, mock_db):
        exc = RuntimeError("oops")
        mock_request = MagicMock()
        mock_request.method = "POST"
        mock_request.url.path = "/api/test"
        mock_request.url.query = "foo=bar"
        mock_request.client.host = "127.0.0.1"
        mock_request.headers.get.return_value = "TestAgent/1.0"
        mock_request.state.user_email = "user@example.com"
        mock_request.state.user_id = "uid123"

        result = await service.log_error(error=exc, request=mock_request)
        assert result is not None

        call_args = mock_db.error_logs.insert_one.call_args[0][0]
        assert call_args["request_context"]["method"] == "POST"
        assert call_args["request_context"]["path"] == "/api/test"
        assert call_args["request_context"]["ip_address"] == "127.0.0.1"
        assert call_args["request_context"]["user_email"] == "user@example.com"
        assert call_args["request_context"]["user_id"] == "uid123"

    @pytest.mark.asyncio
    async def test_log_error_with_request_no_query(self, service, mock_db):
        exc = RuntimeError("oops")
        mock_request = MagicMock()
        mock_request.method = "GET"
        mock_request.url.path = "/api/health"
        mock_request.url.query = ""
        mock_request.client.host = "10.0.0.1"
        mock_request.headers.get.return_value = None
        # No user state attributes
        del mock_request.state.user_email
        del mock_request.state.user_id

        result = await service.log_error(error=exc, request=mock_request)
        assert result is not None

        call_args = mock_db.error_logs.insert_one.call_args[0][0]
        assert call_args["request_context"]["query"] is None

    @pytest.mark.asyncio
    async def test_log_error_with_request_no_client(self, service, mock_db):
        exc = RuntimeError("oops")
        mock_request = MagicMock()
        mock_request.method = "GET"
        mock_request.url.path = "/api/test"
        mock_request.url.query = ""
        mock_request.client = None
        mock_request.headers.get.return_value = None
        del mock_request.state.user_email
        del mock_request.state.user_id

        result = await service.log_error(error=exc, request=mock_request)
        assert result is not None
        call_args = mock_db.error_logs.insert_one.call_args[0][0]
        assert call_args["request_context"]["ip_address"] is None

    @pytest.mark.asyncio
    async def test_log_error_with_request_no_state(self, service, mock_db):
        exc = RuntimeError("oops")
        mock_request = MagicMock()
        mock_request.method = "GET"
        mock_request.url.path = "/api/test"
        mock_request.url.query = ""
        mock_request.client.host = "127.0.0.1"
        mock_request.headers.get.return_value = None
        # Remove state entirely
        del mock_request.state

        result = await service.log_error(error=exc, request=mock_request)
        assert result is not None

    @pytest.mark.asyncio
    async def test_log_error_request_context_exception(self, service, mock_db):
        """When extracting request context throws, log_error still succeeds."""
        exc = ValueError("test")
        mock_request = MagicMock()
        # Make method access raise so the try/except in log_error catches it
        type(mock_request).method = PropertyMock(side_effect=Exception("bad request"))

        result = await service.log_error(error=exc, request=mock_request)
        # Should still succeed because the except pass catches the error
        assert result is not None

    @pytest.mark.asyncio
    async def test_log_error_with_additional_data(self, service, mock_db):
        exc = ValueError("test")
        result = await service.log_error(
            error=exc,
            additional_data={"retry_count": 3},
        )
        assert result is not None
        call_args = mock_db.error_logs.insert_one.call_args[0][0]
        assert call_args["additional_data"] == {"retry_count": 3}

    @pytest.mark.asyncio
    async def test_log_error_custom_level(self, service, mock_db):
        exc = ValueError("test")
        result = await service.log_error(error=exc, level="CRITICAL")
        assert result is not None
        call_args = mock_db.error_logs.insert_one.call_args[0][0]
        assert call_args["level"] == "CRITICAL"


# ========================================================================
# ErrorLogService.log_message
# ========================================================================

class TestLogMessage:
    """Tests for the log_message method."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_logs.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        db.error_log_archives = MagicMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        with patch.object(Path, "mkdir"):
            svc = ErrorLogService(mock_db)
        svc._write_to_file = AsyncMock(return_value=True)
        svc._check_and_archive = AsyncMock(return_value=None)
        return svc

    @pytest.mark.asyncio
    async def test_log_message_basic(self, service, mock_db):
        result = await service.log_message(
            level="WARNING",
            error_type="DeprecationWarning",
            message="Feature X is deprecated",
        )
        assert result is not None
        mock_db.error_logs.insert_one.assert_awaited_once()
        service._write_to_file.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_log_message_with_all_fields(self, service, mock_db):
        result = await service.log_message(
            level="ERROR",
            error_type="CustomError",
            message="Something failed",
            stack_trace="Traceback ...",
            request_context={"path": "/api/v1"},
            additional_data={"key": "value"},
        )
        assert result is not None
        call_args = mock_db.error_logs.insert_one.call_args[0][0]
        assert call_args["error_type"] == "CustomError"
        assert call_args["stack_trace"] == "Traceback ..."
        assert call_args["request_context"] == {"path": "/api/v1"}

    @pytest.mark.asyncio
    async def test_log_message_returns_none_on_db_failure(self, mock_db):
        mock_db.error_logs.insert_one = AsyncMock(side_effect=Exception("fail"))
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        service._write_to_file = AsyncMock(return_value=True)
        service._check_and_archive = AsyncMock(return_value=None)

        result = await service.log_message(
            level="ERROR", error_type="X", message="m"
        )
        assert result is None


# ========================================================================
# ErrorLogService.get_current_logs
# ========================================================================

class TestGetCurrentLogs:
    """Tests for get_current_logs (MongoDB-based pagination + filtering)."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = MagicMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        with patch.object(Path, "mkdir"):
            return ErrorLogService(mock_db)

    @pytest.mark.asyncio
    async def test_returns_empty_when_collection_missing(self):
        db = MagicMock(spec=[])
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db)
        result = await service.get_current_logs()
        assert result == {"logs": [], "total": 0, "page": 0, "limit": 100}

    @pytest.mark.asyncio
    async def test_returns_empty_when_collection_is_none(self):
        db = MagicMock()
        db.error_logs = None
        db.error_log_archives = MagicMock()
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db)
        result = await service.get_current_logs()
        assert result == {"logs": [], "total": 0, "page": 0, "limit": 100}

    @pytest.mark.asyncio
    async def test_basic_retrieval(self, service, mock_db):
        doc = _make_error_doc()
        mock_db.error_logs.count_documents = AsyncMock(return_value=1)
        mock_db.error_logs.find = MagicMock(
            return_value=_chainable_cursor_from_list([doc])
        )

        result = await service.get_current_logs(limit=10, offset=0)
        assert result["total"] == 1
        assert len(result["logs"]) == 1
        assert result["page"] == 0
        assert result["limit"] == 10
        # _id should be stringified
        assert isinstance(result["logs"][0]["_id"], str)

    @pytest.mark.asyncio
    async def test_timestamp_and_created_at_serialized(self, service, mock_db):
        doc = _make_error_doc()
        mock_db.error_logs.count_documents = AsyncMock(return_value=1)
        mock_db.error_logs.find = MagicMock(
            return_value=_chainable_cursor_from_list([doc])
        )

        result = await service.get_current_logs()
        log = result["logs"][0]
        # datetime objects should be converted to ISO strings
        assert isinstance(log["timestamp"], str)
        assert isinstance(log["created_at"], str)

    @pytest.mark.asyncio
    async def test_pagination_page_calculation(self, service, mock_db):
        mock_db.error_logs.count_documents = AsyncMock(return_value=50)
        mock_db.error_logs.find = MagicMock(
            return_value=_chainable_cursor_from_list([])
        )

        result = await service.get_current_logs(limit=10, offset=20)
        assert result["page"] == 2  # 20 // 10

    @pytest.mark.asyncio
    async def test_pagination_page_zero_div(self, service, mock_db):
        """When limit=0, page should be 0 (not ZeroDivisionError)."""
        mock_db.error_logs.count_documents = AsyncMock(return_value=0)
        mock_db.error_logs.find = MagicMock(
            return_value=_chainable_cursor_from_list([])
        )

        result = await service.get_current_logs(limit=0, offset=0)
        assert result["page"] == 0

    @pytest.mark.asyncio
    async def test_filter_by_level(self, service, mock_db):
        mock_db.error_logs.count_documents = AsyncMock(return_value=0)
        mock_db.error_logs.find = MagicMock(
            return_value=_chainable_cursor_from_list([])
        )

        await service.get_current_logs(filters={"level": "critical"})
        query = mock_db.error_logs.count_documents.call_args[0][0]
        assert query["level"] == "CRITICAL"

    @pytest.mark.asyncio
    async def test_filter_by_error_type(self, service, mock_db):
        mock_db.error_logs.count_documents = AsyncMock(return_value=0)
        mock_db.error_logs.find = MagicMock(
            return_value=_chainable_cursor_from_list([])
        )

        await service.get_current_logs(filters={"error_type": "ValueError"})
        query = mock_db.error_logs.count_documents.call_args[0][0]
        assert "$regex" in query["error_type"]
        assert "$options" in query["error_type"]

    @pytest.mark.asyncio
    async def test_filter_by_search(self, service, mock_db):
        mock_db.error_logs.count_documents = AsyncMock(return_value=0)
        mock_db.error_logs.find = MagicMock(
            return_value=_chainable_cursor_from_list([])
        )

        await service.get_current_logs(filters={"search": "timeout"})
        query = mock_db.error_logs.count_documents.call_args[0][0]
        assert "$or" in query
        assert len(query["$or"]) == 3  # message, error_type, stack_trace

    @pytest.mark.asyncio
    async def test_filter_by_start_date(self, service, mock_db):
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        mock_db.error_logs.count_documents = AsyncMock(return_value=0)
        mock_db.error_logs.find = MagicMock(
            return_value=_chainable_cursor_from_list([])
        )

        await service.get_current_logs(filters={"start_date": start})
        query = mock_db.error_logs.count_documents.call_args[0][0]
        assert query["timestamp"]["$gte"] == start

    @pytest.mark.asyncio
    async def test_filter_by_end_date_only(self, service, mock_db):
        end = datetime(2026, 2, 1, tzinfo=timezone.utc)
        mock_db.error_logs.count_documents = AsyncMock(return_value=0)
        mock_db.error_logs.find = MagicMock(
            return_value=_chainable_cursor_from_list([])
        )

        await service.get_current_logs(filters={"end_date": end})
        query = mock_db.error_logs.count_documents.call_args[0][0]
        assert query["timestamp"]["$lte"] == end

    @pytest.mark.asyncio
    async def test_filter_by_start_and_end_date(self, service, mock_db):
        start = datetime(2026, 1, 1, tzinfo=timezone.utc)
        end = datetime(2026, 2, 1, tzinfo=timezone.utc)
        mock_db.error_logs.count_documents = AsyncMock(return_value=0)
        mock_db.error_logs.find = MagicMock(
            return_value=_chainable_cursor_from_list([])
        )

        await service.get_current_logs(
            filters={"start_date": start, "end_date": end}
        )
        query = mock_db.error_logs.count_documents.call_args[0][0]
        assert query["timestamp"]["$gte"] == start
        assert query["timestamp"]["$lte"] == end

    @pytest.mark.asyncio
    async def test_filter_by_days(self, service, mock_db):
        mock_db.error_logs.count_documents = AsyncMock(return_value=0)
        mock_db.error_logs.find = MagicMock(
            return_value=_chainable_cursor_from_list([])
        )

        await service.get_current_logs(filters={"days": 7})
        query = mock_db.error_logs.count_documents.call_args[0][0]
        assert "$gte" in query["timestamp"]
        # The cutoff should be roughly 7 days ago
        cutoff = query["timestamp"]["$gte"]
        assert isinstance(cutoff, datetime)
        assert (datetime.now(timezone.utc) - cutoff).days <= 7

    @pytest.mark.asyncio
    async def test_no_filters(self, service, mock_db):
        mock_db.error_logs.count_documents = AsyncMock(return_value=0)
        mock_db.error_logs.find = MagicMock(
            return_value=_chainable_cursor_from_list([])
        )

        await service.get_current_logs(filters=None)
        query = mock_db.error_logs.count_documents.call_args[0][0]
        assert query == {}

    @pytest.mark.asyncio
    async def test_empty_filters(self, service, mock_db):
        mock_db.error_logs.count_documents = AsyncMock(return_value=0)
        mock_db.error_logs.find = MagicMock(
            return_value=_chainable_cursor_from_list([])
        )

        await service.get_current_logs(filters={})
        query = mock_db.error_logs.count_documents.call_args[0][0]
        assert query == {}

    @pytest.mark.asyncio
    async def test_exception_returns_error(self, service, mock_db):
        mock_db.error_logs.count_documents = AsyncMock(
            side_effect=Exception("DB timeout")
        )

        result = await service.get_current_logs()
        assert result["logs"] == []
        assert result["total"] == 0
        assert "error" in result
        assert "DB timeout" in result["error"]

    @pytest.mark.asyncio
    async def test_multiple_docs_returned(self, service, mock_db):
        docs = [_make_error_doc(message=f"err{i}") for i in range(5)]
        mock_db.error_logs.count_documents = AsyncMock(return_value=5)
        mock_db.error_logs.find = MagicMock(
            return_value=_chainable_cursor_from_list(docs)
        )

        result = await service.get_current_logs()
        assert len(result["logs"]) == 5
        assert result["total"] == 5


# ========================================================================
# ErrorLogService.get_stats
# ========================================================================

class TestGetStats:
    """Tests for the get_stats aggregation method."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = MagicMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        with patch.object(Path, "mkdir"):
            return ErrorLogService(mock_db)

    @pytest.mark.asyncio
    async def test_returns_empty_when_collection_missing(self):
        db = MagicMock(spec=[])
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db)
        result = await service.get_stats()
        assert result == {}

    @pytest.mark.asyncio
    async def test_returns_empty_when_collection_is_none(self):
        db = MagicMock()
        db.error_logs = None
        db.error_log_archives = MagicMock()
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db)
        result = await service.get_stats()
        assert result == {}

    @pytest.mark.asyncio
    async def test_stats_success(self, service, mock_db):
        mock_db.error_logs.count_documents = AsyncMock(return_value=42)

        # Level aggregation
        level_docs = [
            {"_id": "ERROR", "count": 30},
            {"_id": "WARNING", "count": 10},
            {"_id": "CRITICAL", "count": 2},
        ]
        # Type aggregation
        type_docs = [
            {"_id": "ValueError", "count": 20},
            {"_id": "KeyError", "count": 15},
        ]
        # Timeline aggregation
        timeline_docs = [
            {"_id": "2026-01-01", "count": 5},
            {"_id": "2026-01-02", "count": 8},
        ]

        call_count = 0

        def mock_aggregate(pipeline):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return _async_cursor_from_list(level_docs)
            elif call_count == 2:
                return _async_cursor_from_list(type_docs)
            else:
                return _async_cursor_from_list(timeline_docs)

        mock_db.error_logs.aggregate = MagicMock(side_effect=mock_aggregate)

        result = await service.get_stats(days=7)

        assert result["total"] == 42
        assert result["days"] == 7
        assert result["by_level"] == {"ERROR": 30, "WARNING": 10, "CRITICAL": 2}
        assert len(result["by_type"]) == 2
        assert result["by_type"][0] == {"type": "ValueError", "count": 20}
        assert len(result["timeline"]) == 2
        assert result["timeline"][0] == {"date": "2026-01-01", "count": 5}

    @pytest.mark.asyncio
    async def test_stats_with_custom_days(self, service, mock_db):
        mock_db.error_logs.count_documents = AsyncMock(return_value=0)
        mock_db.error_logs.aggregate = MagicMock(
            return_value=_async_cursor_from_list([])
        )

        result = await service.get_stats(days=30)
        assert result["days"] == 30

    @pytest.mark.asyncio
    async def test_stats_exception(self, service, mock_db):
        mock_db.error_logs.count_documents = AsyncMock(
            side_effect=Exception("aggregation fail")
        )

        result = await service.get_stats()
        assert "error" in result
        assert "aggregation fail" in result["error"]


# ========================================================================
# ErrorLogService.get_levels
# ========================================================================

class TestGetLevels:
    """Tests for get_levels."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = MagicMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        with patch.object(Path, "mkdir"):
            return ErrorLogService(mock_db)

    @pytest.mark.asyncio
    async def test_returns_defaults_when_collection_missing(self):
        db = MagicMock(spec=[])
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db)
        result = await service.get_levels()
        assert result == ["ERROR", "WARNING", "CRITICAL"]

    @pytest.mark.asyncio
    async def test_returns_defaults_when_collection_is_none(self):
        db = MagicMock()
        db.error_logs = None
        db.error_log_archives = MagicMock()
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db)
        result = await service.get_levels()
        assert result == ["ERROR", "WARNING", "CRITICAL"]

    @pytest.mark.asyncio
    async def test_returns_sorted_levels(self, service, mock_db):
        mock_db.error_logs.distinct = AsyncMock(
            return_value=["WARNING", "ERROR", "CRITICAL"]
        )
        result = await service.get_levels()
        assert result == ["CRITICAL", "ERROR", "WARNING"]

    @pytest.mark.asyncio
    async def test_returns_defaults_when_empty(self, service, mock_db):
        mock_db.error_logs.distinct = AsyncMock(return_value=[])
        result = await service.get_levels()
        assert result == ["ERROR", "WARNING", "CRITICAL"]

    @pytest.mark.asyncio
    async def test_returns_defaults_on_exception(self, service, mock_db):
        mock_db.error_logs.distinct = AsyncMock(side_effect=Exception("fail"))
        result = await service.get_levels()
        assert result == ["ERROR", "WARNING", "CRITICAL"]


# ========================================================================
# ErrorLogService.get_error_types
# ========================================================================

class TestGetErrorTypes:
    """Tests for get_error_types."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = MagicMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        with patch.object(Path, "mkdir"):
            return ErrorLogService(mock_db)

    @pytest.mark.asyncio
    async def test_returns_empty_when_collection_missing(self):
        db = MagicMock(spec=[])
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db)
        result = await service.get_error_types()
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_when_collection_is_none(self):
        db = MagicMock()
        db.error_logs = None
        db.error_log_archives = MagicMock()
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db)
        result = await service.get_error_types()
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_sorted_types(self, service, mock_db):
        mock_db.error_logs.distinct = AsyncMock(
            return_value=["ValueError", "KeyError", "AttributeError"]
        )
        result = await service.get_error_types()
        assert result == ["AttributeError", "KeyError", "ValueError"]

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_types(self, service, mock_db):
        mock_db.error_logs.distinct = AsyncMock(return_value=[])
        result = await service.get_error_types()
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_on_exception(self, service, mock_db):
        mock_db.error_logs.distinct = AsyncMock(side_effect=Exception("fail"))
        result = await service.get_error_types()
        assert result == []


# ========================================================================
# ErrorLogService.get_current_file_content
# ========================================================================

class TestGetCurrentFileContent:
    """Tests for get_current_file_content."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = MagicMock()
        return db

    @pytest.mark.asyncio
    async def test_returns_file_content(self, mock_db, tmp_path):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        log_file = tmp_path / "test.jsonl"
        log_file.write_text(json.dumps({"message": "test"}) + "\n")
        service.current_log_path = log_file

        result = await service.get_current_file_content(lines=50)
        assert "entries" in result
        assert len(result["entries"]) == 1
        assert "file_size_mb" in result
        assert result["file_path"] == str(log_file)
        assert result["max_size_mb"] == 5

    @pytest.mark.asyncio
    async def test_returns_empty_when_no_file(self, mock_db):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        service.current_log_path = Path("/nonexistent/log.jsonl")

        result = await service.get_current_file_content()
        assert result["entries"] == []
        assert result["file_size_mb"] == 0.0


# ========================================================================
# ErrorLogService.get_archived_files
# ========================================================================

class TestGetArchivedFiles:
    """Tests for get_archived_files."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = MagicMock()
        return db

    @pytest.fixture
    def service(self, mock_db):
        with patch.object(Path, "mkdir"):
            return ErrorLogService(mock_db)

    @pytest.mark.asyncio
    async def test_returns_empty_when_collection_missing(self):
        db = MagicMock(spec=[])
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db)
        result = await service.get_archived_files()
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_empty_when_collection_is_none(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = None
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db)
        result = await service.get_archived_files()
        assert result == []

    @pytest.mark.asyncio
    async def test_returns_archives(self, service, mock_db):
        archive = _make_archive_doc()
        cursor = _chainable_cursor_from_list([archive])
        mock_db.error_log_archives.find = MagicMock(return_value=cursor)

        result = await service.get_archived_files()
        assert len(result) == 1
        assert isinstance(result[0]["_id"], str)
        # created_at datetime should be serialized
        assert isinstance(result[0]["created_at"], str)

    @pytest.mark.asyncio
    async def test_returns_archives_with_string_created_at(self, service, mock_db):
        """When created_at is already a string, it should pass through."""
        archive = _make_archive_doc(created_at="2026-01-01T00:00:00")
        cursor = _chainable_cursor_from_list([archive])
        mock_db.error_log_archives.find = MagicMock(return_value=cursor)

        result = await service.get_archived_files()
        assert len(result) == 1
        assert result[0]["created_at"] == "2026-01-01T00:00:00"

    @pytest.mark.asyncio
    async def test_returns_empty_on_exception(self, service, mock_db):
        mock_db.error_log_archives.find = MagicMock(
            side_effect=Exception("DB error")
        )
        result = await service.get_archived_files()
        assert result == []


# ========================================================================
# ErrorLogService.get_archive_download_url
# ========================================================================

class TestGetArchiveDownloadUrl:
    """Tests for get_archive_download_url."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = MagicMock()
        return db

    @pytest.fixture
    def mock_gcs(self):
        gcs = MagicMock()
        gcs.is_configured.return_value = True
        gcs.bucket_name = "test-bucket"
        gcs.get_signed_url = AsyncMock(return_value="https://signed-url.example.com")
        return gcs

    @pytest.mark.asyncio
    async def test_returns_none_when_gcs_not_configured(self, mock_db):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=None)
        result = await service.get_archive_download_url("abc123")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_gcs_not_configured_flag(self, mock_db):
        gcs = MagicMock()
        gcs.is_configured.return_value = False
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=gcs)
        result = await service.get_archive_download_url("abc123")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_archives_collection_missing(self, mock_gcs):
        db = MagicMock(spec=[])
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db, gcs_service=mock_gcs)
        result = await service.get_archive_download_url("abc123")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_archive_not_found(self, mock_db, mock_gcs):
        mock_db.error_log_archives.find_one = AsyncMock(return_value=None)
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        result = await service.get_archive_download_url("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_signed_url(self, mock_db, mock_gcs):
        archive = _make_archive_doc(archive_id="abc123")
        mock_db.error_log_archives.find_one = AsyncMock(return_value=archive)
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        result = await service.get_archive_download_url("abc123")
        assert result == "https://signed-url.example.com"
        mock_gcs.get_signed_url.assert_awaited_once_with(
            file_path=archive["gcs_path"],
            expiration_minutes=60,
        )

    @pytest.mark.asyncio
    async def test_custom_expiration(self, mock_db, mock_gcs):
        archive = _make_archive_doc(archive_id="abc123")
        mock_db.error_log_archives.find_one = AsyncMock(return_value=archive)
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        await service.get_archive_download_url("abc123", expiration_minutes=120)
        mock_gcs.get_signed_url.assert_awaited_once_with(
            file_path=archive["gcs_path"],
            expiration_minutes=120,
        )

    @pytest.mark.asyncio
    async def test_returns_none_on_exception(self, mock_db, mock_gcs):
        mock_db.error_log_archives.find_one = AsyncMock(
            side_effect=Exception("DB error")
        )
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        result = await service.get_archive_download_url("abc123")
        assert result is None


# ========================================================================
# ErrorLogService.delete_archive
# ========================================================================

class TestDeleteArchive:
    """Tests for delete_archive."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = MagicMock()
        db.error_log_archives.find_one = AsyncMock()
        db.error_log_archives.delete_one = AsyncMock()
        return db

    @pytest.fixture
    def mock_gcs(self):
        gcs = MagicMock()
        gcs.is_configured.return_value = True
        gcs.bucket_name = "test-bucket"
        gcs.delete_file = AsyncMock(return_value=True)
        return gcs

    @pytest.mark.asyncio
    async def test_returns_false_when_gcs_not_configured(self, mock_db):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=None)
        result = await service.delete_archive("abc123")
        assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_when_archives_collection_missing(self, mock_gcs):
        db = MagicMock(spec=[])
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db, gcs_service=mock_gcs)
        result = await service.delete_archive("abc123")
        assert result is False

    @pytest.mark.asyncio
    async def test_returns_false_when_archive_not_found(self, mock_db, mock_gcs):
        mock_db.error_log_archives.find_one = AsyncMock(return_value=None)
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        result = await service.delete_archive("nonexistent")
        assert result is False

    @pytest.mark.asyncio
    async def test_deletes_from_gcs_and_mongodb(self, mock_db, mock_gcs):
        archive = _make_archive_doc(archive_id="abc123")
        mock_db.error_log_archives.find_one = AsyncMock(return_value=archive)
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        result = await service.delete_archive("abc123")
        assert result is True
        mock_gcs.delete_file.assert_awaited_once_with(archive["gcs_path"])
        mock_db.error_log_archives.delete_one.assert_awaited_once_with(
            {"archive_id": "abc123"}
        )

    @pytest.mark.asyncio
    async def test_deletes_metadata_even_when_gcs_fails(self, mock_db, mock_gcs):
        """MongoDB metadata is deleted even if GCS deletion fails."""
        archive = _make_archive_doc(archive_id="abc123")
        mock_db.error_log_archives.find_one = AsyncMock(return_value=archive)
        mock_gcs.delete_file = AsyncMock(return_value=False)
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        result = await service.delete_archive("abc123")
        assert result is True
        mock_db.error_log_archives.delete_one.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_returns_false_on_exception(self, mock_db, mock_gcs):
        mock_db.error_log_archives.find_one = AsyncMock(
            side_effect=Exception("DB error")
        )
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        result = await service.delete_archive("abc123")
        assert result is False


# ========================================================================
# ErrorLogService.force_archive
# ========================================================================

class TestForceArchive:
    """Tests for force_archive."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = MagicMock()
        return db

    @pytest.mark.asyncio
    async def test_returns_none_when_gcs_not_configured(self, mock_db):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=None)
        result = await service.force_archive()
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_gcs_not_configured_flag(self, mock_db):
        gcs = MagicMock()
        gcs.is_configured.return_value = False
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=gcs)
        result = await service.force_archive()
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_file_missing(self, mock_db):
        gcs = MagicMock()
        gcs.is_configured.return_value = True
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=gcs)
        # Point to a nonexistent file
        service.current_log_path = Path("/nonexistent/log.jsonl")

        result = await service.force_archive()
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_file_empty(self, mock_db, tmp_path):
        gcs = MagicMock()
        gcs.is_configured.return_value = True
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=gcs)
        empty_file = tmp_path / "empty.jsonl"
        empty_file.touch()
        service.current_log_path = empty_file

        result = await service.force_archive()
        assert result is None

    @pytest.mark.asyncio
    async def test_calls_check_and_archive(self, mock_db, tmp_path):
        gcs = MagicMock()
        gcs.is_configured.return_value = True
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=gcs)

        log_file = tmp_path / "test.jsonl"
        log_file.write_text('{"message":"test"}\n')
        service.current_log_path = log_file

        archive_result = {"archive_id": "forced123"}
        service._check_and_archive = AsyncMock(return_value=archive_result)

        result = await service.force_archive()
        assert result == archive_result
        service._check_and_archive.assert_awaited_once()
        # Threshold should be restored after the call
        assert service.config["max_file_size_mb"] == 5

    @pytest.mark.asyncio
    async def test_restores_threshold_on_failure(self, mock_db, tmp_path):
        gcs = MagicMock()
        gcs.is_configured.return_value = True
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=gcs)

        log_file = tmp_path / "test.jsonl"
        log_file.write_text('{"message":"test"}\n')
        service.current_log_path = log_file

        service._check_and_archive = AsyncMock(return_value=None)
        await service.force_archive()

        assert service.config["max_file_size_mb"] == 5


# ========================================================================
# ErrorLogService._check_and_archive
# ========================================================================

class TestCheckAndArchive:
    """Tests for _check_and_archive."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = MagicMock()
        db.error_log_archives.insert_one = AsyncMock()
        return db

    @pytest.fixture
    def mock_gcs(self):
        gcs = MagicMock()
        gcs.is_configured.return_value = True
        gcs.bucket_name = "test-bucket"
        gcs.upload_file = AsyncMock(return_value="gs://test-bucket/error_logs/test.gz")
        return gcs

    @pytest.mark.asyncio
    async def test_returns_none_when_below_threshold(self, mock_db):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        service._get_file_size_mb = MagicMock(return_value=1.0)

        result = await service._check_and_archive()
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_gcs_not_configured(self, mock_db):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=None)
        service._get_file_size_mb = MagicMock(return_value=10.0)

        result = await service._check_and_archive()
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_none_when_gcs_not_configured_flag(self, mock_db):
        gcs = MagicMock()
        gcs.is_configured.return_value = False
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=gcs)
        service._get_file_size_mb = MagicMock(return_value=10.0)

        result = await service._check_and_archive()
        assert result is None

    @pytest.mark.asyncio
    async def test_successful_archive(self, mock_db, mock_gcs, tmp_path):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        log_file = tmp_path / "test.jsonl"
        log_file.write_text(
            json.dumps({"timestamp": "2026-01-01T00:00:00", "message": "err1"}) + "\n"
            + json.dumps({"timestamp": "2026-01-01T01:00:00", "message": "err2"}) + "\n"
        )
        service.current_log_path = log_file
        service._get_file_size_mb = MagicMock(return_value=10.0)

        result = await service._check_and_archive()

        assert result is not None
        assert "archive_id" in result
        assert result["error_count"] == 2
        mock_gcs.upload_file.assert_awaited_once()
        mock_db.error_log_archives.insert_one.assert_awaited_once()
        # File should be deleted after archiving
        assert not log_file.exists()

    @pytest.mark.asyncio
    async def test_archive_upload_failure(self, mock_db, mock_gcs, tmp_path):
        mock_gcs.upload_file = AsyncMock(return_value=None)
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        log_file = tmp_path / "test.jsonl"
        log_file.write_text(json.dumps({"message": "err"}) + "\n")
        service.current_log_path = log_file
        service._get_file_size_mb = MagicMock(return_value=10.0)

        result = await service._check_and_archive()
        assert result is None
        # File should NOT be deleted
        assert log_file.exists()

    @pytest.mark.asyncio
    async def test_archive_metadata_save_failure(self, mock_db, mock_gcs, tmp_path):
        """Even if metadata save fails, the archive itself should succeed."""
        mock_db.error_log_archives.insert_one = AsyncMock(
            side_effect=Exception("DB error")
        )
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        log_file = tmp_path / "test.jsonl"
        log_file.write_text(json.dumps({"timestamp": "2026-01-01T00:00:00"}) + "\n")
        service.current_log_path = log_file
        service._get_file_size_mb = MagicMock(return_value=10.0)

        result = await service._check_and_archive()
        # Should still return metadata (archive succeeded)
        assert result is not None

    @pytest.mark.asyncio
    async def test_archive_without_archives_collection(self, mock_gcs, tmp_path):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = None
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db, gcs_service=mock_gcs)

        log_file = tmp_path / "test.jsonl"
        log_file.write_text(json.dumps({"timestamp": "2026-01-01T00:00:00"}) + "\n")
        service.current_log_path = log_file
        service._get_file_size_mb = MagicMock(return_value=10.0)

        result = await service._check_and_archive()
        # Should still complete archive without saving metadata
        assert result is not None

    @pytest.mark.asyncio
    async def test_uncompressed_archive(self, mock_db, mock_gcs, tmp_path):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(
                mock_db,
                gcs_service=mock_gcs,
                config={"compress_archives": False},
            )

        log_file = tmp_path / "test.jsonl"
        log_file.write_text(json.dumps({"timestamp": "2026-01-01T00:00:00"}) + "\n")
        service.current_log_path = log_file
        service._get_file_size_mb = MagicMock(return_value=10.0)

        result = await service._check_and_archive()
        assert result is not None
        # For uncompressed, content_type should be application/x-ndjson
        call_kwargs = mock_gcs.upload_file.call_args[1]
        assert call_kwargs["content_type"] == "application/x-ndjson"

    @pytest.mark.asyncio
    async def test_double_check_size_after_lock(self, mock_db, mock_gcs, tmp_path):
        """If file size drops below threshold after acquiring lock, return None."""
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        log_file = tmp_path / "test.jsonl"
        log_file.write_text('{"message":"test"}\n')
        service.current_log_path = log_file

        # First call returns above threshold, second (inside lock) returns below
        service._get_file_size_mb = MagicMock(side_effect=[10.0, 1.0])

        result = await service._check_and_archive()
        assert result is None


# ========================================================================
# ErrorLogService._sync_archive_to_gcs
# ========================================================================

class TestSyncArchiveToGcs:
    """Tests for the synchronous archive preparation helper."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = MagicMock()
        return db

    def test_returns_none_when_file_missing(self, mock_db):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        result = service._sync_archive_to_gcs(Path("/nonexistent/log.jsonl"))
        assert result is None

    def test_compresses_content(self, mock_db, tmp_path):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, config={"compress_archives": True})
        log_file = tmp_path / "test.jsonl"
        content = json.dumps({"timestamp": "2026-01-01T00:00:00", "message": "err"})
        log_file.write_text(content + "\n")

        result = service._sync_archive_to_gcs(log_file)
        assert result is not None
        assert result["error_count"] == 1
        assert result["compressed_size"] < result["original_size"] or result["compressed_size"] > 0
        assert result["filename"].endswith(".jsonl.gz")
        # Verify content is valid gzip
        decompressed = gzip.decompress(result["compressed_content"])
        assert b"err" in decompressed

    def test_uncompressed_content(self, mock_db, tmp_path):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, config={"compress_archives": False})
        log_file = tmp_path / "test.jsonl"
        content = json.dumps({"timestamp": "2026-01-01T00:00:00", "message": "err"})
        log_file.write_text(content + "\n")

        result = service._sync_archive_to_gcs(log_file)
        assert result is not None
        assert result["filename"].endswith(".jsonl")
        assert result["compressed_size"] == result["original_size"]

    def test_date_range_extraction(self, mock_db, tmp_path):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        log_file = tmp_path / "test.jsonl"
        lines = [
            json.dumps({"timestamp": "2026-01-01T00:00:00"}),
            json.dumps({"timestamp": "2026-01-02T12:00:00"}),
            json.dumps({"timestamp": "2026-01-03T23:59:59"}),
        ]
        log_file.write_text("\n".join(lines) + "\n")

        result = service._sync_archive_to_gcs(log_file)
        assert result["date_range"]["start"] == "2026-01-01T00:00:00"
        assert result["date_range"]["end"] == "2026-01-03T23:59:59"
        assert result["error_count"] == 3

    def test_handles_invalid_json_lines(self, mock_db, tmp_path):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        log_file = tmp_path / "test.jsonl"
        log_file.write_text(
            json.dumps({"timestamp": "2026-01-01T00:00:00"}) + "\n"
            + "NOT VALID JSON\n"
            + json.dumps({"timestamp": "2026-01-02T00:00:00"}) + "\n"
        )

        result = service._sync_archive_to_gcs(log_file)
        assert result["error_count"] == 2

    def test_entries_without_timestamp(self, mock_db, tmp_path):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)
        log_file = tmp_path / "test.jsonl"
        log_file.write_text(json.dumps({"message": "no timestamp"}) + "\n")

        result = service._sync_archive_to_gcs(log_file)
        assert result["error_count"] == 1
        assert result["date_range"]["start"] is None
        assert result["date_range"]["end"] is None

    def test_handles_read_exception(self, mock_db):
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db)

        mock_path = MagicMock()
        mock_path.exists.return_value = True
        # Simulate file read error
        with patch("builtins.open", side_effect=PermissionError("denied")):
            result = service._sync_archive_to_gcs(mock_path)
        assert result is None


# ========================================================================
# ErrorLogService.cleanup_old_archives
# ========================================================================

class TestCleanupOldArchives:
    """Tests for cleanup_old_archives."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = MagicMock()
        db.error_log_archives.find_one = AsyncMock()
        db.error_log_archives.delete_one = AsyncMock()
        return db

    @pytest.fixture
    def mock_gcs(self):
        gcs = MagicMock()
        gcs.is_configured.return_value = True
        gcs.bucket_name = "test-bucket"
        gcs.delete_file = AsyncMock(return_value=True)
        return gcs

    @pytest.mark.asyncio
    async def test_returns_error_when_collection_missing(self):
        db = MagicMock(spec=[])
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db)

        result = await service.cleanup_old_archives()
        assert result["deleted"] == 0
        assert result["errors"] == ["Archives collection not configured"]

    @pytest.mark.asyncio
    async def test_returns_error_when_collection_is_none(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_log_archives = None
        with patch.object(Path, "mkdir"):
            service = ErrorLogService(db)

        result = await service.cleanup_old_archives()
        assert result["deleted"] == 0

    @pytest.mark.asyncio
    async def test_deletes_old_archives(self, mock_db, mock_gcs):
        old_archive = _make_archive_doc(
            archive_id="old1",
            created_at=datetime.now(timezone.utc) - timedelta(days=100),
        )
        # Make find_one return the archive for delete_archive lookup
        mock_db.error_log_archives.find_one = AsyncMock(return_value=old_archive)

        cursor = _async_cursor_from_list([old_archive])
        mock_db.error_log_archives.find = MagicMock(return_value=cursor)

        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        result = await service.cleanup_old_archives(days=90)
        assert result["deleted"] == 1
        assert result["errors"] is None

    @pytest.mark.asyncio
    async def test_no_old_archives(self, mock_db, mock_gcs):
        cursor = _async_cursor_from_list([])
        mock_db.error_log_archives.find = MagicMock(return_value=cursor)

        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        result = await service.cleanup_old_archives(days=90)
        assert result["deleted"] == 0
        assert result["errors"] is None

    @pytest.mark.asyncio
    async def test_handles_individual_delete_failure(self, mock_db, mock_gcs):
        archive = _make_archive_doc(archive_id="fail1")
        mock_db.error_log_archives.find_one = AsyncMock(return_value=None)

        cursor = _async_cursor_from_list([archive])
        mock_db.error_log_archives.find = MagicMock(return_value=cursor)

        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        result = await service.cleanup_old_archives(days=90)
        assert result["deleted"] == 0
        assert len(result["errors"]) == 1

    @pytest.mark.asyncio
    async def test_handles_delete_exception(self, mock_db, mock_gcs):
        archive = _make_archive_doc(archive_id="exc1")
        mock_db.error_log_archives.find_one = AsyncMock(
            side_effect=Exception("unexpected")
        )

        cursor = _async_cursor_from_list([archive])
        mock_db.error_log_archives.find = MagicMock(return_value=cursor)

        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        result = await service.cleanup_old_archives(days=90)
        assert result["deleted"] == 0
        assert len(result["errors"]) == 1
        assert "exc1" in result["errors"][0]

    @pytest.mark.asyncio
    async def test_handles_cursor_exception(self, mock_db, mock_gcs):
        mock_db.error_log_archives.find = MagicMock(
            side_effect=Exception("cursor fail")
        )

        with patch.object(Path, "mkdir"):
            service = ErrorLogService(mock_db, gcs_service=mock_gcs)

        result = await service.cleanup_old_archives()
        assert result["deleted"] == 0
        assert "cursor fail" in result["errors"][0]


# ========================================================================
# Module-level convenience functions
# ========================================================================

class TestModuleFunctions:
    """Tests for init_error_log_service, get_error_log_service, log_error."""

    @pytest.fixture
    def mock_db(self):
        db = MagicMock()
        db.error_logs = MagicMock()
        db.error_logs.insert_one = AsyncMock(
            return_value=MagicMock(inserted_id=ObjectId())
        )
        db.error_log_archives = MagicMock()
        return db

    @patch.object(Path, "mkdir")
    def test_init_error_log_service(self, mock_mkdir, mock_db):
        service = init_error_log_service(mock_db)
        assert service is not None
        assert isinstance(service, ErrorLogService)

    @patch.object(Path, "mkdir")
    def test_init_with_gcs_and_config(self, mock_mkdir, mock_db):
        gcs = MagicMock()
        service = init_error_log_service(
            mock_db, gcs_service=gcs, config={"max_file_size_mb": 20}
        )
        assert service.gcs_service is gcs
        assert service.config["max_file_size_mb"] == 20

    @patch.object(Path, "mkdir")
    def test_get_error_log_service(self, mock_mkdir, mock_db):
        init_error_log_service(mock_db)
        service = get_error_log_service()
        assert service is not None
        assert isinstance(service, ErrorLogService)

    @pytest.mark.asyncio
    @patch.object(Path, "mkdir")
    async def test_log_error_convenience(self, mock_mkdir, mock_db):
        svc = init_error_log_service(mock_db)
        svc._write_to_file = AsyncMock(return_value=True)
        svc._check_and_archive = AsyncMock(return_value=None)

        exc = ValueError("convenience test")
        result = await log_error(error=exc, level="WARNING")
        assert result is not None

    @pytest.mark.asyncio
    async def test_log_error_when_service_not_initialized(self):
        import easylifeauth.services.error_log_service as els

        els._error_log_service = None
        result = await log_error(error=ValueError("test"))
        assert result is None

    @pytest.mark.asyncio
    @patch.object(Path, "mkdir")
    async def test_log_error_with_request(self, mock_mkdir, mock_db):
        svc = init_error_log_service(mock_db)
        svc._write_to_file = AsyncMock(return_value=True)
        svc._check_and_archive = AsyncMock(return_value=None)

        mock_request = MagicMock()
        mock_request.method = "GET"
        mock_request.url.path = "/api/test"
        mock_request.url.query = ""
        mock_request.client.host = "127.0.0.1"
        mock_request.headers.get.return_value = None
        del mock_request.state.user_email
        del mock_request.state.user_id

        result = await log_error(
            error=RuntimeError("test"),
            request=mock_request,
            additional_data={"source": "test"},
        )
        assert result is not None

    @pytest.mark.asyncio
    @patch.object(Path, "mkdir")
    async def test_log_error_with_additional_data(self, mock_mkdir, mock_db):
        svc = init_error_log_service(mock_db)
        svc._write_to_file = AsyncMock(return_value=True)
        svc._check_and_archive = AsyncMock(return_value=None)

        result = await log_error(
            error=ValueError("test"),
            additional_data={"custom_key": "custom_val"},
        )
        assert result is not None
