# MetaMCP Knowledge Base

> **Repository**: https://github.com/metatool-ai/metamcp
> **Documentation**: https://docs.metamcp.com
> **Last Updated**: 2026-02-02

---

## Quick Reference

**MetaMCP** is a unified MCP proxy that aggregates multiple MCP servers into a single endpoint with middleware support.

| Feature | Description |
|---------|-------------|
| Server Aggregation | Combine multiple MCP servers into namespaces |
| Multi-transport | SSE, Streamable HTTP, OpenAPI endpoints |
| Authentication | API keys, OAuth 2.0, OIDC/SSO |
| Multi-tenancy | Private/public scopes |
| Tool Curation | Enable/disable and override tools |

---

## Documentation Index

### Fundamentals

| File | Description | When to Read |
|------|-------------|--------------|
| [01-overview.md](01-overview.md) | Capabilities, use cases | Starting point |
| [02-architecture.md](02-architecture.md) | Tech stack, ports, system diagram | Understanding internals |
| [03-core-concepts.md](03-core-concepts.md) | Servers, Namespaces, Endpoints, Middleware | Core mental model |

### Technical Reference

| File | Description | When to Read |
|------|-------------|--------------|
| [04-database-schema.md](04-database-schema.md) | PostgreSQL/Drizzle tables | Database queries, extensions |
| [05-api-reference.md](05-api-reference.md) | tRPC routers, REST endpoints | Building integrations |
| [06-transport-protocols.md](06-transport-protocols.md) | SSE, Streamable HTTP, OpenAPI | Client configuration |
| [07-authentication.md](07-authentication.md) | API keys, OAuth, OIDC | Security setup |

### Extension & Customization

| File | Description | When to Read |
|------|-------------|--------------|
| [08-extension-points.md](08-extension-points.md) | Official & unofficial hooks | Customizing MetaMCP |

### Operations

| File | Description | When to Read |
|------|-------------|--------------|
| [09-deployment.md](09-deployment.md) | Docker, Nginx, requirements | Production setup |
| [10-configuration.md](10-configuration.md) | Environment variables, settings | Configuration |
| [11-integrations.md](11-integrations.md) | Cursor, Claude Desktop, agents | Client setup |
| [12-performance.md](12-performance.md) | Cold start, sessions, optimization | Performance tuning |
| [13-troubleshooting.md](13-troubleshooting.md) | Common issues, debugging | Problem solving |

---

## Quick Links

### Common Tasks

- **Set up MetaMCP**: [09-deployment.md](09-deployment.md)
- **Configure Cursor/Claude**: [11-integrations.md](11-integrations.md)
- **Add authentication**: [07-authentication.md](07-authentication.md)
- **Extend functionality**: [08-extension-points.md](08-extension-points.md)
- **Optimize performance**: [12-performance.md](12-performance.md)

### Key Concepts

- **MCP Server Types**: STDIO, SSE, STREAMABLE_HTTP → [03-core-concepts.md](03-core-concepts.md)
- **Tool Naming**: `{ServerName}__{toolName}` → [03-core-concepts.md](03-core-concepts.md)
- **API Key Format**: `sk_mt_xxx` → [07-authentication.md](07-authentication.md)
- **Default Ports**: 12008 (app), 12009 (backend), 9433 (postgres) → [02-architecture.md](02-architecture.md)

### External Resources

- [GitHub Repository](https://github.com/metatool-ai/metamcp)
- [Official Docs](https://docs.metamcp.com)
- [MCP Specification](https://spec.modelcontextprotocol.io)
- [Discord Community](https://discord.gg/mNsyat7mFX)
