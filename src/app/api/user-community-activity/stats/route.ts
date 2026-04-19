import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { pool } from "@/lib/settlement/db"
import { parseSearchParams } from "@/lib/api/parse"

// Both filters are optional. `entity` trims whitespace before it becomes a
// SQL param so a caller can't sneak trailing-whitespace duplicates past
// the distinct counts.
const querySchema = z.object({
  entity: z.string().trim().min(1).optional(),
  chainId: z.coerce.number().int().optional(),
})

/**
 * GET /api/user-community-activity/stats
 * Returns aggregate stats for user_activity. Optional filters: entity, chainId.
 */
export async function GET(request: NextRequest) {
  const parsed = parseSearchParams(request, querySchema)
  if (parsed instanceof NextResponse) return parsed
  const { entity, chainId } = parsed

  try {
    const filters: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    if (entity) {
      filters.push(`entity = $${paramIndex++}`)
      values.push(entity)
    }
    if (chainId !== undefined) {
      filters.push(`chainid = $${paramIndex++}`)
      values.push(chainId)
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
