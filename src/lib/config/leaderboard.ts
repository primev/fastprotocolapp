import { DEFAULT_LEADERBOARD_POLL_INTERVAL } from "@/lib/config/constants"

let cachedPollIntervalMs: number | null = null

export async function getLeaderboardPollIntervalMs(): Promise<number> {
  if (cachedPollIntervalMs !== null) return cachedPollIntervalMs

  try {
    const res = await fetch("/api/config/leaderboard-poll")
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const resolved: number =
      typeof data.pollIntervalMs === "number" && data.pollIntervalMs > 0
        ? data.pollIntervalMs
        : DEFAULT_LEADERBOARD_POLL_INTERVAL
    cachedPollIntervalMs = resolved
    return resolved
  } catch {
    return DEFAULT_LEADERBOARD_POLL_INTERVAL
  }
}
