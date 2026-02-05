# 01: Architecture Overview

## Background

**Naming Evolution**:
| Stage | Codename | Focus |
|-------|----------|-------|
| Initial (Early 2025) | Ghostweels | Server aggregation, LLM-native management |
| Mid 2025 | MCP Toolbox / Adaptive Context | Lifecycle management, context units |
| Current | riglm2 | RAG-based tool selection, learning from usage |

**Original Pain Point**: MCP clients require individual config management for each server. Tool discovery is fragmented. No dynamic capability adjustment.

**Core Innovation Identified Early**: LLM-native self-management—expose configuration API as MCP tools, enabling AI agents to dynamically reconfigure their own tool environment.

**Key Abstraction Shift**: From "server aggregation" to "intelligent tool selection". Aggregating everything = context bloat. Manual curation doesn't scale.

---

## Problem

### Primary: Tool Overflow
- LLM reliability degrades past ~20 tools (community consensus)
- Aggregating all tools = context bloat
- Manual curation doesn't scale

### Secondary: Context Blindness
MCP servers only see `tools/call` with arguments—never the user query.

```
User query
    → Embed query          ← MCP servers don't see this
    → Find similar contexts
    → Retrieve relevant tools
```

### Evidence of Impact
| Finding | Source |
|---------|--------|
| 85% token reduction with semantic filtering | Claude Code MCP Tool Search |
| 91% token savings with lazy hydration | SEP-1978 testing |
| 3x accuracy improvement (43% → 13% baseline) | RAG-MCP paper |

---

## Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     riglm2 Proxy                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────┐   ┌─────────────────────────────┐  │
│  │  Context Store  │   │     Embedding Index         │  │
│  │  set_context ───┼──►│  Tool descriptions          │  │
│  │  writes here    │   │  Query-tool pairs (learned) │  │
│  └─────────────────┘   └─────────────────────────────┘  │
│           │                         │                   │
│           ▼                         ▼                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │              tools/list handler                  │    │
│  │  1. Get stored context                          │    │
│  │  2. Semantic search over tool index             │    │
│  │  3. Return top-k + meta-tools                   │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │              tools/call handler                  │    │
│  │  1. Route to appropriate MCP server             │    │
│  │  2. Observe & record (context, tool) pair       │    │
│  │  3. Update relevance model                      │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Meta-tools exposed:                                    │
│  • set_context(query, intent)                          │
│  • search_available_tools(query)                       │
│  • enable_tool_group(group)                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
          │                                    │
          ▼                                    ▼
   ┌────────────┐                      ┌────────────┐
   │ MCP Server │  ...                 │ MCP Server │
   │     1      │                      │     N      │
   └────────────┘                      └────────────┘
```

---

## Implementation Plan

**Phase 1**: Transparent proxy (pass-through, no filtering)
- TypeScript/Bun setup
- MCP SDK integration
- Basic routing to multiple servers

**Phase 2**: Context injection
- `set_context` meta-tool
- Per-session context store
- `search_available_tools` meta-tool

**Phase 3**: Embedding index
- Tool description embeddings
- Semantic search on `tools/list`
- Top-k filtering

**Phase 4**: Learning loop
- Observe `tools/call` events
- Record (context, tool) pairs
- Update embedding index with learned pairs

**Phase 5**: Analytics & tuning
- Cold start detection
- Confidence thresholds
- Multi-turn persistence strategy

---

## Trade-offs

### Transparent vs Explicit
- **Ideal**: Transparent proxy (client doesn't know)
- **Reality**: Learning requires observing tool calls = man-in-the-middle that learns
- **Resolution**: Architecturally reconcilable but distinct modes

---

## Verification Criteria

1. **Token reduction**: Measure context size before/after filtering
2. **Retrieval accuracy**: Does semantic search return tools the LLM actually uses?
3. **Cold start recovery**: Can `search_available_tools` surface missed tools?
4. **Learning signal quality**: Do (context, tool) pairs improve future retrieval?
5. **Multi-turn coherence**: Does Claude maintain access to tools it needs across turns?

---

## References

| Document | Purpose |
|----------|---------|
| [mission.md](../references/mission.md) | Solution approach and core mechanisms |
| [product-seed.md](../references/product-seed.md) | Vision and feature roadmap |
| [solution1-design.md](../references/solution1-design.md) | Hexagonal architecture for Tool Context Optimizer |
| [context-aware-tools-selection.md](../references/context-aware-tools-selection.md) | RAG research findings |
