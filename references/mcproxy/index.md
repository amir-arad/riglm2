# MCProxy Knowledge Base

> **Repository**: https://github.com/igrigorik/MCProxy
> **Local Path**: /data/Workspace/MCProxy
> **Last Updated**: 2026-02-05

---

## Quick Reference

**MCProxy** is a Rust-based MCP proxy with a sophisticated two-layer middleware system for tool management, security, and searchability across multiple upstream servers.

| Feature | Description |
|---------|-------------|
| Server Aggregation | Combine stdio and HTTP MCP servers |
| Two-Layer Middleware | ClientMiddleware (per-server) + ProxyMiddleware (aggregated) |
| Tool Search | Tantivy-powered full-text search with selective exposure |
| Security Middleware | Regex-based tool filtering and call blocking |
| Tool Name Prefixing | `server___tool` format for conflict avoidance |

---

## Key Differentiators (vs MetaMCP/Magg)

| Aspect | MCProxy | MetaMCP | Magg |
|--------|---------|---------|------|
| **Middleware** | Two-layer (client + proxy) | Single pipeline | None |
| **Tool Filtering** | Built-in regex + search | Via curation UI | None |
| **Tool Search** | Tantivy full-text | None | None |
| **Per-Server Config** | Native middleware overrides | Via namespaces | None |
| **Language** | Rust | TypeScript | TypeScript |
| **Database** | None (stateless) | PostgreSQL | None |

---

## Documentation Index

### Fundamentals

| File | Description | When to Read |
|------|-------------|--------------|
| [01-overview.md](01-overview.md) | Capabilities, use cases | Starting point |
| [02-architecture.md](02-architecture.md) | System diagram, tech stack | Understanding internals |
| [03-core-concepts.md](03-core-concepts.md) | Tool prefixing, routing | Core mental model |

### Middleware System

| File | Description | When to Read |
|------|-------------|--------------|
| [04-middleware-system.md](04-middleware-system.md) | Two-layer architecture | Understanding middleware |
| [05-client-middleware.md](05-client-middleware.md) | Logging, filtering, security | Per-server interception |
| [06-proxy-middleware.md](06-proxy-middleware.md) | Description enricher, search | Aggregated transformations |
| [07-tool-search.md](07-tool-search.md) | Tantivy search deep dive | Tool discovery |

### Extension & Operations

| File | Description | When to Read |
|------|-------------|--------------|
| [08-extension-points.md](08-extension-points.md) | Custom middleware creation | Extending MCProxy |
| [09-configuration.md](09-configuration.md) | JSON config, env vars | Setup and tuning |
| [10-integration.md](10-integration.md) | Client configuration | Connecting clients |
| [11-troubleshooting.md](11-troubleshooting.md) | Common issues, debugging | Problem solving |

---

## Quick Links

### Common Tasks

- **Configure servers**: [09-configuration.md](09-configuration.md)
- **Add tool filtering**: [05-client-middleware.md](05-client-middleware.md)
- **Enable tool search**: [07-tool-search.md](07-tool-search.md)
- **Create custom middleware**: [08-extension-points.md](08-extension-points.md)
- **Connect Claude/Cursor**: [10-integration.md](10-integration.md)

### Key Concepts

- **Tool Naming**: `{server_name}___{tool_name}` → [03-core-concepts.md](03-core-concepts.md)
- **Middleware Layers**: ClientMiddleware vs ProxyMiddleware → [04-middleware-system.md](04-middleware-system.md)
- **Search Tool**: `search_available_tools` → [07-tool-search.md](07-tool-search.md)
- **Default Port**: 8080 → [02-architecture.md](02-architecture.md)

### External Resources

- [GitHub Repository](https://github.com/igrigorik/MCProxy)
- [MCP Specification](https://spec.modelcontextprotocol.io)
