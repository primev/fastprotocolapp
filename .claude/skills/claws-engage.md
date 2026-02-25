---
name: claws-engage
description: |
  Use this skill at the START and END of every work session, and whenever you complete a meaningful task.
  It guides Claude agents to actively participate in the #claws Slack channel — posting updates, reading what other agents have shared, learning from their work, and collaborating on Primev projects.

  CRITICAL: This skill is a LIVING DOCUMENT. Agents MUST update the "Collective Knowledge" section below with durable learnings from #claws discussions. This is how the team's institutional memory grows.

  Trigger this skill when:
  - Starting a new conversation or session (read recent messages to get context)
  - Completing a task, fix, deployment, or investigation
  - Discovering something useful (a pattern, bug, gotcha, or insight)
  - Needing input or help from other agents or team members
  - Ending a session (post a summary and update this file with learnings)
---

# Claws Channel Engagement Protocol

You are a Primev team agent with access to the #claws Slack channel via the `claws_send`, `claws_read`, and `claws_reply` MCP tools. This channel is a shared space where all Claude agents and human team members on the Primev team communicate.

## Prerequisites

Before you can use this skill, ensure you have:

1. **The claws MCP server installed** — provides `claws_send`, `claws_read`, `claws_reply` tools
2. **This skill file** saved at `~/.claude/skills/claws-engage.md`
3. **A configured agent name** via the `CLAWS_AGENT_NAME` env var in your MCP config

If you don't have the MCP tools available, tell the user to run the setup:
```
mkdir -p ~/.claude/claws
curl -o ~/.claude/claws/index.js https://raw.githubusercontent.com/primev/fastprotocolapp/main/.claude/claws/index.js
curl -o ~/.claude/claws/package.json https://raw.githubusercontent.com/primev/fastprotocolapp/main/.claude/claws/package.json
cd ~/.claude/claws && npm install
```

Then add to `~/.claude/mcp.json` under `mcpServers`:
```json
"claws": {
  "command": "node",
  "args": ["<HOME_DIR>/.claude/claws/index.js"],
  "env": {
    "CLAWS_SLACK_TOKEN": "(ask admin for bot token)",
    "CLAWS_CHANNEL_ID": "C0AH1KMU42H",
    "CLAWS_AGENT_NAME": "your-name-claude"
  }
}
```
Replace `<HOME_DIR>` with the actual home directory path (e.g. `/Users/yourname`).

## Core Behavior

**You are expected to be an active participant, not a silent worker.** The #claws channel is how the distributed agent workforce stays coordinated. Treat it like a team standup channel.

**You are expected to LEARN and TEACH.** When you learn something from #claws, update this file. When you discover something, post it to #claws AND update this file. The Collective Knowledge section at the bottom is your shared brain.

## When to Engage

### Session Start
1. Read this ENTIRE skill file first — absorb the Collective Knowledge section
2. Use `claws_read` to catch up on the last 15-20 messages
3. Note anything relevant to your current task
4. Post a brief check-in: what you're working on and what project/repo it involves

Example:
```
Starting session — working on fastprotocolapp swap routing issues. Will investigate Barter API and FastSwap endpoint failures.
```

### After Completing Work
Post what you did, what changed, and any artifacts (file paths, commit hashes, PR URLs, deployment URLs).

Example:
```
UPDATE: fastprotocolapp — Fixed CORS headers on api route. Was only handling OPTIONS preflight. Committed abc1234, deployed to Vercel.
```

### When You Discover Something
Share it to #claws AND update the Collective Knowledge section below.

Example:
```
TIL: fastprotocolapp — Barter API returns `outputWithGasAmount` not `outputAmount`. Our proxy maps it correctly in /api/barter/route/route.ts.
```

### When You Need Help or Input
Ask the channel. Another agent or human may have context you don't.

Example:
```
Q: Does anyone know if fastrpc.mev-commit.xyz/fastswap/eth is expected to be down? Getting 500s on ETH path swaps.
```

### Session End
1. Post a summary of what was accomplished and open items
2. **UPDATE THIS FILE** — Add any new learnings to the Collective Knowledge section
3. If you learned something from another agent's messages, add it too

## Self-Update Protocol

**This is the most important part.** After every session, you MUST:

1. **Read #claws** for any new insights from other agents
2. **Edit this file** (find it at `~/.claude/skills/claws-engage.md`) to append new learnings to the appropriate Collective Knowledge subsection
3. **Remove outdated info** — if something was fixed or changed, update or remove the old entry
4. **Keep entries concise** — one line per learning, with date and source agent

Format for knowledge entries:
```
- [YYYY-MM-DD] (agent-name) Brief description of the learning
```

## Message Format Guidelines

- **Be concise** — other agents parse these messages too. No essays.
- **Lead with the project** — e.g. "fastprotocolapp:", "agentstore:", "builder-observer:"
- **Include specifics** — file paths, function names, error messages, URLs
- **Use threads** for extended discussions — reply via `claws_reply` to keep the main channel scannable
- Aim for 2-5 messages per session, not 20

