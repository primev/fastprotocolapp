# External Workspaces — Design Plan

> Status: proposal (not yet implemented). This document designs a reusable
> pattern for giving the agent read-only context from repos that live
> elsewhere on GitHub, without paying the cost of an MCP server.

## 1. Why local clones beat MCP for *code* context

Your instinct is right. For this specific need — giving an agent persistent,
greppable knowledge of another repo we own — a local clone wins on almost
every dimension that matters. The short version:

| Dimension | MCP (e.g., GitHub MCP) | Local clone |
|---|---|---|
| **Session cost** | Tool descriptions tax every turn (≈1–5K tokens) | Zero — no tool schemas to load |
| **Determinism** | `search_code` rankings change over time | `grep` is a pure function |
| **Greppability** | Needs specific tool calls | Claude's existing `Read`/`Grep`/`Glob` work natively |
| **Version pinning** | "Latest main" only | Any SHA / tag / branch |
| **Offline** | No | Yes |
| **Rate limits / auth** | Yes | Once, at clone time |
| **Works in CI** | Requires secrets + network in CI | Already there if checked out with the repo |
| **Reproducibility** | Responses can vary turn-to-turn | Bit-identical across sessions |
| **Disk cost** | Nothing | ~100MB–1GB depending on sparse-checkout |

MCP is still the right tool for *dynamic* signals from another repo — open
issues, PR status, CI state, releases. Those can't be baked into a local
clone. **The recommended model is hybrid:** local clone for code / types /
protocol specs, MCP (or `gh` CLI) for anything that changes by the minute.

For `primev/mev-commit` specifically, what the agent actually needs —
contract source, ABIs, protocol types, protobuf definitions — is exactly the
content that benefits most from local pinning and grepping.

## 2. Design principles

These are the rules the pattern follows. They're deliberately tight so the
same pattern slots into any future repo you want to do this for.

1. **One declarative manifest is the source of truth.** `.claude/externals.json`
   lists every external workspace with name, origin, ref, sparse paths,
   and a freshness policy. Nothing else needs to know those details.
2. **`/prime` is the only place state mutates.** Clone, fetch, sparse-reset —
   all happen there. Other commands only *read* `.external/`.
3. **Externals are gitignored.** They're tooling, not source. Developers
   and CI both start from a clean clone; `/prime` reconstitutes them.
4. **Freshness is visible, not automatic.** `/prime` prints the age of each
   external and warns past a threshold. Auto-pulls without user consent
   surprise people and surprise is the enemy of agentic work.
5. **Pinning is by SHA when it matters, by branch when it doesn't.**
   Cross-repo contracts that we depend on (like ABIs) pin to a SHA so
   drift is a test failure. Read-only reference material can track a
   branch.
6. **Each external gets its own skill.** The skill tells the agent *when*
   to load the external (triggers) and *where to look inside it*. Without
   the skill, the agent wanders the external tree and burns context.
7. **The pattern is zero-config for consumers.** Running `/prime` in a
   fresh clone does the right thing. Developers don't need to remember
   to run `git clone ...` separately.

## 3. Directory layout

```
<repo-root>/
├── .external/                           ← gitignored, tooling-only
│   ├── .manifest.lock.json              ← per-clone state (SHAs, last-fetch)
│   └── mev-commit/                      ← full or sparse clone
│       ├── contracts/
│       ├── contracts-abi/
│       ├── p2p/
│       └── ...
├── .claude/
│   ├── externals.json                   ← declarative manifest (committed)
│   ├── commands/
│   │   ├── prime.md                     ← updated: clone + refresh externals
│   │   └── refresh-externals.md         ← new: manual refresh command
│   ├── hooks/
│   │   └── externals-sync.sh            ← new: shell logic for clone/fetch/pin
│   └── skills/
│       └── external-mev-commit/         ← agent-facing skill
│           ├── SKILL.md
│           ├── contracts.md             ← how to navigate contracts/ source
│           ├── abis.md                  ← where canonical ABIs live + drift policy
│           └── protocol-types.md        ← Go / proto type definitions
├── agent_docs/
│   └── external-workspaces.md           ← brief overview + link to each skill
└── .gitignore                           ← +/.external/
```

Why `.external/` and not `external/`:
- The dot prefix signals "tooling" and keeps it out of most default
  file pickers / searches.
- ESLint, Prettier, `tsc`, and Vitest all need to skip it — easier to
  exclude dot-prefixed paths once than to keep updating ignore lists.
- Matches the existing pattern in your `.superset/`-style worktree dirs.

## 4. The manifest — `.claude/externals.json`

A single JSON file, committed to the repo, that fully describes every
external workspace. Example for the mev-commit case:

