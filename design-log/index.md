# Design Log Index

| # | Title | Description |
|---|-------|-------------|
| 01 | [Architecture Overview](01-architecture-overview.md) | Original Pain Point: MCP clients require individual config management for each server. Tool discovery is fragmented. No dynamic capability adjustment. |
| 02 | [Platform Evaluation](02-platform-evaluation.md) | riglm2 needs a foundation for intercepting and transforming MCP messages. Evaluated existing MCP aggregators/proxies to determine build vs extend. |
| 03 | [Context Injection](03-context-injection.md) | MCP servers are context blind—they only see `tools/call` with arguments, never the user query. This is the fundamental challenge for intelligent tool selection. |
| 04 | [Embedding Strategy](04-embedding-strategy.md) | RAG-based tool selection requires embedding both queries and tools into a shared vector space for similarity search. |
| 05 | [Learning Loop](05-learning-loop.md) | riglm2's differentiator is learning from usage. The proxy observes which tools are actually called and updates its relevance model. |
| 06 | [Cold Start & Recovery](06-cold-start.md) | A learning system faces the cold start paradox: tools never surfaced → never used → never generate signal → never surfaced. |
| 07 | [Dogfood Setup](07-dogfood-setup.md) | Phase 1+2 (transparent proxy + context injection) are complete with passing smoke tests. Before starting Phase 3, we set up riglm2 to proxy its own development environment — Claude Code talks to riglm2, riglm2 proxies to upstream servers. |
| 08 | [Phase 3 Implementation Decisions](08-phase3-implementation.md) | Phase 3 implements embedding-based semantic filtering for `tools/list`, two-tier retrieval (static + dynamic), learning from usage, and cold-start handling. This log records decisions made during implementation that diverged from or refined the original design (logs 04–06). |
| 09 | [Phase 4 — Persistent Dynamic Index + Pruning](09-phase4-persistent-storage.md) | Phase 3 introduced a dynamic index that learns query-tool associations from usage. However, all learned pairs live in memory and are lost on restart. Every restart is a cold start. |
| 10 | [Phase 4 Test Validity Audit & Bug Fixes](10-phase4-test-validity-and-fixes.md) | Audit of Phase 4 integration tests found 3/4 were tautological. Rewrote with unfakeable assertions. Fixed 5 bugs: unsafe BLOB deserialization, uncached statements, non-idempotent load, crash-resilient pruning, relative path resolution. |
