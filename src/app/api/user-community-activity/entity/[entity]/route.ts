import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/fast-db"

/**
 * GET /api/user-community-activity/entity/[entity]
 * Returns users who have verified activity for the given entity.
 * Query params:
 *   limit  – page size (default 50, max 1000)
 *   offset – number of rows to skip (default 0)
 *   chainId – optional chain filter
 *
 * Response includes `total` so clients can paginate through all results.
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
    const limitParam = searchParams.get("limit")
    const limitRaw = limitParam ? parseInt(limitParam, 10) : 50
    const limit = Math.min(Math.max(limitRaw, 1), 1000)

    const offsetParam = searchParams.get("offset")
    const offsetRaw = offsetParam ? parseInt(offsetParam, 10) : 0
    const offset = Math.max(offsetRaw, 0)

    const chainIdParam = searchParams.get("chainId")
    const chainId = chainIdParam !== null && chainIdParam !== "" ? parseInt(chainIdParam, 10) : null

    const values: unknown[] = [entityTrimmed]
    let paramIndex = 2

    const chainFilter =
      chainId !== null && !Number.isNaN(chainId) ? `AND chainid = $${paramIndex++}` : ""
    if (chainId !== null && !Number.isNaN(chainId)) {
      values.push(chainId)
    }

    const limitIdx = paramIndex++
    const offsetIdx = paramIndex++
    values.push(limit, offset)

    const [{ rows }, countResult] = await Promise.all([
      pool.query(
        `SELECT user_address, activity, chainid, created_at
         FROM (
           SELECT user_address, activity, chainid, created_at,
                  ROW_NUMBER() OVER (PARTITION BY user_address ORDER BY created_at DESC) AS rn
           FROM user_activity
           WHERE entity = $1 ${chainFilter}
         ) sub
         WHERE rn = 1
         ORDER BY created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        values
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM (
           SELECT DISTINCT user_address
           FROM user_activity
           WHERE entity = $1 ${chainFilter}
         ) sub`,
        values.slice(0, chainId !== null && !Number.isNaN(chainId) ? 2 : 1)
      ),
    ])

    const users = rows.map((row) => ({
      wallet: row.user_address,
      activity: row.activity === true,
      chainId: row.chainid ?? null,
      createdAt: row.created_at,
    }))

    const total = countResult.rows[0]?.total ?? 0

    return NextResponse.json({ users, total, limit, offset })
  } catch (err) {
    console.error("Error fetching users by entity:", err)
    return NextResponse.json({ error: "Database query failed" }, { status: 500 })
  }
}
