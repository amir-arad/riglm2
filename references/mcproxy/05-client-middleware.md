# Client Middleware Reference

[← Back to Index](index.md)

---

## Overview

ClientMiddleware runs **per-server**, intercepting all MCP operations before they reach the upstream server. Each server can have different middleware configurations.

---

## Logging Middleware

Logs all operations with timing and emoji indicators.

### Type Name
`logging`

### Configuration

```json
{
  "type": "logging",
  "enabled": true,
  "config": {
    "level": "info"
  }
}
```

### Log Output Examples

```
🔧 [github] Listing tools... (request: abc123)
✅ [github] Listed 15 tools in 45ms
📞 [github] Calling tool: create_issue (request: def456)
✅ [github] Tool call completed in 230ms
❌ [file-server] Tool call failed: Permission denied
```

### Use Cases
- Debugging server communication
- Performance monitoring
- Audit logging

---

## Tool Filter Middleware

Filters tools using regex patterns on tool names.

### Type Name
`tool_filter`

### Configuration

```json
{
  "type": "tool_filter",
  "enabled": true,
  "config": {
    "allow": "^file_|^search_",
    "disallow": "delete|remove|drop"
  }
}
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `allow` | String (regex) | If set, **only** matching tools are kept |
| `disallow` | String (regex) | Matching tools are removed |

### Priority

`allow` takes precedence over `disallow`:

1. If `allow` is set, start with only matching tools
2. Then apply `disallow` to remove any remaining matches

### Examples

**Only file operations:**
```json
{ "allow": "^(read|write|list)_file$" }
```

**Exclude dangerous tools:**
```json
{ "disallow": "(?i)(delete|remove|drop|truncate)" }
```

**Specific tool set:**
```json
{
  "allow": "create_issue|list_issues|get_issue",
  "disallow": "delete_issue"
}
```

### How It Works

The middleware modifies `ListToolsResult`:

```rust
async fn modify_list_tools_result(&self, _: Uuid, result: &mut ListToolsResult) {
    result.tools.retain(|tool| {
        let allowed = self.allow_pattern
            .as_ref()
            .map(|p| p.is_match(&tool.name))
            .unwrap_or(true);

        let disallowed = self.disallow_pattern
            .as_ref()
            .map(|p| p.is_match(&tool.name))
            .unwrap_or(false);

        allowed && !disallowed
    });
}
```

---

## Security Middleware

Blocks tool calls matching dangerous patterns in name + arguments.

### Type Name
`security`

### Configuration

```json
{
  "type": "security",
  "enabled": true,
  "config": {
    "rules": [
      {
        "name": "no_system_commands",
        "description": "Block dangerous system commands",
        "pattern": "(?i)(rm\\s+-rf|sudo\\s+|passwd)",
        "block_message": "System commands not allowed",
        "enabled": true
      },
      {
        "name": "no_sensitive_files",
        "description": "Block access to sensitive files",
        "pattern": "(?i)(\\.env|credentials|secrets|password)",
        "block_message": "Access to sensitive files blocked",
        "enabled": true
      }
    ]
  }
}
```

### Rule Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | String | Yes | Unique rule identifier |
| `description` | String | No | Human-readable description |
| `pattern` | String | Yes | Regex pattern to match |
| `block_message` | String | Yes | Error message when blocked |
| `enabled` | Boolean | No | Default: true |

### Pattern Matching

Patterns are matched against:
```
{tool_name} {json_serialized_arguments}
```

Example: Tool call `execute_command({"cmd": "rm -rf /"})` becomes:
```
execute_command {"cmd": "rm -rf /"}
```

### Default Rules

The security middleware includes sensible defaults:

```json
{
  "rules": [
    {
      "name": "system_commands",
      "pattern": "(?i)(rm\\s+-rf|sudo|passwd|chmod\\s+777)",
      "block_message": "Potentially dangerous system command blocked"
    },
    {
      "name": "sensitive_files",
      "pattern": "(?i)(/etc/passwd|/etc/shadow|\\.ssh/|id_rsa)",
      "block_message": "Access to sensitive system files blocked"
    },
    {
      "name": "network_commands",
      "pattern": "(?i)(curl.*\\|.*sh|wget.*\\|.*bash|nc\\s+-e)",
      "block_message": "Potentially dangerous network command blocked"
    }
  ]
}
```

### Blocking Behavior

When a pattern matches, `before_call_tool` returns:

```rust
MiddlewareResult::Block(format!(
    "Security: {} - {}",
    rule.name,
    rule.block_message
))
```

This stops the middleware chain and returns an error to the client.

### Logging

Blocked calls are logged for security monitoring:
```
🚫 [github] BLOCKED: execute_command - no_system_commands
   Pattern matched: rm\\s+-rf
   Arguments: {"cmd": "rm -rf /tmp/*"}
```

---

## Combining Middleware

A server can have multiple middleware in sequence:

```json
{
  "servers": {
    "github": [
      { "type": "logging" },
      {
        "type": "tool_filter",
        "config": { "disallow": "delete_" }
      },
      {
        "type": "security",
        "config": { "rules": [...] }
      }
    ]
  }
}
```

**Execution order:**
1. Logging: Log the incoming request
2. Tool Filter: Remove disallowed tools from list
3. Security: Check call against patterns, potentially block

---

## Best Practices

### Use Tool Filter for Broad Filtering
```json
{ "disallow": "(?i)delete|remove|drop" }
```

### Use Security for Pattern-Based Blocking
```json
{
  "rules": [{
    "pattern": "(?i)(DROP TABLE|DELETE FROM|TRUNCATE)",
    "block_message": "SQL destructive operations blocked"
  }]
}
```

### Layer Defenses
1. **Tool Filter**: Removes tools from the list entirely
2. **Security**: Catches dynamic content in arguments

A filtered tool can't be called. But if a tool passes the filter, security middleware provides the second layer by checking arguments.
