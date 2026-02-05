# E2E Testing with MCP Inspector CLI

## Table of Contents

1. [CLI Syntax](#cli-syntax)
2. [Testing Methods](#testing-methods)
3. [Configuration File](#configuration-file)
4. [Shell Script Patterns](#shell-script-patterns)
5. [CI/CD Integration](#cicd-integration)
6. [Parsing Output with jq](#parsing-output-with-jq)
7. [Limitations and Workarounds](#limitations-and-workarounds)

## CLI Syntax

```bash
npx @modelcontextprotocol/inspector --cli <server-command> [options]
```

### Common Options

| Option | Description | Example |
|--------|-------------|---------|
| `--method` | MCP method to call | `--method tools/list` |
| `--tool-name` | Tool name for tools/call | `--tool-name search` |
| `--tool-arg` | Tool argument (repeatable) | `--tool-arg query="test"` |
| `--resource-uri` | Resource URI for resources/read | `--resource-uri "file:///path"` |
| `--prompt-name` | Prompt name for prompts/get | `--prompt-name analyze` |
| `-e` | Environment variable | `-e API_KEY=$KEY` |
| `--config` | Config file path | `--config mcp-config.json` |
| `--server` | Server name from config | `--server my-server` |

## Testing Methods

### List Tools

```bash
npx @modelcontextprotocol/inspector --cli node build/index.js --method tools/list
```

### Call Tool

```bash
# Simple arguments
npx @modelcontextprotocol/inspector --cli node build/index.js \
  --method tools/call \
  --tool-name search \
  --tool-arg query="test query" \
  --tool-arg limit=10

# JSON object argument
npx @modelcontextprotocol/inspector --cli node build/index.js \
  --method tools/call \
  --tool-name configure \
  --tool-arg 'options={"format": "json", "verbose": true}'
```

### List Resources

```bash
npx @modelcontextprotocol/inspector --cli node build/index.js --method resources/list
```

### Read Resource

```bash
npx @modelcontextprotocol/inspector --cli node build/index.js \
  --method resources/read \
  --resource-uri "file:///data/config.json"
```

### List Prompts

```bash
npx @modelcontextprotocol/inspector --cli node build/index.js --method prompts/list
```

### Get Prompt

```bash
npx @modelcontextprotocol/inspector --cli node build/index.js \
  --method prompts/get \
  --prompt-name summarize \
  --prompt-arg topic="testing"
```

### With Environment Variables

```bash
npx @modelcontextprotocol/inspector --cli \
  -e API_KEY=$API_KEY \
  -e DEBUG=true \
  -e NODE_ENV=test \
  node build/index.js --method tools/list

# Separate inspector flags from server flags with --
npx @modelcontextprotocol/inspector --cli \
  -e API_KEY=$KEY \
  -- node build/index.js --server-flag value
```

## Configuration File

Create `mcp-config.json` for reusable configurations:

```json
{
  "mcpServers": {
    "local-server": {
      "command": "node",
      "args": ["build/index.js"],
      "env": {
        "NODE_ENV": "test",
        "LOG_LEVEL": "debug"
      }
    },
    "production-server": {
      "command": "node",
      "args": ["build/index.js", "--production"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    },
    "http-server": {
      "type": "streamable-http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Usage:

```bash
npx @modelcontextprotocol/inspector --cli \
  --config mcp-config.json \
  --server local-server \
  --method tools/list
```

## Shell Script Patterns

### Basic E2E Test Script

```bash
#!/bin/bash
set -e

INSPECTOR="npx @modelcontextprotocol/inspector --cli"
SERVER="node build/index.js"

echo "=== MCP Server E2E Tests ==="

# Test 1: Verify tools are listed
echo "Testing tools/list..."
TOOLS=$($INSPECTOR $SERVER --method tools/list)
TOOL_COUNT=$(echo "$TOOLS" | jq '.tools | length')
echo "Found $TOOL_COUNT tools"

if [ "$TOOL_COUNT" -eq 0 ]; then
  echo "ERROR: No tools found"
  exit 1
fi

# Test 2: Verify specific tool exists
echo "Checking for 'search' tool..."
if echo "$TOOLS" | jq -e '.tools[] | select(.name == "search")' > /dev/null; then
  echo "✓ 'search' tool found"
else
  echo "✗ 'search' tool NOT found"
  exit 1
fi

# Test 3: Execute tool
echo "Testing search tool execution..."
RESULT=$($INSPECTOR $SERVER \
  --method tools/call \
  --tool-name search \
  --tool-arg query="test")

if echo "$RESULT" | jq -e '.content[0].text' > /dev/null; then
  echo "✓ Tool returned valid content"
else
  echo "✗ Tool response invalid"
  exit 1
fi

# Test 4: Check resources
echo "Testing resources/list..."
RESOURCES=$($INSPECTOR $SERVER --method resources/list)
RESOURCE_COUNT=$(echo "$RESOURCES" | jq '.resources | length')
echo "Found $RESOURCE_COUNT resources"

# Test 5: Check prompts
echo "Testing prompts/list..."
PROMPTS=$($INSPECTOR $SERVER --method prompts/list)
PROMPT_COUNT=$(echo "$PROMPTS" | jq '.prompts | length')
echo "Found $PROMPT_COUNT prompts"

echo ""
echo "=== All E2E tests passed ==="
```

### Comprehensive Test Script

```bash
#!/bin/bash
set -e

INSPECTOR="npx @modelcontextprotocol/inspector --cli"
SERVER="node build/index.js"
FAILURES=0

run_test() {
  local name="$1"
  local cmd="$2"
  local check="$3"

  echo -n "Testing $name... "

  if OUTPUT=$(eval "$cmd" 2>&1); then
    if echo "$OUTPUT" | eval "$check" > /dev/null 2>&1; then
      echo "✓"
      return 0
    else
      echo "✗ (validation failed)"
      echo "  Output: $OUTPUT"
      ((FAILURES++))
      return 1
    fi
  else
    echo "✗ (command failed)"
    echo "  Error: $OUTPUT"
    ((FAILURES++))
    return 1
  fi
}

echo "=== MCP Server E2E Test Suite ==="
echo ""

# Tools tests
run_test "tools/list" \
  "$INSPECTOR $SERVER --method tools/list" \
  "jq -e '.tools | length > 0'"

run_test "tools/call search" \
  "$INSPECTOR $SERVER --method tools/call --tool-name search --tool-arg query=test" \
  "jq -e '.content[0].text'"

run_test "tools/call with JSON arg" \
  "$INSPECTOR $SERVER --method tools/call --tool-name configure --tool-arg 'config={\"verbose\":true}'" \
  "jq -e '.content[0]'"

# Resources tests
run_test "resources/list" \
  "$INSPECTOR $SERVER --method resources/list" \
  "jq -e '.resources'"

run_test "resources/read" \
  "$INSPECTOR $SERVER --method resources/read --resource-uri config://app" \
  "jq -e '.contents[0].text'"

# Prompts tests
run_test "prompts/list" \
  "$INSPECTOR $SERVER --method prompts/list" \
  "jq -e '.prompts'"

run_test "prompts/get" \
  "$INSPECTOR $SERVER --method prompts/get --prompt-name analyze --prompt-arg topic=testing" \
  "jq -e '.messages[0]'"

echo ""
if [ $FAILURES -eq 0 ]; then
  echo "=== All tests passed ==="
  exit 0
else
  echo "=== $FAILURES test(s) failed ==="
  exit 1
fi
```

## CI/CD Integration

### GitHub Actions

```yaml
name: MCP Server Tests

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Unit tests
        run: npm test

      - name: E2E - List tools
        run: |
          TOOLS=$(npx @modelcontextprotocol/inspector --cli node build/index.js --method tools/list)
          echo "Tools found: $(echo "$TOOLS" | jq '.tools[].name')"
          [ $(echo "$TOOLS" | jq '.tools | length') -gt 0 ] || exit 1

      - name: E2E - Execute tool
        env:
          API_KEY: ${{ secrets.API_KEY }}
        run: |
          RESULT=$(npx @modelcontextprotocol/inspector --cli \
            -e API_KEY=$API_KEY \
            node build/index.js \
            --method tools/call \
            --tool-name search \
            --tool-arg query="ci-test")
          echo "$RESULT" | jq -e '.content[0]'

      - name: E2E - Check resources
        run: |
          npx @modelcontextprotocol/inspector --cli node build/index.js \
            --method resources/list | jq '.resources'

      - name: E2E - Full test suite
        run: ./scripts/e2e-test.sh
```

### GitLab CI

```yaml
stages:
  - build
  - test
  - e2e

build:
  stage: build
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - build/

unit-tests:
  stage: test
  script:
    - npm test

e2e-tests:
  stage: e2e
  script:
    - npx @modelcontextprotocol/inspector --cli node build/index.js --method tools/list | jq '.'
    - ./scripts/e2e-test.sh
  variables:
    API_KEY: $API_KEY
```

## Parsing Output with jq

### Extract Tool Names

```bash
npx @modelcontextprotocol/inspector --cli node server.js --method tools/list | \
  jq '.tools[].name'
```

### Get Specific Tool Schema

```bash
npx @modelcontextprotocol/inspector --cli node server.js --method tools/list | \
  jq '.tools[] | select(.name == "search") | .inputSchema'
```

### Extract Text Content from Tool Call

```bash
npx @modelcontextprotocol/inspector --cli node server.js \
  --method tools/call \
  --tool-name search \
  --tool-arg query="test" | jq -r '.content[0].text'
```

### Check for Errors

```bash
RESULT=$(npx @modelcontextprotocol/inspector --cli node server.js \
  --method tools/call --tool-name bad_tool --tool-arg x=1)

if echo "$RESULT" | jq -e '.error' > /dev/null; then
  echo "Error: $(echo "$RESULT" | jq -r '.error.message')"
  exit 1
fi
```

### Count and Validate

```bash
# Count tools
TOOL_COUNT=$(npx @modelcontextprotocol/inspector --cli node server.js \
  --method tools/list | jq '.tools | length')

# Validate minimum tools
[ "$TOOL_COUNT" -ge 3 ] || { echo "Expected at least 3 tools"; exit 1; }

# Check specific tool exists
npx @modelcontextprotocol/inspector --cli node server.js --method tools/list | \
  jq -e '.tools[] | select(.name == "required_tool")' > /dev/null || \
  { echo "required_tool not found"; exit 1; }
```

### Parse JSON Content

```bash
# Extract and parse JSON from tool result
RESULT=$(npx @modelcontextprotocol/inspector --cli node server.js \
  --method tools/call \
  --tool-name get_config \
  --tool-arg key="settings")

CONFIG=$(echo "$RESULT" | jq -r '.content[0].text' | jq '.')
echo "Debug mode: $(echo "$CONFIG" | jq '.debug')"
```

## Limitations and Workarounds

### Custom Authentication Headers

The `--header` flag authenticates to the Inspector proxy, not the MCP server. For custom auth:

```bash
# Direct JSON-RPC for custom headers
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Custom-Header: value" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### Timeout Handling

Set environment variable for long operations:

```bash
MCP_SERVER_REQUEST_TIMEOUT=600000 npx @modelcontextprotocol/inspector --cli \
  node build/index.js \
  --method tools/call \
  --tool-name long_running_tool
```

### Direct JSON-RPC Alternative

Bypass Inspector entirely for maximum control:

```bash
# Via stdin
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node build/index.js | jq

# Tool call
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search","arguments":{"query":"test"}},"id":2}' | \
  node build/index.js | jq
```

### Binary/Large Responses

For responses that may be large or binary:

```bash
# Save to file
npx @modelcontextprotocol/inspector --cli node build/index.js \
  --method tools/call \
  --tool-name export_data > result.json

# Stream processing
npx @modelcontextprotocol/inspector --cli node build/index.js \
  --method tools/call \
  --tool-name get_logs | jq -c '.content[]' | while read line; do
    echo "$line" | jq -r '.text'
  done
```
