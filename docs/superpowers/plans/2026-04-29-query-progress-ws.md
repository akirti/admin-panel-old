# Query Explorer WebSocket Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time WebSocket-based progress tracking to query explorer DatasetPanel, achieving full parity with the process runner's ProgressPanel.

**Architecture:** Create a `QueryWebSocketHandler` on the backend that wraps single-source query execution with the same batched-fetch + progress-callback pattern used by processes. On the frontend, add a `useQueryWebSocket` hook and compact `QueryFetchProgress` component inside DatasetPanel, with WS-first execution and REST fallback.

**Tech Stack:** FastAPI WebSocket, Polars, React, Zustand, TanStack Query, Tailwind CSS

**Key constraint:** DatasetPanel only executes `type: "single"` queries. Joins happen through JoinStepCard via REST. So we only need WS progress for single-source batched fetches.

***

## File Map

| Action | File                                                        | Responsibility                                                |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------------- |
| Modify | `easyweaver-api/src/easyweaver/queries/executor.py`         | Add `execute_single_source_batched()` with progress\_callback |
| Create | `easyweaver-api/src/easyweaver/queries/ws_handler.py`       | WebSocket handler for query execution                         |
| Modify | `easyweaver-api/src/easyweaver/queries/router.py`           | Add `/run/ws` WebSocket endpoint                              |
| Modify | `easyweaver-api/src/easyweaver/queries/service.py`          | Add `update_query_run_progress()` helper                      |
| Modify | `easyweaver-api/src/easyweaver/queries/models.py`           | Add `progress` field to QueryRun                              |
| Modify | `easyweaver-api/src/easyweaver/queries/schemas.py`          | Add `progress` to QueryRunResponse                            |
| Create | `easyweaver-ui/src/hooks/use-query-ws.ts`                   | WebSocket hook for query execution                            |
| Create | `easyweaver-ui/src/components/query/QueryFetchProgress.tsx` | Compact inline progress display                               |
| Modify | `easyweaver-ui/src/components/query/DatasetPanel.tsx`       | WS execution with progress                                    |
| Modify | `easyweaver-ui/src/types/index.ts`                          | Add query WS client message type                              |

***

### Task 1: Backend — Add batched query execution to queries/executor.py

**Files:**

* Modify: `easyweaver-api/src/easyweaver/queries/executor.py:67-87`

This adds `execute_single_source_batched()` which wraps the existing connector with batched fetching and progress callbacks, reusing the same adaptive batch sizing from the process executor.

* [ ] **Step 1: Add the** **`_emit`** **helper and** **`execute_single_source_batched`** **function**

Add after line 10 (after the existing imports):

```Python
from easyweaver.processes.batch_adapter import adapt_batch_size
```

Add after the existing `execute_single_source` function (after line 87):

```Python
async def _emit(callback, event_type: str, **data) -> None:
    """Fire a progress callback if one is provided."""
    if callback is not None:
        await callback(event_type, **data)


async def execute_single_source_batched(
    source: DataSource,
    config: QuerySourceConfig,
    row_limit: int | None = None,
    progress_callback=None,
    control: dict | None = None,
) -> pl.DataFrame:
    """Execute a single-source query with batched fetching and progress callbacks.

    Falls back to single-shot execute_single_source if the connector does not
    support batching.
    """
    from easyweaver.settings import settings

    effective_limit = row_limit or settings.max_result_rows
    creds = get_source_credentials(source)
    connector = get_connector(source.source_type, creds)

    if not connector.supports_batching:
        # Single-shot fallback
        df = await execute_single_source(source, config, row_limit)
        await _emit(progress_callback, "fetch_complete", dataset="query", total_rows=len(df))
        return df

    ctrl = control or {}
    target_seconds = ctrl.get("target_batch_seconds", 10.0)
    adaptive_enabled = ctrl.get("adaptive_enabled", True)
    batch_size = 10_000

    all_rows: list[dict] = []
    batch_number = 0
    offset = 0
    last_key = None
    batch_sizes: list[int] = []
    batch_times: list[float] = []

    import time

    async with connector:
        while True:
            if ctrl.get("cancelled", False):
                raise asyncio.CancelledError("Query cancelled by user")

            while ctrl.get("paused", False):
                await asyncio.sleep(0.5)
                if ctrl.get("cancelled", False):
                    raise asyncio.CancelledError("Query cancelled by user")

            effective_batch_size = ctrl.get("batch_size_override") or batch_size
            batch_number += 1
            t0 = time.monotonic()

            rows, has_more, last_key = await connector.execute_query_batched(
                table=config.table,
                columns=config.columns,
                filters=[f.model_dump() for f in config.filters],
                filter_logic=config.filter_logic,
                batch_size=effective_batch_size,
                offset=offset,
                last_key=last_key,
            )

            batch_time = time.monotonic() - t0
            batch_sizes.append(effective_batch_size)
            batch_times.append(batch_time)

            all_rows.extend(rows)
            offset += len(rows)

            await _emit(
                progress_callback,
                "fetch_progress",
                dataset="query",
                rows_fetched=len(all_rows),
                batch_number=batch_number,
                batch_size=effective_batch_size,
                batch_time_ms=round(batch_time * 1000),
                status="fetching",
            )

            if not has_more or not rows:
                break

            if len(all_rows) >= effective_limit:
                break

            if adaptive_enabled and not ctrl.get("batch_size_override"):
                max_remaining = effective_limit - len(all_rows)
                old_batch_size = batch_size
                batch_size = adapt_batch_size(
                    effective_batch_size,
                    batch_time,
                    target_seconds,
                    max_remaining,
                )
                if batch_size != old_batch_size:
                    await _emit(
                        progress_callback,
                        "batch_adjusted",
                        dataset="query",
                        old_batch_size=old_batch_size,
                        new_batch_size=batch_size,
                        reason="adaptive",
                    )

    df = pl.DataFrame(all_rows) if all_rows else pl.DataFrame()
    if len(df) > effective_limit:
        df = df.head(effective_limit)

    await _emit(progress_callback, "fetch_complete", dataset="query", total_rows=len(df))
    return df
```

