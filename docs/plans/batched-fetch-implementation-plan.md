# Batched Fetch Implementation Plan

**Date**: 2026-04-09
**Spec**: `docs/superpowers/specs/2026-04-09-batched-fetch-design.md`
**Status**: Ready for implementation

---

## Phase 1: Backend Foundation (Connectors + Batch Adapter)

### Step 1.1: Base Connector Interface
- **File**: `easyweaver-api/src/easyweaver/connectors/base.py`
- Add `execute_query_batched(table, columns, filters, filter_logic, batch_size, offset) -> tuple[list[dict], bool]`
- Add `supports_batching` property (default `False`)
- Default implementation raises `NotImplementedError` — only batchable connectors implement it
- Batch orchestrator checks `supports_batching` and falls back to single-shot `execute_query` for File/REST
- **Sort interaction**: Batched queries use PK ordering for stable pagination; user-specified sort is applied post-fetch in Polars

### Step 1.2: Postgres Batched Fetch
- **File**: `easyweaver-api/src/easyweaver/connectors/implementations/postgres.py`
- Implement `execute_query_batched` with `ORDER BY {pk} LIMIT {batch_size} OFFSET {offset}`
- Detect primary key via `information_schema.key_column_usage` (cache per table)
- `supports_batching = True`
- **Tests**: `tests/connectors/test_postgres_batched.py`

### Step 1.3: MySQL Batched Fetch
- **File**: `easyweaver-api/src/easyweaver/connectors/implementations/mysql.py`
- Same OFFSET/LIMIT pattern as Postgres
- PK detection via `SHOW KEYS FROM {table} WHERE Key_name = 'PRIMARY'`
- **Tests**: `tests/connectors/test_mysql_batched.py`

### Step 1.4: DB2 Batched Fetch
- **File**: `easyweaver-api/src/easyweaver/connectors/implementations/db2.py`
- Implement with `ROW_NUMBER() OVER(ORDER BY {pk})` wrapping
- **Tests**: `tests/connectors/test_db2_batched.py`

### Step 1.5: MongoDB Batched Fetch
- **File**: `easyweaver-api/src/easyweaver/connectors/implementations/mongodb.py`
- Implement with `.sort({"_id": 1}).skip(offset).limit(batch_size)`
- **Tests**: `tests/connectors/test_mongodb_batched.py`

### Step 1.6: Adaptive Batch Sizing
- **File**: `easyweaver-api/src/easyweaver/processes/batch_adapter.py` (NEW)
- `adapt_batch_size(current, batch_time, target_seconds, remaining)` — dampened formula
- `get_initial_batch_size(source_id, connector_type, table, db)` — lookup remembered or use defaults
- `save_optimal_batch_size(source_id, connector_type, table, optimal, rps, db)` — persist to MongoDB
- **Tests**: `tests/processes/test_batch_adapter.py`

### Step 1.7: Settings Extension
- **File**: `easyweaver-api/src/easyweaver/settings.py`
- Add: `batch_default_target_seconds`, `batch_min_size`, `batch_max_size`, `batch_intermediate_ttl_seconds`

### Step 1.8: MongoDB Index for batch_size_history
- **File**: `easyweaver-api/src/easyweaver/dependencies.py`
- Add index creation for `batch_size_history` collection on `(source_id, connector_type, table)` during DB init

---

## Phase 2: DAG Execution Engine

### Step 2.1: DAG Module
- **File**: `easyweaver-api/src/easyweaver/processes/dag.py` (NEW)
- `build_dag(queries: dict) -> dict[str, list[str]]` — adjacency list from bindings
- `detect_cycles(dag)` — raise on cycle
- `topological_sort(dag) -> list[list[str]]` — return execution waves
- `get_ready_datasets(dag, completed: set) -> list[str]` — eager scheduling
- **Tests**: `tests/processes/test_dag.py`

