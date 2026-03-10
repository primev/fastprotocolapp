import { TIER_THRESHOLDS } from "@/lib/constants"

/**
 * Returns the USD volume bounds for a given tier filter.
 * Used to build SQL HAVING clauses for tier-filtered queries.
 */
export function getTierVolumeBounds(tier: string): { min: number; max: number | null } {
  switch (tier) {
    case "gold":
      return { min: TIER_THRESHOLDS.GOLD, max: null }
    case "silver":
      return { min: TIER_THRESHOLDS.SILVER, max: TIER_THRESHOLDS.GOLD }
    case "bronze":
      return { min: TIER_THRESHOLDS.BRONZE, max: TIER_THRESHOLDS.SILVER }
    default:
      return { min: 0, max: null }
  }
}

/**
 * Builds a SQL HAVING clause fragment for tier volume filtering.
 * @param tier The tier to filter by (all/gold/silver/bronze)
 * @param volumeExpr The SQL expression for total volume (e.g., "SUM(COALESCE(swap_vol_usd, 0))")
 * @returns A HAVING clause string, or empty string if no filter needed
 */
export function buildTierHavingClause(tier: string, volumeExpr: string): string {
  if (tier === "all") return ""
  const { min, max } = getTierVolumeBounds(tier)
  const parts: string[] = []
  if (min > 0) parts.push(`${volumeExpr} >= ${min}`)
  if (max !== null) parts.push(`${volumeExpr} < ${max}`)
  return parts.length > 0 ? `HAVING ${parts.join(" AND ")}` : ""
}

/**
 * Builds a SQL HAVING clause that combines an existing HAVING condition with tier filtering.
 */
export function buildCombinedHavingClause(
  tier: string,
  volumeExpr: string,
  existingCondition?: string
): string {
  const parts: string[] = []
  if (existingCondition) parts.push(existingCondition)

  if (tier !== "all") {
    const { min, max } = getTierVolumeBounds(tier)
    if (min > 0) parts.push(`${volumeExpr} >= ${min}`)
    if (max !== null) parts.push(`${volumeExpr} < ${max}`)
  }

  return parts.length > 0 ? `HAVING ${parts.join(" AND ")}` : ""
}

/**
 * Standard pagination response shape
 */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}