* [ ] **Step 2: Verify the module imports are correct**

Run: `cd easyweaver-api && python -c "from easyweaver.queries.executor import execute_single_source_batched; print('OK')"`
Expected: `OK`

* [ ] **Step 3: Commit**

```Shell
git add easyweaver-api/src/easyweaver/queries/executor.py
git commit -m "feat: add execute_single_source_batched with progress callbacks"
```

***

### Task 2: Backend — Update QueryRun model and service

**Files:**

* Modify: `easyweaver-api/src/easyweaver/queries/models.py`

* Modify: `easyweaver-api/src/easyweaver/queries/service.py`

* Modify: `easyweaver-api/src/easyweaver/queries/schemas.py`

* [ ] **Step 1: Add** **`progress`** **and** **`control`** **fields to QueryRun model**

In `easyweaver-api/src/easyweaver/queries/models.py`, update the `QueryRun` dataclass:

```Python
@dataclass
class QueryRun:
    id: uuid.UUID
    config: str
    status: str = "pending"
    row_count: int | None = None
    error: str | None = None
    progress: dict | None = None
    control: dict | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @classmethod
    def from_doc(cls, doc: dict) -> "QueryRun":
        """Create a QueryRun from a MongoDB document."""
        return cls(
            id=uuid.UUID(doc["_id"]),
            config=doc["config"],
            status=doc.get("status", "pending"),
            row_count=doc.get("row_count"),
            error=doc.get("error"),
            progress=doc.get("progress"),
            control=doc.get("control"),
            created_at=doc.get("created_at", datetime.now(timezone.utc)),
            updated_at=doc.get("updated_at", datetime.now(timezone.utc)),
        )

    def to_doc(self) -> dict:
        """Convert to a MongoDB document."""
        return {
            "_id": str(self.id),
            "config": self.config,
            "status": self.status,
            "row_count": self.row_count,
            "error": self.error,
            "progress": self.progress,
            "control": self.control,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
```

* [ ] **Step 2: Add** **`update_query_run_progress`** **to service.py**

In `easyweaver-api/src/easyweaver/queries/service.py`, add after `update_query_run`:

```Python
async def update_query_run_progress(
    db: AsyncIOMotorDatabase,
    run_id: str,
    progress: dict | None = None,
    control: dict | None = None,
) -> None:
    """Update progress/control fields without returning the full doc (for perf)."""
    updates: dict = {"updated_at": datetime.now(timezone.utc)}
    if progress is not None:
        updates["progress"] = progress
    if control is not None:
        updates["control"] = control
    await db.query_runs.update_one({"_id": run_id}, {"$set": updates})
```

* [ ] **Step 3: Add** **`progress`** **to QueryRunResponse schema**

In `easyweaver-api/src/easyweaver/queries/schemas.py`, update `QueryRunResponse`:

