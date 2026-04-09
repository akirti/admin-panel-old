# Batched Fetch with Adaptive Sizing, DAG Execution & WebSocket Progress

**Date**: 2026-04-09
**Status**: Approved
**Scope**: EasyWeaver process execution pipeline

---

## Problem Statement

All database connectors currently fetch data in a single query with a `LIMIT` clause. This causes:

1. **Timeouts on large fetches** — DB2, MySQL, and even Postgres can reject or timeout on 100K-row single fetches
2. **No progress visibility** — Users see only "Running..." with no indication of how far along the process is
3. **No recovery** — If a fetch crashes at 80% completion, all progress is lost
4. **No dependency awareness** — All datasets fetch in parallel even when one depends on another's results (data bindings)
5. **No user control** — Users cannot pause, adjust, or cancel a running fetch

## Solution Overview

### 1. Batched Fetching with OFFSET/LIMIT

Replace single-shot fetches with a batch loop in each connector. Each batch fetches a chunk of rows using OFFSET/LIMIT (or equivalent), accumulates into a DataFrame, and reports progress.

### 2. Adaptive Batch Sizing

An algorithm that auto-tunes batch size to hit a target time per batch (default 10s, user-configurable). Starts with connector-aware defaults, then adjusts based on measured throughput. Optimal sizes are remembered per source/table for future runs.

### 3. Dependency-Aware DAG Execution

Process queries are analyzed for data bindings to build a dependency graph. Independent datasets fetch in parallel; dependent datasets wait for their source to complete, then resolve bindings as filters before fetching.

### 4. WebSocket Bidirectional Communication

A WebSocket endpoint handles both real-time progress streaming (server → client) and user control commands (client → server) including pause/resume, batch size adjustment, and cancellation.

### 5. Inline Progress Panel with Partial Preview

An inline progress UI replacing the "Running..." spinner, showing phased progress with per-dataset detail, batch controls, and the ability to preview partial results for completed datasets before the full process finishes.

---

## Detailed Design

### 1. WebSocket Protocol

#### Connection

```
WS /api/v1/processes/{config_id}/run/ws
```

Single WebSocket per process execution. Auth via query param token: `ws://.../{config_id}/run/ws?token={jwt_token}`. Token is validated on connection upgrade; connection is rejected with 403 if invalid.

#### Client → Server Messages

```jsonc
// Start execution
{ "type": "start", "param_values": {}, "max_rows": 5000, "target_batch_seconds": 10 }

// Attach to an existing run (reconnection)
{ "type": "attach", "run_id": "abc-123" }

// Pause fetching (current batch finishes, then pauses)
{ "type": "pause" }

// Resume fetching
{ "type": "resume" }

// Change batch size for next batch (disables adaptive until set_target_seconds sent)
{ "type": "set_batch_size", "batch_size": 15000 }

// Change target seconds per batch (re-enables adaptive)
{ "type": "set_target_seconds", "target_seconds": 5 }

// Cancel execution entirely
{ "type": "cancel" }
```

#### Server → Client Messages

```jsonc
// Execution started
{ "type": "run_started", "run_id": "abc-123",
  "phases": ["fetching", "joining", "transforming"],
  "datasets": ["orders.main", "customers.main", "shipments.main"],
  "dag": { "orders.main": [], "customers.main": ["orders.main"], "shipments.main": [] } }

// Phase transition
{ "type": "phase", "phase": "fetching", "phase_index": 0, "total_phases": 3 }

// Per-dataset fetch progress
{ "type": "fetch_progress", "dataset": "orders.main",
  "rows_fetched": 30000, "batch_number": 3, "batch_size": 10000,
  "batch_time_ms": 9500, "status": "fetching", "depends_on": null }

// Dataset fetch complete
{ "type": "fetch_complete", "dataset": "orders.main", "total_rows": 50000 }

// Dataset waiting for dependency
{ "type": "fetch_waiting", "dataset": "customers.main",
  "waiting_for": ["orders.main"], "reason": "binding: orders.customer_id -> customers.id" }

// Dependency resolved, fetch starting
{ "type": "fetch_started", "dataset": "customers.main",
  "binding_resolved": true, "filter_values_count": 1250 }

// Join step progress
{ "type": "join_progress", "step_key": "joined_data",
  "left": "orders.main", "right": "customers.main", "status": "running" }
{ "type": "join_complete", "step_key": "joined_data", "rows": 45000 }

// Transform/operation progress
{ "type": "transform_progress", "operation": "group_by", "step": 2, "total_steps": 4 }

// Adaptive batch size adjustment
{ "type": "batch_adjusted", "dataset": "orders.main",
  "old_batch_size": 10000, "new_batch_size": 14500, "reason": "adaptive" }

// Control acknowledgments
{ "type": "paused" }
{ "type": "resumed" }

// Execution complete
{ "type": "completed", "run_id": "abc-123", "total_rows": 42000 }

// Error
{ "type": "error", "message": "DB2 connection timeout", "dataset": "orders.main" }
```

