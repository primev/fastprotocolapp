/**
 * SQL Registry - Loads SQL queries from centralized queries file
 * This is a thin wrapper around the QUERIES constant for backward compatibility
 */

import { QUERIES } from "../queries"

/**
 * Registry mapping query keys to SQL strings
 * All SQL queries are stored as TypeScript template literals in queries.ts
 */
export const sqlMap: Record<string, string> = QUERIES

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
