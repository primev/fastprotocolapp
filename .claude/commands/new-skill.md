---
description: Scaffold a new skill in .claude/skills/ following the skill-creator conventions. Pass the skill name as an argument (kebab-case).
---

Scaffold a new skill named `$ARGUMENTS`.

1. Load `.claude/skills/skill-creator/SKILL.md` and its `anatomy.md` / `checklist.md`.
2. Create `.claude/skills/$ARGUMENTS/SKILL.md` with the frontmatter template, with `name` matching the directory name and a **placeholder** description the user must fill in.
3. Leave the body as a template using the section order from `anatomy.md`.
4. Print the checklist from `.claude/skills/skill-creator/checklist.md` and ask the user for:
   - the real `description` (the trigger)
   - the key files this skill should point at
   - any sibling reference files to scaffold
5. Do not commit. The user reviews and edits before merging.

If the directory already exists, stop and ask the user whether to replace or edit.
