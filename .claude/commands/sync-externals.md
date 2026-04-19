---
description: Refresh every external workspace (fetch + fast-forward) without re-reading orientation docs. Use mid-session when a PR lands upstream.
---

Run:

```
.claude/hooks/externals-sync.sh
```

Surface the output to the user exactly as-is. The script is strict: it fast-forwards only clean clones, refuses to auto-resolve divergence, and writes `.external/.manifest.lock.json` with the resulting state.

If anything failed (non-zero exit), surface the error. Do **not** attempt to `git reset --hard` or otherwise repair `.external/` state on your own — if a mirror genuinely diverged, the user should `rm -rf .external/<name>` and re-run.

Do **not** re-read orientation docs. This command is scoped to externals only — `/prime` is the full session-start orientation.
