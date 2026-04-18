---
description: Run the full verification stack — typecheck, lint, tests — and report results.
---

Run these in order. Stop on the first failure and print its output. On success of all three, print "verify: ok".

```bash
npm run typecheck
npm run lint
npm run test:run
```

If any step fails, do not attempt to fix it inline — report the failure and wait for instruction.

Do not run `npm run build` unless the user explicitly asks. It's slow and the other checks usually catch regressions.
