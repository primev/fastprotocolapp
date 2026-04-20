# tests/

All Vitest test files live here, mirroring `src/`:

```
tests/
├── a11y/                <- WCAG 2.1 AA sweeps via axe-core (own oracle)
├── api/                 <- src/app/api/<route>/route.ts
├── components/          <- src/components/**
├── hooks/               <- src/hooks/**
├── lib/                 <- src/lib/**
│   ├── settlement/
│   ├── swap/
│   └── tokens/
└── utils/               <- shared helpers (not picked up by the runner)
```

## Naming convention

`tests/<mirror>.test.ts(x)` where `<mirror>` matches the path beneath `src/`.
Example: tests for `src/lib/swap/quote-guard.ts` live at
`tests/lib/swap/quote-guard.test.ts`.

## Import rules

- Source under test: use the `@/` alias (`@/lib/swap/quote-guard`).
- Test helpers: use relative paths (`../utils/mock-next-request`). The
  alias is reserved for production code so a misnamed helper can't shadow a
  source file.

## Why a top-level `tests/` folder (and not colocated `__tests__/`)

1. The entire test surface is visible from one directory — useful for
   coverage, lint overrides, and bundle exclusion.
2. Production imports never accidentally pull from tests, because tests
   aren't under `src/`.
3. The `post-edit-test.sh` hook looks up `tests/<mirror>.test.*` first,
   so saving a source file automatically runs its test when one exists.

## Shared helpers

`tests/utils/` is excluded from test discovery. Put factories, fixture
builders, and custom matchers here. Keep it small — a crowded utils folder
is a sign tests are doing too much setup.

## Commands

```bash
npm run test:run          # one-shot — use this in CI and agents
npm run test              # watch mode (human-only)
npm run test:coverage     # v8 coverage
```

Never run watch mode from an automated agent — it hangs.
