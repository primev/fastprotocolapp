import { NextResponse } from "next/server"
import { get } from "@vercel/edge-config"

export const runtime = "edge"

const DEFAULT_POLL_INTERVAL_MS = 15000

export async function GET() {
  try {
    const pollIntervalMs = await get<number>("leaderboard_poll_interval_ms")
    return NextResponse.json(
      {
        pollIntervalMs:
          typeof pollIntervalMs === "number" && pollIntervalMs > 0
            ? pollIntervalMs
            : DEFAULT_POLL_INTERVAL_MS,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  } catch (error) {
    console.error("[leaderboard-poll] Edge Config read failed:", error)
    return NextResponse.json(
      { pollIntervalMs: DEFAULT_POLL_INTERVAL_MS },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
    )
  }
}
