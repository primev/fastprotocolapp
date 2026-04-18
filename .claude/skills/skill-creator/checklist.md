# Skill checklist

Before committing a new or edited skill:

- [ ] Frontmatter has `name` (kebab-case) and `description` (starts with "Use when…")
- [ ] Description mentions concrete files, symbols, or feature names an agent would pattern-match on
- [ ] No code snippets from `src/` inlined — all citations use `src/path/file.ts:42` form
- [ ] SKILL.md under ~150 lines
- [ ] Anything longer split into sibling reference files, linked from SKILL.md
- [ ] "When to use" section is 1-3 bullets, not a paragraph
- [ ] "Guardrails" section captures the top 3 mistakes that domain invites
- [ ] No overlap with another skill's trigger (if overlap, merge or disambiguate descriptions)
- [ ] Verified that `/prime` does **not** auto-load this skill (it shouldn't — skills are Tier 2)
- [ ] If the skill includes scripts, they're in `scripts/` and are executable (`chmod +x`)
- [ ] Added to the skill table in `CLAUDE.md` under "Skills (load when task matches)"
- [ ] Added to the skill list in `.claude/README.md`
