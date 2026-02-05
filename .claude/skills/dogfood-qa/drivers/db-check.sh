#!/usr/bin/env bash
# Tests 12-13: Verify DB exists and inspect persisted dynamic entries
# Shows entry count + metadata (without vector blobs)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

DB="riglm2-dogfood.db"

if [ ! -f "$DB" ]; then
  echo "FAIL: $DB not found"
  exit 1
fi

echo "=== DB file ==="
ls -la "$DB"

echo ""
echo "=== Entry count ==="
bun -e "
const db = new (require('bun:sqlite').Database)('$DB');
console.log(db.query('SELECT COUNT(*) as n FROM dynamic_entries').get());
db.close();
"

echo ""
echo "=== Entry details (no vectors) ==="
bun -e "
const db = new (require('bun:sqlite').Database)('$DB');
const rows = db.query('SELECT * FROM dynamic_entries').all();
for (const r of rows) {
  const {vector, ...rest} = r;
  console.log(JSON.stringify(rest));
}
db.close();
"
