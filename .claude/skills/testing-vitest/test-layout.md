# Test layout

## Where tests live

All tests live at the repo root under `tests/`, mirroring `src/`:

```
tests/
├── api/            <- src/app/api/<route>/route.ts
├── components/     <- src/components/**
├── hooks/          <- src/hooks/**
├── lib/            <- src/lib/**
│   ├── api/
│   ├── settlement/
│   ├── swap/
│   └── tokens/
└── utils/          <- shared helpers (excluded from runner discovery)
```

Colocated `src/**/__tests__/*.test.ts` is **no longer used**. If you see
one, move it into `tests/<mirror>/`.

The `post-edit-test.sh` hook discovers tests via this mirror — saving
`src/lib/swap/quote-guard.ts` auto-runs `tests/lib/swap/quote-guard.test.ts`
if it exists.

## Naming

- `<module>.test.ts` for plain logic
- `<Component>.test.tsx` for React components

## Imports

- Source under test: use the `@/` alias → `import { foo } from "@/lib/swap/quote-guard"`
- Test helpers: use relative paths → `import { fx } from "../utils/mock-next-request"`
- The `@` alias is reserved for production code; keeping helpers relative
  prevents a misnamed helper from accidentally shadowing a source file.

## Structure of a test file

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { subject } from "@/lib/<path>/<module>"

describe("subject", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("does X when Y", () => {
    expect(subject(inputs)).toBe(expected)
  })
})
```

- One `describe` per module, unless you need sub-grouping.
- `it("does X when Y")` — descriptive, reads like documentation.
- `beforeEach` clears mocks to avoid per-test bleed.

## Vitest-specific

- Use `vi.mock("<path>", factory)` at top-level, not inside test bodies.
- Use `vi.fn()` for ad-hoc mocks.
- Use `vi.hoisted()` when you need a mocked symbol referenced by a hoisted
  `vi.mock`.

## Coverage expectations

No hard threshold today. Aim for: high coverage on `src/lib/` pure utilities;
reasonable coverage on hooks with non-trivial logic; spot coverage on
components. Coverage config in `vitest.config.ts` excludes `src/env/`,
`src/types/`, and `.d.ts` files — these are contracts, not runtime.

## Do not

- Don't skip tests (`.skip`, `.todo`) in committed code without a comment
  explaining why.
- Don't commit `.only` tests.
- Don't test third-party library internals.
- Don't run watch mode from an agent — use `npm run test:run`.
