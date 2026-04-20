---
name: merging-main
description: Use when merging main into a feature branch, rebasing, or pulling upstream changes that haven't been reviewed against the agentic-repo patterns. The goal is to catch drift — main PRs don't know about this repo's conventions (Zod on all routes, folderized src/lib, strict TS, doc indexes, test seeds) and will quietly reintroduce old patterns. Covers the checklist, the commands, and where to update the agent-visible docs.
---

# Merging main without losing agentic alignment

Main moves independently of the agentic work. Feature PRs that land there
don't know about:

- The `src/lib/` folderization (swap/ tokens/ settlement/ api/ config/).
- `parseJson` / `parseSearchParams` / `parseParams` on every input-taking route.
- `strict: true` TypeScript (no new `any`, no `@ts-ignore`).
- The `src/app/` and `src/components/` directory maps in
  `agent_docs/architecture.md`.
- The route/hook discovery indexes (`src/app/api/README.md`,
  `src/hooks/README.md`).
- The ESLint `no-restricted-syntax` rule that forbids `request.json()` and
  `request.nextUrl.searchParams` on API routes.

Every merge is a chance for one of those to silently drift back. This skill
is the playbook that catches it.

## When to use

- `git merge origin/main` or `git pull origin main`.
- Opening a PR that says "merge conflicts" on GitHub.
- After a rebase onto a moved main.
- Any time the PR checks say `mergeable: DIRTY`.

Run `/realign` after you've resolved mechanical conflicts but before
pushing — it's the most efficient time to catch pattern drift.

## Pre-merge checklist

Before you merge, capture the baseline:

```bash
git fetch origin main
git log main..HEAD --oneline | wc -l              # commits on your branch
git log $(git merge-base HEAD origin/main)..origin/main --oneline
```

Read those main-side commits — the PR titles tell you what categories of
change to watch for (new routes, new components, moved files).

## Merge mechanics

Always **merge**, never rebase a branch that's already been pushed and
reviewed:

```bash
git merge origin/main --no-commit --no-ff
# resolve conflicts
# then the alignment pass below, ideally before `git commit`
```

Rebasing a shared branch forces a `git push --force`, which violates the
repo's safety protocol (see CLAUDE.md) and loses review comments on the PR.

## Alignment pass (the hard part)

After resolving mechanical conflicts, run these checks against the incoming
main changes. Each is a class of drift to catch.

### 1. Stale import paths

The folderization under `src/lib/` renamed a bunch of modules. Main PRs
opened before the folderization still import the old paths:

| Old path (pre-folderization) | New path |
|---|---|
| `@/lib/site-config` | `@/lib/config/site` |
| `@/lib/network` | `@/lib/config/network` |
| `@/lib/feature-flags` | `@/lib/config/feature-flags` |
| `@/lib/constants` | `@/lib/config/constants` |
| `@/lib/weth-abi` | `@/lib/tokens/weth-abi` |
| `@/lib/erc20-abi` | `@/lib/tokens/erc20-abi` |
| `@/lib/token-list` (import from JSON) | `@/lib/tokens/token-list.json` |
| `@/lib/token-resolver` | `@/lib/tokens/token-resolver` |
| `@/lib/stablecoins` | `@/lib/tokens/stablecoins` |
| `@/lib/weth-utils` | `@/lib/tokens/weth-utils` |
| `@/lib/transaction-errors` | `@/lib/settlement/transaction-errors` |
| `@/lib/transaction-receipt-utils` | `@/lib/settlement/transaction-receipt-utils` |
| `@/lib/tx-config` | `@/lib/settlement/tx-config` |
| `@/lib/rpc-status` | `@/lib/settlement/rpc-status` |
| `@/lib/slippage` | `@/lib/swap/slippage` |
| `@/lib/quote-guard` | `@/lib/swap/quote-guard` |
| `@/lib/eth-path-tx` | `@/lib/swap/eth-path-tx` |
| `@/lib/permit2` | `@/lib/swap/permit2` |

Grep the merged tree for any of the old paths:

```bash
grep -rn "@/lib/site-config\|@/lib/network\b\|@/lib/feature-flags\b\|@/lib/weth-abi\b\|@/lib/constants\b" src/ 2>/dev/null
```

