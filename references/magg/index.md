# Magg Knowledge Base

> **Repository**: https://github.com/sitbon/magg
> **Documentation**: https://github.com/sitbon/magg/tree/main/docs
> **Last Updated**: 2026-02-02

---

## Quick Reference

**Magg** is a Python-based meta-MCP server that provides true hot-reload capabilities, LLM-driven self-extension, and unified proxy access to multiple MCP servers.

| Feature | Description |
|---------|-------------|
| Hot-Reload | True hot-reload via file watcher (watchdog/inotify) or SIGHUP |
| LLM Self-Extension | Discover and add servers mid-session via MCP tools |
| Unified Proxy | Single `proxy` tool for all tools/resources/prompts |
| Kit System | Bundle related servers for easy load/unload |
| Message Routing | Aggregate notifications from all backends |

---

## Documentation Index

### Fundamentals

| File | Description | When to Read |
|------|-------------|--------------|
| [01-overview.md](01-overview.md) | Capabilities, use cases, vs MetaMCP | Starting point |
| [02-architecture.md](02-architecture.md) | Class hierarchy, key files | Understanding internals |
| [03-core-concepts.md](03-core-concepts.md) | Servers, Proxies, Kits, Prefixes | Core mental model |

### Technical Reference

| File | Description | When to Read |
|------|-------------|--------------|
| [04-hot-reload.md](04-hot-reload.md) | Complete reload flow | Understanding dynamic updates |
| [05-messaging.md](05-messaging.md) | Notification routing, handlers | Real-time updates |
| [06-extension-points.md](06-extension-points.md) | Hooks, monkey-patching | Customizing Magg |
| [07-monitoring.md](07-monitoring.md) | Health checks, metrics | Observability |

### Operations

| File | Description | When to Read |
|------|-------------|--------------|
| [08-configuration.md](08-configuration.md) | Environment variables, config files | Setup |
| [09-integration.md](09-integration.md) | In-process, subprocess, hybrid | Using Magg in projects |
| [10-troubleshooting.md](10-troubleshooting.md) | Known issues, race conditions | Problem solving |

---

## Quick Links

### Common Tasks

- **Install Magg**: `pip install magg` or `uv pip install magg`
- **Run in stdio mode**: `magg serve`
- **Run in HTTP mode**: `magg serve --http --port 8000`
- **Run in hybrid mode**: `magg serve --hybrid --port 8000`
- **Trigger reload**: `kill -HUP $(pgrep -f "magg serve")`

### Key Concepts

- **Proxy Tool**: `proxy` action=list/info/call, type=tool/resource/prompt
- **Tool Naming**: `{prefix}_{toolName}` (e.g., `playwright_browser_navigate`)
- **Config Path**: `~/.magg/config.json` (or `MAGG_CONFIG_PATH`)
- **Kit Directory**: `~/.magg/kit.d/*.json`

### MCP Tools (Self-Management)

| Tool | Purpose |
|------|---------|
| `magg_search_servers` | Search MCP catalog for servers |
| `magg_add_server` | Add new server to config |
| `magg_remove_server` | Remove server from config |
| `magg_enable_server` | Enable disabled server |
| `magg_disable_server` | Disable server without removing |
| `magg_reload_config` | Trigger config reload |
| `magg_status` | Get server status |
| `magg_check` | Health check mounted servers |
| `magg_load_kit` | Load a kit bundle |
| `magg_unload_kit` | Unload a kit bundle |

### External Resources

- [GitHub Repository](https://github.com/sitbon/magg)
- [PyPI Package](https://pypi.org/project/magg/)
- [FastMCP](https://github.com/jlowin/fastmcp) (dependency)
- [MCP Specification](https://spec.modelcontextprotocol.io)
