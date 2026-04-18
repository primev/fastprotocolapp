# Component conventions

## File naming

- PascalCase `.tsx` for components: `SwapForm.tsx`, `TokenSelectorModal.tsx`.
- kebab-case `.ts` for non-component files (hooks, utils): `use-swap-form.ts`, `token-resolver.ts`.

## Component file shape

```tsx
"use client"           // only if needed — most leaf components should be server-safe

import { cn } from "@/lib/utils"
// external imports first, then internal (grouped)

interface FooProps {
  // prefer `interface` for public props; `type` for unions/utility
}

export function Foo({ ... }: FooProps) {
  return <div className={cn("…", className)}>…</div>
}
```

- **One primary export per file.** Colocate helpers below or extract if reused.
- **No default exports** for new components — `export function Foo`.
- **Forward `className`** on the root element when the component is reusable.

## Styling

- Tailwind utilities only. No CSS modules, no styled-components.
- Use design tokens via CSS variables in `globals.css` + Tailwind config — don't hardcode hex colors.
- `cn()` from `src/lib/utils.ts` to conditionally merge classes.
- For variant-heavy components, use `class-variance-authority`. Reference: existing `ui/button.tsx`.

## Composition over variants

If a component has 6+ boolean props, split it. Example done right: swap cards are separate `SellCard` and `BuyCard` rather than one polymorphic `SwapCard`.

## Modals, dialogs, drawers

- Desktop: `Dialog` from `ui/dialog.tsx` (Radix).
- Mobile: consider `Drawer` from `ui/drawer.tsx` (Vaul).
- The swap flow modals follow this — see `src/components/swap/TokenSelectorModal.tsx`.

## State in components

- Local UI state: `useState`.
- Shared UI state across siblings: lift, or use a domain-specific Zustand store (see `src/stores/swapToastStore.ts` for the existing pattern).
- Server data: TanStack Query via hooks (see `dashboard-data` skill).

## Don't

- Don't import from `@/components/ui/*` inside `ui/*` — that direction is one-way.
- Don't rename a `ui/` file without running the shadcn sync.
- Don't introduce a new primitive that duplicates an existing Radix component (e.g., a custom `Tooltip` when `ui/tooltip.tsx` exists).
