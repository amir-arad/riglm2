# 09: Phase 4 — Persistent Dynamic Index + Pruning

## Background

Phase 3 introduced a dynamic index that learns query-tool associations from usage. However, all learned pairs live in memory and are lost on restart. Every restart is a cold start.

---

## Problem

Make the dynamic index survive restarts while keeping the index bounded so it doesn't grow without limit.

---

## Questions and Answers

### Q1: What persistence layer?

**Chosen**: `bun:sqlite` — zero-dependency, native to Bun, synchronous API. No async complexity needed for DB ops. WAL mode for concurrent reads during search.

**Rejected**: File-based JSON (fragile, no atomic writes), external DB (unnecessary dependency for single-process proxy).

### Q2: What gets persisted?

Only the dynamic index. Static index is rebuilt from live tool registry on every startup — tools may change between restarts, so persisting static entries would create staleness.

### Q3: How to serialize vectors?

`Float64Array` stored as BLOB (384 dims * 8 bytes = 3072 bytes per entry). Float64 avoids precision loss vs Float32. Deserialized via `new Float64Array(buffer.buffer)` → `Array.from()`.

### Q4: Write-through or batch?

Write-through on every `recordLearning` call. Simpler, no data loss on crash. The write volume is low (one per tool call observation), so SQLite handles it easily.

### Q5: When to prune?

On shutdown. Three strategies in a single transaction:
1. Delete entries with `confidence < pruneMinConfidence` (default 0.1)
2. Delete entries unused for `> pruneUnusedDays` (default 30 days)
3. If still over `pruneThreshold` (default 5000): keep top 90% by confidence

---

## Design

### Architecture

```
ToolRetriever
  ├── staticIndex: InMemoryVectorIndex  (rebuilt on startup)
  ├── dynamicIndex: InMemoryVectorIndex (search engine, hydrated from storage)
  └── storage?: Storage                 (SQLite persistence, write-through)
```

No new index class. `Storage` is a pure persistence layer. `InMemoryVectorIndex` remains the search engine. `ToolRetriever` coordinates both.

### Schema

```sql
CREATE TABLE dynamic_entries (
  id TEXT PRIMARY KEY,
  vector BLOB NOT NULL,
  tool_name TEXT NOT NULL,
  query TEXT NOT NULL,
  confidence REAL NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_used_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

Indexes on `confidence` and `last_used_at` for efficient pruning queries.

### Startup sequence

1. Open SQLite DB (create if missing)
2. `storage.loadAll()` → `dynamicIndex.addBatch(entries)` — hydrate in-memory index
3. `indexStaticTools()` — embed tool descriptions from live registry

### Learning flow

`recordLearning()` now persists after every mutation:
- Existing entry: update confidence via EMA → `storage.upsert(existing)`
- New entry: add to dynamic index → `storage.upsert(newEntry)`

`upsert` uses `INSERT ... ON CONFLICT DO UPDATE` to atomically set confidence and reset `last_used_at`.

### Shutdown flow

1. `storage.prune(config)` — clean up low-value entries
2. `storage.close()` — close DB connection
3. Disconnect upstreams, close server

---

## Implementation

### Files changed

| Action | File | Change |
|--------|------|--------|
| Create | `src/storage.ts` | `Storage` class — DB lifecycle, CRUD, 3-strategy pruning |
| Create | `test/storage.test.ts` | 8 tests (roundtrip, conflict, remove, empty, 3 pruning strategies) |
| Modify | `src/config.ts` | `StorageConfigSchema` (path, pruneThreshold, pruneMinConfidence, pruneUnusedDays) |
| Modify | `src/tool-retriever.ts` | Optional `Storage` param, `loadDynamicEntries()`, persist in `recordLearning` |
| Modify | `src/index.ts` | Wire `Storage`, load before static index, prune on shutdown |
| Modify | `knip.json` | Ignore `mcpmon` devDependency |

### Config defaults

```json
{
  "storage": {
    "path": "./riglm2-data.db",
    "pruneThreshold": 5000,
    "pruneMinConfidence": 0.1,
    "pruneUnusedDays": 30
  }
}
```

---

## Trade-offs

| Decision | Upside | Downside |
|----------|--------|----------|
| Write-through vs batch | No data loss on crash | Slightly more DB writes |
| Float64 vs Float32 | Zero precision loss | 2x storage per vector |
| Prune on shutdown only | Simple, predictable | Long-running instances accumulate until restart |
| Optional `Storage` in `ToolRetriever` | Backward compatible, testable without DB | Nullable field, conditional calls |

---

## Verification Criteria

- [x] `bun test` — 30 tests pass (22 existing + 8 new)
- [x] `bun run typecheck` — clean
- [x] `bun run lint` — clean
- [x] `bun run deadcode` — clean
- [x] `bun run circular` — no circular dependencies
- [ ] Manual: start → learn → restart → verify pairs survive
- [ ] Manual: verify pruning log on shutdown with entries exceeding threshold