---
description: Review the current branch's diff against main using the security-reviewer subagent. Read-only.
---

1. Show a brief summary of what's changed:
   ```bash
   git fetch origin main --quiet
   git diff --stat origin/main...HEAD
   ```

2. Invoke the `security-reviewer` subagent with this prompt:

   > Review the diff of the current branch (`git diff origin/main...HEAD`) for security issues. Focus on the priority list in `.claude/agents/security-reviewer.md`. Return findings grouped by severity with `file:line` citations.

3. Relay the subagent's findings to the user verbatim (do not re-summarize).

4. Do not edit any code. This command is read-only review.
