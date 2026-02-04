# Troubleshooting

[← Back to Index](index.md)

---

## Known Issues

### 1. Race Condition in Config Reload

**Severity:** Critical

**Location:** `magg/reload.py:247-289`

**Issue:** Tool calls can start during config reload, seeing inconsistent state.

```python
async def reload_config(self):
    async with self._reload_lock:  # Only protects reload, not tool calls
        new_config = self._load_config()  # T1
        # RACE WINDOW: tool call may read old mounted_servers
        change = self._detect_changes(old, new)  # T2
        # RACE WINDOW: tool call sees inconsistent state
        await self.reload_callback(change)  # T3
```

**Symptoms:**
- Tool calls fail during reload
- Stale server state observed
- Intermittent errors

**Mitigation:**
```python
# Add read-write lock around tool calls
from asyncio import Lock

class SafeProxyFastMCP(ProxyFastMCP):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._rw_lock = Lock()

    async def _proxy_tool(self, *args, **kwargs):
        async with self._rw_lock:  # Read lock
            return await super()._proxy_tool(*args, **kwargs)
```

---

### 2. Connection Pooling Absence

**Severity:** Medium

**Location:** `magg/proxy/mixin.py:180-196`

**Issue:** Each proxy call creates/destroys connection.

```python
async def _proxy_list(self, capability_type):
    client = await self._get_proxy_backend_client()
    async with client:  # Opens connection
        result = await client.list_tools()
    # Connection CLOSED - no reuse
    return result, result_type
```

**Symptoms:**
- High latency for rapid calls
- Connection overhead

**Mitigation:** Consider caching client connections.

---

### 3. Notification State Memory Leak

**Severity:** Low (long-running only)

**Location:** `magg/messaging.py:107`

**Issue:** Notification state never cleared.

```python
self._notification_state.setdefault("tool_changes", set()).add(server_id)
# Never cleared - grows unbounded
```

**Symptoms:**
- Memory growth over long sessions
- Slow `get_notification_state()` calls

**Mitigation:**
```python
# Periodically clear notification state
async def clear_notification_state():
    async with coordinator._lock:
        coordinator._notification_state.clear()
```

---

### 4. Exception Swallowing in Message Routing

**Severity:** Medium

**Location:** `magg/messaging.py:86-89`

**Issue:** Handler exceptions silently captured.

```python
await asyncio.gather(
    *[handler(message) for handler in handlers_to_call],
    return_exceptions=True  # Exceptions silently captured
)
```

**Symptoms:**
- Handler failures invisible
- No error notifications
- Silent data loss

**Mitigation:**
```python
# Custom router with error logging
async def route_message(self, message, server_id=None):
    results = await asyncio.gather(
        *[handler(message) for handler in handlers_to_call],
        return_exceptions=True
    )
    for result in results:
        if isinstance(result, Exception):
            logger.error(f"Handler failed: {result}")
```

---

### 5. Signal Handler Race

**Severity:** Low

**Location:** `magg/server/runner.py:65-73`

**Issue:** SIGHUP can fire during shutdown.

```python
def _handle_signal(self, signum, frame):
    self._shutdown_event.set()
    signal.signal(signal.SIGINT, signal.SIG_IGN)  # Too late if SIGHUP pending
```

**Symptoms:**
- Reload fires during shutdown
- Unexpected behavior on termination

---

### 6. FastMCP Unmount Workaround

**Severity:** Medium

**Location:** `magg/server/manager.py:151-190`

**Issue:** No official FastMCP unmount method; uses internal access.

```python
def _unmount_from_fastmcp(self, server_name: str) -> bool:
    """This is a workaround until FastMCP provides an official unmount method."""
    # Directly manipulates _tool_manager._mounted_servers
```

**Symptoms:**
- May break with FastMCP updates
- Potential incomplete cleanup

---

### 7. Environment Variable Side Effects

**Severity:** Low

**Location:** `magg/settings.py:267-281`

**Issue:** Config loading modifies `os.environ`.

```python
@model_validator(mode='after')
def export_environment_variables(self) -> 'MaggConfig':
    os.environ['MAGG_LOG_LEVEL'] = self.log_level or 'INFO'
```

**Symptoms:**
- Child processes inherit unexpected env
- Hard to override settings

