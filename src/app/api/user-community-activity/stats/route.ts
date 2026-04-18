import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { pool } from "@/lib/settlement/db"

/**
 * GET /api/user-community-activity/stats
 * Returns aggregate stats for user_activity. Query params: entity (optional), chainId (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const entity = searchParams.get("entity")?.trim() || null
    const chainIdParam = searchParams.get("chainId")
    const chainId = chainIdParam !== null && chainIdParam !== "" ? parseInt(chainIdParam, 10) : null

    const filters: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (entity) {
      filters.push(`entity = $${paramIndex}`)
      values.push(entity)
      paramIndex++
    }
    if (chainId !== null && !Number.isNaN(chainId)) {
      filters.push(`chainid = $${paramIndex}`)
      values.push(chainId)
      paramIndex++
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : ""

    const [totalRes, usersRes, byEntityRes, byChainRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM user_activity ${whereClause}`, values),
      pool.query(
        `SELECT COUNT(DISTINCT user_address)::int AS count FROM user_activity ${whereClause}`,
        values
      ),
      pool.query(
        `SELECT entity, COUNT(*)::int AS count FROM user_activity ${whereClause} GROUP BY entity ORDER BY count DESC`,
        values
      ),
      pool.query(
        `SELECT chainid, COUNT(*)::int AS count FROM user_activity ${whereClause} GROUP BY chainid ORDER BY count DESC`,
        values
      ),
    ])

    const byEntity: Record<string, number> = {}
    for (const row of byEntityRes.rows) {
      byEntity[row.entity] = row.count
    }

    const byChain: Record<number, number> = {}
    for (const row of byChainRes.rows) {
      byChain[row.chainid] = row.count
    }

    return NextResponse.json({
      totalRecords: totalRes.rows[0]?.total ?? 0,
      uniqueUsers: usersRes.rows[0]?.count ?? 0,
      byEntity,
      byChain,
    })
  } catch (err) {
    console.error("Error fetching user activity stats:", err)
    return NextResponse.json({ error: "Database query failed" }, { status: 500 })
  }
}
