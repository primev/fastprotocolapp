import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { pool } from "@/lib/settlement/db"
import { parseParams, parseSearchParams } from "@/lib/api/parse"

const paramsSchema = z.object({
  entity: z.string().trim().min(1, "Entity is required"),
})
// Optional chainId filter; we coerce because it arrives as a string.
const querySchema = z.object({
  chainId: z.coerce.number().int().optional(),
})

/**
 * GET /api/user-community-activity/entity/[entity]
 * Returns all users who have activity records for the given entity.
 * Optional `?chainId=` filter narrows to a specific chain.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> }
) {
  const parsedParams = await parseParams(params, paramsSchema)
  if (parsedParams instanceof NextResponse) return parsedParams
  const { entity } = parsedParams

  const parsedQuery = parseSearchParams(request, querySchema)
  if (parsedQuery instanceof NextResponse) return parsedQuery
  const { chainId } = parsedQuery

  try {
    const values: unknown[] = [entity]
    let paramIndex = 2
    const chainFilter = chainId !== undefined ? `AND chainid = $${paramIndex++}` : ""
    if (chainId !== undefined) values.push(chainId)

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
