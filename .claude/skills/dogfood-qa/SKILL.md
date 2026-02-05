---
name: dogfood-qa
description: |
  QA agent for dogfooding riglm2's own MCP proxy. Use when: (1) Verifying riglm2 proxy is working
  after changes, (2) Testing meta-tools (set_context, search_available_tools), (3) Exercising
  upstream tool routing through the proxy, (4) Regression testing after refactors, (5) Validating
  new features end-to-end through Claude Code's own MCP connection.
related_skills:
  - mcp-testing (programmatic tests)
---

# riglm2 Dogfood QA

Exercise the riglm2 proxy **through Claude Code's own MCP connection** — the `riglm2` server in `.mcp.json`.

## Prerequisites

- `.mcp.json` exists at project root with `riglm2` server entry
- `dogfood.config.json` defines upstream servers (default: `server-everything`)
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

### 2. Meta-tool: set_context

**Action**: Call `riglm2__set_context` with:

```json
{ "query": "I need to test echo functionality", "intent": "testing" }
```

**Verify**:

- [ ] Response contains "Context updated"
- [ ] Response echoes back the query text
- [ ] Response includes intent "testing"

### 3. Meta-tool: search_available_tools

**Action**: Call `riglm2__search_available_tools` with:

```json
{ "query": "echo" }
```

**Verify**:

- [ ] Response contains at least one result
- [ ] `everything__echo` appears in results
- [ ] Results include tool descriptions

### 4. Search — No Results

**Action**: Call `riglm2__search_available_tools` with:

```json
{ "query": "xyznonexistent99" }
```

**Verify**:

- [ ] Response contains "No tools found"

### 5. Upstream Tool Routing

**Action**: Call `riglm2__everything__echo` with:

```json
{ "message": "dogfood-qa-probe" }
```

**Verify**:

- [ ] Response is not an error
- [ ] Response content array is non-empty

### 6. Unknown Tool Error

**Action**: Call `riglm2__nonexistent__fake_tool` with `{}`

**Verify**:

- [ ] Response contains "Unknown tool"
- [ ] Response is marked as error (`isError: true`)

### 7. Context Persistence (set then search)

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

## Reporting

After running all checks, produce a summary:

```
## Dogfood QA Results

| # | Test | Status | Notes |
|---|------|--------|-------|
| 1 | Connection Health | PASS/FAIL | |
| 2 | set_context | PASS/FAIL | |
| 3 | search (hit) | PASS/FAIL | |
| 4 | search (miss) | PASS/FAIL | |
| 5 | upstream routing | PASS/FAIL | |
| 6 | unknown tool error | PASS/FAIL | |
| 7 | context persistence | PASS/FAIL | |

**Overall**: X/7 passed
```

## When Something Fails

1. Check stderr output: `bun run src/index.ts dogfood.config.json` manually to see logs
2. Verify `dogfood.config.json` is valid JSON
3. Confirm upstream server (`server-everything`) is installable: `npx -y @modelcontextprotocol/server-everything`
4. Check `.mcp.json` has correct `cwd` path
5. Re-run `bun install` if dependencies are stale

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

More upstream servers = more tools = better test of the "too many tools" problem that Phase 3 solves.
