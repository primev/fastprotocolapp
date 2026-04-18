---
name: skill-creator
description: Creating or editing a skill in this repo. Use when the user asks to add a new skill, scaffold a skill directory, or restructure an existing skill. Also use when you notice domain knowledge that would be loaded repeatedly across sessions — that's a candidate for a new skill.
---

# Skill creator

A meta-skill for building other skills in this repo. Follow this shape and skills will compose well with the progressive-disclosure model.

## When to create a new skill

Create a skill when **all** of these are true:

1. The knowledge applies only to a **specific kind of task**, not every session.
2. It's longer than ~10 lines — too much to put in CLAUDE.md without bloat.
3. It has a **clear trigger** you can write as a single `description` sentence starting with "Use when…".

If only (1) and (2) are true, it might belong in `agent_docs/` as a reference file instead (no frontmatter, loaded by link).

## Anatomy

See [`anatomy.md`](./anatomy.md).

## Checklist

See [`checklist.md`](./checklist.md).

## Workflow

1. Pick a directory name: kebab-case, singular, verb-leading if possible (`defi-swap`, `leaderboard-miles`, `testing-vitest`).
2. Create `.claude/skills/<name>/SKILL.md` with the frontmatter template in `anatomy.md`.
3. Keep SKILL.md under ~100 lines. Push anything longer to sibling `.md` reference files.
4. Reference existing code with `src/path/file.ts:42`-style citations — never inline.
5. Run through `checklist.md` before finishing.

## Guardrails

- **No inline code snippets** from files in `src/` — they rot. Always cite.
- **No duplication** — if a skill overlaps with another, the trigger descriptions must disambiguate, or merge the skills.
- **Description is the trigger** — treat it like a search query. Include domain keywords (e.g., "permit2", "slippage", "show_miles_estimate") that the user is likely to type.
- **Progressive disclosure** — split long content into `reference.md`, `patterns.md`, etc. SKILL.md should tell Claude _when_ to open them.

## See also

- The plan: `/Users/jasonschwarz/.claude/plans/inherited-herding-penguin.md`
- `.claude/commands/new-skill.md`
