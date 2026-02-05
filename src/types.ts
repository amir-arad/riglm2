import { z } from "zod";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

const JsonSchemaObjectSchema = z
  .object({
    type: z.literal("object"),
    properties: z.record(z.record(z.unknown())).optional(),
    required: z.array(z.string()).optional(),
  })
  .passthrough();

export const UpstreamToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  inputSchema: JsonSchemaObjectSchema,
  outputSchema: JsonSchemaObjectSchema.optional(),
  annotations: z
    .object({
      title: z.string().optional(),
      readOnlyHint: z.boolean().optional(),
      destructiveHint: z.boolean().optional(),
      idempotentHint: z.boolean().optional(),
      openWorldHint: z.boolean().optional(),
    })
    .optional(),
});

export type UpstreamTool = z.infer<typeof UpstreamToolSchema>;

export interface UpstreamConnection {
  name: string;
  client: Client;
  tools: UpstreamTool[];
}

export interface ToolEntry {
  namespacedName: string;
  originalName: string;
  serverName: string;
  definition: UpstreamTool;
}

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
  retrievedTools?: string[];
  lastSearch?: {
    query: string;
    results: string[];
    timestamp: number;
  };
}
