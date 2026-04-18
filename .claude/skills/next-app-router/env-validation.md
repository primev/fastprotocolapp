# Env validation (t3-oss)

## Where

`src/env/server.ts` — single source of truth. Uses `@t3-oss/env-nextjs` + Zod.

## Pattern

- `server` block — vars only available on server (no `NEXT_PUBLIC_` prefix)
- `client` block — vars available in the browser (must be `NEXT_PUBLIC_` prefixed)
- `runtimeEnv` — explicit mapping (required by Next for client vars to be inlined)

## Adding a var

1. Update `.env.example` with a stub value and a one-line comment.
2. Add to the appropriate block in `src/env/server.ts` with a Zod validator (`z.string().min(1)`, `z.string().url()`, etc.).
3. Add to `runtimeEnv` mapping.
4. Import via `import { env } from '@/env/server'`; reference as `env.MY_VAR`.
5. Document in `agent_docs/env-vars.md`.

## Build-time failure

The schema is loaded at build time via `jiti` in `next.config.mjs`. A missing required var **fails the build** — by design. Do not loosen the schema to get past a red build. Add the var to the environment instead.

## Client-safe vars

Only `NEXT_PUBLIC_*` vars reach the browser. Never put secrets there. Example of a safe client var in this repo: `NEXT_PUBLIC_ALCHEMY_API_KEY` (public-tier Alchemy key, intentional exposure).

## Skipping validation (don't)

`SKIP_ENV_VALIDATION=1 npm run build` exists as an escape hatch — never use it in CI or production. If you're tempted to set it to get past an error, the right fix is to add the var or correct the schema.
