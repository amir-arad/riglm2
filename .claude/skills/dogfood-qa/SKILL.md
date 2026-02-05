---
name: dogfood-qa
description: "QA agent for dogfooding riglm2's own MCP proxy. Use when: (1) Verifying riglm2 proxy is working after changes, (2) Testing meta-tools (set_context, search_available_tools), (3) Exercising upstream tool routing through the proxy, (4) Regression testing after refactors, (5) Validating semantic filtering and learning signals end-to-end through Claude Code's own MCP connection, (6) Verifying persistence of learned pairs across restarts."
---

# riglm2 Dogfood QA

Exercise the riglm2 proxy **through Claude Code's own MCP connection** — the `riglm2` server in `.mcp.json`.

## Prerequisites

- `.mcp.json` exists at project root with `riglm2` server entry
- `dogfood.config.json` defines upstream servers (default: `server-everything`) and storage path
- Claude Code has been restarted / `/mcp` refreshed so the `riglm2` server is connected

Verify connection first:

```
Check that tools prefixed with `riglm2__` are available (e.g., riglm2__set_context, riglm2__everything__echo)
```

## QA Test Suite

Run these checks **in order**. Stop and report on first failure.

### 1. Connection Health

**Action**: List tools from the riglm2 MCP server.

**Verify**:

- [ ] `riglm2__set_context` exists
- [ ] `riglm2__search_available_tools` exists
- [ ] At least one `riglm2__everything__*` upstream tool exists
- [ ] Tool descriptions include `[everything]` prefix for upstream tools

### 2. Cold Start — All Tools Returned

**Action**: Without calling `set_context` first, list tools from riglm2.

**Verify**:

- [ ] All 13 upstream `everything__*` tools are present (cold start mode — no context, so no filtering)
- [ ] Both meta-tools present

### 3. Meta-tool: set_context

**Action**: Call `riglm2__set_context` with:

```json
{ "query": "I need to test echo functionality", "intent": "testing" }
```

**Verify**:

- [ ] Response contains "Context updated"
- [ ] Response echoes back the query text
- [ ] Response includes intent "testing"

### 4. Filtering — tools/list After set_context

**Action**: After test 3's `set_context`, list tools from riglm2 again.

**Verify**:

- [ ] `riglm2__set_context` still present (meta-tools always included)
- [ ] `riglm2__search_available_tools` still present
- [ ] **One of**: (a) tool count is less than full 15 (filtering active), OR (b) all tools still present (cold start — dynamic index empty, confidence < 0.3). Record which case.

**Note**: On a fresh proxy with no learning history, confidence will be < 0.3, so all tools are returned. This is expected. After repeated usage, filtering will kick in.

### 5. Meta-tool: search_available_tools

**Action**: Call `riglm2__search_available_tools` with:

```json
{ "query": "echo" }
```

**Verify**:

- [ ] Response contains at least one result
- [ ] `everything__echo` appears in results
- [ ] Results include tool descriptions

### 6. Search — No Results

**Action**: Call `riglm2__search_available_tools` with:

```json
{ "query": "xyznonexistent99" }
```

**Verify**:

- [ ] Response contains "No tools found"

### 7. Upstream Tool Routing

**Action**: Call `riglm2__everything__echo` with:

```json
{ "message": "dogfood-qa-probe" }
```

**Verify**:

- [ ] Response is not an error
- [ ] Response content array is non-empty

### 8. Learning Signal — Tool Call After Context

**Action**: Ensure context is set (from test 3), then call `riglm2__everything__echo` with:

```json
{ "message": "learning signal test" }
```

**Verify**:

- [ ] Call succeeds (response is non-error)
- [ ] No errors in proxy stderr about "Learning signal failed"

**What this tests**: After `set_context` + `tools/call`, the proxy records a learning signal (query-tool pair) into the dynamic index. The signal type depends on whether the tool was in the filtered list (1.0) or discovered via search (1.5) or neither (0.5).

### 9. Unknown Tool Error

Claude Code may validate tool names client-side, so non-existent tools can't be called via MCP tool invocation.
If this happens, use a raw JSON-RPC call via Bash instead:

**Action**:

First, call `riglm2__nonexistent__fake_tool` with `{}`

