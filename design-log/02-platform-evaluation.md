# 02: Platform Evaluation

## Background

riglm2 needs a foundation for intercepting and transforming MCP messages. Evaluated existing MCP aggregators/proxies to determine build vs extend.

---

## Problem

**Q**: Build on existing platform or implement from scratch in TypeScript?

---

## Questions and Answers

### What does riglm2 actually need?
- Middleware pipeline for intercepting `tools/list` and `tools/call`
- Structured extension points for analytics hooks
- Session state management
- Programmatic customization (not live server management)

### Why not Magg?

**Magg's killer features** (that don't apply to riglm2):
- LLM-driven self-extension (`magg_search_servers` → `magg_add_server`)
- True hot-reload (only affected servers restart)
- File-based config with watchdog

**Magg's weaknesses** (for riglm2's use case):
- "Monkey-patching, subclassing" extensibility vs proper middleware
- No hooks for `tools/list` interception
- Hot-reload solves a different problem than intelligent filtering

### Why not MetaMCP?

**MetaMCP strengths**:
- Good aggregation model
- SDK and middleware pipeline

**MetaMCP weaknesses**:
- Filtering is roadmap-only, not implemented
- Aggregation-focused, not filtering-focused

### Why MCProxy looks promising?

Research uncovered igrigorik/MCProxy with:
- **ClientMiddleware**: Per-server call interception
- **ProxyMiddleware**: Aggregated tool filtering
- **Built-in tool search**: Limits initial list, provides search functionality

Architecturally closer to riglm2's needs than MetaMCP or Magg.

**Caveat**: Rust implementation, language mismatch with solution1-design.ts

### Why FastMCP is also viable?

- Python, programmable `on_list_tools` hook
- Direct control over tool filtering logic
- Simpler than MCProxy but less performant

---

## Design

### Platform Assessment Matrix

| Platform | Fit | Reasoning |
|----------|-----|-----------|
| **igrigorik/MCProxy** | High | Middleware designed for filtering, Rust performance |
| **FastMCP** | High | Python, programmable `on_list_tools` hook |
| **MetaMCP** | Medium | Aggregation good, filtering via roadmap only |
| **Magg** | Low | Hot-reload solves different problem; no middleware hooks |

### Decision

**TBD**. Options:
1. Build on MCProxy (Rust) — best architecture, language mismatch
2. Build on FastMCP (Python) — good hooks, Python ecosystem
3. Build from scratch (TypeScript) — full control, more work

---

## Trade-offs

### MCProxy (Rust)
- ✅ Best middleware architecture
- ✅ Performance
- ❌ Language mismatch with solution1-design
- ❌ Steeper learning curve

### FastMCP (Python)
- ✅ `on_list_tools` hook
- ✅ Familiar ecosystem
- ❌ Python performance
- ❌ Less structured than MCProxy

### From Scratch (TypeScript)
- ✅ Full control
- ✅ Matches solution1-design
- ❌ More implementation work
- ❌ Reinventing solved problems

---

## References

| Document | Purpose |
|----------|---------|
| [mcproxy/](../references/mcproxy/) | MCProxy knowledge base |
| [metamcp/](../references/metamcp/) | MetaMCP knowledge base |
| [magg/](../references/magg/) | Magg knowledge base |