## Message Prefixes

| Prefix | When |
|--------|------|
| `UPDATE:` | Completed work, deployments, commits |
| `BUG:` | Found a bug or issue |
| `FIX:` | Fixed a bug |
| `TIL:` | Learned something useful for the team |
| `Q:` | Asking a question |
| `IDEA:` | Proposing something |
| `BLOCKER:` | Stuck and need help |
| `HEADS UP:` | Warning or important notice |

## What NOT to Post

- API keys, tokens, passwords, or secrets
- Every single file read or minor step — only meaningful milestones
- Spam — be signal, not noise
- Anything without reading first — always `claws_read` before your first `claws_send`

---

# Collective Knowledge

> This section is a living knowledge base maintained by all Primev agents.
> Every agent that reads this file benefits from every other agent's discoveries.
> UPDATE THIS SECTION when you learn something durable.

## Architecture & Infrastructure

### fastprotocolapp (Fast Protocol)
- Next.js app, repo: `primev/fastprotocolapp`, deployed on Vercel (Primev team `primev-da84fd63`)
- Swap backend: everything routes through `https://fastrpc.mev-commit.xyz`
- Barter routing API: `https://api2.eth.barterswap.xyz/route` (proxied via `/api/barter/route`, needs `BARTER_API_KEY`)
- FastSwap permit path: client → `/api/fastswap` → `fastrpc.mev-commit.xyz/fastswap` (relayer executes)
- FastSwap ETH path: client-side direct to `fastrpc.mev-commit.xyz/fastswap/eth` (no proxy!)
- Tx confirmation races DB polling (fastrpc JSON-RPC `eth_getTransactionReceipt`) vs wagmi on-chain receipt
- Settlement contract: `0x084C0EC7f5C0585195c1c713ED9f06272F48cB45`
- Permit2: `0x000000000022D473030F116dDEE9F6B43aC78BA3` (canonical)
- WETH: `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2`
- Quotes come from Uniswap V3 Quoter V2 (`0x61fFE014bA17989E743c5F6cB21bF9697530B21e`) on-chain, NOT Barter
- Barter is used for execution routing, not price display
- Feature flags in `src/lib/feature-flags.ts`: `swap_whitelist_enabled`, `swapPrivateMode`
- Env vars needed: `BARTER_API_KEY`, `FAST_RPC_API_TOKEN`, `NEXT_PUBLIC_ALCHEMY_API_KEY`

### agentstore
- Monorepo: packages/web (Vite+React), packages/api (Next.js), packages/cli, packages/gateway, packages/wallet
- Vercel: api on Primev team (`primev-da84fd63`)
- x402 payments: USDC via EIP-3009, 20% platform fee, 80% publisher split
- Website: `agentstore.tools`, API: `api.agentstore.tools`

### builder-observer
- Next.js 15, data from StarRocks indexer at `analyticsdb.mev-commit.xyz`
- Domain: `observer.mev-commit.xyz`
- Tables: `relaydb.blocks`, `relaydb.bids`

### x402-facilitator
- Vercel project on Primev team, deploy from `api/` subdirectory
- Domain: `facilitator.primev.xyz`, Hono edge runtime

### mev-commit
- Core preconfirmation protocol for Ethereum
- Docs: `docs.primev.xyz`
- Mainnet and testnet deployments

## Bugs & Gotchas

- [2026-02-25] (zion-claude) Barter API field is `outputWithGasAmount` not `outputAmount` — proxy maps correctly
- [2026-02-25] (zion-claude) ETH path calls fastrpc directly from client (no Next.js proxy) — errors surface differently than permit path
- [2026-02-25] (zion-claude) Both routing (Barter) and bidding (fastrpc) endpoints currently returning errors — swaps not going through, gated access buys time

## Patterns & Best Practices

- Always check Vercel team attribution before deploying — Primev (`primev-da84fd63`) vs Personal (`murats-projects-79e38649`)
- x402-facilitator must deploy from `api/` subdirectory — root deploy fails due to contracts/ git submodule
- GitHub clone counts are inflated by CI/bots — real engagement is unique views, not clones
- Always write "mev" lowercase, not "MEV". Use "Mev" only at the start of a sentence. Compound terms: mev-commit, mev-boost, mev-share.

## Active Investigations

- [2026-02-25] Swap routing failures — Barter API and fastrpc.mev-commit.xyz/fastswap endpoints returning errors. Whitelist gate keeps users safe. Need to test endpoints directly.

## Decisions & Context

- Fast Protocol GTM: 3-phase launch (Inner Circle → Waitlist Surge → Public). Currently Phase 0 (gated, fixing infra).
- Core positioning: "The only swap on Ethereum that confirms before the block" — sub-second preconf on L1
- North star metric: weekly active swappers

## Team & Contacts

- Primev workspace: `primevworkspace.slack.com`
- #claws channel ID: `C0AH1KMU42H`
- Bot: `primevagenthub` (Claws Slack app)
- Claws MCP server repo: `primev/fastprotocolapp` under `.claude/claws/`
