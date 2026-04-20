// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { LeaderboardRow } from "@/components/dashboard/leaderboard/LeaderboardRow"
import type { LeaderboardEntry } from "@/components/dashboard/leaderboard/types"

// Why pin LeaderboardRow:
//   - This is the visual representation of "what rank am I?" on the
//     leaderboard. Tier accents (Gold/Silver/Bronze glow on top 3 only),
//     YOU badge (current user or explicit override), and the rank-tint
//     gradient for #1-3 are each their own thing that's easy to drop in
//     a refactor.
//   - Tier metadata comes from `@/lib/config/constants`; this test
//     asserts the row pulls the right tier for a given volume, so a
//     downstream change to the tier thresholds trips it.

afterEach(cleanup)

const baseEntry: LeaderboardEntry = {
  wallet: "0xabcdef…1234",
  rank: 10,
  swapVolume24h: 500_000,
  swapCount: 42,
  change24h: 2.5,
  isCurrentUser: false,
  ethValue: 100,
}

const fmtVol = (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`

describe("LeaderboardRow — rank rendering", () => {
  it("zero-pads the rank display to two digits", () => {
    render(
      <LeaderboardRow entry={{ ...baseEntry, rank: 1 }} formatVolumeDisplay={fmtVol} />
    )
    // Ensures #1 renders as "01" (consistent-width column).
    expect(screen.getByText("01")).toBeTruthy()
  })

  it("renders double-digit ranks without padding change", () => {
    render(
      <LeaderboardRow entry={{ ...baseEntry, rank: 42 }} formatVolumeDisplay={fmtVol} />
    )
    expect(screen.getByText("42")).toBeTruthy()
  })
})

describe("LeaderboardRow — tier accent on top 3", () => {
  it("shows a tier label on rank 1 when the volume hits Gold", () => {
    // Default tier thresholds (see @/lib/config/constants): $1M = Gold.
    render(
      <LeaderboardRow
        entry={{ ...baseEntry, rank: 1, swapVolume24h: 5_000_000 }}
        formatVolumeDisplay={fmtVol}
      />
    )
    // Tier metadata pulls the label from the shared config; accept
    // case-insensitive to dodge future localization.
    expect(screen.getByText(/Gold/i)).toBeTruthy()
  })

  it("does not show a tier label for rank ≥ 4", () => {
    // Tier accent is gated on rank ≤ 3, NOT on the tier itself. A rank-4
    // Gold trader should still render without the accent — keeps the
    // podium visually distinct from the general leaderboard body.
    const { container } = render(
      <LeaderboardRow
        entry={{ ...baseEntry, rank: 4, swapVolume24h: 5_000_000 }}
        formatVolumeDisplay={fmtVol}
      />
    )
    // The podium-only tier label text should NOT appear as an isolated
    // label (tier label on accent column). We check the accent bar
    // class isn't present.
    expect(container.querySelector(".bg-yellow-400")).toBeNull()
  })
})

describe("LeaderboardRow — YOU badge", () => {
  it("shows YOU when entry.isCurrentUser is true", () => {
    render(
      <LeaderboardRow
        entry={{ ...baseEntry, isCurrentUser: true }}
        formatVolumeDisplay={fmtVol}
      />
    )
    expect(screen.getByText("YOU")).toBeTruthy()
  })

  it("shows YOU when showYouBadge prop is true even if entry.isCurrentUser is false", () => {
    // The "Your Position" section under tier filters synthesizes an
    // entry object for the connected user; the isCurrentUser flag is
    // false there (so the entry doesn't highlight inside the list), but
    // the YOU badge must still appear via showYouBadge.
    render(
      <LeaderboardRow
        entry={{ ...baseEntry, isCurrentUser: false }}
        formatVolumeDisplay={fmtVol}
        showYouBadge
      />
    )
    expect(screen.getByText("YOU")).toBeTruthy()
  })

  it("hides YOU when neither flag is set", () => {
    render(<LeaderboardRow entry={baseEntry} formatVolumeDisplay={fmtVol} />)
    expect(screen.queryByText("YOU")).toBeNull()
  })
})

describe("LeaderboardRow — volume + miles display", () => {
  it("formats the volume via the injected formatter", () => {
    const customFmt = (v: number) => `USD ${v}`
    render(
      <LeaderboardRow
        entry={{ ...baseEntry, swapVolume24h: 1234 }}
        formatVolumeDisplay={customFmt}
      />
    )
    expect(screen.getByText("USD 1234")).toBeTruthy()
  })

  it("renders the miles cell with thousands-separator formatting", () => {
    render(
      <LeaderboardRow entry={baseEntry} formatVolumeDisplay={fmtVol} miles={12_345} />
    )
    // The miles cell shows its value plus the "Miles" uppercase label.
    expect(screen.getByText("12,345")).toBeTruthy()
    expect(screen.getByText(/Miles/)).toBeTruthy()
  })

  it("falls back to 0 in the miles cell when miles is null", () => {
    render(
      <LeaderboardRow entry={baseEntry} formatVolumeDisplay={fmtVol} miles={null} />
    )
    expect(screen.getByText("0")).toBeTruthy()
  })

  it("renders the swap-count subtext with plural form", () => {
    render(
      <LeaderboardRow
        entry={{ ...baseEntry, swapCount: 7 }}
        formatVolumeDisplay={fmtVol}
      />
    )
    expect(screen.getByText("7 swaps")).toBeTruthy()
  })

  it("renders singular 'swap' for exactly 1 swapCount", () => {
    render(
      <LeaderboardRow
        entry={{ ...baseEntry, swapCount: 1 }}
        formatVolumeDisplay={fmtVol}
      />
    )
    expect(screen.getByText("1 swap")).toBeTruthy()
  })

  it("shows 'N/A' when swapCount is missing", () => {
    render(
      <LeaderboardRow
        entry={{ ...baseEntry, swapCount: undefined }}
        formatVolumeDisplay={fmtVol}
      />
    )
    expect(screen.getByText("N/A")).toBeTruthy()
  })
})
