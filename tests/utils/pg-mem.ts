import { newDb } from "pg-mem"
import type { IMemoryDb } from "pg-mem"

// Test helper: spin up a fresh in-memory Postgres and return a Pool-compatible
// object that runs real SQL. Callers pass a setup callback that creates the
// tables + seed data they need for their test.
//
// Why pg-mem instead of a mocked `pool.query`:
//   - pg-mem parses and executes actual SQL. Mocks only check that `query()`
//     was called with the string we *expect* — they can't catch typos like
//     `SELECT * FROM userr_onboarding` because the string still matches the
//     assertion.
//   - It runs in-process, so tests stay fast and don't need Docker.
//   - It supports `ON CONFLICT`, window functions, and param binding — the
//     features this app actually uses.
//
// Limitations to know about:
//   - No native array ops that rely on Postgres-only extensions.
//   - Trigger semantics are limited. Not an issue for this app today.
//   - Timezone / timestamp formatting can differ from real pg; assert on
//     values, not serialization.
//
// Usage:
//   const { pool, db } = makeTestPool(async (sql) => {
//     await sql`CREATE TABLE user_onboarding (...)`
//     await sql`INSERT INTO user_onboarding ...`
//   })
//   vi.mock("@/lib/settlement/db", () => ({ pool }))

export interface TestPoolHandle {
  /** The pg-mem-provided Pool, type-compatible with `pg`'s Pool. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pool: any
  /** Raw pg-mem handle, for direct SQL outside the Pool (seeding, introspection). */
  db: IMemoryDb
  /** Reset the database to a clean state. Useful in `beforeEach`. */
  reset: () => Promise<void>
  /** Run raw SQL (helpful for seeding). */
  exec: (sql: string) => Promise<void>
}

export async function makeTestPool(
  setup?: (exec: (sql: string) => Promise<void>) => Promise<void>
): Promise<TestPoolHandle> {
  const db = newDb({ autoCreateForeignKeyIndices: true })
  const { Pool } = db.adapters.createPg()
  const pool = new Pool()

  const exec = async (sql: string): Promise<void> => {
    await pool.query(sql)
  }

  if (setup) await setup(exec)

  const backup = db.backup()
  const reset = async () => {
    backup.restore()
  }

  return { pool, db, reset, exec }
}

/**
 * Helper for the `user_onboarding` table used by the route at
 * `src/app/api/user-onboarding/[wallet_address]/route.ts`. Captures the
 * single source of truth for the onboarding columns — if the app schema
 * evolves, update here so tests stay in sync.
 */
export const USER_ONBOARDING_SCHEMA = `
  CREATE TABLE user_onboarding (
    wallet_address TEXT PRIMARY KEY,
    connect_wallet_completed BOOLEAN NOT NULL DEFAULT FALSE,
    setup_rpc_completed BOOLEAN NOT NULL DEFAULT FALSE,
    mint_sbt_completed BOOLEAN NOT NULL DEFAULT FALSE,
    x_completed BOOLEAN NOT NULL DEFAULT FALSE,
    telegram_completed BOOLEAN NOT NULL DEFAULT FALSE,
    discord_completed BOOLEAN NOT NULL DEFAULT FALSE,
    email_completed BOOLEAN NOT NULL DEFAULT FALSE
  )
`

/**
 * Helper for the `user_activity` table used by
 * `src/app/api/user-community-activity/...`.
 */
export const USER_ACTIVITY_SCHEMA = `
  CREATE TABLE user_activity (
    id SERIAL PRIMARY KEY,
    user_address TEXT NOT NULL,
    entity TEXT NOT NULL,
    activity BOOLEAN NOT NULL,
    chainid INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`
