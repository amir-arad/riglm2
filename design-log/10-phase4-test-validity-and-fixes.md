# 10: Phase 4 Test Validity Audit & Bug Fixes

## Background

After implementing Phase 4 (persistent dynamic index + pruning), the initial integration tests passed but were challenged for validity. A systematic audit revealed that 3 of 4 tests were tautological or duplicative — they would pass even if the persistence layer did nothing. A subsequent code review of `storage.ts` and the wiring in `index.ts` uncovered 5 additional issues ranging from a correctness bug to design fragilities.

---

## Problem

Ensure Phase 4 persistence tests actually prove persistence matters, and fix all identified bugs and design issues in the storage layer.

---

## Questions and Answers

### Q1: Are the persistence integration tests real?

**Decision**: 3 of 4 original tests were fake/duplicative. Rewrote them.

**Analysis**:
1. **Roundtrip test** — passed without loading dynamic entries because MockEmbedder + static index already ranked `db_query` first for "query the database". The assertion was tautological.
2. **Pruning test** — pure `Storage` test using `:memory:`, duplicated `storage.test.ts`.
3. **DB file creation** — tested SQLite's `{ create: true }` behavior, not our code.
4. **Custom path** — combined #3 + a roundtrip already covered in unit tests.

### Q2: How to make persistence tests unfakeable?

**Decision**: Use "unlikely pairings" — learn associations that static index would never produce.

**Why**: By learning `"query the database" → test__file_read` (orthogonal vectors in the mock), the only way `file_read` can rank higher is if the dynamic index loaded from persistence. A built-in control (retrieve without `loadDynamicEntries()`) proves the static index alone doesn't produce this ranking.

### Q3: What bugs exist in Storage?

**Five issues identified**:

1. **BLOB deserialization bug** — `new Float64Array(row.vector.buffer)` uses the underlying ArrayBuffer which may be larger than the Buffer's slice. Must use `byteOffset` and `byteLength`.
2. **No prepared statement caching** — every `upsert()` re-parsed SQL. Hot path during learning.
3. **`loadDynamicEntries()` not idempotent** — calling twice doubles entries in dynamic index.
4. **Pruning only on shutdown** — SIGKILL/OOM skips pruning; DB grows unbounded across crashes.
5. **Relative storage path** — resolved against CWD, not config file directory. DB created in unexpected locations depending on launch context.

### Q4: WAL sidecar file cleanup in tests?

**Decision**: Clean up `-wal` and `-shm` files alongside `.db` in `afterAll`.

**Why**: `PRAGMA journal_mode = WAL` creates sidecar files. Original cleanup only removed the `.db`, leaving orphans in `/tmp`.

---

## Design

### Rewritten Tests (`test/persistence.test.ts`)

| Test | What it proves | Technique |
|------|---------------|-----------|
| Unlikely pairing survives restart | Persistence changes retrieval results | Learn `db_query → file_read`, control without load, verify rank improves with load |
| EMA confidence persists | Update-existing codepath + persistence | Learn twice, verify exact EMA value (1.3) after restart |
| Learn → prune → reload cycle | Full lifecycle integration | Learn 10 entries, prune by confidence, reload, verify surviving entries work |
| DB file created on disk | File path config works | Smoke test, kept as-is |

### Storage Fixes (`src/storage.ts`)

- BLOB deserialization: `new Float64Array(buf.buffer, buf.byteOffset, buf.byteLength / 8)`
- Prepared statements: `stmtLoadAll`, `stmtUpsert`, `stmtRemove`, `stmtSize` cached in constructor
- Pruning queries left uncached (called rarely, contain dynamic logic)

### ToolRetriever Fix (`src/tool-retriever.ts`)

- `loadDynamicEntries()`: `this.dynamicIndex.clear()` before `addBatch()` for idempotency

### Wiring Fixes (`src/index.ts`)

- `path.resolve(path.dirname(configPath), config.storage.path)` — resolve relative to config file
- `storage.prune(config.storage)` called on startup before `loadDynamicEntries()` — catches crash-without-prune

---

## Trade-offs

### Prune on startup (not just shutdown)
- **Pro**: Handles crash recovery; DB never grows unbounded
- **Con**: Adds ~1ms to startup for empty/small DBs
- **Mitigation**: Prune is a no-op when nothing matches criteria

### Prepared statement caching
- **Pro**: Eliminates SQL re-parsing on hot path
- **Con**: Slightly more complex constructor; statements hold DB references
- **Mitigation**: Statements are invalidated when `close()` is called anyway

### Unlikely pairing test technique
- **Pro**: Test is structurally unfakeable — can only pass if persistence works
- **Con**: Requires understanding of mock vector geometry to maintain
- **Mitigation**: WHY comments explain the orthogonality reasoning inline

---

## Verification Criteria

| Criterion | Status |
|-----------|--------|
| 34 tests pass (`bun test`) | Done |
| TypeScript clean (`bun run typecheck`) | Done |
| Lint clean (`bun run lint`) | Done |
| No dead code (`bun run deadcode`) | Done |
| No circular deps (`bun run circular`) | Done |
| Roundtrip test fails without `loadDynamicEntries()` | Done (control assertion) |
| EMA value 1.3 exact match after restart | Done |
| WAL sidecar files cleaned in test teardown | Done |
