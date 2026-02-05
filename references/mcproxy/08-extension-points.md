# Extension Points

[← Back to Index](index.md)

---

## Creating Custom ClientMiddleware

### Step 1: Define the Middleware

```rust
// src/middleware/client_middleware/my_middleware.rs

use async_trait::async_trait;
use uuid::Uuid;
use crate::middleware::{ClientMiddleware, MiddlewareResult};
use rmcp::model::{CallToolRequestParam, CallToolResult, ListToolsResult};
use rmcp::service::ServiceError;

pub struct MyClientMiddleware {
    server_name: String,
    custom_option: bool,
}

impl MyClientMiddleware {
    pub fn new(server_name: &str, config: &serde_json::Value) -> Result<Self, String> {
        let custom_option = config.get("customOption")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        Ok(Self {
            server_name: server_name.to_string(),
            custom_option,
        })
    }
}

#[async_trait]
impl ClientMiddleware for MyClientMiddleware {
    async fn before_call_tool(
        &self,
        request_id: Uuid,
        request: &CallToolRequestParam,
    ) -> MiddlewareResult {
        if self.custom_option && request.name.contains("dangerous") {
            return MiddlewareResult::Block("Blocked by custom middleware".to_string());
        }
        MiddlewareResult::Continue
    }

    async fn modify_list_tools_result(
        &self,
        _request_id: Uuid,
        result: &mut ListToolsResult,
    ) {
        // Add custom annotation to all tools
        for tool in &mut result.tools {
            if let Some(desc) = &tool.description {
                tool.description = Some(format!("{} [{}]", desc, self.server_name));
            }
        }
    }
}
```

### Step 2: Create the Factory

```rust
// In the same file or mod.rs

use crate::middleware::ClientMiddlewareFactory;
use std::sync::Arc;

pub struct MyClientFactory;

impl ClientMiddlewareFactory for MyClientFactory {
    fn create(
        &self,
        server_name: &str,
        config: &serde_json::Value,
    ) -> Result<Arc<dyn ClientMiddleware>, String> {
        let middleware = MyClientMiddleware::new(server_name, config)?;
        Ok(Arc::new(middleware))
    }

    fn middleware_type(&self) -> &'static str {
        "my_middleware"
    }
}
```

### Step 3: Register in Registry

```rust
// src/middleware/registry.rs

pub fn register_builtin_middleware(&mut self) {
    // Existing registrations...
    self.register_client(Arc::new(LoggingClientFactory));
    self.register_client(Arc::new(ToolFilterClientFactory));
    self.register_client(Arc::new(SecurityClientFactory));

    // Add your middleware
    self.register_client(Arc::new(MyClientFactory));
}
```

### Step 4: Use in Configuration

```json
{
  "httpServer": {
    "middleware": {
      "client": {
        "servers": {
          "github": [
            {
              "type": "my_middleware",
              "enabled": true,
              "config": {
                "customOption": true
              }
            }
          ]
        }
      }
    }
  }
}
```

---

## Creating Custom ProxyMiddleware

### Step 1: Define the Middleware

```rust
// src/middleware/proxy_middleware/my_proxy.rs

use async_trait::async_trait;
use crate::middleware::ProxyMiddleware;
use rmcp::model::{Tool, Prompt, Resource};
use std::any::Any;

pub struct MyProxyMiddleware {
    allowed_servers: Vec<String>,
}

impl MyProxyMiddleware {
    pub fn new(config: &serde_json::Value) -> Result<Self, String> {
        let allowed = config.get("allowedServers")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect())
            .unwrap_or_default();

        Ok(Self { allowed_servers: allowed })
    }
}

#[async_trait]
impl ProxyMiddleware for MyProxyMiddleware {
    async fn on_list_tools(&self, tools: &mut Vec<Tool>) {
        if !self.allowed_servers.is_empty() {
            tools.retain(|tool| {
                // Extract server from prefixed name
                tool.name.split("___")
                    .next()
                    .map(|server| self.allowed_servers.contains(&server.to_string()))
                    .unwrap_or(false)
            });
        }
    }

    async fn on_list_prompts(&self, prompts: &mut Vec<Prompt>) {
        // Similar filtering logic
    }

    async fn on_list_resources(&self, resources: &mut Vec<Resource>) {
        // Similar filtering logic
    }

    fn as_any(&self) -> Option<&dyn Any> {
        Some(self)
    }
}
```

### Step 2: Create the Factory

