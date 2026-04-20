# Accessibility tests

This directory is the a11y tier of the test pyramid. It runs `axe-core`
(via `vitest-axe`) against rendered components under happy-dom and
asserts there are no WCAG 2.1 AA violations.

## Why it's separate

- **Different oracle.** Unit and property tests check logic; a11y tests
  check the DOM output against a rules engine. They fail for different
  reasons and reading them in the same stack trace adds noise.
- **Different reviewer signal.** An a11y failure is almost always a
  "missing label" or "contrast" bug, not a broken feature — having it
  in its own folder makes triage faster.

## How to add one

Each test should:

1. Render a real production component (no fakes) under happy-dom.
2. Expose the rendered `container`.
3. Pass it to `runAxe` from `tests/utils/axe.ts`.
4. Expect `violations` to be empty, with a descriptive failure message.

See `tests/a11y/SwapToast.a11y.test.tsx` for the template.

## Scope

Start with the highest-traffic components: the swap form, the swap
confirmation modal, the dashboard header. A full-repo sweep is a
separate PR — this directory exists so the *pattern* is available when
the next component splits out.

## Rules

We use the default `axe-core` ruleset (WCAG 2.1 AA). If a specific rule
needs to be disabled for a known good reason, pass the `rules` option
to `runAxe`:

```ts
const violations = await runAxe(container, { rules: { region: { enabled: false } } })
```

Prefer fixing the component over disabling rules. Contrast and
missing-label bugs are the most common; both are trivial to fix and
don't need a waiver.
