// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react"
import { LeaderboardHeader } from "@/components/dashboard/leaderboard/LeaderboardHeader"
import type { LeaderboardMode } from "@/components/dashboard/leaderboard/LeaderboardHeader"
import type { FuulMilesEntry } from "@/hooks/use-fuul-miles-leaderboard"

// Why pin LeaderboardHeader:
//   - This is the control surface users tap first when they land on the
//     leaderboard page. The mode toggle (Miles / Volume / Stats) drives
//     which of the three mode-tables below it even renders. A regression
//     that wires the toggle wrong shows one mode's data under another
//     mode's heading.
//   - Phase-2 split extracted it from LeaderboardTable with 15 props.
//     The orchestration parent calls this component blind — a prop-name
//     typo on either side would silently render the header-stale.
//   - The per-user cards have conditional rendering based on `userAddr`
//     and `leaderboardMode`, which means there are effectively six
//     variants (3 modes × 2 connected states). We pin the three that
//     carry user-visible state; the rest are exercised by render-no-crash
//     smoke.

const BASE_PROPS = {
  activeTraders: 100,
  swapVolumeEth: 250,
  totalVol: 500_000,
  totalParticipants: 250,
  totalMiles: 12_345,
  formatVolumeDisplay: (v: number) => `$${v.toLocaleString()}`,
  userAddr: undefined as string | undefined,
  userMilesEntry: null as FuulMilesEntry | null,
  nextMilesRankEntry: null as FuulMilesEntry | null,
  adjustedUserPos: null as number | null,
  adjustedUserVol: null as number | null,
  userSwapCount: null as number | null,
}

function renderHeader(overrides: Partial<React.ComponentProps<typeof LeaderboardHeader>> = {}) {
  const onModeChange = vi.fn()
  const props: React.ComponentProps<typeof LeaderboardHeader> = {
    ...BASE_PROPS,
    leaderboardMode: "volume",
    onModeChange,
    ...overrides,
  }
  render(<LeaderboardHeader {...props} />)
  return { onModeChange }
}

describe("LeaderboardHeader — mode toggle", () => {
  afterEach(cleanup)

  it.each<[LeaderboardMode, LeaderboardMode]>([
    ["volume", "stats"],
    ["stats", "volume"],
    // Miles toggle only renders when the feature flag is on; that flag is
    // `false` in feature-flags.ts by default so we skip that transition
    // in the smoke. When the flag flips on, add:
    //   ["volume", "miles"],
    //   ["miles", "volume"],
  ])("clicking %s → %s calls onModeChange with the target", (from, to) => {
    const { onModeChange } = renderHeader({ leaderboardMode: from })
    // Button text is the Mode-with-capital — "Volume" / "Stats" / "Miles".
    // Case-insensitive match so a button-copy refactor doesn't trip this.
    const target = new RegExp(`^${to}$`, "i")
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: target }))
    })
    expect(onModeChange).toHaveBeenCalledWith(to)
  })
})

describe("LeaderboardHeader — global metrics", () => {
  afterEach(cleanup)

  it("renders Traders / Vol (ETH) / Vol (USD) in volume mode", () => {
    renderHeader({ leaderboardMode: "volume" })
    expect(screen.getByText("Traders")).toBeTruthy()
    expect(screen.getByText("Vol (ETH)")).toBeTruthy()
    expect(screen.getByText("Vol (USD)")).toBeTruthy()
    // Number formatting — `formatVolumeDisplay` was injected in BASE_PROPS.
    expect(screen.getByText("$500,000")).toBeTruthy()
    expect(screen.getByText("100")).toBeTruthy() // activeTraders
    // Specific formatted-value check — "/ETH/" alone would match both the
    // label and the value, so scope to "250 ETH".
    expect(screen.getByText("250 ETH")).toBeTruthy()
  })

  it("falls back to --- when stats are null (SSR / unauth path)", () => {
    renderHeader({
      leaderboardMode: "volume",
      activeTraders: null,
      swapVolumeEth: null,
      totalVol: null,
    })
    // Three metric rows should all render "---" instead of crashing.
    const dashes = screen.getAllByText("---")
    expect(dashes.length).toBeGreaterThanOrEqual(3)
  })
})

describe("LeaderboardHeader — user performance card (volume mode)", () => {
  afterEach(cleanup)

  it("is hidden when userAddr is undefined (wallet not connected)", () => {
    renderHeader({ leaderboardMode: "volume", userAddr: undefined })
    // "Global Rank" label only renders when the user card is present.
    expect(screen.queryByText(/Global Rank/)).toBeNull()
  })

  it("renders the user's rank + swap count when connected with a volume position", () => {
    renderHeader({
      leaderboardMode: "volume",
      userAddr: "0xabcdef1234567890abcdef1234567890abcdef12",
      adjustedUserPos: 42,
      adjustedUserVol: 12_345,
      userSwapCount: 7,
    })
    expect(screen.getByText(/Global Rank/)).toBeTruthy()
    expect(screen.getByText(/#42/)).toBeTruthy()
    expect(screen.getByText("$12,345")).toBeTruthy()
    expect(screen.getByText("7")).toBeTruthy() // swap count
  })

  it("renders '#--' when the user's position hasn't loaded yet", () => {
    renderHeader({
      leaderboardMode: "volume",
      userAddr: "0xabcdef1234567890abcdef1234567890abcdef12",
      adjustedUserPos: null,
    })
    // Load-bearing: a crashed string or a raw `null` would break the
    // layout card. Use the `#--` placeholder.
    expect(screen.getByText("#--")).toBeTruthy()
  })
})
