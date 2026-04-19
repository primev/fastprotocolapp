import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { pool } from "@/lib/settlement/db"
import { parseJson, parseParams } from "@/lib/api/parse"
import { walletAddressSchema } from "@/lib/api/schemas"

const paramsSchema = z.object({ wallet_address: walletAddressSchema })

// Body shape for POST. `activity` accepts the string "true" as a legacy
// holdover — we normalize to boolean at parse time so downstream SQL
// never sees strings.
const postBodySchema = z.object({
  entity: z.string().trim().min(1, "entity is required and must be a non-empty string"),
  activity: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .transform((v) => v === true || v === "true"),
  chainId: z.number().int().nullable().optional(),
})

/**
 * GET /api/user-community-activity/[wallet_address]
 * Returns the latest activity per entity for the user.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ wallet_address: string }> }
) {
  const parsed = await parseParams(params, paramsSchema)
  if (!parsed.ok) return parsed.response
  const address = parsed.data.wallet_address

  try {
    const { rows } = await pool.query(
      `SELECT entity, activity
       FROM (
         SELECT entity, activity,
                ROW_NUMBER() OVER (PARTITION BY entity ORDER BY created_at DESC) AS rn
         FROM user_activity
         WHERE user_address = $1
       ) sub
       WHERE rn = 1`,
      [address]
    )

    const activities: Record<string, boolean> = {}
    for (const row of rows) {
      activities[row.entity] = row.activity === true
    }

    return NextResponse.json({ activities })
  } catch (err) {
    console.error("Error fetching user community activity:", err)
    return NextResponse.json({ error: "Database query failed" }, { status: 500 })
  }
}

/**
 * POST /api/user-community-activity/[wallet_address]
 * Save or update one entity's activity for the user.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ wallet_address: string }> }
) {
  const parsedParams = await parseParams(params, paramsSchema)
  if (!parsedParams.ok) return parsedParams.response
  const address = parsedParams.data.wallet_address

  const body = await parseJson(request, postBodySchema)
  if (!body.ok) return body.response

  try {
    await pool.query(
      `INSERT INTO user_activity (user_address, entity, activity, chainid)
       VALUES ($1, $2, $3, $4)`,
      [address, body.data.entity, body.data.activity, body.data.chainId ?? null]
    )

    return NextResponse.json(
      { ok: true, entity: body.data.entity, activity: body.data.activity, chainId: body.data.chainId ?? null },
      { status: 201 }
    )
  } catch (err) {
    console.error("Error saving user community activity:", err)
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 })
  }
}