```rust
use crate::middleware::ProxyMiddlewareFactory;
use std::sync::Arc;

pub struct MyProxyFactory;

impl ProxyMiddlewareFactory for MyProxyFactory {
    fn create(&self, config: &serde_json::Value) -> Result<Arc<dyn ProxyMiddleware>, String> {
        let middleware = MyProxyMiddleware::new(config)?;
        Ok(Arc::new(middleware))
    }

    fn middleware_type(&self) -> &'static str {
        "server_filter"
    }
}
```

### Step 3: Register and Configure

```rust
// registry.rs
self.register_proxy(Arc::new(MyProxyFactory));
```

```json
{
  "proxy": [
    {
      "type": "server_filter",
      "config": {
        "allowedServers": ["github", "file-server"]
      }
    }
  ]
}
```

---

## Custom HTTP Endpoints

Add custom routes to the Axum server:

```rust
// src/http_server.rs

use axum::{Router, routing::get, extract::State};

async fn custom_status(State(proxy): State<Arc<ProxyServer>>) -> impl IntoResponse {
    let servers = proxy.servers.read().await;
    let status = servers.keys()
        .map(|name| format!("{}: connected", name))
        .collect::<Vec<_>>()
        .join("\n");
    status
}

pub fn create_router(proxy: Arc<ProxyServer>) -> Router {
    Router::new()
        .route("/mcp", post(handle_mcp_request))
        .route("/health", get(health_check))
        // Add custom endpoint
        .route("/status", get(custom_status))
        .with_state(proxy)
}
```

---

## Custom Server Connection Types

Extend `ServerConfig` for new transports:

```rust
// src/config.rs

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum ServerConfig {
    Stdio { command: String, args: Vec<String>, env: HashMap<String, String> },
    Http { url: String, authorization_token: Option<String> },
    // Add new type
    WebSocket { ws_url: String, auth_header: Option<String> },
}
```

Then handle in `proxy.rs`:

```rust
async fn connect_server(name: &str, config: &ServerConfig) -> Result<McpClient> {
    match config {
        ServerConfig::Stdio { .. } => { /* existing */ }
        ServerConfig::Http { .. } => { /* existing */ }
        ServerConfig::WebSocket { ws_url, auth_header } => {
            // Implement WebSocket connection
            todo!()
        }
    }
}
```

---

## Request/Response Hooks

For observability, add hooks to the HTTP layer:

```rust
// src/http_server.rs

use tower_http::trace::{TraceLayer, MakeSpan, OnResponse};

#[derive(Clone)]
struct McpTracer;

impl<B> MakeSpan<B> for McpTracer {
    fn make_span(&mut self, request: &http::Request<B>) -> tracing::Span {
        tracing::info_span!(
            "mcp_request",
            method = %request.method(),
            path = %request.uri().path(),
        )
    }
}

pub fn create_router(proxy: Arc<ProxyServer>) -> Router {
    Router::new()
        .route("/mcp", post(handle_mcp_request))
        .layer(TraceLayer::new_for_http().make_span_with(McpTracer))
        .with_state(proxy)
}
```

---

## Webhooks/Event Emission

Emit events from middleware:

```rust
pub struct WebhookClientMiddleware {
    webhook_url: String,
    client: reqwest::Client,
}

#[async_trait]
impl ClientMiddleware for WebhookClientMiddleware {
    async fn after_call_tool(
        &self,
        request_id: Uuid,
        result: &Result<CallToolResult, ServiceError>,
    ) {
        let event = json!({
            "type": "tool_called",
            "request_id": request_id.to_string(),
            "success": result.is_ok(),
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });

        // Fire and forget
        let _ = self.client.post(&self.webhook_url)
            .json(&event)
            .send()
            .await;
    }
}
```

---

## Extension Locations Summary

| Extension | File Location |
|-----------|---------------|
| Client Middleware | `src/middleware/client_middleware/` |
| Proxy Middleware | `src/middleware/proxy_middleware/` |
| Factory Registry | `src/middleware/registry.rs` |
| HTTP Routes | `src/http_server.rs` |
| Server Types | `src/config.rs`, `src/proxy.rs` |
| Error Types | `src/error.rs` |

---

## Extension Guidelines

1. **Use the Factory Pattern**: All middleware must have a corresponding factory
2. **Handle Config Errors Gracefully**: Return `Result` from constructors
3. **Be Async-Safe**: Use `Send + Sync` bounds, avoid blocking
4. **Log Meaningfully**: Use `tracing` for structured logging
5. **Test Independently**: Write unit tests for middleware logic