```Python
class QueryRunResponse(BaseModel):
    id: uuid.UUID
    status: Literal["pending", "running", "completed", "failed", "cancelled"]
    row_count: int | None = None
    error: str | None = None
    progress: dict | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

* [ ] **Step 4: Verify imports**

Run: `cd easyweaver-api && python -c "from easyweaver.queries.models import QueryRun; from easyweaver.queries.service import update_query_run_progress; print('OK')"`
Expected: `OK`

* [ ] **Step 5: Commit**

```Shell
git add easyweaver-api/src/easyweaver/queries/models.py easyweaver-api/src/easyweaver/queries/service.py easyweaver-api/src/easyweaver/queries/schemas.py
git commit -m "feat: add progress/control fields to QueryRun model"
```

***

### Task 3: Backend — Create QueryWebSocketHandler

**Files:**

* Create: `easyweaver-api/src/easyweaver/queries/ws_handler.py`

This handler manages a single WebSocket connection for query execution, broadcasting progress events from the batched executor.

* [ ] **Step 1: Create the handler**

```Python
"""WebSocket handler for real-time query execution with progress.

Accepts a WebSocket connection, receives a start message with a QueryRequest,
and executes using batched fetching with progress callbacks forwarded to the
client in real time. Supports pause/resume/cancel/batch controls.
"""

from __future__ import annotations

import asyncio
import uuid

import structlog
from fastapi import WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase

from easyweaver.queries import service
from easyweaver.queries.schemas import QueryRequest

logger = structlog.get_logger()

# Module-level registry for reconnection support
_active_query_handlers: dict[str, "QueryWebSocketHandler"] = {}


