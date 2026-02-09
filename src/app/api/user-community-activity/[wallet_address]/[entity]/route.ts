import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/fast-db"

function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * GET /api/user-community-activity/[wallet_address]/[entity]
 * Returns the latest activity for a single entity for the user. 404 if no record exists.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ wallet_address: string; entity: string }> }
) {
  try {
    const { wallet_address, entity } = await params

    if (!wallet_address) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 400 })
    }

    if (!isValidWalletAddress(wallet_address)) {
      return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 })
    }

    const entityTrimmed = typeof entity === "string" ? entity.trim() : ""
    if (!entityTrimmed) {
      return NextResponse.json({ error: "Entity is required" }, { status: 400 })
    }

    const address = wallet_address.toLowerCase()

    const { rows } = await pool.query(
      `SELECT entity, activity, chainid, created_at
       FROM (
         SELECT entity, activity, chainid, created_at,
                ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
         FROM user_activity
         WHERE user_address = $1 AND entity = $2
       ) sub
       WHERE rn = 1`,
      [address, entityTrimmed]
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
