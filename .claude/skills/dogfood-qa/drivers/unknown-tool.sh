#!/usr/bin/env bash
# Test 9: Unknown tool error — sends raw JSON-RPC to a fresh proxy instance
# Expected: {"isError":true} with "Unknown tool: nonexistent__fake_tool"
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"nonexistent__fake_tool","arguments":{}}}' \
  | timeout 5 bun run src/index.ts dogfood.config.json 2>/dev/null \
  | head -1