class QueryWebSocketHandler:
    """Manages a single WebSocket connection for query execution."""

    def __init__(self, websocket: WebSocket, db: AsyncIOMotorDatabase):
        self.ws = websocket
        self.db = db
        self.run_id: str | None = None
        self.control: dict = {
            "paused": False,
            "batch_size_override": None,
            "target_batch_seconds": 10.0,
            "adaptive_enabled": True,
            "cancelled": False,
        }
        self._execution_task: asyncio.Task | None = None
        self._progress_state: dict = {}

    async def handle(self) -> None:
        """Accept the connection and enter the receive-dispatch loop."""
        await self.ws.accept()
        try:
            while True:
                data = await self.ws.receive_json()
                await self._dispatch(data)
        except WebSocketDisconnect:
            pass

    _HANDLERS = {
        "start": "_handle_start",
        "pause": "_handle_pause",
        "resume": "_handle_resume",
        "set_batch_size": "_handle_set_batch_size",
        "set_target_seconds": "_handle_set_target_seconds",
        "cancel": "_handle_cancel",
    }

    async def _dispatch(self, msg: dict) -> None:
        msg_type = msg.get("type")
        handler_name = self._HANDLERS.get(msg_type)
        if handler_name is None:
            await self._send({"type": "error", "message": f"Unknown message type: {msg_type}"})
            return
        handler = getattr(self, handler_name)
        await handler(msg)

    async def _handle_start(self, msg: dict) -> None:
        """Start a new query execution."""
        request_data = msg.get("request")
        if not request_data:
            await self._send({"type": "error", "message": "request is required"})
            return

        target_seconds = msg.get("target_batch_seconds")
        if target_seconds is not None:
            self.control["target_batch_seconds"] = target_seconds

        try:
            request = QueryRequest.model_validate(request_data)
        except Exception as exc:
            await self._send({"type": "error", "message": f"Invalid request: {exc}"})
            return

        run = await service.create_query_run(self.db, request)
        self.run_id = str(run.id)
        _active_query_handlers[self.run_id] = self

        await self._send({
            "type": "run_started",
            "run_id": self.run_id,
            "phases": ["fetching"],
            "datasets": ["query"],
            "dag": {},
        })

        self._execution_task = asyncio.create_task(
            self._run_execution(request)
        )

    async def _handle_pause(self, _msg: dict) -> None:
        self.control["paused"] = True
        if self.run_id:
            await service.update_query_run_progress(self.db, self.run_id, control=self.control)
        await self._send({"type": "paused"})

    async def _handle_resume(self, _msg: dict) -> None:
        self.control["paused"] = False
        if self.run_id:
            await service.update_query_run_progress(self.db, self.run_id, control=self.control)
        await self._send({"type": "resumed"})

    async def _handle_set_batch_size(self, msg: dict) -> None:
        self.control["batch_size_override"] = msg.get("batch_size")
        self.control["adaptive_enabled"] = False
        await self._send({"type": "batch_size_set", "batch_size": msg.get("batch_size")})

    async def _handle_set_target_seconds(self, msg: dict) -> None:
        self.control["target_batch_seconds"] = msg.get("target_seconds", 10.0)
        self.control["adaptive_enabled"] = True
        self.control["batch_size_override"] = None
        await self._send({"type": "target_seconds_set", "target_seconds": self.control["target_batch_seconds"]})

    async def _handle_cancel(self, _msg: dict) -> None:
        self.control["cancelled"] = True
        if self.run_id:
            await service.update_query_run_progress(self.db, self.run_id, control=self.control)
        if self._execution_task and not self._execution_task.done():
            self._execution_task.cancel()
        await self._send({"type": "cancelled"})

    async def _send(self, msg: dict) -> None:
        try:
            await self.ws.send_json(msg)
        except Exception:
            pass

    async def _progress_callback(self, event_type: str, **data) -> None:
        """Forward progress events to the WebSocket client."""
        await self._send({"type": event_type, **data})

        # Persist progress to MongoDB (debounced via only persisting on phase changes)
        if event_type in ("fetch_complete", "completed", "error"):
            self._progress_state[event_type] = data
            if self.run_id:
                await service.update_query_run_progress(
                    self.db, self.run_id, progress=self._progress_state
                )

    async def _run_execution(self, request: QueryRequest) -> None:
        """Background task that runs the query and sends completion/error."""
        from easyweaver.dependencies import get_query_semaphore
        from easyweaver.queries.executor import (
            execute_single_source_batched,
            execute_join,
            apply_sort,
            resolve_cross_dataset_filters,
        )
        from easyweaver.queries.schemas import FilterCondition as FC
        from easyweaver.results.redis_store import RedisResultStore
        from easyweaver.settings import settings
        from easyweaver.sources.service import get_source
        from redis.asyncio import Redis

        semaphore = get_query_semaphore()
        redis = Redis.from_url(settings.redis_url, decode_responses=True)
        store = RedisResultStore(redis)
        run_id = self.run_id

        try:
            async with semaphore:
                await service.update_query_run(self.db, run_id, status="running")

                await self._send({
                    "type": "phase",
                    "phase": "fetching",
                    "phase_index": 1,
                    "total_phases": 1,
                })

                await self._send({
                    "type": "fetch_started",
                    "dataset": "query",
                    "binding_resolved": False,
                    "filter_values_count": 0,
                })

                left_config = request.left
                if any(f.value_from for f in left_config.filters):
                    resolved = await resolve_cross_dataset_filters(
                        store, [f.model_dump() for f in left_config.filters]
                    )
                    left_config = left_config.model_copy(
                        update={"filters": [FC(**fd) for fd in resolved]}
                    )

                if request.type == "single":
                    source = await get_source(self.db, left_config.source_id)
                    df = await asyncio.wait_for(
                        execute_single_source_batched(
                            source,
                            left_config,
                            row_limit=settings.max_result_rows,
                            progress_callback=self._progress_callback,
                            control=self.control,
                        ),
                        timeout=settings.query_timeout_seconds,
                    )
                else:
                    # Join queries — fall back to non-batched (both sides fetched)
                    assert request.right is not None and request.join is not None
                    right_config = request.right
                    if any(f.value_from for f in right_config.filters):
                        resolved_right = await resolve_cross_dataset_filters(
                            store, [f.model_dump() for f in right_config.filters]
                        )
                        right_config = right_config.model_copy(
                            update={"filters": [FC(**fd) for fd in resolved_right]}
                        )
                    left_source = await get_source(self.db, left_config.source_id)
                    right_source = await get_source(self.db, right_config.source_id)
                    df = await asyncio.wait_for(
                        execute_join(left_source, right_source, left_config, right_config, request.join),
                        timeout=settings.query_timeout_seconds,
                    )
                    await self._send({
                        "type": "fetch_complete",
                        "dataset": "query",
                        "total_rows": len(df),
                    })

                # Apply bindings
                if request.bindings:
                    from easyweaver.queries.operations.binding import (
                        resolve_distinct_bindings,
                        resolve_row_pair_bindings,
                        apply_row_pair_filter,
                    )
                    from easyweaver.queries.operations.filter import apply_filters

                    distinct_filters = await resolve_distinct_bindings(
                        store, [b.model_dump() for b in request.bindings]
                    )
                    if distinct_filters:
                        df = apply_filters(df, distinct_filters, "and")

                    pair_df = await resolve_row_pair_bindings(
                        store, [b.model_dump() for b in request.bindings]
                    )
                    if pair_df is not None:
                        df = apply_row_pair_filter(df, pair_df)

                # Apply transforms
                if request.transforms:
                    from easyweaver.queries.operations.transform import apply_transforms
                    df = apply_transforms(df, [t.model_dump() for t in request.transforms])

                # Apply group_by
                if request.group_by:
                    from easyweaver.queries.operations.group_by import apply_group_by
                    df = apply_group_by(df, request.group_by.model_dump())

                # Apply distinct
                if request.distinct:
                    from easyweaver.queries.operations.distinct import apply_distinct
                    df = apply_distinct(df, request.distinct.model_dump())

                # Apply sort
                if request.sort:
                    df = apply_sort(df, [s.model_dump() for s in request.sort])

                # Enforce row limit
                if len(df) > settings.max_result_rows:
                    df = df.head(settings.max_result_rows)

                # Store result
                await store.store_result(run_id, df)
                await service.update_query_run(self.db, run_id, status="completed", row_count=len(df))

                await self._send({
                    "type": "completed",
                    "run_id": run_id,
                    "total_rows": len(df),
                })

        except asyncio.CancelledError:
            logger.info("query_cancelled_ws", run_id=run_id)
            await service.update_query_run(self.db, run_id, status="cancelled")
            await self._send({"type": "cancelled", "run_id": run_id})

        except asyncio.TimeoutError:
            msg = f"Query timed out after {settings.query_timeout_seconds}s"
            logger.warning("query_timeout_ws", run_id=run_id)
            await service.update_query_run(self.db, run_id, status="failed", error=msg)
            await self._send({"type": "error", "run_id": run_id, "message": msg})

        except Exception as e:
            logger.exception("query_execution_failed_ws", run_id=run_id, error=str(e))
            await service.update_query_run(self.db, run_id, status="failed", error=str(e))
            await self._send({"type": "error", "run_id": run_id, "message": str(e)})

        finally:
            await redis.aclose()
            if run_id and run_id in _active_query_handlers:
                del _active_query_handlers[run_id]
