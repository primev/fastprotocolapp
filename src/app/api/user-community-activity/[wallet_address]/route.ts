import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/fast-db"

function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

async function getValidatedWalletAddress(
  params: Promise<{ wallet_address: string }>
): Promise<{ address: string } | { error: NextResponse }> {
  const { wallet_address } = await params

  if (!wallet_address) {
    return {
      error: NextResponse.json({ error: "Wallet address is required" }, { status: 400 }),
    }
  }

  if (!isValidWalletAddress(wallet_address)) {
    return {
      error: NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 }),
    }
  }

  return { address: wallet_address.toLowerCase() }
}

/**
 * GET /api/user-community-activity/[wallet_address]
 * Returns the latest activity per entity for the user (e.g. ecosystem set verifications).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ wallet_address: string }> }
) {
  try {
    const result = await getValidatedWalletAddress(params)
    if ("error" in result) return result.error

    const { rows } = await pool.query(
      `SELECT entity, activity
       FROM (
         SELECT entity, activity,
                ROW_NUMBER() OVER (PARTITION BY entity ORDER BY created_at DESC) AS rn
         FROM user_activity
         WHERE user_address = $1
       ) sub
       WHERE rn = 1`,
      [result.address]
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
 * Save or update one entity's activity. Body: { entity: string, activity: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ wallet_address: string }> }
) {
  try {
    const result = await getValidatedWalletAddress(params)
    if ("error" in result) return result.error

    const body = await request.json()
    const entity = typeof body?.entity === "string" ? body.entity.trim() : null
    const activity = body?.activity === true || body?.activity === "true"

    if (!entity) {
      return NextResponse.json(
        { error: "entity is required and must be a non-empty string" },
        { status: 400 }
      )
    }

    await pool.query(
      `INSERT INTO user_activity (user_address, entity, activity)
       VALUES ($1, $2, $3)`,
      [result.address, entity, activity]
    )

    return NextResponse.json({ ok: true, entity, activity }, { status: 201 })
  } catch (err) {
    console.error("Error saving user community activity:", err)
    return NextResponse.json({ error: "Database operation failed" }, { status: 500 })
  }
}
