---
description: Audit incoming main changes against the agentic-repo patterns and fix drift (stale imports, missing Zod, missing doc entries, etc.). Runs the merging-main skill's playbook.
---

Run the alignment pass after merging / rebasing main into this branch. The
full playbook is at `.claude/skills/merging-main/SKILL.md` — load it before
starting.

## Steps

1. **Capture what came in.**

   ```bash
   git fetch origin main
   git log $(git merge-base HEAD origin/main)..origin/main --oneline
   ```

   Read the commit subjects. Every new route / component / hook /
   lib-file needs to be traced through the alignment checklist.

2. **Hunt stale lib imports.** The folderization renamed several modules.
   The skill has the full old → new table. Any hit here is a broken
   import in the merged tree:

   ```bash
   grep -rn "@/lib/site-config\|@/lib/network\b\|@/lib/feature-flags\b\|@/lib/weth-abi\b\|@/lib/constants\b\|@/lib/stablecoins\b\|@/lib/weth-utils\b\|@/lib/erc20-abi\b\|@/lib/token-list\b\|@/lib/token-resolver\b\|@/lib/transaction-errors\b\|@/lib/slippage\b\|@/lib/quote-guard\b\|@/lib/eth-path-tx\b\|@/lib/permit2\b" src/
   ```

   Fix by updating the call site, never by reintroducing the old module.

3. **ESLint on new API routes.** The Zod-validation rule is scoped to
   `src/app/api/**/route.ts`. A main PR that preceded that rule can
   reintroduce imperative validation.

   ```bash
   npx next lint --dir src/app/api 2>&1 | grep -B 2 "no-restricted-syntax" || echo "clean"
   ```

   Any hit → migrate that route using `.claude/skills/next-app-router/api-routes.md`.

4. **TypeScript strictness drift.**

   ```bash
   npx tsc --noEmit
   git diff $(git merge-base HEAD origin/main)..HEAD -- src/ | grep -E "^\+.*: any\b|^\+.*as any\b|^\+.*@ts-ignore" | head
   ```

   The second command finds new explicit `any` / `@ts-ignore` added since
   the merge base. Fix each with a real type (cast through `unknown` +
   interface if the source really is untyped).

5. **Doc indexes.** For every new directory main added under `src/app/`
   or `src/components/`, update `agent_docs/architecture.md`. For every
   new API route, update `src/app/api/README.md`. For every new hook,
   update `src/hooks/README.md`. Also REMOVE entries for routes main
   deleted (the skill has a concrete example from PR #109).

6. **Full verify.**

   ```bash
   npm run typecheck
   npm run lint
   npm run test:run
   npm run format:check
   ```

   (`/verify` runs these in sequence.)

7. **UI smoke** on any route main touched. `/verify-ui` boots the dev
   server and curls the critical pages.

## Output

Report back to the user:

- **Incoming commits** from main (short-hashes + subjects).
- **Drift caught** — each hit from steps 2–4, with file:line and the fix.
- **Docs updated** — which index files got edits, and what was added or
  removed.
- **Verify result** — each step from #6 pass/fail.
- **Outstanding** — anything you flagged but didn't fix (e.g. a main-side
  `any` you couldn't retype without more context; a skipped test seed).

## Rules

- Don't modify main's new code for taste or style — only fix **concrete
  alignment breaks**: broken imports, ESLint rule violations, `any` that
  wasn't there before, missing index entries.
- Don't `git push --force`. This branch is shared; rebases become merges.
- Don't silence the ESLint rule; migrate the route.
- Don't commit yet — return the report and wait for the user to review
  before the merge commit is finalized.