### Step 2.2: Process Config Extension
- **File**: `easyweaver-api/src/easyweaver/processes/schemas.py`
- Add `ProcessQueryBinding` model
- Add `bindings: list[ProcessQueryBinding]` to `ProcessQueryConfig`

### Step 2.3: Executor Rewrite
- **File**: `easyweaver-api/src/easyweaver/processes/executor.py`
- Replace `asyncio.gather(*all_queries)` with DAG-aware execution
- Batch fetch loop per dataset with progress callbacks
- Binding resolution between waves
- Intermediate caching to Redis after each batch
- **Tests**: `tests/processes/test_executor_batched.py`

---

## Phase 3: Progress Tracking & State

### Step 3.1: Progress Module
- **File**: `easyweaver-api/src/easyweaver/processes/progress.py` (NEW)
- `ProcessProgressTracker` class — manages progress state for a run
- Methods: `update_dataset_progress()`, `set_phase()`, `get_snapshot()`, `set_paused()`
- Persists to MongoDB `process_runs.progress` field
- **Tests**: `tests/processes/test_progress.py`

### Step 3.2: Run Schema Extension
- **File**: `easyweaver-api/src/easyweaver/processes/schemas.py`
- Add `progress` and `control` fields to run document schema
- Add `ProcessRunResponse.progress` to API response

### Step 3.3: Partial Preview Endpoint
- **File**: `easyweaver-api/src/easyweaver/processes/router.py`
- `GET /runs/{run_id}/preview/{dataset_key}?page_size=100`
- Reads intermediate cached DataFrame from Redis
- Returns first N rows as JSON
- **Tests**: `tests/processes/test_preview.py`

---

## Phase 4: WebSocket Handler

### Step 4.1: WS Handler Module
- **File**: `easyweaver-api/src/easyweaver/processes/ws_handler.py` (NEW)
- `ProcessWebSocketHandler` class
- Handles: `start`, `attach`, `pause`, `resume`, `set_batch_size`, `set_target_seconds`, `cancel`
- Sends progress messages from executor callbacks via WS
- Manages connection lifecycle, auth validation
- **Tests**: `tests/processes/test_ws_handler.py`

### Step 4.2: WebSocket Route
- **File**: `easyweaver-api/src/easyweaver/processes/router.py`
- Add `@router.websocket("/{config_id}/run/ws")`
- Wire to `ProcessWebSocketHandler`
- Keep existing REST `POST /{config_id}/run` endpoint as fallback (non-WS clients)

### Step 4.3: Reconnection Support
- On `attach` message, replay current state from MongoDB progress snapshot
- Background execution continues independently of WS connection
- **Tests**: `tests/processes/test_ws_reconnection.py`

---

## Phase 5: Frontend — WebSocket Hook & Progress State

### Step 5.1: WebSocket Hook
- **File**: `easyweaver-ui/src/hooks/use-process-ws.ts` (NEW)
- `useProcessWebSocket(configId)` — manages WS lifecycle
- Returns: `{ messages, sendCommand, isConnected, reconnect, lastMessage }`
- Auto-reconnect with exponential backoff
- Message type discrimination
- **Tests**: `easyweaver-ui/src/__tests__/hooks/use-process-ws.test.ts`

### Step 5.2: Progress State Reducer
- **File**: `easyweaver-ui/src/hooks/use-progress-state.ts` (NEW)
- `useProgressState()` — `useReducer` that processes WS messages into `ProgressState`
- Handles all server message types
- **Tests**: `easyweaver-ui/src/__tests__/hooks/use-progress-state.test.ts`

### Step 5.3: TypeScript Types
- **File**: `easyweaver-ui/src/types/index.ts`
- Add WS message types (client→server, server→client)
- Add `ProgressState`, `DatasetProgress`, `BatchControl` interfaces

---

## Phase 6: Frontend — Progress Panel Components

### Step 6.1: PhaseIndicator
- **File**: `easyweaver-ui/src/components/processes/PhaseIndicator.tsx` (NEW)
- Step dots: fetching → joining → transforming
- Highlights current phase, dims future, checkmarks past

