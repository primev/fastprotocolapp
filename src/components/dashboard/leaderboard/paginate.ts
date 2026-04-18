// Pure pagination helpers for the leaderboard UI. Extracted from
// LeaderboardTable so they can be unit-tested without mounting the whole
// dashboard tree — tiny changes here used to need a full manual QA pass
// to catch off-by-one errors.

export const LEADERBOARD_PAGE_SIZE = 25

/**
 * Build a page-number array with ellipses, e.g. [1, "...", 4, 5, 6, "...", 20].
 *
 * For small totals (≤7 pages), every page is shown.
 * For larger totals, we always show first + last, a window of ±1 around
 * the current page, and ellipses for the gaps. This matches the Google/GitHub
 * convention and keeps the control bar a constant width.
 */
export function buildPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | "...")[] = []
  pages.push(1)

  // Left ellipsis when the current page has slid past the first-cluster window.
  if (current > 3) pages.push("...")

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)

  // Right ellipsis when the current page hasn't yet reached the last cluster.
  if (current < total - 2) pages.push("...")

  pages.push(total)
  return pages
}
