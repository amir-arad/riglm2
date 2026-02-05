# 08: Phase 3 Implementation Decisions

## Background

Phase 3 implements embedding-based semantic filtering for `tools/list`, two-tier retrieval (static + dynamic), learning from usage, and cold-start handling. This log records decisions made during implementation that diverged from or refined the original design (logs 04–06).

---

## Problem

Turn the Phase 3 design into working code on the Bun runtime with minimal dependencies and acceptable retrieval quality.

---

## Questions and Answers

### Q1: Which embedding library works on Bun?

**Planned**: `@huggingface/transformers` with `all-MiniLM-L6-v2`

**Actual**: `fastembed@2.1.0` with BGE-small-en-v1.5

**Why**: `@huggingface/transformers` v3.8.1 fails on Bun 1.3.5 due to two native dependency issues:
1. `onnxruntime-common` — Bun's cache-based module resolution can't resolve peer dependencies from the install cache. Adding explicit deps fixes this.
2. `sharp` — requires system-level `libvips-cpp.so`. Even with `bun add sharp` and trusted postinstall, the shared library isn't available.

`fastembed` uses its own ONNX WASM runtime internally, bypassing both issues. BGE-small-en-v1.5 produces 384-dimensional pre-normalized vectors. Quality is comparable to MiniLM for short tool descriptions.

**Spike results** (5 tools, query "I need to search for information online"):
```
0.8223  tavily_search
0.5995  browser_navigate
0.4743  add-tasks
0.4560  get-sum
0.4475  echo
```

### Q2: In-memory vector index or external store?

**Decision**: In-memory with linear scan.

For 50–500 tools, linear cosine similarity takes <1ms. No need for approximate nearest neighbors or an external vector DB. The `InMemoryVectorIndex` uses dot product on pre-normalized vectors (equivalent to cosine similarity).

### Q3: When does filtering happen?

**Decision**: `tools/list` checks session context on every call.

- No context → return all tools (unchanged behavior)
- Context set but confidence < 0.3 → return all tools (cold start)
- Context set and confidence >= 0.3 → return filtered top-k

### Q4: How does the client know to re-fetch tools/list?

**Decision**: `set_context` sends `notifications/tools/list_changed` via `server.sendToolListChanged()`.

The MCP SDK `Server` class exposes this method (confirmed in `dist/esm/server/index.js:433`). When the client receives this notification, it calls `tools/list` again and gets the filtered result.

### Q5: How are learning signals classified?

**Implemented signals** (simplified from design):

| Scenario | Signal | Rationale |
|----------|--------|-----------|
| Tool was in filtered list AND used | 1.0 | Retrieval was correct |
| Tool found via `search_available_tools` AND used | 1.5 | Discovery — retrieval missed it |
| Tool used but wasn't in filtered list or search | 0.5 | Weak discovery signal |

**Omitted**: The -0.2 weak negative for "retrieved but not used" was dropped. Reason: in a single session, not using a retrieved tool doesn't mean it was irrelevant — the user may simply not have needed it yet. Negative signals need cross-session data to be reliable.

### Q6: How does confidence update work?

**Decision**: Exponential moving average (EMA) on the dynamic index.

When a learned pair already exists: `new_confidence = old * 0.8 + signal * 0.2`

This smooths out noise from individual sessions while allowing confidence to grow over repeated positive signals.

---

## Design

### New Components

| File | Responsibility |
|------|---------------|
| `embedder.ts` | `Embedder` interface + `FastEmbedEmbedder` (lazy model load) |
| `vector-index.ts` | `InMemoryVectorIndex` (add, search, remove, upsert) |
| `tool-retriever.ts` | `ToolRetriever` (static indexing, two-tier retrieve, learning, confidence) |

### Modified Components

| File | Change |
|------|--------|
| `proxy-server.ts` | Accepts optional `ToolRetriever`, filters `tools/list`, records learning on `tools/call` |
| `meta-tools.ts` | `set_context` sends `tools/list_changed`; `search_available_tools` tracks results in session |
| `session-store.ts` | Added `retrievedTools` and `lastSearch` tracking |
| `types.ts` | Extended `Session` with `retrievedTools?` and `lastSearch?` |
| `tool-registry.ts` | Added `getAllEntries()` |
| `index.ts` | Wires `FastEmbedEmbedder` → `ToolRetriever`, indexes tools on startup |

### Data Flow

```
set_context("file operations")
  → sessionStore.setContext()
  → server.sendToolListChanged()
  → client calls tools/list
    → retriever.contextConfidence("file operations")
    → confidence < 0.3? return all tools
    → retriever.retrieve("file operations", topK=15)
      → embed query
      → search static index (topK*2)
      → search dynamic index (topK*2)
      → merge: 0.6*static + 0.4*dynamic
      → return top-15 tool names
    → filter registry to matched tools + meta-tools
    → sessionStore.setRetrievedTools(toolNames)

tools/call("file_read", {...})
  → route to upstream
  → sessionStore.recordToolCall()
  → classify signal (retrieved=1.0, searched=1.5, other=0.5)
  → retriever.recordLearning(query, toolName, signal)
    → embed query → upsert into dynamic index
```

---

## Trade-offs

### fastembed over @huggingface/transformers
- **Pro**: Works on Bun, smaller dependency footprint, no system-level deps
- **Con**: Less ecosystem support, limited to ONNX models packaged by Qdrant
- **Mitigation**: `Embedder` interface allows swapping to any backend

### No negative signals
- **Pro**: Avoids penalizing tools unfairly in short sessions
- **Con**: Dynamic index may grow with false positives
- **Mitigation**: Monitor index size; add pruning in Phase 4 if >5k entries

### Cold start returns all tools
- **Pro**: Safe — never hides tools when uncertain
- **Con**: Defeats filtering purpose until dynamic index builds up
- **Mitigation**: Threshold (0.3) is low; even a few interactions should push above it

### `retriever` is optional parameter
- **Pro**: Backward compatible — proxy works without embeddings if `fastembed` fails
- **Con**: Slight code complexity with `if (retriever)` checks
- **Mitigation**: Only 2 guard checks in proxy-server.ts

---

## Verification Criteria

| Criterion | Status |
|-----------|--------|
| 22 tests pass (7 vector-index, 6 retriever, 5 smoke, 4 filtering) | Done |
| Typecheck clean | Done |
| Lint clean (no-comments rule) | Done |
| No circular dependencies | Done |
| Embedding model loads on startup | Done |
| `set_context` triggers `tools/list_changed` | Done |
| Cold start returns all tools | Done |
| Learning signals recorded on `tools/call` | Done |
| Retrieval quality: tavily_search ranked #1 for "search information online" | Done |
