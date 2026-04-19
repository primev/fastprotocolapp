---
description: Prime a fresh session with the project mental model. Syncs external workspaces, then reads the orientation files deterministically.
---

First, sync every external workspace declared in `.claude/externals.json`.
Run:

```
.claude/hooks/externals-sync.sh
```

Surface the script's stdout to the user exactly as-is — it reports per-external state (current SHA, commits fast-forwarded, age vs freshness threshold). If it exits non-zero, stop and surface the message; don't attempt to resolve `.external/` state yourself.

Then read these files in order and summarize back to the user in 5 bullets what this project is, what matters, and how to verify work:

1. `CLAUDE.md`
2. `AGENTS.md`
3. `agent_docs/stack.md`
4. `agent_docs/architecture.md`
5. `agent_docs/verification.md`

Do **not** read skills, agent definitions, or the `docs/` folder — those are Tier-2/3 and load on demand.

Then list the available slash commands (`/verify`, `/typecheck`, `/lint`, `/test`, `/new-skill`, `/review-diff`, `/sync-externals`) and skills by name (from `.claude/skills/`). Do not load their bodies.

If `.claude/externals.json` declares any externals, also list them by name under an "External workspaces:" heading with their current short SHA and age from the sync output above.

End with: "Ready. What's the task?"