#### Reconnection

If the WebSocket drops mid-execution, the process continues running in the background. Client reconnects and sends `{ "type": "attach", "run_id": "..." }`. Server replays current state snapshot (current phase, all dataset statuses, control state).

---

### 2. Batched Connector Implementation

#### SQL Connectors (Postgres, MySQL)

New method `execute_query_batched` using OFFSET/LIMIT:

```sql
SELECT {columns} FROM {table}
WHERE {filters}
ORDER BY {stable_order_column}
LIMIT {batch_size} OFFSET {offset}
```

Stable ordering uses primary key if detectable, otherwise first column. Returns `(rows: list[dict], has_more: bool)`.

#### DB2 Connector

DB2 OFFSET support varies by version. Uses ROW_NUMBER() approach:

```sql
SELECT * FROM (
  SELECT t.*, ROW_NUMBER() OVER(ORDER BY {pk}) AS rn__ FROM {table} t
  WHERE {filters}
) WHERE rn__ > {offset} AND rn__ <= {offset + batch_size}
```

#### MongoDB Connector

Uses `.sort({"_id": 1}).skip(offset).limit(batch_size)` for stable pagination.

#### File & REST API Connectors

No batching — these load all data in one shot (file from GCS, REST from endpoint). Progress reports a single batch at 100%. Row limit applied in-memory post-fetch.

#### Sort Interaction

The existing `execute_query` signature includes a `sort` parameter. For batched fetching, the stable ordering column (PK) is used **internally for pagination only** and does not replace the user-specified sort. The flow is:

1. Batched fetch uses `ORDER BY {pk}` to ensure stable OFFSET/LIMIT pagination
2. After all batches are accumulated into a DataFrame, the user-specified sort is applied in-memory via Polars (same as current post-fetch sort behavior)

This ensures pagination correctness without affecting the final result ordering.

#### Connector Interface

```python
class BaseConnector:
    # Existing (actual signature)
    async def execute_query(self, table, columns, filters, sort, limit, filter_logic) -> list[dict]: ...

    # New — batched variant (sort handled post-fetch, not in SQL)
    async def execute_query_batched(
        self, table, columns, filters, filter_logic,
        batch_size: int, offset: int
    ) -> tuple[list[dict], bool]:
        """Returns (rows, has_more). Must be overridden by batchable connectors."""
        raise NotImplementedError(
            f"{type(self).__name__} does not support batched queries. "
            f"Use execute_query instead."
        )

    @property
    def supports_batching(self) -> bool:
        return False  # Override in SQL/Mongo connectors
```

**Note**: The default `execute_query_batched` raises `NotImplementedError`. Only connectors that override `supports_batching = True` (Postgres, MySQL, DB2, MongoDB) implement it. File and REST API connectors use the existing single-shot `execute_query` — the batch orchestrator checks `supports_batching` and falls back accordingly.

---

### 3. Adaptive Batch Sizing Algorithm

#### Initial Batch Size Selection

1. Check `batch_size_history` MongoDB collection for source_id + table combo
2. If found, use remembered optimal size
3. If not found, use connector defaults:

| Connector | Initial Batch | Rationale |
|-----------|--------------|-----------|
| Postgres  | 15,000       | Handles large fetches well |
| MySQL     | 10,000       | Moderate, safe default |
| DB2       | 5,000        | Conservative — DB2 is strict |
| MongoDB   | 10,000       | Cursor-based, moderate |

#### Adaptation Formula

```python
def adapt_batch_size(current_batch_size, batch_time_seconds, target_seconds, max_rows_remaining):
    if batch_time_seconds <= 0:
        return current_batch_size

    rows_per_second = current_batch_size / batch_time_seconds
    ideal_size = int(rows_per_second * target_seconds)

    # Dampen: move only 50% toward ideal to avoid oscillation
    new_size = int(current_batch_size + 0.5 * (ideal_size - current_batch_size))

    # Clamp: floor 1K, ceiling 100K per batch
    new_size = max(1_000, min(new_size, 100_000))

    # Don't fetch more than remaining
    new_size = min(new_size, max_rows_remaining)

    return new_size
```

#### User Override Behavior

- `set_batch_size` → adaptive pauses, uses exact user value
- `set_target_seconds` → adaptive resumes from current batch size
- Manual and adaptive never fight each other

#### Remembering Optimal Sizes

```python
# MongoDB collection: batch_size_history
{
    "source_id": "src_abc",
    "connector_type": "postgres",
    "table": "orders",
    "optimal_batch_size": 14500,
    "avg_rows_per_second": 1450,
    "last_updated": "2026-04-09T..."
}
```

