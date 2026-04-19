# External workspaces

This repo vendors a read-only copy of selected upstream repos under
`.external/` so agents can grep source, ABIs, and protocol types
without MCP round-trips or paying tool-budget tax per turn.

## What's vendored

Declared in [`.claude/externals.json`](../.claude/externals.json).
Current entries:

| Name | Upstream | Tracking | Scope |
|---|---|---|---|
| `mev-commit` | [primev/mev-commit](https://github.com/primev/mev-commit) | `main` | [`external-mev-commit.md`](./external-mev-commit.md) |

## How it's kept in sync

- `/prime` at session start — fetches and fast-forwards every external,
  prints per-external summary (current SHA, commits advanced, age).
- `/sync-externals` mid-session — same sync without re-reading the
  orientation docs. Run when a PR lands upstream and you want the new
  state immediately.
- `.external/` is gitignored; rebuilt on demand. A pre-commit hook
  (see `.claude/hooks/pre-commit-external-guard.sh`) rejects staged
  changes under that path — never edit the vendored mirror.

## Why this instead of MCP

For *code* context — types, ABIs, protocol source, HTTP handler shapes
— local files beat MCP on every axis: zero per-turn tool tax, native
grep, version-pinnable, offline, reproducible, CI-friendly. MCP is
still the right tool for *dynamic* signals (live PR status, CI,
issues) — the two layers are complementary, not competing. See the
design rationale in
[`external-workspaces-plan.md`](./external-workspaces-plan.md).

## Adding a new external

1. Append an entry to `.claude/externals.json` with `name`, `origin`,
   `ref`, optional `sparse` paths, and a `freshness` block.
2. Write a scope map: `agent_docs/external-<name>.md` — what lives at
   which paths inside the upstream, what to ignore, how the app
   consumes it.
3. Create a skill: `.claude/skills/external-<name>/SKILL.md` — tells
   agents WHEN to load this external, pointing at the scope map for
   the deep read.
4. Run `/sync-externals`. Done.

The sync mechanism is entirely driven by the JSON manifest — no script
changes needed per external.
