import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { pool } from "@/lib/settlement/db"
import { parseParams } from "@/lib/api/parse"
import { walletAddressSchema } from "@/lib/api/schemas"

const paramsSchema = z.object({
  wallet_address: walletAddressSchema,
  entity: z.string().trim().min(1, "Entity is required"),
})

/**
 * GET /api/user-community-activity/[wallet_address]/[entity]
 * Returns the latest activity for a single entity for the user. 404 if no record exists.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ wallet_address: string; entity: string }> }
) {
  const parsed = await parseParams(params, paramsSchema)
  if (parsed instanceof NextResponse) return parsed
  const { wallet_address: address, entity } = parsed

  try {
    const { rows } = await pool.query(
      `SELECT entity, activity, chainid, created_at
       FROM (
         SELECT entity, activity, chainid, created_at,
                ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
         FROM user_activity
         WHERE user_address = $1 AND entity = $2
       ) sub
       WHERE rn = 1`,
      [address, entity]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 })
    }

    const row = rows[0]
    return NextResponse.json({
      entity: row.entity,
      activity: row.activity === true,
      chainId: row.chainid ?? null,
      createdAt: row.created_at,
    })
  } catch (err) {
    console.error("Error fetching user activity for entity:", err)
    return NextResponse.json({ error: "Database query failed" }, { status: 500 })
  }
}
