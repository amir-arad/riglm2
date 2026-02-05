# riglm2

Adaptive tool selection for MCP. A transparent proxy that learns tool relevance from usage patterns.

## Quick Context

- **Problem**: MCP clients face context bloat when aggregating many tools. LLM performance degrades past ~20 tools.
- **Solution**: RAG-based tool filtering—embed queries, find similar contexts, surface relevant tools.
- **Core Challenge**: MCP servers are blind to conversation context (only see `tools/call`, not user queries).

## Key Documents

| Document | Purpose |
|----------|---------|
| [design-log/index.md](design-log/index.md) | **Start here each session**. Index of all design logs. |
| [references/mission.md](references/mission.md) | Solution approach and core mechanisms |
| [references/product-seed.md](references/product-seed.md) | Vision and feature roadmap |
| [references/solution1-design.md](references/solution1-design.md) | Hexagonal architecture for Tool Context Optimizer |

## Design Logs

Design logs live in `./design-log/` with an index. Each log follows the structure:

**Background → Problem → Questions and Answers → Design → Implementation Plan → Trade-offs → Verification Criteria**

| # | Title | Focus |
|---|-------|-------|
| 01 | Architecture Overview | Core problem, high-level design |
| 02 | Platform Evaluation | MCProxy vs MetaMCP vs Magg |
| 03 | Context Injection | `set_context` pattern |
| 04 | Embedding Strategy | What to embed, model choices |
| 05 | Learning Loop | Observing usage, updating index |
| 06 | Cold Start & Recovery | Escape valves, thresholds |

## Reference Knowledge Bases

Generated documentation for upstream projects:

| Directory | Project | Key Files |
|-----------|---------|-----------|
| `references/metamcp/` | MetaMCP aggregator | `01-overview.md`, `08-extension-points.md` |
| `references/magg/` | Magg hot-reload aggregator | `01-overview.md`, `04-hot-reload.md` |
| `references/mcproxy/` | igrigorik/MCProxy | `01-overview.md`, `04-middleware-system.md` |

## Current Architecture Direction

Proxy-based semantic filtering with meta-tools for context injection:

```mermaid
flowchart LR
    MCP[MCP Client] <--> Proxy[riglm2 Proxy] <--> SRV[MCP Servers]

    Proxy --- CTX[set_context\nLLM provides context]
    Proxy --- SEARCH[search_tools\nFallback discovery]
    Proxy --- EMB[Embedding Index\nTool descriptions + learned pairs]
    Proxy --- STORE[Context Store\nPer-session state]
```

## Tech Stack

- TypeScript / Bun
- MCP SDK for protocol handling
- Vector store for embeddings (TBD: local vs API)
- SQLite/PostgreSQL for analytics

## Commands

```bash
# Development
bun install                    # Install dependencies
bun run dev                    # Dev server with hot reload
bun test                       # Run all tests
bun run start                  # Run from source

# Quality checks
bun run typecheck              # TypeScript type checking
bun run lint                   # ESLint (includes no-comments rule)
bun run format                 # Prettier formatting
bun run deadcode               # Find unused exports (knip)
bun run circular               # Check for circular dependencies

# Production
bun run build                  # Build to dist/
```

## Coding Standards

- **No comments** — enforced by ESLint. Only `WHY:`, `TODO`, `@ts-`, `eslint` prefixes allowed
- **No `any`** — use `unknown` and narrow with Zod
- **Named exports only** — no `default export`
- **Zod validation** — all external data validated with Zod schemas
- **No dead code** — enforced by knip (`bun run deadcode`)
- **No circular deps** — enforced by madge (`bun run circular`)
- **Strict TypeScript** — `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`
- **Logging** — all to stderr via `log.ts`; stdout reserved for MCP protocol

## Skills

Project includes skills in `.claude/skills/`:
- `writing-plans` — structured implementation plan authoring
- `executing-plans` — batch execution with review checkpoints
- `using-superpowers` — skill discovery and enforcement
- `mcp-testing` — MCP server testing patterns (unit, integration, e2e)
- `dogfood-qa` — QA via Claude Code's own MCP connection to riglm2 (also available as `/dogfood-qa` command)
