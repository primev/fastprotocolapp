import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/fast-db"

/**
 * GET /api/user-community-activity/entity/[entity]
 * Returns all users who have verified activity for the given entity.
 * Query params: chainId (optional)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    const { entity } = await params
    const entityTrimmed = typeof entity === "string" ? entity.trim() : ""

    if (!entityTrimmed) {
      return NextResponse.json({ error: "Entity is required" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const chainIdParam = searchParams.get("chainId")
    const chainId = chainIdParam !== null && chainIdParam !== "" ? parseInt(chainIdParam, 10) : null

    const values: unknown[] = [entityTrimmed]
    let paramIndex = 2

    const chainFilter =
      chainId !== null && !Number.isNaN(chainId) ? `AND chainid = $${paramIndex++}` : ""
    if (chainId !== null && !Number.isNaN(chainId)) {
      values.push(chainId)
    }

    const { rows } = await pool.query(
      `SELECT user_address, activity, chainid, created_at
       FROM (
         SELECT user_address, activity, chainid, created_at,
                ROW_NUMBER() OVER (PARTITION BY user_address ORDER BY created_at DESC) AS rn
         FROM user_activity
         WHERE entity = $1 ${chainFilter}
       ) sub
       WHERE rn = 1
       ORDER BY created_at DESC`,
      values
    )

    const users = rows.map((row) => ({
      wallet: row.user_address,
      activity: row.activity === true,
      chainId: row.chainid ?? null,
      createdAt: row.created_at,
    }))

    return NextResponse.json({ users, total: users.length })
  } catch (err) {
    console.error("Error fetching users by entity:", err)
    return NextResponse.json({ error: "Database query failed" }, { status: 500 })
  }
}
