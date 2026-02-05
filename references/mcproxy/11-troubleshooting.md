# Troubleshooting

[← Back to Index](index.md)

---

## Common Issues

### Server Won't Start

**Symptom**: MCProxy exits immediately after starting

**Check**:
1. Config file exists and is valid JSON
2. Port is not already in use
3. STDIO servers have valid commands

```bash
# Validate JSON
jq . config.json

# Check port
lsof -i :8080

# Test server command manually
npx @modelcontextprotocol/server-filesystem /tmp
```

---

### Server Connection Failed

**Symptom**: Error like `Connection { server: "github", message: "..." }`

**Possible Causes**:

1. **STDIO server**: Command not found
   ```bash
   # Test the command
   which npx
   npx @modelcontextprotocol/server-filesystem --help
   ```

2. **HTTP server**: Network/auth issue
   ```bash
   # Test endpoint
   curl -H "Authorization: Bearer $TOKEN" https://mcp.example.com/health
   ```

3. **Environment variables**: Not set
   ```bash
   # Check env var expansion
   echo $GITHUB_TOKEN
   ```

---

### Tools Not Appearing

**Symptom**: `tools/list` returns empty or missing tools

**Possible Causes**:

1. **Tool Filter middleware**: Check `allow`/`disallow` patterns
   ```json
   // Check this isn't filtering everything
   { "type": "tool_filter", "config": { "allow": "^impossible_" } }
   ```

2. **Tool Search middleware**: `maxToolsLimit` too low
   ```json
   // Increase limit or disable search
   { "type": "tool_search", "config": { "maxToolsLimit": 100 } }
   ```

3. **Server error**: Check server logs
   ```bash
   RUST_LOG=debug mcproxy -c config.json
   ```

---

### Tool Calls Blocked

**Symptom**: Tool calls fail with "Blocked by..." message

**Cause**: Security middleware pattern matched

**Debug**:
```bash
# Check logs for blocked calls
RUST_LOG=debug mcproxy -c config.json 2>&1 | grep BLOCKED
```

**Fix**: Adjust security rules
```json
{
  "type": "security",
  "config": {
    "rules": [
      {
        "name": "overly_broad_rule",
        "enabled": false  // Disable problematic rule
      }
    ]
  }
}
```

---

### Slow Performance

**Symptom**: Tool calls take too long

**Possible Causes**:

1. **Upstream server slow**: Test directly
   ```bash
   time curl -X POST http://upstream-server/mcp -d '{"method":"tools/list"}'
   ```

2. **Too many tools indexed**: Check search middleware
   ```bash
   # Log shows index size
   🔍 Index size: 500 tools, rebuild: 150ms
   ```

3. **Network issues**: Check latency
   ```bash
   ping mcp.example.com
   ```

---

### CORS Errors

**Symptom**: Browser shows CORS error

**Check Config**:
```json
{
  "httpServer": {
    "corsEnabled": true,
    "corsOrigins": ["http://localhost:3000"]  // Add your origin
  }
}
```

**Test CORS Headers**:
```bash
curl -v -X OPTIONS http://localhost:8080/mcp \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST"
```

---

### Memory Issues

**Symptom**: MCProxy uses excessive memory

**Possible Causes**:

1. **Too many tools indexed**: Tantivy index grows with tools
2. **Connection leaks**: Check server count

**Monitor**:
```bash
# Memory usage
ps aux | grep mcproxy

# Active connections (if available)
curl http://localhost:8080/status
```

---

## Debug Logging

Enable detailed logging:

```bash
# All components
RUST_LOG=debug mcproxy -c config.json

# Specific modules
RUST_LOG=mcproxy::proxy=debug,mcproxy::middleware=trace mcproxy -c config.json

# HTTP requests only
RUST_LOG=tower_http=debug mcproxy -c config.json
```

### Log Levels

| Level | Use For |
|-------|---------|
| `error` | Failures only |
| `warn` | Warnings and errors |
| `info` | Normal operation |
| `debug` | Troubleshooting |
| `trace` | Deep debugging |

---

## Testing Tools

### Test JSON-RPC Endpoint

```bash
# List tools
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'

# Call a tool
curl -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "memory___store",
      "arguments": {"key": "test", "value": "hello"}
    }
  }'
```

### Test with jq

```bash
curl -s -X POST http://localhost:8080/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
  | jq '.result.tools | length'
```

---

## Graceful Shutdown Issues

**Symptom**: Orphan STDIO processes after MCProxy exit

**Debug**:
```bash
# Find orphan processes
ps aux | grep mcp-server

# Check process tree
pstree -p $(pgrep mcproxy)
```

**Fix**: Increase shutdown timeout
```json
{
  "httpServer": {
    "shutdownTimeout": 15
  }
}
```

Or manually kill:
```bash
pkill -f "mcp-server"
```

---

## Common Error Messages

| Error | Meaning | Fix |
|-------|---------|-----|
| `Invalid configuration` | JSON parse error | Validate JSON syntax |
| `Connection refused` | Server not running | Start upstream server |
| `Server not found: xxx` | Invalid tool prefix | Check server names |
| `Permission denied` | File/network access | Check permissions |
| `Parse error (-32700)` | Invalid JSON-RPC | Check request format |

---

## Getting Help

1. **Check logs**: `RUST_LOG=debug`
2. **Validate config**: `jq . config.json`
3. **Test manually**: Use curl commands above
4. **Check upstream**: Test MCP servers directly
5. **File issue**: [GitHub Issues](https://github.com/igrigorik/MCProxy/issues)
