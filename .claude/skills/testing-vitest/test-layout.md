# Test layout

## Where tests live

- `src/lib/__tests__/*.test.ts` — colocated unit tests for lib utilities (existing convention)
- `src/test/utils/` — shared test helpers (renderer, mock factories, fixtures)

There is **no** parallel `tests/` or `__tests__` at the repo root. Don't create one.

## Naming

- `<module>.test.ts` for plain logic
- `<Component>.test.tsx` for React components (when introduced)

## Structure of a test file

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { subject } from '../subject'

describe('subject', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('does X when Y', () => {
    expect(subject(inputs)).toBe(expected)
  })
})
```

- One `describe` per module, unless you need sub-grouping.
- `it('does X when Y')` — descriptive, reads like documentation.
- `beforeEach` clears mocks; avoid per-test mock bleed.

## Vitest-specific

- Use `vi.mock('<path>', factory)` at top-level, not inside test bodies.
- Use `vi.fn()` for ad-hoc mocks.
- Use `vi.hoisted()` when you need a mocked symbol referenced by a hoisted `vi.mock`.

## Coverage expectations

No hard threshold today. Aim for: high coverage on `src/lib/` pure utilities; reasonable coverage on hooks with non-trivial logic; spot coverage on components.

## Do not

- Don't skip tests (`.skip`, `.todo`) in committed code without a comment explaining why.
- Don't commit `.only` tests.
- Don't test third-party library internals.