```

* [ ] **Step 2: Verify the module imports**

Run: `cd easyweaver-api && python -c "from easyweaver.queries.ws_handler import QueryWebSocketHandler; print('OK')"`
Expected: `OK`

* [ ] **Step 3: Commit**

```Shell
git add easyweaver-api/src/easyweaver/queries/ws_handler.py
git commit -m "feat: add QueryWebSocketHandler for real-time query progress"
```

***

### Task 4: Backend — Add WebSocket endpoint to query router

**Files:**

* Modify: `easyweaver-api/src/easyweaver/queries/router.py:373-390`

Add a new WS endpoint `/run/ws` for query execution with progress. Keep the existing `/ws/{run_id}` endpoint for backward compatibility.

* [ ] **Step 1: Add the** **`/run/ws`** **endpoint**

Add before the existing `@router.websocket("/ws/{run_id}")` at line 373:

```Python
@router.websocket("/run/ws")
async def run_query_ws(
    websocket: WebSocket,
    token: str | None = None,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """WebSocket endpoint for real-time query execution with progress updates.

    Requires a valid JWT token passed as a ``token`` query parameter.
    Client sends a start message with the query request to begin execution.
    """
    from easyweaver.auth.service import decode_token
    from easyweaver.core.exceptions import AuthenticationError
    from easyweaver.queries.ws_handler import QueryWebSocketHandler

    if not token:
        await websocket.close(code=4003, reason="Forbidden: token required")
        return

    try:
        decode_token(token)
    except (AuthenticationError, Exception):
        await websocket.close(code=4003, reason="Forbidden: invalid token")
        return

    handler = QueryWebSocketHandler(websocket, db)
    await handler.handle()
```

* [ ] **Step 2: Verify the endpoint is registered**

Run: `cd easyweaver-api && python -c "from easyweaver.queries.router import router; routes = [r.path for r in router.routes]; print('/run/ws' in routes or any('run/ws' in str(r.path) for r in router.routes))"`
Expected: `True`

* [ ] **Step 3: Commit**

```Shell
git add easyweaver-api/src/easyweaver/queries/router.py
git commit -m "feat: add /queries/run/ws WebSocket endpoint"
```

***

### Task 5: Frontend — Add WsClientMessage type for queries

**Files:**

* Modify: `easyweaver-ui/src/types/index.ts:494-501`

* [ ] **Step 1: Extend WsClientMessage union**

In `easyweaver-ui/src/types/index.ts`, update the `WsClientMessage` type (around line 494):

```TypeScript
// Client → Server
export type WsClientMessage =
  | { type: 'start'; param_values: Record<string, unknown>; max_rows: number; target_batch_seconds?: number }
  | { type: 'start_query'; request: QueryRequest; target_batch_seconds?: number }
  | { type: 'attach'; run_id: string }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'set_batch_size'; batch_size: number }
  | { type: 'set_target_seconds'; target_seconds: number }
  | { type: 'cancel' };
