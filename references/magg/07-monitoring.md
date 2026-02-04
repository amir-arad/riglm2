# Monitoring

[← Back to Index](index.md)

---

## Overview

Magg provides several approaches for monitoring server health, reload events, and tool execution. This document covers both built-in capabilities and creative extensions.

---

## Built-in Monitoring

### Health Check Tool

```python
# Via MCP tool
result = await client.call_tool("magg_check", {
    "action": "report",   # report, remount, unmount, or disable
    "timeout": 2.0        # Health check timeout in seconds
})
```

**Response:**
```json
{
    "action": "report",
    "servers": {
        "calculator": {
            "name": "calculator",
            "enabled": true,
            "mounted": true,
            "healthy": true,
            "prefix": "calc"
        },
        "broken-server": {
            "name": "broken-server",
            "enabled": true,
            "mounted": false,
            "healthy": false,
            "prefix": "broken",
            "error": "Connection timeout"
        }
    },
    "summary": {
        "total": 2,
        "healthy": 1,
        "unhealthy": 1,
        "actions_taken": 0
    }
}
```

### Status Tool

```python
result = await client.call_tool("magg_status")
```

Returns current server configurations and mount status.

---

## Notification State Inspection

Track which servers have emitted notifications:

```python
# Access coordinator's notification state
state = await mcp._message_coordinator.get_notification_state()
# Returns: {
#   'tool_changes': {'server1', 'server2'},
#   'resource_changes': {'server1'},
#   'prompt_changes': set()
# }
```

---

## Programmatic Health Checks

```python
# Check each mounted server
for name, mounted in server_manager.mounted_servers.items():
    try:
        async with mounted.client:
            tools = await mounted.client.list_tools()
            print(f"{name}: {len(tools)} tools, healthy")
    except Exception as e:
        print(f"{name}: unhealthy - {e}")
```

---

## Creative Monitoring Approaches

### 1. Config Reload Metrics

```python
from magg.reload import ConfigReloader
import time

class MetricsConfigReloader(ConfigReloader):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.metrics = {
            "reload_count": 0,
            "last_reload_duration": None,
            "failed_reloads": 0,
            "last_reload_time": None,
        }

    async def reload_config(self):
        start = time.time()
        self.metrics["last_reload_time"] = start

        result = await super().reload_config()

        self.metrics["reload_count"] += 1
        self.metrics["last_reload_duration"] = time.time() - start

        if result is None:
            self.metrics["failed_reloads"] += 1

        return result

    def get_metrics(self):
        return self.metrics.copy()
```

### 2. Tool Call Instrumentation

```python
from magg.proxy.server import ProxyFastMCP
import time

# Metrics storage
call_metrics = {
    "calls": [],
    "errors": [],
}

original_proxy_tool = ProxyFastMCP._proxy_tool

async def instrumented_proxy_tool(self, action, a_type, args, path, **kwargs):
    start = time.time()
    metric = {
        "action": action,
        "type": a_type,
        "path": path,
        "timestamp": start,
    }

    try:
        result = await original_proxy_tool(self, action, a_type, args, path, **kwargs)
        metric["duration"] = time.time() - start
        metric["status"] = "success"
        call_metrics["calls"].append(metric)
        return result
    except Exception as e:
        metric["duration"] = time.time() - start
        metric["status"] = "error"
        metric["error"] = str(e)
        call_metrics["calls"].append(metric)
        call_metrics["errors"].append(metric)
        raise

ProxyFastMCP._proxy_tool = instrumented_proxy_tool

# Get metrics
def get_call_metrics():
    return {
        "total_calls": len(call_metrics["calls"]),
        "total_errors": len(call_metrics["errors"]),
        "recent_calls": call_metrics["calls"][-10:],
        "recent_errors": call_metrics["errors"][-10:],
    }
```

### 3. Message Throughput Tracking

```python
from magg.messaging import MessageRouter
import time
from collections import deque

# Sliding window metrics
message_window = deque(maxlen=1000)

original_route = MessageRouter.route_message

async def tracked_route(self, message, server_id=None):
    message_window.append({
        "timestamp": time.time(),
        "server_id": server_id,
        "type": type(message).__name__,
    })
    return await original_route(self, message, server_id)

MessageRouter.route_message = tracked_route

# Calculate throughput
def get_message_throughput(window_seconds=60):
    now = time.time()
    recent = [m for m in message_window if now - m["timestamp"] < window_seconds]
    return len(recent) / window_seconds  # messages per second
```

### 4. External File Watcher Monitor

