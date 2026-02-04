# Troubleshooting

[← Back to Index](index.md)

---

## Common Issues

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:12008
```

**Solutions:**
- Check Docker container status: `docker ps`
- Verify port mapping in docker-compose.yml
- Ensure `APP_URL` matches access URL
- Check firewall rules

---

### Session Not Found

```
Error: Session xyz not found
```

**Solutions:**
- Session expired or cleaned up → Reconnect client
- Check `session_lifetime` config
- Verify `mcp-session-id` header is sent correctly

---

### API Key Invalid

```
Error: Invalid API key
```

**Solutions:**
- Verify key format starts with `sk_mt_`
- Check key is active in dashboard
- Ensure correct header: `Authorization: Bearer sk_mt_xxx`
- Try `X-API-Key` header instead

---

### SSE Connection Drops

**Solutions:**
Configure nginx properly:
```nginx
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;
proxy_set_header Connection '';
proxy_http_version 1.1;
proxy_set_header X-Accel-Buffering 'no';
```

---

### CORS Errors

```
Access-Control-Allow-Origin error
```

**Solutions:**
- Ensure `APP_URL` matches the URL you're accessing from
- Access only via the configured `APP_URL`
- Don't use localhost if `APP_URL` is set to domain

---

### Server Won't Start

**Common causes:**
- Missing dependencies (use custom Dockerfile)
- Incorrect command or arguments
- Environment variables not set
- Network issues (for SSE/Streamable HTTP servers)

**Debug steps:**
1. Check server logs in MetaMCP dashboard
2. Test command manually in terminal
3. Verify environment variables
4. Check network connectivity

---

### OAuth Infinite Redirect

**Solutions:**
- Verify `OIDC_DISCOVERY_URL` is correct
- Ensure redirect URI is registered: `${APP_URL}/api/auth/oauth2/callback/oidc`
- Check OIDC provider logs
- Verify scopes are supported

---

## Debug Mode

Enable verbose logging:

```bash
DEBUG=* docker compose up
```

Or set in container:
```yaml
environment:
  DEBUG: "*"
```

---

## Health Checks

```bash
# Basic health
curl http://localhost:12008/health

# Session status
curl http://localhost:12008/metamcp/{endpoint}/mcp/health/sessions

# Database connection (via psql)
psql postgresql://metamcp_user:m3t4mcp@localhost:9433/metamcp_db -c "SELECT 1"
```

---

## Log Locations

| Component | Location |
|-----------|----------|
| Docker logs | `docker compose logs -f` |
| App logs | Container stdout |
| Nginx logs | `/var/log/nginx/` |
| PostgreSQL | Container stdout |

---

## Reset Error State

If a server is marked as crashed:

```typescript
const pool = McpServerPool.getInstance();
await pool.resetServerErrorState(serverUuid);
```

Or via tRPC (restart from UI).

---

## Database Issues

### Check connection
```bash
docker exec metamcp-pg pg_isready -U metamcp_user -d metamcp_db
```

### Reset database
```bash
docker compose down -v
docker compose up -d
```

**Warning:** This deletes all data.

---

## Network Debugging

```bash
# Test from inside container
docker exec metamcp curl -I http://localhost:12009/health

# Test external connectivity
curl -I http://localhost:12008/health

# Check ports
netstat -tlnp | grep -E '12008|12009|9433'
```

---

## Getting Help

- [GitHub Issues](https://github.com/metatool-ai/metamcp/issues)
- [Discord Community](https://discord.gg/mNsyat7mFX)
- [Official Docs](https://docs.metamcp.com)
