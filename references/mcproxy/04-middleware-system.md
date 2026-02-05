# Middleware System

[← Back to Index](index.md)

---

## Two-Layer Architecture

MCProxy's middleware system has two distinct layers:

```
┌─────────────────────────────────────────────────────────────┐
│                     ProxyMiddleware                          │
│  Operates on aggregated results from ALL servers             │
│  - Filter/transform final tool list                          │
│  - Inject synthetic tools (e.g., search)                     │
│  - Modify descriptions/metadata                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    ClientMiddleware                          │
│  Per-server interception (different config per server)       │
│  - Block/allow specific tool calls                           │
│  - Log operations per server                                 │
│  - Security pattern matching                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    [Individual MCP Servers]
```

---

## ClientMiddleware

Intercepts operations on **individual** MCP servers.

### Trait Definition

```rust
#[async_trait]
pub trait ClientMiddleware: Send + Sync {
    // Tool listing hooks
    async fn before_list_tools(&self, request_id: Uuid) {}
    async fn after_list_tools(&self, request_id: Uuid, result: &Result<ListToolsResult, ServiceError>) {}
    async fn modify_list_tools_result(&self, request_id: Uuid, result: &mut ListToolsResult) {}

    // Tool call hooks
    async fn before_call_tool(&self, request_id: Uuid, request: &CallToolRequestParam) -> MiddlewareResult {
        MiddlewareResult::Continue
    }
    async fn after_call_tool(&self, request_id: Uuid, result: &Result<CallToolResult, ServiceError>) {}

    // Similar hooks for prompts and resources...
}
```

### MiddlewareResult Enum

```rust
pub enum MiddlewareResult {
    Continue,           // Proceed with operation
    Block(String),      // Stop with error message
}
```

### Execution Order

For a chain `[A, B, C]`:
1. `A.before_*()` → `B.before_*()` → `C.before_*()` → **operation**
2. `C.after_*()` → `B.after_*()` → `A.after_*()` (reverse order)
3. Any `Block` result stops the chain immediately

### Built-in ClientMiddleware

| Name | Purpose |
|------|---------|
| `logging` | Log all operations with timing |
| `tool_filter` | Regex-based allow/disallow patterns |
| `security` | Block calls matching dangerous patterns |

---

## ProxyMiddleware

Operates on **aggregated** results from all servers.

### Trait Definition

```rust
#[async_trait]
pub trait ProxyMiddleware: Send + Sync {
    async fn on_list_tools(&self, tools: &mut Vec<Tool>);
    async fn on_list_prompts(&self, prompts: &mut Vec<Prompt>);
    async fn on_list_resources(&self, resources: &mut Vec<Resource>);

    // Optional: Enable downcasting for special handling
    fn as_any(&self) -> Option<&dyn Any> { None }
}
```

### Key Difference from ClientMiddleware

- **ClientMiddleware**: Can block operations, runs per-server
- **ProxyMiddleware**: Mutates final results, runs once on aggregation

### Built-in ProxyMiddleware

| Name | Purpose |
|------|---------|
| `description_enricher` | Appends "(via mcproxy)" to descriptions |
| `tool_search` | Tantivy-powered search with selective exposure |

---

## Middleware Configuration

### Config Structure

```json
{
  "httpServer": {
    "middleware": {
      "proxy": [
        // ProxyMiddleware list (applied to aggregated results)
        { "type": "tool_search", "enabled": true, "config": {...} }
      ],
      "client": {
        "default": [
          // Default ClientMiddleware for all servers
          { "type": "logging", "enabled": true, "config": {} }
        ],
        "servers": {
          // Per-server overrides (REPLACE default, don't merge)
          "github": [
            { "type": "security", "enabled": true, "config": {...} }
          ]
        }
      }
    }
  }
}
```

### Override Behavior

**Important**: Server-specific middleware **replaces** defaults, it doesn't merge.

```json
{
  "client": {
    "default": [
      { "type": "logging" }
    ],
    "servers": {
      "github": [
        // This REPLACES default, github won't have logging
        { "type": "security" }
      ]
    }
  }
}
```

To keep logging AND add security:
```json
{
  "servers": {
    "github": [
      { "type": "logging" },
      { "type": "security" }
    ]
  }
}
```

---

## MiddlewareManager

Factory-based middleware instantiation:

```rust
pub struct MiddlewareManager {
    client_registry: HashMap<String, Arc<dyn ClientMiddlewareFactory>>,
    proxy_registry: HashMap<String, Arc<dyn ProxyMiddlewareFactory>>,
}
```

### Factory Traits

```rust
pub trait ClientMiddlewareFactory: Send + Sync {
    fn create(&self, server_name: &str, config: &serde_json::Value)
        -> Result<Arc<dyn ClientMiddleware>>;
    fn middleware_type(&self) -> &'static str;
}

pub trait ProxyMiddlewareFactory: Send + Sync {
    fn create(&self, config: &serde_json::Value)
        -> Result<Arc<dyn ProxyMiddleware>>;
    fn middleware_type(&self) -> &'static str;
}
```

---

## Middleware Flow Diagram

```
tools/list Request
        │
        ▼
┌───────────────────────────────────────────────────────┐
│ For each server:                                       │
│   1. ClientMiddleware.before_list_tools()             │
│   2. MCP Server.list_tools()                          │
│   3. ClientMiddleware.after_list_tools()              │
│   4. ClientMiddleware.modify_list_tools_result()      │
└───────────────────────────────────────────────────────┘
        │
        ▼ (tools from all servers)
┌───────────────────────────────────────────────────────┐
│ ProxyMiddleware.on_list_tools(&mut aggregated_tools)  │
└───────────────────────────────────────────────────────┘
        │
        ▼
   Return to client
```

```
tools/call Request
        │
        ▼
┌───────────────────────────────────────────────────────┐
│ 1. Extract server from prefixed tool name              │
│ 2. ClientMiddleware.before_call_tool()                │
│    → If Block, return error immediately               │
│ 3. MCP Server.call_tool()                             │
│ 4. ClientMiddleware.after_call_tool()                 │
└───────────────────────────────────────────────────────┘
        │
        ▼
   Return to client
```

---

## Enabled Flag

All middleware configs support `enabled` flag:

```json
{
  "type": "logging",
  "enabled": false,  // Disabled, will be skipped
  "config": {}
}
```

Default is `true` if not specified.
