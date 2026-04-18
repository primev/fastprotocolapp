# Accessibility

Radix primitives handle a lot — use them. Don't roll your own focus trap, aria attributes, or keyboard navigation when Radix covers the case.

## Defaults that Radix handles for you

- Focus trapping in dialogs
- Escape-to-close
- aria-labelledby / aria-describedby wiring
- Keyboard navigation (arrow keys in menus, Enter/Space for triggers)
- Portal-mounted overlays with correct z-index

## What you still need to do

- **Alt text** on every `<img>`. Decorative → `alt=""`.
- **Label** on every form input. Use `ui/label.tsx` + `htmlFor`/`id`.
- **Focus visibility** — ensure Tailwind's `focus-visible:` utilities are present. shadcn defaults do this; preserve them.
- **Color contrast** — 4.5:1 minimum for text, 3:1 for UI chrome.
- **Keyboard-only test** — can you complete the swap flow without a mouse? If not, that's a bug.
- **Motion-respecting** — wrap big animations in `@media (prefers-reduced-motion: reduce)` or use `motion`'s reduced-motion support.

## Wallet UX is often inaccessible

- RainbowKit's default modals are accessible — don't skin them into keyboard-traps.
- Custom network-install flows (`network-checker/`) must announce their state changes. Consider `aria-live="polite"` on status text.

## Testing

- Axe DevTools in the browser catches most issues; not automated here but worth a pass on a new page.
- Manual: Tab through the page. Focus must be visible at every stop.

## Don'ts

- Don't remove `:focus-visible` styles.
- Don't set `tabIndex="-1"` on interactive elements.
- Don't use `div` + `onClick` for a button. Use `<button>` or the `ui/button.tsx` component.
- Don't use color alone to convey status (add an icon / text).
