/**
 * SQL Registry - Loads and maps SQL query files
 * Uses fs.readFileSync for server-side file loading in Next.js
 */

import { readFileSync } from "fs"
import { join } from "path"

// Base directory for SQL files (relative to project root)
const SQL_BASE_DIR = join(process.cwd(), "src/lib/analytics/sql")

/**
 * Reads a SQL file from the filesystem
 */
function readSqlFile(relativePath: string): string {
  const fullPath = join(SQL_BASE_DIR, relativePath)
  try {
    const content = readFileSync(fullPath, "utf-8")
    return content.trim()
  } catch (error) {
    throw new Error(
      `Failed to read SQL file: ${relativePath}. Error: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

// Load SQL files
const listBlocks = readSqlFile("transactions/get-transactions-analytics.sql")
const getActiveTraders = readSqlFile("transactions/get-transactions-analytics.sql") // Reuses same query
const getSwapCount = readSqlFile("transactions/get-swap-count.sql")
const getSwapVolume = readSqlFile("transactions/get-swap-volume.sql")
const mainLeaderboard = readSqlFile("leaderboard/main-leaderboard.sql")
const leaderboardUserData = readSqlFile("leaderboard/user-data.sql")
const leaderboardUserRank = readSqlFile("leaderboard/user-rank.sql")
const leaderboardNextRank = readSqlFile("leaderboard/next-rank-threshold.sql")
const getUserSwapVolume = readSqlFile("users/get-user-swap-volume.sql")

/**
 * Registry mapping query keys to SQL strings
 * This map is frozen to prevent accidental modification
 */
export const sqlMap: Record<string, string> = Object.freeze({
  // Transactions domain
  "transactions/get-transactions-analytics": listBlocks,
  "transactions/get-active-traders": getActiveTraders,
  "transactions/get-swap-count": getSwapCount,
  "transactions/get-swap-volume": getSwapVolume,

  // Leaderboard domain
  "leaderboard/main-leaderboard": mainLeaderboard,
  "leaderboard/user-data": leaderboardUserData,
  "leaderboard/user-rank": leaderboardUserRank,
  "leaderboard/next-rank-threshold": leaderboardNextRank,

  // Users domain
  "users/get-user-swap-volume": getUserSwapVolume,
})

/**
 * Loads a SQL query by key from the registry
 * @param key Query key (e.g., "transactions/get-swap-count")
 * @returns SQL string
 * @throws Error if query key not found
 */
export function loadSql(key: string): string {
  const sql = sqlMap[key]
  if (!sql) {
    const availableKeys = Object.keys(sqlMap).join(", ")
    throw new Error(`Unknown SQL query key: ${key}. Available keys: ${availableKeys}`)
  }
  return sql
}
