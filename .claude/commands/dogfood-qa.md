---
description: Run the dogfood QA suite against the riglm2 MCP proxy (15 checks)
---

Run the dogfood QA test suite from `.claude/skills/dogfood-qa/SKILL.md`.

Execute all 15 checks in order against the live riglm2 MCP connection. Stop and report on first failure. Produce the summary table at the end.

Optional focus: `$ARGUMENTS` (if provided, run only the numbered test(s) specified, e.g. "12-15" for storage tests only)
