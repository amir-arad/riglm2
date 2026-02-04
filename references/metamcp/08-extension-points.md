# Extension Points

[← Back to Index](index.md)

---

## Official Extension Points

### 1. Custom Middleware (Planned)

**Status:** Under active development

**Concept:**
```typescript
interface McpMiddleware {
  name: string;
  priority: number;

  // Process outgoing request
  onRequest?(request: McpRequest): Promise<McpRequest>;

  // Process incoming response
  onResponse?(response: McpResponse): Promise<McpResponse>;

  // Filter tools list
  onListTools?(tools: Tool[]): Promise<Tool[]>;
}
```

**Built-in Examples:**
- `filter-inactive-tools` - Remove disabled tools from responses
- `request-logging` - Log all MCP requests (planned)
- `rate-limiting` - Throttle requests (planned)

---

### 2. Tool Overrides

Override tool metadata per namespace without modifying source servers.

**Storage:** `namespace_tool_mappings` table

**Available Overrides:**
```json
{
  "override_name": "custom_tool_name",
  "override_title": "Human Readable Title",
  "override_description": "Custom description",
  "override_annotations": {
    "readOnlyHint": true,
    "destructiveHint": false,
    "customField": "value"
  }
}
```

---

### 3. Custom Dockerfile

Extend the base image with custom dependencies:

```dockerfile
FROM ghcr.io/metatool-ai/metamcp:latest

# Python dependencies
RUN pip install requests beautifulsoup4

# System packages
RUN apt-get update && apt-get install -y \
    curl git \
    && rm -rf /var/lib/apt/lists/*

# Node.js packages
RUN npm install -g some-mcp-package
```

---

### 4. Environment Variable Interpolation

Reference container environment in server configs:

```json
{
  "env": {
    "API_KEY": "${API_KEY}",
    "SECRET": "${MY_SECRET}"
  }
}
```

---

## Unofficial Extension Points

### 1. Direct Database Access

Connect to PostgreSQL for custom queries:

```bash
postgresql://metamcp_user:m3t4mcp@localhost:9433/metamcp_db
```

**Warning:** Direct modifications may cause cache inconsistencies.

---

### 2. Custom tRPC Procedures

Fork and add custom procedures:

```typescript
// apps/backend/src/trpc/custom.impl.ts
export const customImplementations = {
  myProcedure: protectedProcedure
    .input(z.object({ ... }))
    .mutation(async ({ ctx, input }) => {
      // Custom logic
    }),
};
```

---

### 3. MCP Server Pool Hooks

```typescript
const pool = McpServerPool.getInstance();

// Monitor status
const status = pool.getPoolStatus();

// Manual cleanup
await pool.cleanupSession(sessionId);

// Invalidate after config changes
await pool.invalidateIdleSession(serverUuid, newParams);

// Reset error state
await pool.resetServerErrorState(serverUuid);
```

---

### 4. Custom Transport Handlers

Create Express routers for custom transport:

```typescript
// apps/backend/src/routers/custom-transport/index.ts
import express from "express";

const customRouter = express.Router();

customRouter.post("/:endpoint_name/custom", async (req, res) => {
  // Custom transport implementation
});

export default customRouter;
```

Mount in `apps/backend/src/index.ts`:
```typescript
app.use("/custom", customRouter);
```

---

### 5. Webhook/Event Hooks

Implement custom event emission by modifying repositories:

```typescript
async function createServer(data) {
  const result = await db.insert(mcpServersTable).values(data);

  // Emit custom event
  await fetch(process.env.WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({ event: 'server.created', data: result })
  });

  return result;
}
```

---

### 6. Pre-request Processing

Modify `api-key-oauth.middleware.ts` for custom auth:

```typescript
// apps/backend/src/middleware/api-key-oauth.middleware.ts
export const authenticateApiKey = async (req, res, next) => {
  // Custom logic: IP whitelist, custom tokens
  // ...
};
```

---

### 7. Tool Response Transformation

Modify MetaMCP server for response transformation:

```typescript
const transformedResponse = await middleware.process(
  originalResponse,
  { namespace, tool, request }
);
```

---

## Extension Locations Summary

| Extension | File/Location |
|-----------|---------------|
| tRPC procedures | `apps/backend/src/trpc/*.impl.ts` |
| Transport handlers | `apps/backend/src/routers/` |
| Auth middleware | `apps/backend/src/middleware/` |
| Server pool | `apps/backend/src/lib/metamcp/mcp-server-pool.ts` |
| Database schema | `apps/backend/src/db/schema.ts` |
| Repositories | `apps/backend/src/db/repositories/` |
