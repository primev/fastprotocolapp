import { defineConfig } from "vitest/config"
import path from "path"

// Tests live in the top-level `tests/` directory, mirroring `src/`:
//   tests/lib/<feature>/<file>.test.ts   → src/lib/<feature>/<file>.ts
//   tests/hooks/<name>.test.ts           → src/hooks/<name>.ts
//   tests/api/<route>.test.ts            → src/app/api/<route>/route.ts
//   tests/components/<path>.test.tsx     → src/components/<path>.tsx
//   tests/utils/                         → shared test helpers (not tests)
//
// Why top-level `tests/` instead of colocated `__tests__/`:
//   - One directory to load when you want to see the whole test surface.
//   - Tests and production code don't share folders → easier coverage gating,
//     lint overrides, and bundle exclusion.
//   - The post-edit-test.sh hook looks for `tests/<mirror>.test.*` first, so
//     saving a source file automatically runs its test if one exists.

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/utils/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/types/**",
        "src/env/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