```bash
# Monitor config changes externally
inotifywait -m -e modify ~/.magg/config.json | while read path action file; do
    timestamp=$(date +%Y-%m-%dT%H:%M:%S)
    echo "$timestamp: Config modified, expecting reload"

    # Optional: send to monitoring system
    curl -X POST http://localhost:9090/metrics \
        -d "magg_config_change_total 1"
done
```

### 5. Prometheus Metrics Exporter

```python
from prometheus_client import Counter, Histogram, Gauge, start_http_server

# Define metrics
reload_counter = Counter('magg_reload_total', 'Total config reloads')
reload_errors = Counter('magg_reload_errors_total', 'Failed config reloads')
reload_duration = Histogram('magg_reload_duration_seconds', 'Reload duration')
mounted_servers = Gauge('magg_mounted_servers', 'Number of mounted servers')
tool_calls = Counter('magg_tool_calls_total', 'Tool calls', ['action', 'type', 'server'])

# Instrument reload
from magg.reload import ConfigReloader

original_reload = ConfigReloader.reload_config

async def prometheus_reload(self):
    with reload_duration.time():
        result = await original_reload(self)

    reload_counter.inc()
    if result is None:
        reload_errors.inc()

    return result

ConfigReloader.reload_config = prometheus_reload

# Start metrics server
start_http_server(9090)
```

### 6. Structured Logging

```python
import logging
import json

class JSONFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "extra": getattr(record, "extra", {}),
        })

# Configure Magg logger
logger = logging.getLogger("magg")
handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger.addHandler(handler)
logger.setLevel(logging.DEBUG)
```

---

## Monitoring Dashboard Data

### Server Health Summary

```python
async def get_health_summary(server_manager):
    summary = {
        "total_servers": len(server_manager.config.servers),
        "enabled_servers": len(server_manager.config.get_enabled_servers()),
        "mounted_servers": len(server_manager.mounted_servers),
        "servers": []
    }

    for name, server in server_manager.config.servers.items():
        status = {
            "name": name,
            "prefix": server.prefix,
            "enabled": server.enabled,
            "mounted": name in server_manager.mounted_servers,
            "healthy": False,
        }

        if status["mounted"]:
            try:
                mounted = server_manager.mounted_servers[name]
                async with mounted.client:
                    tools = await mounted.client.list_tools()
                    status["healthy"] = True
                    status["tool_count"] = len(tools)
            except Exception as e:
                status["error"] = str(e)

        summary["servers"].append(status)

    return summary
```

### Reload History

```python
from dataclasses import dataclass
from datetime import datetime
from collections import deque

@dataclass
class ReloadEvent:
    timestamp: datetime
    changes: list
    success: bool
    duration: float

reload_history = deque(maxlen=100)

# Track in reload callback
async def tracking_reload_callback(config_change):
    start = datetime.now()
    try:
        await original_callback(config_change)
        success = True
    except Exception:
        success = False
        raise
    finally:
        reload_history.append(ReloadEvent(
            timestamp=start,
            changes=[c.name for c in config_change.server_changes],
            success=success,
            duration=(datetime.now() - start).total_seconds(),
        ))
```

---

## Health Check Endpoints

For HTTP mode, expose health endpoints:

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/health/servers")
async def server_health():
    return await get_health_summary(server_manager)

@app.get("/metrics")
async def metrics():
    return {
        "reload_count": metrics_reloader.metrics["reload_count"],
        "call_metrics": get_call_metrics(),
        "message_throughput": get_message_throughput(),
    }
```

---

## Alerting Patterns

### 1. Unhealthy Server Alert

```python
async def check_and_alert():
    summary = await get_health_summary(server_manager)

    unhealthy = [s for s in summary["servers"] if not s["healthy"]]
    if unhealthy:
        await send_alert(
            title="Unhealthy Magg Servers",
            message=f"{len(unhealthy)} servers unhealthy: {[s['name'] for s in unhealthy]}"
        )
```

### 2. Reload Failure Alert

```python
async def alerting_reload_callback(config_change):
    try:
        await original_callback(config_change)
    except Exception as e:
        await send_alert(
            title="Magg Reload Failed",
            message=f"Config reload failed: {e}"
        )
        raise
```

### 3. High Error Rate Alert

```python
def check_error_rate():
    metrics = get_call_metrics()
    if metrics["total_calls"] > 0:
        error_rate = metrics["total_errors"] / metrics["total_calls"]
        if error_rate > 0.1:  # 10% error rate
            send_alert(
                title="High Magg Error Rate",
                message=f"Error rate: {error_rate:.1%}"
            )
```
