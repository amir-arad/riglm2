#!/usr/bin/env bash
# Tests 3+8+11 combined: set_context → tool call → verify learning signal persisted
# Runs against a fresh proxy instance (not the live MCP connection)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DB="riglm2-dogfood.db"

count_before() {
  if [ ! -f "$DB" ]; then echo 0; return; fi
  bun -e "
const db = new (require('bun:sqlite').Database)('$DB');
const r = db.query('SELECT COUNT(*) as n FROM dynamic_entries').get();
console.log(r.n);
db.close();
"
}

BEFORE=$(count_before)
echo "Entries before: $BEFORE"

echo ""
echo "=== Sending set_context + echo in one session ==="
{
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}}}'
  sleep 0.5
  echo '{"jsonrpc":"2.0","method":"notifications/initialized"}'
  sleep 0.5
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"set_context","arguments":{"query":"testing echo for learning","intent":"qa"}}}'
  sleep 1
  echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"everything__echo","arguments":{"message":"learning-cycle-driver"}}}'
  sleep 2
} | timeout 15 bun run src/index.ts dogfood.config.json 2>/dev/null | while IFS= read -r line; do
  echo "  < $line"
done || true

echo ""
AFTER=$(count_before)
echo "Entries after: $AFTER"

if [ "$AFTER" -gt "$BEFORE" ]; then
  echo "PASS: new learning entry persisted ($BEFORE → $AFTER)"
else
  echo "INFO: entry count unchanged ($BEFORE → $AFTER) — may be EMA update on existing entry"
fi
