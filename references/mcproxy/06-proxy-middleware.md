# Proxy Middleware Reference

[← Back to Index](index.md)

---

## Overview

ProxyMiddleware operates on **aggregated** results from all servers. It runs once after tools/prompts/resources are collected from all upstream servers.

Unlike ClientMiddleware, ProxyMiddleware:
- Cannot block operations (mutates results only)
- Runs on the final aggregated list
- Is server-agnostic

---

## Description Enricher Middleware

Appends "(via mcproxy)" to all tool descriptions.

### Type Name
`description_enricher`

### Configuration

```json
{
  "type": "description_enricher",
  "enabled": true,
  "config": {}
}
```

### Effect

```
Before: "Create a new GitHub issue"
After:  "Create a new GitHub issue (via mcproxy)"
```

### Use Cases
- Visual indication of proxied tools
- Debugging tool origins
- Demo/documentation purposes

### Implementation

```rust
async fn on_list_tools(&self, tools: &mut Vec<Tool>) {
    for tool in tools.iter_mut() {
        if let Some(desc) = &tool.description {
            tool.description = Some(format!("{} (via mcproxy)", desc));
        }
    }
}
```

---

## Tool Search Middleware

Tantivy-powered full-text search with selective tool exposure.

### Type Name
`tool_search`

### Configuration

```json
{
  "type": "tool_search",
  "enabled": true,
  "config": {
    "maxToolsLimit": 50,
    "searchThreshold": 0.1,
    "toolSelectionOrder": ["server_priority", "alphabetical"]
  }
}
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `maxToolsLimit` | Integer | 50 | Max tools exposed initially |
| `searchThreshold` | Float | 0.1 | BM25 relevance score cutoff |
| `toolSelectionOrder` | Array | ["server_priority"] | Selection strategy |

### Detailed Documentation

See [07-tool-search.md](07-tool-search.md) for comprehensive coverage.

---

## Middleware Ordering

ProxyMiddleware is applied in configuration order:

```json
{
  "proxy": [
    { "type": "description_enricher" },  // Applied first
    { "type": "tool_search" }            // Applied second
  ]
}
```

**Order matters!**

If `description_enricher` runs first, search indexes include "(via mcproxy)" in descriptions. If `tool_search` runs first, descriptions won't have the suffix when indexed.

### Recommended Order

1. **tool_search** (first) - Index original descriptions for better search
2. **description_enricher** (second) - Modify for display

```json
{
  "proxy": [
    { "type": "tool_search" },
    { "type": "description_enricher" }
  ]
}
```

---

## Creating Custom ProxyMiddleware

See [08-extension-points.md](08-extension-points.md) for full guide.

### Quick Example

```rust
pub struct MyProxyMiddleware {
    prefix: String,
}

#[async_trait]
impl ProxyMiddleware for MyProxyMiddleware {
    async fn on_list_tools(&self, tools: &mut Vec<Tool>) {
        // Filter to only tools matching prefix
        tools.retain(|t| t.name.starts_with(&self.prefix));
    }

    async fn on_list_prompts(&self, _prompts: &mut Vec<Prompt>) {
        // No modification
    }

    async fn on_list_resources(&self, _resources: &mut Vec<Resource>) {
        // No modification
    }
}
```

---

## as_any() Method

The `as_any()` method enables special handling:

```rust
fn as_any(&self) -> Option<&dyn Any> {
    Some(self)
}
```

### Use Case: Tool Search Special Handling

The HTTP server needs to access `ToolSearchMiddleware` directly:

```rust
// In http_server.rs
if let Some(search_middleware) = proxy_middleware
    .iter()
    .find_map(|m| m.as_any()?.downcast_ref::<ToolSearchMiddleware>())
{
    // Special handling for search_available_tools
    return search_middleware.handle_search(query).await;
}
```

Without `as_any()`, you can only call trait methods. With it, you can access middleware-specific functionality.

---

## Proxy Middleware vs Client Middleware

| Aspect | ProxyMiddleware | ClientMiddleware |
|--------|-----------------|------------------|
| **Scope** | All servers combined | Per-server |
| **When** | After aggregation | During server calls |
| **Can Block** | No | Yes |
| **Access To** | Final tool list | Individual server ops |
| **Use Case** | Global transformations | Server-specific policies |

### Example: Same Goal, Different Approaches

**Goal**: Remove all "debug_" tools

**ProxyMiddleware approach:**
```rust
async fn on_list_tools(&self, tools: &mut Vec<Tool>) {
    tools.retain(|t| !t.name.contains("debug_"));
}
```

**ClientMiddleware approach:**
```json
{
  "type": "tool_filter",
  "config": { "disallow": "debug_" }
}
```

**Difference**: ClientMiddleware runs per-server and can have different configs. ProxyMiddleware is simpler for universal filtering.
