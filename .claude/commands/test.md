---
description: Run the Vitest suite in single-pass mode. Never use watch mode from an agent.
---

Run:

```bash
npm run test:run
```

On success, print "tests: ok" plus the pass count. On failure, print only the failing test names + the error messages (not full stack traces — those flood context).

If the user asks for a specific file, append it: `npm run test:run -- <path>`.

Do **not** run `npm run test` (watch mode) — it never exits.
