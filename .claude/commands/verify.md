---
description: Run the full verification stack — typecheck, lint, tests, format — and report results.
---

Run these in order. Stop on the first failure and print its output. On success of all four, print "verify: ok".

```bash
npm run typecheck
npm run lint
npm run test:run
npm run format:check
```

If any step fails, do not attempt to fix it inline — report the failure and wait for instruction.

`format:check` runs last because it's cheapest and most noise-prone; putting it first would hide typecheck failures behind prettier diff noise.

Do not run `npm run build` unless the user explicitly asks. It's slow and the path-gated CI `build` workflow plus the other checks here usually catch regressions.
