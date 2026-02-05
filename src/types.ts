import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

/** Raw tool definition as returned by an upstream MCP server. */
export interface UpstreamTool {
  name: string;
  description?: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, object>;
    required?: string[];
    [key: string]: unknown;
  };
  outputSchema?: {
    type: "object";
    properties?: Record<string, object>;
    required?: string[];
    [key: string]: unknown;
  };
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

/** A connected upstream MCP server. */
export interface UpstreamConnection {
  name: string;
  client: Client;
  tools: UpstreamTool[];
}

/** A tool in the aggregated registry with provenance info. */
export interface ToolEntry {
  /** Namespaced name exposed to the downstream client. */
  namespacedName: string;
  /** Original tool name on the upstream server. */
  originalName: string;
  /** Name of the upstream server this tool belongs to. */
  serverName: string;
  /** Full tool definition with namespaced name and prefixed description. */
  definition: UpstreamTool;
}

/** Per-session context state. */
export interface Session {
  id: string;
  context?: {
    query: string;
    intent?: string;
    timestamp: number;
  };
  toolCalls: Array<{
    toolName: string;
    timestamp: number;
    contextSnapshot?: string;
  }>;
}
