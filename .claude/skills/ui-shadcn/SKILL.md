---
name: ui-shadcn
description: Use when adding or modifying React components under src/components/**, particularly ui/ (shadcn primitives), shared/, or domain folders. Covers Tailwind conventions, Radix composition, shadcn update workflow, and accessibility basics.
---

# UI: shadcn + Radix + Tailwind

Components are organized by domain. `ui/` holds shadcn primitives (generated from `components.json`); everything else composes them.

## When to use

- Creating a new component or modifying an existing one
- Adding a new shadcn primitive
- Working on design tokens (Tailwind config + `globals.css`)
- Composing dialogs, popovers, sheets, drawers (mostly Radix)

## Key files

- `src/components/ui/` — shadcn primitives (button, dialog, input, etc.)
- `src/components/shared/` — cross-domain reusable components
- Domain folders: `dashboard/`, `swap/`, `claim/`, `onboarding/`, `landing/`, `referral/`, `network-checker/`, `modals/`, `pwa/`, `learn/`
- `components.json` — shadcn config
- `tailwind.config.ts` — design tokens, plugin config
- `src/app/globals.css` — base styles + CSS variables

## References

- Component conventions: [`component-conventions.md`](./component-conventions.md)
- Accessibility: [`accessibility.md`](./accessibility.md)

## Workflow

1. Check if a shadcn primitive already covers the need in `src/components/ui/`.
2. If yes, compose it in a domain folder — don't modify `ui/` unless the change is design-system-wide.
3. If you need a new shadcn primitive, use the shadcn CLI so `components.json` stays consistent.
4. Use `cn()` from `src/lib/utils.ts` to merge Tailwind classes; avoid string concatenation.
5. For conditional variants, use `class-variance-authority` (already a dep).
6. Use `@radix-ui/*` primitives directly only when shadcn hasn't wrapped them yet; check `src/components/ui/` first.

## Guardrails

- Never edit a file in `src/components/ui/` to add domain-specific logic — push it to `shared/` or the domain folder.
- Never import a design token directly from a component — go through Tailwind classes or CSS variables.
- Never add a new UI library (MUI, Chakra, Mantine) — the design system is shadcn/Radix/Tailwind.
- Prefer Radix primitives for a11y (focus trapping, aria, keyboard) over hand-rolled solutions.
- Animations: `motion` and `framer-motion`-style APIs via `motion` package; keep animations subtle on data-dense surfaces.

## Verification

- `/verify`
- `npm run dev` — eyeball in the browser at multiple widths. The app is mobile-first; test narrow viewports.