Updated on dataset fetch completion. Uses median batch size of last 3 batches within 20% of target time (filters out ramp-up and manual overrides).

---

### 4. Dependency-Aware DAG Execution

#### Process Config Extension

```python
class ProcessQueryBinding(BaseModel):
    source_dataset: str                    # e.g., "schema1.orders"
    mode: Literal["distinct", "row_pair"]
    mappings: list[BindingMapping]         # source_column -> target_column

class ProcessQueryConfig(BaseModel):
    # ... existing fields ...
    bindings: list[ProcessQueryBinding] = Field(default_factory=list)
```

#### DAG Construction

```python
def build_execution_dag(queries: dict[str, ProcessQueryConfig]) -> dict:
    """Build dependency graph from query bindings.

    Returns:
        {
            "orders.main": [],                    # no dependencies
            "customers.main": ["orders.main"],    # depends on orders
            "shipments.main": [],                 # no dependencies
        }
    """
```

1. Parse all query configs, extract `bindings[].source_dataset` as dependencies
2. Validate: all referenced datasets exist in the process config
3. Detect cycles → raise `ProcessExecutionError` if found
4. Return adjacency list

#### Execution Strategy

Eager execution — not strict wave-based:

```
1. Topological sort → identify datasets with no dependencies (wave 0)
2. Start all wave-0 datasets in parallel (batched fetch)
3. When ANY dataset completes:
   a. Check all dependents — are their dependencies now fully satisfied?
   b. For newly unblocked datasets:
      - Resolve bindings (extract values from completed source)
      - Inject as filters into the dependent's query config
      - Start fetching immediately
4. Continue until all datasets complete
5. Proceed to join phase
```

#### Binding Resolution

When a dependency completes:

- **distinct mode**: Extract unique values from source column → inject as `IN (...)` filter on target column
- **row_pair mode**: Extract (source_col1, source_col2...) pairs → inject as semi-join filter

Uses the same `resolve_distinct_bindings` and `resolve_row_pair_bindings` logic from the existing binding module, but operating on the cached intermediate DataFrame in Redis instead of a query run result.

---

### 5. Intermediate Caching

| What | Where | When | TTL | Purpose |
|------|-------|------|-----|---------|
| Per-dataset accumulated rows | Redis | After each batch | 1 hour | Crash recovery, partial preview |
| Final result | Redis | On completion | `result_ttl_seconds` (1hr) | Serves paginated results (existing) |
| Run progress state | MongoDB | After each batch | Permanent (run doc) | Reconnection replay, history |
| Optimal batch sizes | MongoDB | After dataset fetch | Permanent | Smart defaults for future runs |

Redis keys for intermediate data:

```
ew:batch:{run_id}:{dataset_key} → serialized Polars DataFrame (accumulated)
```

#### Partial Preview

Once a dataset has at least one batch cached, the frontend can request a preview:

```
GET /api/v1/processes/runs/{run_id}/preview/{dataset_key}?page_size=100
```

Returns the first 100 rows of the intermediate cached DataFrame. Read-only, no transforms applied.

---

### 6. Process Run State Machine

```
PENDING → RUNNING → COMPLETED
                  → FAILED
                  → CANCELLED
         RUNNING ↔ PAUSED
```

MongoDB `process_runs` document extended:

```python
{
    # ... existing fields ...
    "progress": {
        "phase": "fetching",
        "phase_index": 0,
        "total_phases": 3,
        "datasets": {
            "orders.main": {
                "status": "fetching",      # waiting | fetching | paused | completed | failed
                "rows_fetched": 30000,
                "batch_number": 3,
                "batch_size": 10000,
                "waiting_for": [],
                "depends_on": []
            }
        },
        "current_operation": null
    },
    "control": {
        "paused": false,
        "batch_size_override": null,
        "target_batch_seconds": 10,
        "adaptive_enabled": true
    }
}
```

---

### 7. Frontend Progress Panel UI

Replaces the "Running..." spinner in the Run tab with an inline panel:

```
┌─────────────────────────────────────────────────────────────────┐
│ ● Running Process                                      [Cancel] │
├─────────────────────────────────────────────────────────────────┤
│ Phase 1 of 3: Fetching Datasets                                 │
│                                                                 │
│  ✅ orders.main        50,000 rows    12.3s    [Preview]        │
│  ██████████░░░░ customers.main  12,000/30,000  batch 3/~5       │
│  ⏳ shipments.main     waiting for orders.main                   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ Batch Controls                                                  │
│  [⏸ Pause]  [▶ Resume]                                          │
│                                                                 │
│  ○ Slower(2K)  ○ Balanced(10K)  ● Faster(25K)  [____15000]     │
│                                                                 │
│  Target time/batch: [____10____] sec     ☑ Auto-adapt           │
│  Current: ~9.5s/batch  |  ~1,450 rows/sec                      │
└─────────────────────────────────────────────────────────────────┘
```

