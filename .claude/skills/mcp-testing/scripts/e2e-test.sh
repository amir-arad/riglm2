#!/bin/bash
#
# MCP Server E2E Test Script
#
# Usage:
#   ./e2e-test.sh <server-command> [server-args...]
#
# Examples:
#   ./e2e-test.sh node build/index.js
#   ./e2e-test.sh bun run src/index.ts
#   ./e2e-test.sh npx ts-node src/server.ts
#
# Environment variables:
#   MCP_TEST_TIMEOUT - Request timeout in ms (default: 30000)
#   MCP_TEST_VERBOSE - Set to "1" for verbose output
#   API_KEY, etc.    - Passed to server via -e flags
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
INSPECTOR="npx @modelcontextprotocol/inspector --cli"
TIMEOUT="${MCP_TEST_TIMEOUT:-30000}"
VERBOSE="${MCP_TEST_VERBOSE:-0}"
FAILURES=0
PASSED=0

# Parse server command from arguments
if [ $# -eq 0 ]; then
  echo "Usage: $0 <server-command> [server-args...]"
  echo ""
  echo "Examples:"
  echo "  $0 node build/index.js"
  echo "  $0 bun run src/index.ts"
  exit 1
fi

SERVER_CMD="$*"

# Build environment variable flags
ENV_FLAGS=""
for var in API_KEY DATABASE_URL NODE_ENV LOG_LEVEL; do
  if [ -n "${!var}" ]; then
    ENV_FLAGS="$ENV_FLAGS -e $var=${!var}"
  fi
done

log() {
  if [ "$VERBOSE" = "1" ]; then
    echo -e "${YELLOW}[DEBUG]${NC} $1"
  fi
}

run_test() {
  local name="$1"
  local method="$2"
  shift 2
  local extra_args="$*"

  echo -n "Testing $name... "
  log "Command: $INSPECTOR $ENV_FLAGS $SERVER_CMD --method $method $extra_args"

  local output
  local exit_code=0

  output=$(eval "$INSPECTOR $ENV_FLAGS $SERVER_CMD --method $method $extra_args" 2>&1) || exit_code=$?

  if [ $exit_code -ne 0 ]; then
    echo -e "${RED}FAIL${NC} (command failed)"
    [ "$VERBOSE" = "1" ] && echo "  Output: $output"
    ((FAILURES++))
    return 1
  fi

  # Check for JSON-RPC error
  if echo "$output" | jq -e '.error' > /dev/null 2>&1; then
    echo -e "${RED}FAIL${NC} (RPC error)"
    echo "  Error: $(echo "$output" | jq -r '.error.message // .error')"
    ((FAILURES++))
    return 1
  fi

  echo -e "${GREEN}PASS${NC}"
  [ "$VERBOSE" = "1" ] && echo "$output" | jq -C '.' | head -20
  ((PASSED++))
  return 0
}

validate_result() {
  local name="$1"
  local method="$2"
  local jq_check="$3"
  shift 3
  local extra_args="$*"

  echo -n "Validating $name... "
  log "Command: $INSPECTOR $ENV_FLAGS $SERVER_CMD --method $method $extra_args"

  local output
  output=$(eval "$INSPECTOR $ENV_FLAGS $SERVER_CMD --method $method $extra_args" 2>&1)

  if echo "$output" | eval "$jq_check" > /dev/null 2>&1; then
    echo -e "${GREEN}PASS${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}FAIL${NC} (validation failed)"
    [ "$VERBOSE" = "1" ] && echo "  Output: $output"
    ((FAILURES++))
    return 1
  fi
}

echo "========================================"
echo "MCP Server E2E Test Suite"
echo "========================================"
echo "Server: $SERVER_CMD"
echo "Timeout: ${TIMEOUT}ms"
echo ""

# Core capability tests
echo "--- Core Capabilities ---"

run_test "tools/list" "tools/list"
run_test "resources/list" "resources/list"
run_test "prompts/list" "prompts/list"

echo ""

# Validation tests
echo "--- Validation ---"

validate_result "tools exist" "tools/list" \
  "jq -e '.tools | length > 0'"

validate_result "tool has schema" "tools/list" \
  "jq -e '.tools[0].inputSchema'"

echo ""

# Tool execution tests (customize these for your server)
echo "--- Tool Execution ---"

# Get first tool name dynamically
FIRST_TOOL=$(eval "$INSPECTOR $ENV_FLAGS $SERVER_CMD --method tools/list" | jq -r '.tools[0].name // empty')

if [ -n "$FIRST_TOOL" ]; then
  echo "Testing tool: $FIRST_TOOL"
  # Note: This may fail if the tool requires specific arguments
  # Customize the --tool-arg flags for your specific tools
  run_test "call $FIRST_TOOL" "tools/call" "--tool-name $FIRST_TOOL" || true
fi

echo ""

# Summary
echo "========================================"
echo "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILURES failed${NC}"
echo "========================================"

if [ $FAILURES -gt 0 ]; then
  exit 1
fi

exit 0
