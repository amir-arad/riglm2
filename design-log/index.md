# Design Log Index

## Core Architecture

| # | Title | Description |
|---|-------|-------------|
| 01 | [Architecture Overview](01-architecture-overview.md) | Core problem, high-level design, verification criteria |
| 02 | [Platform Evaluation](02-platform-evaluation.md) | MCProxy vs MetaMCP vs Magg vs FastMCP analysis |

## Context & Filtering

| # | Title | Description |
|---|-------|-------------|
| 03 | [Context Injection](03-context-injection.md) | The `set_context` tool pattern for solving context blindness |
| 04 | [Embedding Strategy](04-embedding-strategy.md) | What to embed, model choices, index structure |

## Learning & Recovery

| # | Title | Description |
|---|-------|-------------|
| 05 | [Learning Loop](05-learning-loop.md) | Observing tool calls, recording pairs, updating relevance |
| 06 | [Cold Start & Recovery](06-cold-start.md) | Cold start paradox, `search_available_tools`, thresholds |

## Implementation

| # | Title | Description |
|---|-------|-------------|
| 08 | [Phase 3 Implementation](08-phase3-implementation.md) | Embedding choice (fastembed), two-tier retrieval, learning signals, cold start |

## Dogfooding

| # | Title | Description |
|---|-------|-------------|
| 07 | [Dogfood Setup](07-dogfood-setup.md) | Self-hosting riglm2 via Claude Code MCP, QA skill, 7/7 baseline |