```

Note: The backend handler receives `type: 'start'` with a `request` field (not `start_query`). The frontend hook will send `{ type: 'start', request: ... }`. The `start_query` variant is defined here for type-safety to distinguish process starts from query starts on the frontend side. The hook will map it to `{ type: 'start', request }` when sending.

* [ ] **Step 2: Commit**

```Shell
git add easyweaver-ui/src/types/index.ts
git commit -m "feat: add start_query WsClientMessage type"
```

***

### Task 6: Frontend — Create useQueryWebSocket hook

**Files:**

* Create: `easyweaver-ui/src/hooks/use-query-ws.ts`

This is modeled after `use-process-ws.ts` but connects to `/queries/run/ws` instead.

* [ ] **Step 1: Create the hook**

```TypeScript
import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsServerMessage } from '@/types';

export interface QueryWsCommand {
  type: string;
  [key: string]: unknown;
}

export interface UseQueryWebSocketReturn {
  sendCommand: (msg: QueryWsCommand) => void;
  lastMessage: WsServerMessage | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;

function buildWsUrl(): string {
  const loc = window.location;
  const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = localStorage.getItem('access_token') ?? '';
  return `${protocol}//${loc.host}/api/v1/queries/run/ws?token=${encodeURIComponent(token)}`;
}

export function useQueryWebSocket(): UseQueryWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const intentionalClose = useRef(false);

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WsServerMessage | null>(null);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimer.current !== null) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    intentionalClose.current = true;
    clearReconnectTimer();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, [clearReconnectTimer]);

  const openSocket = useCallback(() => {
    const url = buildWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      setIsConnected(true);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const parsed = JSON.parse(event.data) as WsServerMessage;
        setLastMessage(parsed);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;

      if (!intentionalClose.current) {
        const delay = Math.min(BASE_BACKOFF_MS * Math.pow(2, attemptRef.current), MAX_BACKOFF_MS);
        attemptRef.current += 1;
        reconnectTimer.current = setTimeout(() => {
          openSocket();
        }, delay);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current) {
      intentionalClose.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }

    intentionalClose.current = false;
    attemptRef.current = 0;
    clearReconnectTimer();

    openSocket();
  }, [openSocket, clearReconnectTimer]);

  const sendCommand = useCallback((msg: QueryWsCommand) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    return () => {
      intentionalClose.current = true;
      clearReconnectTimer();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [clearReconnectTimer]);

  return { sendCommand, lastMessage, isConnected, connect, disconnect };
}
```

* [ ] **Step 2: Verify it compiles**

Run: `cd easyweaver-ui && npx tsc --noEmit src/hooks/use-query-ws.ts 2>&1 | head -20`

* [ ] **Step 3: Commit**

```Shell
git add easyweaver-ui/src/hooks/use-query-ws.ts
git commit -m "feat: add useQueryWebSocket hook for query progress"
```

***

### Task 7: Frontend — Create QueryFetchProgress component

**Files:**

* Create: `easyweaver-ui/src/components/query/QueryFetchProgress.tsx`

A compact inline progress display for DatasetPanel — shows progress bar, row count, batch info, and pause/resume/cancel controls. Reuses `DatasetProgress` type from `use-progress-state.ts`.

* [ ] **Step 1: Create the component**

```TSX
import { Loader2, Pause, Play, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProgressState } from '@/hooks/use-progress-state';