### Step 6.2: DatasetProgress
- **File**: `easyweaver-ui/src/components/processes/DatasetProgress.tsx` (NEW)
- Per-dataset row: status icon, name, progress bar, row count, batch info, [Preview] button
- Status variants: waiting (clock icon), fetching (animated bar), paused, completed (checkmark), failed (x)

### Step 6.3: BatchControls
- **File**: `easyweaver-ui/src/components/processes/BatchControls.tsx` (NEW)
- Preset buttons: Slower(2K), Balanced(10K), Faster(25K)
- Manual batch size input field
- Target seconds input with auto-adapt checkbox
- Pause/Resume buttons
- Current stats: batch time, rows/sec

### Step 6.4: DatasetPreview
- **File**: `easyweaver-ui/src/components/processes/DatasetPreview.tsx` (NEW)
- Modal/dialog showing first 100 rows of a dataset's intermediate results
- Uses existing DataTable component internally
- Fetches from `GET /runs/{run_id}/preview/{dataset_key}`

### Step 6.5: ProgressPanel (Container)
- **File**: `easyweaver-ui/src/components/processes/ProgressPanel.tsx` (NEW)
- Composes: PhaseIndicator + DatasetProgressList + BatchControls + StatsBar
- Cancel button in header
- Fade-out transition to results on completion

### Step 6.6: ProcessRunner Integration
- **File**: `easyweaver-ui/src/components/processes/ProcessRunner.tsx`
- Replace direct REST mutation with WebSocket-based execution
- Show ProgressPanel when running, DataTable when completed
- Keep REST fallback if WS fails to connect

---

## Phase 7: Integration Tests

### Step 7.1: Backend Integration
- **File**: `tests/integration/test_batched_process.py` (NEW)
- Full process execution with batched fetch against test Postgres
- DAG execution with bindings
- Pause/resume mid-execution
- Intermediate cache verification
- Partial preview during execution

### Step 7.2: WebSocket Integration
- **File**: `tests/integration/test_process_websocket.py` (NEW)
- WS connect → start → receive progress → send controls → completion
- Reconnection and state replay
- Auth validation
- Concurrent WS connections

### Step 7.3: Frontend E2E (Playwright)
- **File**: `easyweaver-ui/e2e/process-batched.spec.ts` (NEW)
- Start process → verify progress panel appears
- Verify phase transitions
- Click pause/resume
- Adjust batch size
- Click dataset preview
- Verify completion transitions to results

---

## Phase 8: Load Tests & SonarQube

### Step 8.1: Load Tests
- **File**: `tests/load/test_batched_load.py` (NEW)
- Large dataset fetch (500K+ rows) — memory stays bounded
- 10+ concurrent process executions with WS connections
- Adaptive algorithm convergence measurement
- WS message throughput

### Step 8.2: SonarQube Analysis
- Run SonarQube analysis on all new/modified files
- Fix all critical/blocker issues
- Ensure minimum 80% coverage on new files
- Resolve security hotspots

---

## Execution Order & Dependencies

```
Phase 1 (Foundation)     — no dependencies, start here
Phase 2 (DAG)            — depends on Phase 1 (batch_adapter used in executor)
Phase 3 (Progress)       — depends on Phase 2 (executor emits progress)
Phase 4 (WebSocket)      — depends on Phase 3 (progress tracker feeds WS)
Phase 5 (Frontend hooks) — depends on Phase 4 (WS endpoint must exist)
Phase 6 (Frontend UI)    — depends on Phase 5 (hooks provide data)
Phase 7 (Integration)    — depends on Phase 4 + Phase 6
Phase 8 (Load + Sonar)   — depends on Phase 7
```

Phases 1-4 are backend, 5-6 are frontend — can overlap once Phase 4 is stable.

---

## Estimated File Count

- **New files**: ~20 (backend: 5, frontend: 8, tests: 7)
- **Modified files**: ~10 (connectors: 5, executor, router, schemas, settings, types)