```json
{
  "$schema": "./externals.schema.json",
  "externals": [
    {
      "name": "mev-commit",
      "origin": "https://github.com/primev/mev-commit.git",
      "ref": "main",
      "pin": "0a1b2c3d4e5f6789...",
      "sparse": [
        "/contracts/",
        "/contracts-abi/",
        "/p2p/pkg/preconf/",
        "/p2p/pkg/signer/",
        "/oracle/pkg/"
      ],
      "freshness": {
        "warnAfterDays": 7,
        "failAfterDays": 45
      },
      "purpose": "Protocol source of truth — contracts, ABIs, and preconf types."
    }
  ]
}
```

**Field semantics:**

- `name` — folder name under `.external/`. Also the skill suffix
  (`external-mev-commit`).
- `origin` — HTTPS clone URL. SSH is allowed but HTTPS works for CI
  without SSH-key setup.
- `ref` — tracking branch or tag. What `git fetch` refers to.
- `pin` (optional) — exact SHA. If set, `/prime` checks out this SHA
  and refuses to auto-advance. Omit to track `ref` head.
- `sparse` (optional) — array of `git sparse-checkout` patterns. Omit
  for a full clone. Start with the 3–5 paths the agent actually needs;
  you can widen later.
- `freshness.warnAfterDays` — `/prime` warns if the upstream `ref` has
  advanced past the local HEAD by more than this many days.
- `freshness.failAfterDays` — `/prime` refuses to proceed and forces
  the user to run `/refresh-externals`. Rare — set high or omit.
- `purpose` — one-liner the skill picks up for its own docs.

**Lock file** — `.external/.manifest.lock.json` (gitignored) records:
- last fetch time per external
- resolved SHA at that fetch
- size on disk
- sparse paths materialized

This lets `/prime` answer "am I up to date?" without hitting the network,
and lets the skill tell the agent "you're reading mev-commit as of
commit `abc1234`, 2 days old."

## 5. The `/prime` flow

```
1. Read .claude/externals.json
2. For each external:
   a. If .external/<name>/ does not exist:
      - git clone --filter=blob:none --no-checkout <origin> .external/<name>
      - If sparse: git sparse-checkout init --cone && sparse-checkout set <patterns>
      - git checkout <pin | ref>
   b. Else (already cloned):
      - git -C .external/<name> fetch --no-tags origin <ref>
      - If pin: verify HEAD matches pin; warn if drifted
      - Else: fast-forward HEAD to origin/<ref>
   c. Update .external/.manifest.lock.json with SHA + timestamp
   d. Compute age: days since latest-fetch vs upstream advance
3. Read CLAUDE.md + AGENTS.md + agent_docs/stack.md + architecture.md + verification.md
   (the existing /prime behavior)
4. Print a single summary like:
   Externals:
     ✅ mev-commit @ 0a1b2c3d (2 days behind main, within threshold)
   Project docs primed.
```

The `externals-sync.sh` hook script does the heavy lifting. `/prime`'s
command body just invokes it and then proceeds with the existing
orientation reads.

## 6. Skill structure — `external-mev-commit`

Each external has a matching skill. This is the load-bearing part for
agent context — without it, the agent knows the files exist but has no
discovery signal.

```
.claude/skills/external-mev-commit/
├── SKILL.md
├── contracts.md
├── abis.md
└── protocol-types.md
```

**`SKILL.md`** (the always-loaded metadata):

