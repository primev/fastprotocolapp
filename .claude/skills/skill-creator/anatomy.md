# Skill anatomy

## Frontmatter template

```yaml
---
name: <kebab-case-name>
description: <one sentence starting "Use when...">. Include 3-5 keywords the user is likely to type.
---
```

Optional frontmatter fields (Claude Code):

- `disable-model-invocation: true` — prevents automatic invocation. Useful for destructive workflows that should only fire when the user explicitly invokes the slash command.

## Body structure

Follow this order. Skip sections that don't apply.

```
# <Skill title>

## When to use
<1-3 bullets that make the trigger concrete — concrete file paths, features, symbols>

## Prerequisites / key files
<Bullet list of `src/...` citations the agent should open first>

## Workflow
<Numbered steps for the common task this skill exists to guide>

## Guardrails
<Do / don't for this domain — things that are easy to get wrong>

## See also
<Links to related skills, agent_docs entries, human docs>
```

## Reference files

Split anything longer than ~30 lines into a sibling `.md`. Naming convention:

- `patterns.md` — recurring code patterns in the domain
- `<specific-concept>.md` — e.g., `permit2.md`, `server-actions.md`
- `anti-patterns.md` — what not to do
- `checklist.md` — step-by-step verification

Inside SKILL.md, link via relative path: `[permit2](./permit2.md)`.

## Scripts

Scripts live in a `scripts/` subdirectory of the skill. They are **executable**, not read-in. Claude invokes them via Bash; the source isn't loaded into context. Use scripts for:

- Deterministic calculations
- File scaffolding
- Validation passes

Keep scripts readable — Claude infers intent from filename and a short comment block.

## Size budget

- SKILL.md: aim for 60-100 lines. Hard cap ~150.
- Each reference file: aim for under 200 lines.
- Total skill directory: no hard cap, but if it balloons, split into two skills.

## Frontmatter description anti-patterns

| Bad | Why | Better |
|---|---|---|
| "Swap helper" | No trigger, no keywords | "Use when editing swap flow, quotes, slippage, permit2, or WETH wrap/unwrap under src/components/swap or src/hooks/use-swap-*" |
| "Best practices for everything" | Too broad — will match every task | Split into narrow skills |
| "This skill will help you when…" | Narrator voice wastes tokens | Direct imperative: "Use when…" |
