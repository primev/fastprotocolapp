# Database schema — app-side Postgres

The app reads + writes a small app-owned Postgres database (connection
via `FAST_DAPP_DB_URL`, client in `src/lib/settlement/db.ts`). This
doc is the single source of truth for its schema — the test fixtures
at `tests/utils/pg-mem.ts` mirror these shapes and should stay in
sync.

> **Scope note:** this database is separate from:
> - The StarRocks analytics warehouse read via `src/lib/analytics/`
>   (docs at `docs/leaderboard-queries.md`).
> - The upstream mev-commit preconf-rpc store
>   (`.external/mev-commit/tools/preconf-rpc/store/`).
>
> Only the app-owned Postgres is documented here.

---

## `user_onboarding`

Completion state for the seven onboarding steps the UI walks users
through. One row per wallet.

| Column | Type | Default | Notes |
|---|---|---|---|
| `wallet_address` | `TEXT` | — | Primary key. Lower-cased by `walletAddressSchema` before insert. |
| `connect_wallet_completed` | `BOOLEAN` | `FALSE` | Wallet connected via RainbowKit |
| `setup_rpc_completed` | `BOOLEAN` | `FALSE` | Fast RPC added to the browser wallet |
| `mint_sbt_completed` | `BOOLEAN` | `FALSE` | Genesis SBT minted |
| `x_completed` | `BOOLEAN` | `FALSE` | X (Twitter) follow step |
| `telegram_completed` | `BOOLEAN` | `FALSE` | Telegram join step |
| `discord_completed` | `BOOLEAN` | `FALSE` | Discord join step |
| `email_completed` | `BOOLEAN` | `FALSE` | Email submitted via `use-email-capture` |

### Routes that touch it

- `GET /api/user-onboarding/[wallet_address]` — read the row
- `POST /api/user-onboarding/[wallet_address]` — partial update
  (creates on first call with unset fields defaulting to `false`)
- `PUT /api/user-onboarding/[wallet_address]` — full upsert (missing
  fields set to `false`, `ON CONFLICT (wallet_address)` DO UPDATE)
- `GET /api/users/` — admin list (first 10 users)

### Tests + fixtures

- Integration: `tests/api/user-onboarding.integration.test.ts`
  (pg-mem, real SQL, covers all three methods)
- Mocked: `tests/api/user-onboarding.test.ts` (Zod-validation focus)
- Schema constant: `USER_ONBOARDING_SCHEMA` in `tests/utils/pg-mem.ts`

### Conventions

- **Always lower-case the wallet before querying.** `walletAddressSchema`
  in `@/lib/api/schemas` does this at the route boundary.
- **`PUT` replaces the row** (missing keys → `false`). `POST` preserves
  unsent keys. Don't conflate them.

---

## `user_activity`

Append-only log of community-activity events (partner quest
completions, external-protocol interactions, etc.). One row per event
— `(wallet, entity, created_at)` triple uniquely identifies a record.
Reads use `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY created_at DESC)`
to pick the latest row per partition.

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `SERIAL` | auto | Primary key |
| `user_address` | `TEXT` | — | Lower-cased wallet |
| `entity` | `TEXT` | — | The external protocol / ecosystem-set identifier |
| `activity` | `BOOLEAN` | — | `true` = completed, `false` = undone |
| `chainid` | `INTEGER` | `NULL` | Chain where the activity happened (optional) |
| `created_at` | `TIMESTAMP` | `CURRENT_TIMESTAMP` | Event timestamp; drives ORDER BY in reads |

### Routes that touch it

- `GET /api/user-community-activity/[wallet_address]` — latest
  activity per entity, for one user
- `POST /api/user-community-activity/[wallet_address]` — insert one event
- `GET /api/user-community-activity/[wallet_address]/[entity]` —
  latest activity for one (wallet, entity) pair; 404 if nothing
- `GET /api/user-community-activity/entity/[entity]` — list users
  with activity for an entity (optional `?chainId=` filter)
- `GET /api/user-community-activity/entities/` — distinct entity list
- `GET /api/user-community-activity/stats/` — aggregate stats

### Tests + fixtures

- Schema constant: `USER_ACTIVITY_SCHEMA` in `tests/utils/pg-mem.ts`
- **No integration tests yet** — pg-mem doesn't support the
  `ROW_NUMBER() OVER (...)` window functions these routes use. See
  `agent_docs/audit-followup.md` (testcontainers path forward).
- Mocked-pool tests are possible but not wired.

### Conventions

- **Append-only from the route perspective.** Never `UPDATE` a row;
  insert a new one with updated `activity`. The ROW_NUMBER query
  picks the latest, making "toggle off" a matter of inserting `false`
  rather than mutating.
- **`chainid` is optional.** Missing values mean "not scoped to a
  chain." The entity-level filter respects this — `?chainId=` only
  keeps rows with a matching chain, while absent filter keeps all.

---

## `user_activity` — indices

Not currently declared in the test schema. The route query shapes
suggest these would help at production scale:

- `(user_address, entity, created_at DESC)` — the main read shape
- `(entity, created_at DESC)` — for the entity-level listing

If you add production indices, mirror them in the pg-mem schema so
test behavior matches.

---

## Upstream data surfaces (out of scope here, but linked)

Cross-references for when you need to chase data that isn't in the
app-owned Postgres:

- **StarRocks analytics warehouse** (`mevcommit_57173.*`) — read via
  `src/lib/analytics/services/*`, routes under `src/app/api/analytics/`.
  Tables include `processed_l1_txns_v2` (swap volume + tiers) and
  `fastswap_miles` (populated by the upstream indexer at
  `.external/mev-commit/tools/fastswap-miles/`). Reference:
  `docs/leaderboard-queries.md`.
- **Fuul API** (external HTTPS, not SQL) — used for miles, referrals,
  payouts. Schemas + fixtures at `src/lib/api/upstream.ts` +
  `tests/fixtures/upstream/`. Routes under `src/app/api/fuul/`.
- **Google Sheets** (external) — the waitlist and whitelist storage.
  Client at `src/lib/google-sheets.ts`, cache at
  `src/lib/waitlist-sheet-cache.ts`. Routes under `src/app/api/waitlist/`
  and `src/app/api/whitelist/`.

---

## Adding a new table

1. Write the DDL. Add a `CREATE TABLE` constant to
   `tests/utils/pg-mem.ts` named `<TABLE>_SCHEMA` so test code has a
   single source of truth.
2. Run the migration on the production database separately (this repo
   doesn't have a migration runner; SQL gets applied manually). Note
   the production DDL here with any differences from the test schema
   (indices, grants, etc.).
3. Add a section to this file with columns, defaults, tests, routes
   that touch it.
4. Add a row to `src/app/api/README.md` for each new route.
5. If the route uses window functions or features pg-mem doesn't
   support (see `agent_docs/audit-followup.md`), note that integration
   tests are blocked on testcontainers.
