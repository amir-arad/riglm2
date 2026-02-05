import { z } from "zod";
import { readFile } from "node:fs/promises";

const ServerConfigSchema = z.object({
  name: z
    .string()
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Server name must be alphanumeric, hyphens, or underscores"
    )
    .refine((s) => !s.includes("__"), "Server name must not contain '__'"),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
  enabled: z.boolean().default(true),
  cwd: z.string().optional(),
});

const ProxyConfigSchema = z.object({
  name: z.string().default("riglm2"),
  namespace_separator: z.string().default("__"),
});

const StorageConfigSchema = z.object({
  path: z.string().default("./riglm2-data.db"),
  pruneThreshold: z.number().int().positive().default(5000),
  pruneMinConfidence: z.number().min(0).max(1).default(0.1),
  pruneUnusedDays: z.number().int().positive().default(30),
});

const ConfigSchema = z.object({
  servers: z.array(ServerConfigSchema).min(1, "At least one server required"),
  proxy: ProxyConfigSchema.default({}),
  storage: StorageConfigSchema.default({}),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type StorageConfig = z.infer<typeof StorageConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

export async function loadConfig(path: string): Promise<Config> {
  const raw = await readFile(path, "utf-8");
  const json = JSON.parse(raw);
  return ConfigSchema.parse(json);
}
