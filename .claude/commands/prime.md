---
description: Prime a fresh session with the project mental model. Reads the orientation files deterministically.
---

Read these files in order and summarize back to the user in 5 bullets what this project is, what matters, and how to verify work:

1. `CLAUDE.md`
2. `AGENTS.md`
3. `agent_docs/stack.md`
4. `agent_docs/architecture.md`
5. `agent_docs/verification.md`

Do **not** read skills, agent definitions, or the `docs/` folder — those are Tier-2/3 and load on demand.

Then list the available slash commands (`/verify`, `/typecheck`, `/lint`, `/test`, `/new-skill`, `/review-diff`) and skills by name (from `.claude/skills/`). Do not load their bodies.

End with: "Ready. What's the task?"