```md
---
name: external-mev-commit
description: Use when a question or edit depends on the mev-commit protocol
  source of truth — contract implementations, canonical ABIs, preconfirm
  type definitions, or oracle behavior. The repo is vendored read-only
  under .external/mev-commit/ by `/prime`; paths cited here are relative
  to that root.
---

# External: mev-commit

The upstream protocol repo. We vendor a read-only copy under
`.external/mev-commit/` so the agent can grep contract source, ABI
definitions, and protocol types without hitting GitHub at every turn.

## When to load this skill

- Editing anything that touches FastSettlement, Permit2 wiring, preconfirm
  flows, or the oracle (`src/lib/swap/*`, `src/lib/settlement/*`)
- Updating a local ABI in `src/lib/tokens/` or `contracts-abi/abi/`
- Debugging an on-chain revert where you need to read the Solidity source
- Answering a protocol-behavior question ("what does the oracle guarantee?")

## Hard rules

- **Never write to `.external/`.** It's a vendored mirror. Edits must
  happen in the real mev-commit repo + a separate PR.
- **Never import from `.external/` at build time.** The path is
  gitignored; production builds won't have it.
- **Check freshness before citing.** `/prime` prints the current pin;
  if it's stale, run `/refresh-externals` first.

## Navigation

- [Contracts source](./contracts.md) — Solidity under `.external/mev-commit/contracts/`
- [ABIs and drift policy](./abis.md) — canonical JSON under `contracts-abi/abi/`
- [Protocol types](./protocol-types.md) — Go + proto definitions for preconf events
```

The three reference files are thin — each one says "here's what lives at
this path, here are the 3 files worth opening first, here's what to
ignore." That keeps the skill useful without bloating.

## 7. Freshness policy

The policy needs to be strict enough to catch drift, loose enough not to
nag. Proposed defaults:

- **Green (0–7 days):** silent. `/prime` prints "✅ X days behind main".
- **Yellow (7–45 days):** `/prime` prints a warning but continues.
  Suggests `/refresh-externals`.
- **Red (>45 days):** `/prime` still succeeds, but the skill's SKILL.md
  gets a visible banner that the agent will see: *"⚠️ This external is
  45+ days behind upstream. Verify any citation against the current
  repo before relying on it."* The banner is injected by the sync
  script rewriting a small section of SKILL.md.
- **SHA drift (pin mismatch):** `/prime` hard-fails. You cannot
  silently run against a SHA that doesn't match the manifest.

The lock file stores the last-fetch timestamp, so the warning doesn't
require a network call on every `/prime` — only the user can opt into
actually re-fetching.

## 8. Security considerations

- **No hook execution during checkout.** Clone with
  `GIT_CONFIG_GLOBAL=/dev/null git clone ...` or explicitly
  `--no-hooks`-equivalent config, so a malicious `post-checkout` hook
  in the external can't run arbitrary code.
- **No env var leakage.** `.external/` is explicitly excluded from
  `dotenv` / `@t3-oss/env-nextjs` search paths. Any `.env` in the
  external is a mirror of *their* setup and must not leak into ours.
- **Vendored is read-only.** The skill documents this as a hard rule;
  a commit-msg hook could enforce by refusing commits that modify
  `.external/`.
- **Sparse-checkout reduces blast radius.** The less of the external we
  check out, the smaller the attack surface.
- **HTTPS over SSH in the manifest.** Avoids SSH-key requirements in CI;
  public repos only anyway.

## 9. Generalizing to other repos

This plan deliberately bakes *none* of it to `mev-commit`. Any future
external is:

1. Add a new entry to `.claude/externals.json`.
2. Create `.claude/skills/external-<name>/` with a SKILL.md and 1–3 thin
   reference files.
3. Run `/prime`.

That's it. No new script, no new hook, no new command. The sync hook
reads the manifest and materializes everything the same way.

Use cases beyond `mev-commit` that this pattern handles well:
- A design-system / component library published as a separate repo
- A shared schema / proto repo consumed by multiple services
- An internal SDK repo whose source matters more than its npm package
- Documentation-heavy repos (RFCs, standards, protocol specs)

Use cases where you'd still want MCP instead:
- Live PR / issue status
- CI / deployment observability
- Anything with changing row-level data (not code)

## 10. Implementation phases

Suggested ordering so each commit is independently reviewable and each
phase leaves the repo in a working state:

**Phase A — Scaffolding (no behavior change)**
1. Add `.gitignore` entry for `.external/`.
2. Create `.claude/externals.json` (empty `externals: []` array).
3. Create `agent_docs/external-workspaces.md` that explains the pattern
   briefly and points to this plan doc.

**Phase B — Sync mechanism**
4. Add `.claude/hooks/externals-sync.sh` that:
   - Reads the manifest
   - Clones / fetches / sparse-resets / prints the summary
   - Updates the lock file
5. Add `.claude/commands/refresh-externals.md` (one-liner: invoke the
   sync script).
6. Update `.claude/commands/prime.md` to invoke the sync script before
   the existing orientation reads.

**Phase C — Wire up mev-commit**
7. Add the mev-commit entry to `.claude/externals.json` with sparse
   paths (contracts/, contracts-abi/, p2p/pkg/preconf/, signer/, oracle/).
8. Create `.claude/skills/external-mev-commit/` with SKILL.md and three
   thin reference files.
9. Run `/prime` end-to-end; verify the clone, lock-file, and skill are
   all in good shape.

**Phase D — Leverage the external (optional but high-value)**
10. Extend `tests/contracts-abi/abi-drift.test.ts` to diff our local
    `contracts-abi/abi/*.abi` against `.external/mev-commit/contracts-abi/abi/*.abi`.
    Fails if the two diverge — catches the case where upstream updates
    an ABI and we forget to copy it across.
11. Add a CI-only `externals.yml` workflow that runs `/prime`-equivalent
    sync and runs the drift test, gated on a weekly schedule. Not a PR
    gate; just a canary.

## 11. Resolved — decisions for the first external (mev-commit)

Based on your feedback, the defaults below are locked for `mev-commit`.
Future externals can override per-entry in `externals.json`.

1. **Track `main`, not a pinned SHA.** You want upstream freshness to be
   the default posture because mev-commit is actively developed and a
   day-old SHA is often wrong by afternoon. Drift is caught by the ABI
   diff test (Phase D) — if upstream ships an ABI change, our verify
   job fails on the next run, which IS the signal to reconcile. That's
   a working safety net without the manual-bump friction of pinning.
   The `pin` field in `externals.json` stays supported for future
   externals where pinning IS appropriate (e.g., a frozen spec repo).

2. **Sparse-checkout — start with the ten paths in `external-mev-commit.md`.**
   That's what `contracts-abi/`, `contracts/`, `tools/preconf-rpc/*`
   (the handlers we actually consume), and `tools/fastswap-miles/` come
   to. Everything else — `p2p/`, `bridge/`, `external/geth`,
   `infrastructure/`, `testing/` — is explicitly out of scope for
   Fast Protocol App per the mapping doc. Widen later if an agent
   genuinely needs more.

3. **`/prime` fast-forwards on every call; `/sync-externals` is the
   manual knob.** Two commands, not one:
   - `/prime` — full orientation. Fetches all externals, fast-forwards
     clean ones, prints the per-external summary (current SHA, commits
     fast-forwarded, age). Suitable for session-start.
   - `/sync-externals` — just the external refresh, without re-reading
     orientation docs. Suitable for mid-session when you know a PR
     landed upstream and you want the new state immediately.

   Fast-forward semantics: only advances HEAD when it's a clean
   fast-forward (no local commits, no working-tree diff, upstream is
   strictly ahead). Anything else prints a warning and stops — the
   agent should never resolve a `.external/` conflict.

4. **CI runs externals only in the dedicated drift workflow.** `verify`,
   `build`, and the default test run stay network-independent. A new
   `externals.yml` workflow (weekly + manual) clones the externals,
   runs `npm run test:externals` (new script that runs just
   `tests/contracts-abi/abi-drift.test.ts` after the upstream clone),
   and fails the scheduled run if drift is detected. Not a PR gate.

5. **Pre-commit hook that rejects staged changes under `.external/`.**
   Yes — cheap insurance. Lands in Phase B alongside the sync script.
   Separate `pre-commit-external-guard.sh` that exits non-zero if
   `git diff --cached --name-only | grep -q '^\.external/'`.

---

## 12. Scope map for mev-commit (agent-facing)

The full mapping of *what mev-commit paths Fast Protocol App consumes*
— FastSwap endpoints, preconf RPC, miles/Fuul flow, contract source —
lives in [`external-mev-commit.md`](./external-mev-commit.md). That's
the doc the `external-mev-commit` skill will point agents at as their
first read. This plan doc is about the *mechanism*; the scope doc is
about *content*.

---

## 13. Implementation roadmap (revised)

Phases from §10 stand; concretizing with the decisions above:

**Phase A — Scaffolding (~1 commit)**
- `.gitignore` adds `/.external/`
- `.claude/externals.json` with the mev-commit entry (tracking `main`,
  the ten sparse paths, freshness warn-after 7 days)
- `agent_docs/external-workspaces.md` — brief pointer to this plan +
  the scope map + the skill

**Phase B — Sync mechanism (~2 commits)**
- `.claude/hooks/externals-sync.sh` — reads manifest, clones or
  fetches-and-ff-s, writes lock file, prints summary. Strict: refuses
  to run if `.external/<name>/` has uncommitted changes or diverged.
- `.claude/hooks/pre-commit-external-guard.sh` — rejects staged paths
  under `.external/`
- `.claude/commands/prime.md` — invoke the sync before orientation reads
- `.claude/commands/sync-externals.md` — manual refresh command

**Phase C — Wire up mev-commit (~1 commit)**
- `.claude/skills/external-mev-commit/` — SKILL.md + three reference
  files (contracts.md, abis.md, protocol-types.md); all point at
  `agent_docs/external-mev-commit.md` for the deep scope map
- First end-to-end `/prime` run to confirm clone + summary + skill
  discovery all work

**Phase D — Drift test + CI (~1–2 commits)**
- Extend `tests/contracts-abi/abi-drift.test.ts` with a "when
  `.external/mev-commit/contracts-abi/abi/<name>.abi` exists, diff
  ours against upstream" case. Gated on the file being present so the
  default test run still passes without a clone.
- Add `npm run test:externals` script
- `.github/workflows/externals.yml` — weekly + manual; clones +
  runs the drift test
- Add the workflow to the README CI table

Total: **5–6 commits**, each independently reviewable.

---

When you give the green light, I'll execute the phases in order with
`/verify` between each. Let me know if anything in the resolved
decisions needs adjustment before I start.
