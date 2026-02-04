# MetaMCP Overview

[← Back to Index](index.md)

---

## What is MetaMCP?

**MetaMCP** is a unified MCP (Model Context Protocol) aggregator, orchestrator, middleware, and gateway packaged in a single Docker container. It dynamically aggregates multiple MCP servers into a unified endpoint and applies middleware transformations.

---

## Key Capabilities

| Capability | Description |
|------------|-------------|
| **Server Aggregation** | Combine multiple MCP servers into namespaces |
| **Dynamic Routing** | Route requests to appropriate backend servers |
| **Middleware Pipeline** | Intercept/transform MCP requests and responses |
| **Multi-transport Support** | SSE, Streamable HTTP, OpenAPI endpoints |
| **Multi-tenancy** | Private/public scopes with user-owned resources |
| **Session Management** | Pre-allocated idle sessions for cold-start optimization |
| **Tool Curation** | Enable/disable tools, override names/descriptions |

---

## Use Cases

### 1. MCP Server Hosting
Group servers into namespaces with public endpoints (SSE or Streamable HTTP) with authentication. One-click namespace switching for endpoints.

### 2. Tool Curation
Pick specific tools when remixing MCP servers. Apply pluggable middleware for observability and security.

### 3. Enhanced MCP Inspector
Debug servers with saved configurations. Inspect MetaMCP endpoints in-house to verify functionality.

### 4. MCP Context Engineering
Build agents on dynamically composed MCP infrastructure. Use as foundation for agent development.

---

## Target Users

- **Developers** building agents that need multiple MCP tools
- **Teams** sharing curated tool collections
- **Enterprises** requiring centralized MCP management with auth
- **Platform builders** needing MCP gateway infrastructure
