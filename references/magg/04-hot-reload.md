# Hot Reload

[← Back to Index](index.md)

---

## Overview

Magg supports true hot-reload: only affected servers restart when configuration changes. This is the key differentiator from other MCP aggregators.

---

## Trigger Points

| Trigger | Mechanism |
|---------|-----------|
| File modification | Watchdog (inotify/FSEvents) or polling |
| SIGHUP signal | `kill -HUP <pid>` |
| MCP tool | `magg_reload_config` |
| Programmatic | `await server.reload_config()` |

---

## Complete Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. TRIGGER DETECTION                                        │
├─────────────────────────────────────────────────────────────┤
│ File Watcher:                                               │
│   WatchdogHandler.on_modified()                             │
│     └── loop.call_soon_threadsafe(reload_event.set)        │
│                                                             │
│ Signal:                                                     │
│   MaggRunner._handle_reload_signal()                        │
│     └── self._reload_event.set()                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. WATCH LOOP                                               │
├─────────────────────────────────────────────────────────────┤
│ ConfigReloader._watch_loop():                               │
│   await self._reload_event.wait()                           │
│   self._reload_event.clear()                                │
│   await asyncio.sleep(0.1)  # debounce                      │
│   await self._check_for_changes()                           │
│     └── if mtime changed: await self.reload_config()       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CONFIG RELOAD                                            │
├─────────────────────────────────────────────────────────────┤
│ ConfigReloader.reload_config():                             │
│   async with self._reload_lock:  # prevent concurrent       │
│     new_config = self._load_config()  # parse JSON          │
│     old_config = self._last_config                          │
│     change = self._detect_changes(old, new)                 │
│     if change.has_changes:                                  │
│       if self._validate_config(new):                        │
│         await self.reload_callback(change)                  │
│         self._last_config = new_config                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. APPLY CHANGES (Ordered Phases)                           │
├─────────────────────────────────────────────────────────────┤
│ ServerManager.handle_config_reload():                       │
│                                                             │
│ Phase 1: REMOVE deleted servers                             │
│   for change where action == 'remove':                      │
│     await unmount_server(name)                              │
│                                                             │
│ Phase 2: DISABLE servers                                    │
│   for change where action == 'disable':                     │
│     await unmount_server(name)                              │
│                                                             │
│ Phase 3: UPDATE modified servers                            │
│   for change where action == 'update':                      │
│     await unmount_server(name)                              │
│     await asyncio.sleep(0.1)  # cleanup grace               │
│     await mount_server(new_config)                          │
│                                                             │
│ Phase 4: ENABLE servers                                     │
│   for change where action == 'enable':                      │
│     await mount_server(new_config)                          │
│                                                             │
│ Phase 5: ADD new servers                                    │
│   for change where action == 'add':                         │
│     await mount_server(new_config)                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. NOTIFICATION PROPAGATION                                 │
├─────────────────────────────────────────────────────────────┤
│ After mount, backend emits ToolListChangedNotification:     │
│                                                             │
│ BackendMessageHandler.on_tool_list_changed(notification)    │
│   └── coordinator.handle_tool_list_changed(notif, id)      │
│         └── router.route_message(notification, id)         │
│               └── asyncio.gather(*handlers)                │
│                     └── user callback                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Change Detection

### Fields Monitored

```python
fields_to_check = [
    'source',     # Repository/package URL
    'prefix',     # Tool name prefix
    'command',    # Main command
    'args',       # Command arguments
    'uri',        # HTTP/SSE endpoint
    'env',        # Environment variables
    'cwd',        # Working directory
    'transport'   # Transport-specific config
]
```

### Action Types

| Action | Trigger |
|--------|---------|
| `add` | Server in new_config but not in old_config |
| `remove` | Server in old_config but not in new_config |
| `enable` | `enabled` changed from false to true |
| `disable` | `enabled` changed from true to false |
| `update` | Any other field changed |

---

## File Watching Modes

### Watchdog (Preferred)

- Uses inotify (Linux) or FSEvents (macOS)
- Zero CPU usage when idle
- Instant detection
- Requires `watchdog` package

### Polling (Fallback)

- Checks file mtime periodically
- Uses `MAGG_RELOAD_POLL_INTERVAL` (default: 1.0s)
- Used when watchdog unavailable

### Check Active Mode

```bash
# Look for this log message on startup:
INFO: Started config file watcher using file system notifications (watchdog)
# or
INFO: Started config file watcher using polling (interval: 1.0s)
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAGG_AUTO_RELOAD` | `true` | Enable/disable file watching |
| `MAGG_RELOAD_POLL_INTERVAL` | `1.0` | Polling interval (seconds) |
| `MAGG_RELOAD_USE_WATCHDOG` | `null` | Force watchdog on/off |
| `MAGG_READ_ONLY` | `false` | Prevent config modifications |

---

## Programmatic Trigger

```python
# Manual reload
success = await server.reload_config()

# Via config manager
success = await config_manager.reload_config()

# Ignore next file change (after programmatic save)
config_manager.ignore_next_change()
config_manager.save_config(new_config)
```

---

## Validation

Before applying changes, config is validated:

```python
def _validate_config(config: MaggConfig) -> bool:
    for name, server in config.servers.items():
        if not server.command and not server.uri:
            logger.error("Server '%s' has neither command nor uri", name)
            return False
    return True
```

Invalid configurations are rejected; existing state is preserved.

---

## Debugging

### Enable Debug Logging

```bash
export MAGG_LOG_LEVEL=DEBUG
magg serve
```

### Watch for Log Messages

```
DEBUG: Config file changed, reloading...
INFO: Config changes: + new-server, - old-server, ~ modified-server
DEBUG: Applying configuration changes...
DEBUG: Adding new server: new-server
DEBUG: Removing server: old-server
DEBUG: Updating server: modified-server
DEBUG: Configuration reload complete
```

---

## Best Practices

1. **Test configs before save**: Validate JSON syntax manually
2. **Use atomic writes**: Write to temp file, then `mv` to config path
3. **Monitor logs during reload**: Watch for errors/warnings
4. **Backup before changes**: Keep working configuration copies
5. **Gradual rollout**: Test with one server before applying broadly
