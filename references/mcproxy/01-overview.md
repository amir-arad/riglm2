# MCProxy Overview

[← Back to Index](index.md)

---

## What is MCProxy?

**MCProxy** is a Rust-based MCP proxy designed for aggregating multiple MCP servers with sophisticated middleware capabilities. Unlike simpler aggregators, it provides two distinct interception layers and built-in tool search functionality.

---

## Key Capabilities

| Capability | Description |
|------------|-------------|
| **Server Aggregation** | Combine stdio subprocesses and HTTP remote servers |
| **Two-Layer Middleware** | Separate per-server and aggregated interception |
| **Tool Search** | Tantivy-powered full-text search with BM25 scoring |
| **Security Middleware** | Regex-based tool filtering and call blocking |
| **Tool Prefixing** | Automatic `server___tool` naming to avoid conflicts |
| **Graceful Shutdown** | SIGTERM/SIGKILL with configurable timeout |

---

## Use Cases

### 1. Large Tool Set Management

When aggregating many MCP servers with 100+ tools, use tool search middleware to:
- Limit initially exposed tools to a manageable number
- Inject `search_available_tools` for discovery
- Dynamically update tool list based on search results

### 2. Per-Server Security Policies

Apply different middleware to different servers:
- Logging only for trusted internal servers
- Security regex patterns for external servers
- Tool filtering to expose only specific capabilities

### 3. Tool Curation Without UI

Use regex-based filtering for programmatic tool management:
- Allow patterns: `"^file_|^search_"` (only file and search tools)
- Disallow patterns: `"delete|remove|drop"` (no destructive tools)

### 4. MCP Gateway for Agents

Provide a single HTTP endpoint for agents to access multiple tools:
- Consistent JSON-RPC 2.0 interface
- CORS support for web-based agents
- SSE streaming for compatible tools

---

## Target Users

- **Agent Developers** needing controlled access to many tools
- **Security-Conscious Teams** requiring per-server policies
- **Platform Builders** needing stateless MCP gateway
- **Rust Developers** preferring native performance

---

## Comparison with Alternatives

### vs MetaMCP

| Aspect | MCProxy | MetaMCP |
|--------|---------|---------|
| Middleware | Two-layer, code-defined | Single pipeline, planned |
| State | Stateless | PostgreSQL |
| Tool Management | Regex + search | UI curation |
| Deployment | Single binary | Docker compose |

### vs Magg

| Aspect | MCProxy | Magg |
|--------|---------|------|
| Middleware | Full system | None |
| Hot Reload | No | Yes |
| Tool Search | Tantivy | None |
| Focus | Filtering/security | Config reloading |

---

## When to Choose MCProxy

**Choose MCProxy when:**
- You need per-server middleware configuration
- Tool search/filtering is critical
- You prefer stateless architecture
- Security policies must be code-enforced
- Performance matters (Rust native)

**Consider alternatives when:**
- You need UI-based management (MetaMCP)
- Hot reload is essential (Magg)
- You need multi-tenancy (MetaMCP)
