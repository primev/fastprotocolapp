import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { pool } from "@/lib/settlement/db"
import { parseJson, parseParams } from "@/lib/api/parse"
import { walletAddressSchema } from "@/lib/api/schemas"

// One source of truth for onboarding columns. The DB schema and the Zod
// body schema are both built from this list, so a new step added here
// propagates to reads, writes, and validation.
const ONBOARDING_FIELDS = [
  "connect_wallet_completed",
  "setup_rpc_completed",
  "mint_sbt_completed",
  "x_completed",
  "telegram_completed",
  "discord_completed",
  "email_completed",
] as const

const paramsSchema = z.object({ wallet_address: walletAddressSchema })

// Every field is an optional boolean: POST is a partial update, PUT is a
// full replace, and both accept any subset of these keys.
const onboardingBodySchema = z.object(
  Object.fromEntries(ONBOARDING_FIELDS.map((f) => [f, z.boolean().optional()])) as Record<
    (typeof ONBOARDING_FIELDS)[number],
    z.ZodOptional<z.ZodBoolean>
  >
)

/**
 * GET /api/user-onboarding/[wallet_address]
 * Read user onboarding data by wallet address.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet_address: string }> }
) {
  const parsed = await parseParams(params, paramsSchema)
  if (parsed instanceof NextResponse) return parsed
  const address = parsed.wallet_address

  try {
    const { rows } = await pool.query("SELECT * FROM user_onboarding WHERE wallet_address = $1", [
      address,
    ])
    if (rows.length === 0) return NextResponse.json({ error: "User not found" }, { status: 404 })
    return NextResponse.json({ user: rows[0] })
  } catch (err) {
    console.error("Error fetching user onboarding:", err)
    return NextResponse.json({ error: "Database query failed" }, { status: 500 })
  }
}

/**
 * POST /api/user-onboarding/[wallet_address]
 * Create if missing, otherwise update only the fields provided in the body.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ wallet_address: string }> }
) {
  const parsedParams = await parseParams(params, paramsSchema)
  if (parsedParams instanceof NextResponse) return parsedParams
  const address = parsedParams.wallet_address

  const body = await parseJson(request, onboardingBodySchema)
  if (body instanceof NextResponse) return body

  try {
    const { rows: existingRows } = await pool.query(
      "SELECT * FROM user_onboarding WHERE wallet_address = $1",
      [address]
    )

    if (existingRows.length === 0) {
      // Create: unset fields default to false so the row always has all columns.
      const values = ONBOARDING_FIELDS.map((field) => body[field] ?? false)
      const placeholders = ONBOARDING_FIELDS.map((_, i) => `$${i + 2}`).join(", ")
      const { rows } = await pool.query(
        `INSERT INTO user_onboarding (wallet_address, ${ONBOARDING_FIELDS.join(", ")})
         VALUES ($1, ${placeholders})
         RETURNING *`,
        [address, ...values]
      )
      return NextResponse.json({ user: rows[0] }, { status: 201 })
    }

    // Update: only touch columns the caller explicitly sent.
    const updates = ONBOARDING_FIELDS.filter((f) => body[f] !== undefined).map((f) => ({
      field: f,
      value: body[f] as boolean,
    }))
    if (updates.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const setClause = updates.map((u, i) => `${u.field} = $${i + 1}`).join(", ")
    const values = updates.map((u) => u.value)
    const { rows } = await pool.query(
      `UPDATE user_onboarding
       SET ${setClause}
       WHERE wallet_address = $${updates.length + 1}
       RETURNING *`,
      [...values, address]
    )
    return NextResponse.json({ user: rows[0] })
  } catch (err) {
    console.error("Error creating/updating user onboarding:", err)
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 })
  }
}

/**
 * PUT /api/user-onboarding/[wallet_address]
 * Upsert that replaces every column with the body value (missing fields
 * default to false). Use POST when you want to preserve existing columns.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ wallet_address: string }> }
) {
  const parsedParams = await parseParams(params, paramsSchema)
  if (parsedParams instanceof NextResponse) return parsedParams
  const address = parsedParams.wallet_address

  const body = await parseJson(request, onboardingBodySchema)
  if (body instanceof NextResponse) return body

  try {
    const values = ONBOARDING_FIELDS.map((field) => body[field] ?? false)
    const { rows } = await pool.query(
      `INSERT INTO user_onboarding (wallet_address, ${ONBOARDING_FIELDS.join(", ")})
       VALUES ($1, ${ONBOARDING_FIELDS.map((_, i) => `$${i + 2}`).join(", ")})
       ON CONFLICT (wallet_address)
       DO UPDATE SET ${ONBOARDING_FIELDS.map((f, i) => `${f} = $${i + 2}`).join(", ")}
       RETURNING *`,
      [address, ...values]
    )
    return NextResponse.json({ user: rows[0] }, { status: rows[0] ? 200 : 201 })
  } catch (err) {
    console.error("Error updating user onboarding:", err)
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 })
  }
}