interface QueryFetchProgressProps {
  state: ProgressState;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function QueryFetchProgress({ state, onPause, onResume, onCancel }: QueryFetchProgressProps) {
  const ds = state.datasets['query'];
  if (!ds) return null;

  const isFetching = ds.status === 'fetching';
  const isPaused = state.paused;
  const rowsFetched = ds.rows_fetched;
  const batchNumber = ds.batch_number;
  const batchTimeMs = ds.batch_time_ms;

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <Loader2 className={`h-3.5 w-3.5 text-blue-500 ${isPaused ? '' : 'animate-spin'}`} />
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div className="h-full animate-pulse rounded-full bg-blue-500 dark:bg-blue-600" style={{ width: '100%' }} />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums font-medium text-foreground">
          {rowsFetched.toLocaleString()} rows
        </span>
        {batchNumber > 0 && <span>batch {batchNumber}</span>}
        {batchTimeMs > 0 && <span>~{formatDuration(batchTimeMs)}/batch</span>}
        {batchTimeMs > 0 && ds.batch_size > 0 && (
          <span>~{Math.round((ds.batch_size / batchTimeMs) * 1000).toLocaleString()} rows/sec</span>
        )}
      </div>

      {/* Controls */}
      {isFetching && (
        <div className="flex items-center gap-2">
          {isPaused ? (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onResume}>
              <Play className="mr-1 h-3 w-3" />
              Resume
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onPause}>
              <Pause className="mr-1 h-3 w-3" />
              Pause
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive" onClick={onCancel}>
            <XCircle className="mr-1 h-3 w-3" />
            Cancel
          </Button>
        </div>
      )}

      {/* Error display */}
      {state.error && (
        <p className="text-xs text-destructive">{state.error}</p>
      )}
    </div>
  );
}
```

* [ ] **Step 2: Commit**

```Shell
git add easyweaver-ui/src/components/query/QueryFetchProgress.tsx
git commit -m "feat: add QueryFetchProgress compact progress component"
```

***

### Task 8: Frontend — Wire DatasetPanel to use WebSocket execution

**Files:**

* Modify: `easyweaver-ui/src/components/query/DatasetPanel.tsx`

Add WS-first execution with REST fallback (same pattern as ProcessRunner). Show QueryFetchProgress while running via WS.

* [ ] **Step 1: Add imports**

At the top of `DatasetPanel.tsx`, add these imports:

```TypeScript
import { useQueryWebSocket } from '@/hooks/use-query-ws';
import { useProgressState } from '@/hooks/use-progress-state';
import { QueryFetchProgress } from './QueryFetchProgress';
```

* [ ] **Step 2: Add WS hooks and state inside the component**

After the existing hooks (line 74, after `const { data: schema } = useSourceSchema(...)`), add:

```TypeScript
  // WebSocket execution
  const { sendCommand, lastMessage, isConnected, connect, disconnect } = useQueryWebSocket();
  const { state: progressState, dispatch } = useProgressState();
  const wsExecuting = useRef(false);
  const wantToStart = useRef(false);
  const sentStartRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRequestRef = useRef<QueryRequest | null>(null);
```

Also add `useRef` to the React imports at line 1:

```TypeScript
import { useEffect, useRef, useState } from 'react';
```

And add `QueryRequest` to the type imports (line 17):

```TypeScript
import type { FilterCondition, TransformSpec, QueryRequest, ColumnInfo, DataBinding, SortSpec, GroupBySpec } from '@/types';
```

(QueryRequest is already imported — verify it is.)

* [ ] **Step 3: Add WS message dispatch effect**

After the existing `useEffect` for syncing run status (line 89), add:

```TypeScript
  // Dispatch incoming WS messages to progress reducer
  useEffect(() => {
    if (lastMessage) {
      dispatch(lastMessage);
    }
  }, [lastMessage, dispatch]);

  // When WS execution completes, update dataset state
  useEffect(() => {
    if (progressState.completed && progressState.runId) {
      wsExecuting.current = false;
      disconnect();
      onRunUpdate(progressState.runId, 'completed', progressState.totalRows, null);
      toast.success(`Query completed: ${progressState.totalRows?.toLocaleString() ?? 0} rows`);
    }
  }, [progressState.completed, progressState.runId, progressState.totalRows, disconnect]);

  // Handle cancelled
  useEffect(() => {
    if (progressState.cancelled) {
      wsExecuting.current = false;
      disconnect();
      onRunUpdate(null, 'idle', null, null);
      toast.info('Query cancelled');
    }
  }, [progressState.cancelled, disconnect]);

  // Handle error
  useEffect(() => {
    if (progressState.error && !progressState.completed) {
      wsExecuting.current = false;
      disconnect();
      onRunUpdate(null, 'failed', null, progressState.error);
    }
  }, [progressState.error, progressState.completed, disconnect]);

  // Send start command once WS is connected
  useEffect(() => {
    if (isConnected && wantToStart.current && !sentStartRef.current && wsRequestRef.current) {
      sentStartRef.current = true;
      wantToStart.current = false;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      sendCommand({
        type: 'start',
        request: wsRequestRef.current,
        target_batch_seconds: progressState.targetSeconds,
      });
    }
    if (!isConnected) {
      sentStartRef.current = false;
    }
  }, [isConnected]);
