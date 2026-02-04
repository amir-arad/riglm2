# Magg Overview

[← Back to Index](index.md)

---

## What is Magg?

**Magg** is a Python-based meta-MCP server that aggregates multiple MCP servers into a unified interface with true hot-reload capabilities and LLM-driven self-extension.

Unlike traditional MCP aggregators that require restart or pre-staged namespace switching, Magg allows adding, removing, and updating MCP servers mid-session with only affected servers restarting.

---

## Key Capabilities

| Capability | Description |
|------------|-------------|
| **Hot-Reload** | Edit config → servers reload automatically (watchdog/SIGHUP) |
| **LLM Self-Extension** | LLM can discover and add servers via `magg_search_servers` → `magg_add_server` |
| **Unified Proxy** | Single `proxy` tool provides access to all capabilities |
| **Kit System** | Bundle related servers for atomic load/unload |
| **Message Routing** | Aggregate notifications from all backend servers |
| **Hybrid Mode** | Run stdio and HTTP simultaneously |

---

## Magg vs MetaMCP

| Aspect | Magg | MetaMCP |
|--------|------|---------|
| **Language** | Python | TypeScript |
| **Hot-Reload** | True (only affected servers restart) | Pre-staged namespace switching |
| **Mid-session Server Add** | Native via MCP tools | Requires namespace reconfiguration |
| **Extension Mechanism** | Monkey-patching, subclassing | SDK, middleware pipeline |
| **Config Management** | File-based + MCP tools | Web UI + API |
| **Auth** | Bearer tokens (JWT/RSA) | API keys, OAuth 2.0, OIDC |
| **Maturity** | Newer, smaller community | More established |

---

## Use Cases

### 1. Development Experimentation
Hot-add MCP servers during development without restart. Test new servers, swap implementations, compare alternatives.

### 2. LLM-Driven Tool Discovery
Let the LLM autonomously discover and add servers from catalogs (glama.ai, GitHub, NPM) based on task requirements.

### 3. Kit Bundles
Package related servers (e.g., "web-tools" = playwright + fetch + browser) for quick load/unload.

### 4. Unified Tool Access
Single `proxy` tool provides list/info/call for all tools, resources, and prompts across all mounted servers.

---

## Target Users

- **Developers** experimenting with multiple MCP servers
- **Researchers** building adaptive agent systems
- **Teams** needing dynamic tool composition
- **Projects** requiring in-process MCP aggregation (Python)

---

## Quick Start

```bash
# Install
pip install magg

# Create config
mkdir -p ~/.magg
cat > ~/.magg/config.json << 'EOF'
{
  "servers": {
    "calculator": {
      "source": "https://github.com/modelcontextprotocol/servers",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-calculator"],
      "prefix": "calc"
    }
  }
}
EOF

# Run
magg serve
```

---

## Architecture Summary

```
MaggRunner (lifecycle + signals)
  └── MaggServer (tools registration)
        └── ServerManager
              ├── ConfigManager (persistence + reload)
              ├── ProxyFastMCP (aggregator)
              └── mounted_servers: Dict[str, MountedServer]
```

See [02-architecture.md](02-architecture.md) for details.