If it fails or prevented client-side, run this Bash command:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"nonexistent__fake_tool","arguments":{}}}' | timeout 5 bun run src/index.ts dogfood.config.json 2>/dev/null | head -5
```

**Verify**:

- [ ] Response JSON contains `"Unknown tool: nonexistent__fake_tool"`
- [ ] Response JSON contains `"isError":true`

### 10. Context Persistence (set then search)

**Action**: Call `riglm2__set_context` with:

```json
{ "query": "working with notifications and echoing" }
```

Then call `riglm2__search_available_tools` with:

```json
{ "query": "echo" }
```

**Verify**:

- [ ] set_context succeeds
- [ ] search returns results (everything\_\_echo or other matching tools)

### 11. Repeated Context — Confidence Growth

**Action**: Call `riglm2__set_context` with the same query used earlier:

```json
{ "query": "I need to test echo functionality" }
```

Then call `riglm2__everything__echo` with:

```json
{ "message": "confidence growth test" }
```

Then list tools again.

**Verify**:

- [ ] Both calls succeed
- [ ] Tools list is returned (may or may not be filtered — depends on accumulated confidence)

**What this tests**: Repeated context + tool usage builds dynamic index entries. Over multiple cycles, confidence for this query should increase, eventually crossing the 0.3 threshold and enabling filtering.

### 12. Storage — DB File Exists

**Action**: Check that the storage DB file exists on disk:

```bash
ls -la riglm2-dogfood.db
```

**Verify**:

- [ ] `riglm2-dogfood.db` exists in the project root
- [ ] File size is > 0

**What this tests**: The `storage.path` config in `dogfood.config.json` is resolved relative to the config file directory, and the SQLite DB is created on first use.

### 13. Storage — Learned Entries Persisted

**Action**: Read the dynamic entry count from the DB:

```bash
sqlite3 riglm2-dogfood.db "SELECT COUNT(*) FROM dynamic_entries"
```

Or if `sqlite3` is not available:

```bash
bun -e "const db = new (require('bun:sqlite').Database)('riglm2-dogfood.db'); console.log(db.query('SELECT COUNT(*) as n FROM dynamic_entries').get()); db.close()"
```

**Verify**:

- [ ] Count is > 0 (learning signals from tests 8 and 11 should have been persisted)
- [ ] Each recorded entry corresponds to a `set_context` → `tools/call` pair from this session

**What this tests**: Write-through persistence — every `recordLearning` call upserts into SQLite.

### 14. Storage — Persistence Across Restart

**Action**: Record the current dynamic entry count (from test 13). Then restart the riglm2 MCP server:

1. Run `/mcp` in Claude Code to restart MCP servers
2. Wait for reconnection
3. Read entry count again:

```bash
bun -e "const db = new (require('bun:sqlite').Database)('riglm2-dogfood.db'); console.log(db.query('SELECT COUNT(*) as n FROM dynamic_entries').get()); db.close()"
```

4. Call `riglm2__set_context` with a query used earlier in this session:

```json
{ "query": "I need to test echo functionality" }
```

5. List tools from riglm2.

**Verify**:

- [ ] Entry count after restart matches count before restart (no data loss)
- [ ] Proxy stderr shows `Loaded N dynamic entries from storage` on startup
- [ ] `set_context` succeeds — filtering uses restored dynamic index
- [ ] Tools list returned includes expected tools (learned associations survived)

**What this tests**: The full persistence lifecycle — learned pairs are written to SQLite during usage, loaded back on startup, and influence retrieval after restart.

### 15. Storage — Startup Pruning

**Action**: Check proxy stderr logs from the most recent startup (test 14's restart).

**Verify**:

- [ ] If entry count was small (< 5000), no "Pruned" message appears (nothing to prune)
- [ ] If entry count was large, "Pruned N dynamic entries" message appears before "Loaded N dynamic entries"

**What this tests**: Pruning runs on startup (not just shutdown) to handle crash recovery scenarios. With a fresh dogfood DB, this will be a no-op, which is the correct behavior.

## Reporting

After running all checks, produce a summary:

```
## Dogfood QA Results

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | Connection Health | PASS/FAIL | |
| 2 | Cold Start | PASS/FAIL | |
| 3 | set_context | PASS/FAIL | |
| 4 | Filtering after context | PASS/FAIL | filtering active / cold start |
| 5 | search (hit) | PASS/FAIL | |
| 6 | search (miss) | PASS/FAIL | |
| 7 | upstream routing | PASS/FAIL | |
| 8 | learning signal | PASS/FAIL | |
| 9 | unknown tool error | PASS/FAIL | |
| 10 | context persistence | PASS/FAIL | |
| 11 | confidence growth | PASS/FAIL | |
| 12 | DB file exists | PASS/FAIL | |
| 13 | entries persisted | PASS/FAIL | count: N |
| 14 | persistence across restart | PASS/FAIL | entries before/after: N/N |
| 15 | startup pruning | PASS/FAIL | pruned: N / no-op |

**Overall**: X/15 passed
**Filtering active**: yes/no (cold start expected on fresh proxy)
**Dynamic entries**: N persisted
```

## Test Driver Scripts

Standalone bash scripts in `drivers/` for tests that don't require MCP tool invocation. Run from project root.

| Script | Covers | What it does |
|--------|--------|--------------|
| `drivers/unknown-tool.sh` | Test 9 | Sends raw JSON-RPC with bogus tool name to a fresh proxy, verifies `isError:true` |
| `drivers/db-check.sh` | Tests 12-13 | Checks DB exists, prints entry count + entry metadata (sans vector blobs) |
| `drivers/learning-cycle.sh` | Tests 3+8+11 | Runs a full `initialize` → `set_context` → `echo` session against a fresh proxy, verifies learning entry persisted |

```bash
.claude/skills/dogfood-qa/drivers/unknown-tool.sh
.claude/skills/dogfood-qa/drivers/db-check.sh
.claude/skills/dogfood-qa/drivers/learning-cycle.sh
```

Use these for quick smoke tests without a live MCP connection, or in CI.

## When Something Fails

1. Check stderr output: `bun run src/index.ts dogfood.config.json` manually to see logs
2. Verify `dogfood.config.json` is valid JSON and has `storage` section
3. Confirm upstream server (`server-everything`) is installable: `npx -y @modelcontextprotocol/server-everything`
4. Check `.mcp.json` has correct `cwd` path
5. Re-run `bun install` if dependencies are stale
6. If embedding model fails to load, check `fastembed` is installed: `bun add fastembed`
7. Enable debug logging: `RIGLM2_DEBUG=1` in `.mcp.json` env
8. If DB file missing: check `storage.path` in `dogfood.config.json` — path is resolved relative to config file directory
9. If entries not persisting: check that `storage` is wired in `index.ts` and passed to `ToolRetriever`

## Adding New Upstream Servers

To expand dogfood coverage, add servers to `dogfood.config.json`:

```json
{
  "servers": [
    {
      "name": "everything",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"]
    },
    {
      "name": "filesystem",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/data/Workspace/riglm2"
      ]
    }
  ]
}
```

More upstream servers = more tools = better test of semantic filtering. With 40+ tools across multiple servers, filtering becomes observable within a single session.
