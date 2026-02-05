import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "./tool-registry.js";
import type { UpstreamManager } from "./upstream-manager.js";
import type { SessionStore } from "./session-store.js";
import {
  getMetaToolDefinitions,
  isMetaTool,
  handleMetaTool,
} from "./meta-tools.js";
import { log } from "./log.js";

const DEFAULT_SESSION = "default";

export function createProxyServer(
  name: string,
  registry: ToolRegistry,
  upstream: UpstreamManager,
  sessionStore: SessionStore
): Server {
  const server = new Server(
    { name, version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const upstreamTools = registry.getAllTools();
    const metaTools = getMetaToolDefinitions();
    log.debug(
      `tools/list: ${upstreamTools.length} upstream + ${metaTools.length} meta`
    );
    return { tools: [...upstreamTools, ...metaTools] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: toolName, arguments: args } = request.params;
    log.debug(`tools/call: ${toolName}`);

    // Meta-tools handled locally
    if (isMetaTool(toolName)) {
      return handleMetaTool(
        toolName,
        (args ?? {}) as Record<string, unknown>,
        registry,
        sessionStore
      );
    }

    // Route to upstream
    const entry = registry.getEntry(toolName);
    if (!entry) {
      return {
        isError: true,
        content: [{ type: "text" as const, text: `Unknown tool: ${toolName}` }],
      };
    }

    const result = await upstream.callTool(
      entry.serverName,
      entry.originalName,
      (args ?? {}) as Record<string, unknown>
    );

    // Record for Phase 2 analytics
    sessionStore.recordToolCall(DEFAULT_SESSION, toolName);

    return result;
  });

  return server;
}
