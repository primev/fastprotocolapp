# `.claude/` — agent infrastructure map

This directory configures Claude Code for the Fast Protocol App. Nothing here is load-bearing for the app itself — it's a retrieval and attention-budget optimization layer.

## Layout

```
.claude/
├── README.md           # You are here
├── settings.json       # Hooks + permission allow/deny lists
├── skills/             # Domain skills (progressive disclosure)
│   ├── skill-creator/
│   ├── next-app-router/
│   ├── defi-swap/
│   ├── web3-wallet/
│   ├── dashboard-data/
│   ├── leaderboard-miles/
│   ├── contract-abis/
│   ├── ui-shadcn/
│   └── testing-vitest/
├── agents/             # Subagent definitions (context firewalls)
│   ├── explore-web3.md
│   ├── security-reviewer.md
│   ├── ui-verifier.md
│   └── abi-tracer.md
├── commands/           # Slash commands
│   ├── prime.md
│   ├── verify.md
│   ├── typecheck.md
│   ├── lint.md
│   ├── test.md
│   ├── new-skill.md
│   └── review-diff.md
└── hooks/              # Shell scripts invoked by settings.json hooks
    ├── post-edit-typecheck.sh
    └── stop-format-check.sh
```

## Design principles (from the research corpus)

1. **Progressive disclosure.** SKILL.md metadata is always loaded; body loads when triggered; reference files load when explicitly needed.
2. **Silent success, loud failure.** Hooks print nothing when clean.
3. **Pointers over copies.** All content cites `src/path/file.ts:42`; nothing is inlined.
4. **Subagents as firewalls.** Reading many files happens in a subagent, not the parent context.
5. **Verification is a first-class primitive.** `/verify` is the single most important command here.

## Doc layer convention — one source of truth per topic

To prevent drift, the three doc surfaces have **non-overlapping roles**:

| Layer | Audience | Role | Loads |
|---|---|---|---|
| `.claude/skills/` | agents | HOW-TO — patterns, do/don't, code snippets | on relevance |
| `agent_docs/` | agents | MAP — pointers to code + cross-links to skills | on demand |
| `docs/` | humans | NARRATIVE — UX behavior, SQL reference, product flow | banner-gated |

Rules:
- Each topic has exactly one authoritative home. Others link, they don't duplicate.
- `docs/*.md` files carry an "Audience: humans" banner at the top pointing to the authoritative skill or agent_doc.
- Moving a skill or splitting a module → update `agent_docs/architecture.md`
  first (it's the map), then skill cross-links, then any `docs/` pointers.

## Editing

- Adding a skill → use `/new-skill <name>`, which invokes `skill-creator`.
- Adding a hook → edit `settings.json` + drop a script in `hooks/`; keep it silent-on-success.
- Adding a subagent → drop a new `.md` under `agents/` with `name`/`description`/`tools`/`model` frontmatter.
- Adding a command → drop a new `.md` under `commands/`; body is the prompt.

Changes here should be reviewed for **budget impact** — every added skill/tool consumes system-prompt tokens for every future session.

## Local overrides

`.claude/settings.local.json` is gitignored. Use it for personal preferences (extra permissions, model overrides). Do not put team-shared config there.

## Plugins & MCP servers

MCP servers are user-level, not repo-level. This repo does not require any. If you connect one for work here (e.g., Linear), prune unused tools — tool descriptions are a tax on every turn. See the "instruction budget" section of the plan at `/Users/jasonschwarz/.claude/plans/inherited-herding-penguin.md`.
