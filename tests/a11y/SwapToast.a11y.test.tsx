// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, cleanup } from "@testing-library/react"
import { SwapToast } from "@/components/swap/SwapToast"
import { useSwapToastStore } from "@/stores/swapToastStore"
import type { Token } from "@/types/swap"
import { runAxe, formatViolations } from "../utils/axe"

// Template a11y test. Mirrors the functional SwapToast component test but
// swaps the assertion: instead of checking labels + click handlers, we
// render each visual state and run axe-core over the DOM.
//
// Why SwapToast as the first a11y canary:
//   - It's always visible during and after a swap, so a missing-label or
//     contrast regression is on-screen for every user who completes a trade.
//   - Every variant (pending, preconfirmed, confirmed, failed, barter
//     retry) is already pinned by the functional test fixture, so we can
//     reuse the store-seeding helper here and just swap the assertion.
//
// When adding the next a11y test, copy this file's shape — the vi.mock
// block, the seedToast helper, and the runAxe + formatViolations pattern.
// Anything more complex belongs in `tests/utils/axe.ts`.

vi.mock("wagmi", () => ({
  useWaitForTransactionReceipt: () => ({
    data: undefined as unknown,
    error: undefined as unknown,
  }),
}))
vi.mock("@/hooks/use-wait-for-tx-confirmation", () => ({
  useWaitForTxConfirmation: () => {},
}))
vi.mock("@/lib/settlement/preconfirm-sound", () => ({
  playPreconfirmSound: () => {},
}))

const ETH_TOKEN = {
  address: "0x0000000000000000000000000000000000000000",
  symbol: "ETH",
  name: "Ether",
  decimals: 18,
  icon: "/eth.png",
} as unknown as Token

const USDC_TOKEN = {
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  icon: "/usdc.png",
} as unknown as Token

function seedToast(toast: Record<string, unknown> = {}) {
  useSwapToastStore.setState({
    toasts: [
      {
        id: "toast-a11y-1",
        hash: "0xabc",
        status: "pending",
        collapsed: false,
        createdAt: Date.now(),
        tokenIn: ETH_TOKEN,
        tokenOut: USDC_TOKEN,
        amountIn: "1.0",
        amountOut: "2500",
        ...toast,
      } as never,
    ],
    lastTxError: null,
    retrySlippage: null,
  })
}

beforeEach(() => {
  useSwapToastStore.setState({ toasts: [], lastTxError: null, retrySlippage: null })
})

afterEach(() => {
  cleanup()
})

describe("SwapToast — accessibility", () => {
  it("pending state has no WCAG 2.1 AA violations", async () => {
    seedToast()
    const { container } = render(<SwapToast hash="0xabc" />)
    const violations = await runAxe(container)
    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it("confirmed state has no WCAG 2.1 AA violations", async () => {
    seedToast({ status: "confirmed" })
    const { container } = render(<SwapToast hash="0xabc" />)
    const violations = await runAxe(container)
    expect(violations, formatViolations(violations)).toHaveLength(0)
  })

  it("barter-slippage failed state has no WCAG 2.1 AA violations", async () => {
    // The retry-with-slippage card has the tightest color contrast (amber on
    // near-black) and the most interactive elements — most likely to regress.
    seedToast({
      status: "failed",
      errorMessage: "Slippage: 0.5\nbarter minReturn (1987949) < user required (2000000)",
    })
    const { container } = render(<SwapToast hash="0xabc" />)
    const violations = await runAxe(container)
    expect(violations, formatViolations(violations)).toHaveLength(0)
  })
})
