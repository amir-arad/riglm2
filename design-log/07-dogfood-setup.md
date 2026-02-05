# 07: Dogfood Setup

## Background

Phase 1+2 (transparent proxy + context injection) are complete with passing smoke tests. Before starting Phase 3, we set up riglm2 to proxy its own development environment — Claude Code talks to riglm2, riglm2 proxies to upstream servers.

---

## Problem

How to validate riglm2 end-to-end through real MCP client usage, not just programmatic tests?

---

## Design

### Configuration

Two files added to project root:

**`dogfood.config.json`** — riglm2 upstream config:
- `server-everything` as upstream (13 tools, good surface area)

**`.mcp.json`** — Claude Code MCP server entry:
- Launches `bun run src/index.ts dogfood.config.json`
- Tools appear as `riglm2__*` in Claude Code

### QA Skill

`.claude/skills/dogfood-qa/SKILL.md` — 7-step QA suite invocable via `/dogfood-qa`:

| # | Test | What it validates |
|---|------|-------------------|
| 1 | Connection Health | Meta-tools + upstream tools present with namespacing |
| 2 | set_context | Context injection with query + intent |
| 3 | search (hit) | Substring search finds matching tools |
| 4 | search (miss) | Graceful "no results" for non-matching queries |
| 5 | upstream routing | Tool call proxied to upstream and response returned |
| 6 | unknown tool error | Error path for non-existent tools |
| 7 | context persistence | set_context followed by search — session state holds |

---

## Results

First run: **7/7 passed** (after fixing test 7's search term from "sample" to "echo").

### Observations

- Proxy startup via Claude Code MCP is seamless — stdio transport works as expected
- 13 upstream tools + 2 meta-tools = 15 total, well under the ~20 tool degradation threshold
- Substring search works but is context-unaware — `set_context` stores state but doesn't influence `search_available_tools` results yet (Phase 3 scope)

---

## Trade-offs

### Why server-everything?

- Ships with `npx`, no config needed
- 13 diverse tools (echo, add, longRunningOperation, sampleLLM, etc.)
- Not *enough* tools to trigger context bloat — need more upstreams for Phase 3 testing

### What's missing for real dogfooding?

- No semantic filtering yet — proxy is transparent, so Claude Code sees all tools regardless of context
- Need 40+ tools across multiple servers to actually stress the "too many tools" problem
- Phase 3 (embedding index) will make dogfooding meaningful for tool selection quality

---

## Verification Criteria

1. `/dogfood-qa` produces 7/7 PASS — confirmed
2. riglm2 MCP server appears in Claude Code's tool list — confirmed
3. No stdout pollution (all logging to stderr) — confirmed