---

## Common Problems

### Server Won't Mount

**Symptoms:**
- Server not appearing in tool list
- Mount fails silently

**Troubleshooting:**

1. Check server is enabled:
   ```json
   { "enabled": true }
   ```

2. Verify command or uri:
   ```bash
   # Test command manually
   npx -y @example/mcp-server
   ```

3. Check logs:
   ```bash
   MAGG_LOG_LEVEL=DEBUG magg serve
   ```

4. Verify config syntax:
   ```bash
   python -c "import json; json.load(open('~/.magg/config.json'))"
   ```

---

### Hot Reload Not Working

**Symptoms:**
- Config changes not detected
- Server state unchanged after edit

**Troubleshooting:**

1. Check auto-reload enabled:
   ```bash
   echo $MAGG_AUTO_RELOAD  # Should be "true" or unset
   ```

2. Verify file permissions:
   ```bash
   ls -la ~/.magg/config.json
   ```

3. Check watchdog installed:
   ```bash
   python -c "import watchdog; print('OK')"
   ```

4. Try manual reload:
   ```bash
   kill -HUP $(pgrep -f "magg serve")
   ```

5. Check logs for reload messages:
   ```
   INFO: Config file changed, reloading...
   ```

---

### Authentication Failures

**Symptoms:**
- Connection refused
- 401 Unauthorized

**Troubleshooting:**

1. Check key exists:
   ```bash
   ls ~/.ssh/magg/magg.key
   ```

2. Generate keys if missing:
   ```bash
   magg auth keygen
   ```

3. Verify token:
   ```bash
   magg auth token
   ```

4. Check client has token:
   ```bash
   export MAGG_JWT=$(magg auth token)
   ```

---

### Tool Calls Fail

**Symptoms:**
- Tool not found
- Call returns error

**Troubleshooting:**

1. List available tools:
   ```python
   tools = await client.list_tools()
   for t in tools:
       print(t.name)
   ```

2. Check prefix:
   ```
   # Tool name format: {prefix}_{toolName}
   # e.g., calc_add, not just add
   ```

3. Verify server is mounted:
   ```python
   result = await client.call_tool("magg_status")
   ```

4. Check server health:
   ```python
   result = await client.call_tool("magg_check", {"action": "report"})
   ```

---

### High Memory Usage

**Symptoms:**
- Memory grows over time
- OOM errors

**Troubleshooting:**

1. Clear notification state periodically:
   ```python
   coordinator._notification_state.clear()
   ```

2. Check for handler leaks:
   ```python
   len(router._global_handlers)
   len(router._handlers)
   ```

3. Unmount unused servers:
   ```python
   await client.call_tool("magg_disable_server", {"name": "unused"})
   ```

---

### Slow Tool Calls

**Symptoms:**
- High latency
- Timeout errors

**Troubleshooting:**

1. Check server health:
   ```python
   await client.call_tool("magg_check", {"timeout": 2.0})
   ```

2. Reduce mounted servers:
   ```
   # Fewer servers = faster aggregation
   ```

3. Check network for HTTP servers:
   ```bash
   curl -v http://localhost:8000/mcp
   ```

---

## Debug Logging

Enable debug logging for detailed information:

```bash
export MAGG_LOG_LEVEL=DEBUG
magg serve
```

Key log messages to look for:

```
# Server mounting
DEBUG: Attempting to mount server calculator (enabled=True)
DEBUG: Mounted server calculator with prefix 'calc'

# Config reload
DEBUG: Config file changed, reloading...
INFO: Config changes: + new-server, - old-server
DEBUG: Configuration reload complete

# Tool calls
DEBUG: Proxy call: list tool
DEBUG: Proxy call: call tool calc_add

# Errors
ERROR: Failed to mount server xyz: Connection refused
ERROR: Config reload failed: Invalid JSON
```

---

## Getting Help

1. **Check logs** with `MAGG_LOG_LEVEL=DEBUG`
2. **Search GitHub issues**: https://github.com/sitbon/magg/issues
3. **Read documentation**: https://github.com/sitbon/magg/tree/main/docs
4. **Open an issue** with:
   - Magg version (`magg --version`)
   - Python version
   - Config file (sanitized)
   - Error logs
   - Steps to reproduce