#### Components

- **PhaseIndicator** — Shows current phase with step dots (fetching → joining → transforming)
- **DatasetProgressList** — Per-dataset rows with status icon, progress bar, row counts, [Preview] button
- **BatchControls** — Preset buttons + manual input + target seconds + auto-adapt checkbox + pause/resume
- **StatsBar** — Current batch time, rows/sec throughput

#### WebSocket Hook

```typescript
// useProcessWebSocket(configId)
// Returns: { messages, sendCommand, isConnected, reconnect }
// Manages WS lifecycle, auto-reconnect, message buffering
```

#### State Management

Progress state managed via `useReducer` that processes incoming WS messages:

```typescript
type ProgressState = {
  phase: string;
  phaseIndex: number;
  totalPhases: number;
  datasets: Record<string, DatasetProgress>;
  paused: boolean;
  adaptiveEnabled: boolean;
  batchSize: number | null;
  targetSeconds: number;
  runId: string | null;
};
```

#### Transition to Results

On `completed` message, the progress panel fades out (300ms CSS transition) and the DataTable appears with the full results — same as existing behavior.

---

### 8. Backend File Structure (New/Modified)

```
easyweaver-api/src/easyweaver/
├── connectors/
│   ├── base.py                          # MODIFIED — add execute_query_batched, supports_batching
│   └── implementations/
│       ├── postgres.py                  # MODIFIED — implement batched query
│       ├── mysql.py                     # MODIFIED — implement batched query
│       ├── db2.py                       # MODIFIED — implement batched query (ROW_NUMBER)
│       └── mongodb.py                   # MODIFIED — implement batched query (skip/limit)
├── processes/
│   ├── executor.py          # MODIFIED — DAG execution, batched fetch loop
│   ├── router.py            # MODIFIED — WebSocket endpoint
│   ├── schemas.py           # MODIFIED — ProcessQueryBinding, progress fields
│   ├── dag.py               # NEW — DAG construction, topological sort, cycle detection
│   ├── batch_adapter.py     # NEW — adaptive batch sizing algorithm
│   ├── ws_handler.py        # NEW — WebSocket message handling, command dispatch
│   └── progress.py          # NEW — progress state management, MongoDB updates
├── settings.py              # MODIFIED — add batch-related settings

easyweaver-ui/src/
├── components/processes/
│   ├── ProcessRunner.tsx     # MODIFIED — integrate progress panel
│   ├── ProgressPanel.tsx     # NEW — main progress container
│   ├── PhaseIndicator.tsx    # NEW — phase step dots
│   ├── DatasetProgress.tsx   # NEW — per-dataset progress row
│   ├── BatchControls.tsx     # NEW — preset buttons, manual input, pause/resume
│   ├── DatasetPreview.tsx    # NEW — partial result preview modal
│   └── StatsBar.tsx          # NEW — throughput stats
├── hooks/
│   └── use-process-ws.ts    # NEW — WebSocket hook with reconnection
├── types/index.ts            # MODIFIED — WS message types, progress state
└── api/processes.ts          # MODIFIED — preview endpoint
```

---

### 9. New Settings

```python
# settings.py additions
batch_default_target_seconds: float = 10.0
batch_min_size: int = 1_000
batch_max_size: int = 100_000
batch_intermediate_ttl_seconds: int = 3600  # 1 hour TTL for intermediate cached batches
```

---

### 10. Testing Strategy

#### Unit Tests
- Adaptive batch sizing algorithm — various scenarios (ramp up, stabilize, user override, edge cases)
- DAG construction — linear deps, diamond deps, cycle detection, no deps
- WebSocket message serialization/deserialization
- Connector batched query SQL generation (each connector type)
- Progress state reducer (frontend)

#### Integration Tests
- Full process execution with batched fetch against test databases (Postgres, MongoDB)
- WebSocket connect → start → receive progress → control commands → completion
- DAG execution with bindings — verify execution order and binding resolution
- Pause/resume mid-execution
- Reconnection and state replay
- Partial preview during execution
- Intermediate cache cleanup after completion

#### Load Tests
- Large dataset fetch (500K+ rows) with batching — verify memory stays bounded
- Concurrent process executions (10+) with WebSocket connections
- Adaptive algorithm convergence speed under varying DB latencies
- WebSocket message throughput under high-frequency batch completion

#### SonarQube Quality Gates
- All new code must pass SonarQube analysis
- Zero critical/blocker issues
- Minimum 80% code coverage on new files
- No security hotspots
