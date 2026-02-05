/** All logging goes to stderr — stdout is reserved for MCP protocol. */
export const log = {
  info: (...args: unknown[]) =>
    console.error("[riglm2]", ...args),
  error: (...args: unknown[]) =>
    console.error("[riglm2 ERROR]", ...args),
  debug: (...args: unknown[]) => {
    if (process.env.RIGLM2_DEBUG) console.error("[riglm2 DEBUG]", ...args);
  },
};
