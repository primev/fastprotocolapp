import "server-only"
import { NextResponse } from "next/server"
import { pool } from "@/lib/fast-db"

/**
 * GET /api/user-community-activity/entities
 * Returns distinct entities that have at least one activity record.
 */
export async function GET() {
  try {
    const { rows } = await pool.query(`SELECT DISTINCT entity FROM user_activity ORDER BY entity`)

    const entities = rows.map((row) => row.entity)

    return NextResponse.json({ entities })
  } catch (err) {
    console.error("Error fetching entities:", err)
    return NextResponse.json({ error: "Database query failed" }, { status: 500 })
  }
}