Each hit is a broken import that `next build` will catch — fix the path at
the call site, not by reintroducing the old module.

### 2. New API routes must use Zod + parseJson

The ESLint rule at `eslint.config.js:88-112` flags `request.json()` /
`request.nextUrl.searchParams` / `new URL(request.url)` on files under
`src/app/api/**/route.ts`. Run:

```bash
npx next lint --dir src/app/api 2>&1 | grep -B 2 "no-restricted-syntax"
```

Any match is a drift — migrate that route to the pattern in
`.claude/skills/next-app-router/api-routes.md`. Don't silence the rule.

### 3. TypeScript strictness — no regressions

```bash
npx tsc --noEmit
```

If main introduced a file with `any` or `@ts-ignore`, strict mode will
still compile it (because explicit `any` is allowed). Hunt for those
manually:

```bash
git diff main..HEAD -- src/ | grep -E "^\+.*: any\b|^\+.*as any\b|^\+.*@ts-ignore"
```

Replace with a real type. If the underlying API really is untyped (e.g.
`window.ethereum`), cast through `unknown` with a local interface rather
than leaking `any`.

### 4. Doc indexes drift

New routes, hooks, and component folders need to be registered in the
agent-visible docs:

- **New `src/app/<route>/`**: add to the tree in
  `agent_docs/architecture.md` under `## src/app/`.
- **New `src/components/<domain>/`**: add to the tree in
  `agent_docs/architecture.md` under `## src/components/`.
- **New API route under `src/app/api/`**: add to the list in
  `src/app/api/README.md`. Note which ones accept user input vs. are
  trigger-only.
- **New hook under `src/hooks/`**: add to the list in
  `src/hooks/README.md`.

Deleted routes need to be REMOVED from the same indexes. Main's /share
deletion in PR #109 is a prior example.

### 5. Test seeds on new components / hooks

Not strictly required, but if main added a new component in a critical
path (not just a marketing landing), copy the SwapToast template
(`tests/components/swap/SwapToast.test.tsx`) and seed at least one test.
Every untested component is a future regression-oracle gap.

Priority:
- New API route → integration test (`tests/api/<route>.test.ts`).
- New hook with state → happy-dom hook test
  (`tests/hooks/<name>.test.ts`).
- New component on a wallet/swap-critical path → functional test.
- New marketing component → skip; a11y sweep is enough.

### 6. a11y sweep on new user-facing components

```bash
npx vitest run tests/a11y
```

If main added a Dialog or a button with just an icon, the axe sweep will
catch missing accessible names. Close-button patterns in particular
(see `SwapConfirmationModal`'s `aria-label="Close"` fix) are a repeat
offender.

### 7. Bundle check for dependency additions

```bash
git diff main..HEAD -- package.json | grep -E "^\+.*\""
```

Any new runtime dependency from main needs at least a sniff check:
- Is it already transitively installed?
- Does it duplicate functionality we have (date-fns vs dayjs, etc.)?
- Does it pin a peer-dep version that conflicts with wagmi/viem/RainbowKit?

## Post-merge verification

After the alignment pass, run full verify before pushing:

```bash
npm run typecheck
npm run lint
npm run test:run
npm run format:check
```

(`/verify` runs all four.)

Then a UI smoke on any route main touched:

```bash
/verify-ui
```

## Writing the merge commit

A merge-main commit should spell out:

- Which upstream commits came in (short-hash + one-line).
- What conflicts were resolved, with the semantic choice explained.
- Which drift was caught and fixed.
- What was adopted verbatim from main.

Example (from commit `b810514`):

> Merge main: resolve early-access Zod conflict, fix /pro import path
>
> Main added commit 8743544 ("feat: add /pro landing + fix OG image
> pre-warm URL"). Conflict resolved in early-access/route.ts: kept this
> branch's Zod shape but adopted main's "at least one contact method"
> semantics via `.refine`. Also updated src/app/pro/layout.tsx to import
> from @/lib/config/site (new folderized path).

## Related

- `.claude/commands/realign.md` — slash command that runs this playbook.
- `agent_docs/audit-followup.md` — the canonical "what's left" list;
  update when merging in changes that close an open gap or reopen a
  closed one.
- `eslint.config.js` — the API-route Zod rule. Main's PRs bypass it if
  they opened before it landed.