```

* [ ] **Step 4: Replace handleRun to use WS-first**

Replace the existing `handleRun` function (lines 91-157) with:

```TypeScript
  const handleRun = async () => {
    if (!dataset.sourceId || !dataset.table) {
      toast.error('Select a connection and table first');
      return;
    }

    const noValueOps = new Set(['is_null', 'is_not_null']);

    const processedFilters = dataset.filters
      .filter((f) => {
        if (noValueOps.has(f.operator)) return true;
        if ((f.operator === 'in' || f.operator === 'not_in') && f.value_from) return true;
        if (f.operator === 'between') return f.value !== '' && f.value != null && f.value2 !== '' && f.value2 != null;
        return f.value !== '' && f.value != null;
      })
      .map((f) => {
        const col = tableColumns.find((c: ColumnInfo) => c.name === f.column);
        const category = col ? getTypeCategory(col.type) : 'text';
        const coerce = (v: unknown) => {
          if (v === undefined || v === null || v === '') return v;
          const s = String(v);
          if (category === 'numeric') {
            const n = Number(s);
            return isNaN(n) ? s : n;
          }
          if (category === 'boolean') return s === 'true';
          return s;
        };

        if ((f.operator === 'in' || f.operator === 'not_in') && !f.value_from && typeof f.value === 'string') {
          return { ...f, value: f.value.split(',').map((v) => v.trim()).filter(Boolean).map(coerce) };
        }
        if (f.operator === 'between') {
          return { ...f, value: coerce(f.value), value2: coerce(f.value2) };
        }
        return { ...f, value: coerce(f.value) };
      });

    const request: QueryRequest = {
      type: 'single',
      left: {
        source_id: dataset.sourceId,
        table: dataset.table,
        columns: dataset.columns.length > 0 ? dataset.columns : undefined,
        filters: processedFilters,
        filter_logic: dataset.filterLogic,
      },
      sort: sorts,
      group_by: groupBy || undefined,
      transforms: transforms.length > 0 ? transforms : [],
      bindings: bindings.length > 0
        ? bindings.map(({ source_run_id, mode, mappings }) => ({ source_run_id, mode, mappings }))
        : undefined,
      page: 1,
      page_size: 50,
    };

    // Try WebSocket first
    dispatch({ type: 'reset' });
    wsExecuting.current = true;
    wantToStart.current = true;
    sentStartRef.current = false;
    wsRequestRef.current = request;

    connect();

    // 3s timeout: fall back to REST if WS doesn't connect
    fallbackTimerRef.current = setTimeout(async () => {
      if (!sentStartRef.current) {
        wantToStart.current = false;
        wsExecuting.current = false;
        wsRequestRef.current = null;
        disconnect();
        try {
          const run = await executeMutation.mutateAsync(request);
          onRunUpdate(run.id, 'pending');
        } catch {
          toast.error('Failed to execute query');
        }
      }
    }, 3000);
  };
```

* [ ] **Step 5: Add wsRunning flag and update isRunning/canRun**

Replace the existing `isRunning` and `canRun` lines (around line 160-161) with:

```TypeScript
  const wsRunning =
    wsExecuting.current &&
    !progressState.completed &&
    !progressState.cancelled &&
    (isConnected || progressState.runId !== null);

  const isRunning = wsRunning || dataset.status === 'pending' || dataset.status === 'running';
  const canRun = !!dataset.sourceId && !!dataset.table && !isRunning;
```

* [ ] **Step 6: Add QueryFetchProgress to the JSX**

After the Run Query button (after line 300 `</Button>`), add:

```TSX
        {/* WS-driven progress */}
        {wsRunning && (
          <QueryFetchProgress
            state={progressState}
            onPause={() => sendCommand({ type: 'pause' })}
            onResume={() => sendCommand({ type: 'resume' })}
            onCancel={() => sendCommand({ type: 'cancel' })}
          />
        )}
```

* [ ] **Step 7: Verify it compiles**

Run: `cd easyweaver-ui && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to DatasetPanel

* [ ] **Step 8: Commit**

```Shell
git add easyweaver-ui/src/components/query/DatasetPanel.tsx
git commit -m "feat: wire DatasetPanel to WebSocket execution with progress"
```

***

### Task 9: Integration test — Verify end-to-end

**Files:** None (manual testing)

* [ ] **Step 1: Start the backend**

Run: `cd easyweaver-api && python run.py`

* [ ] **Step 2: Start the frontend**

Run: `cd easyweaver-ui && npm run dev`

* [ ] **Step 3: Test in browser**

1. Open the query explorer at `/aggregator/queries`
2. Select a data source and table
3. Click "Run Query"
4. Verify: progress bar appears with row count, batch info
5. Verify: pause/resume works
6. Verify: cancel works
7. Verify: on completion, results appear in the DataTable
8. Verify: if WS fails to connect within 3s, REST fallback works (can test by temporarily blocking WS in Network tab)

* [ ] **Step 4: Test saved process runs still work**

1. Navigate to a saved process
2. Run it
3. Verify: ProgressPanel still appears with full dataset/phase tracking
4. Verify: no regressions

* [ ] **Step 5: Commit all remaining changes if any**

```Shell
git add -A
git commit -m "feat: query explorer real-time WebSocket progress"
```

