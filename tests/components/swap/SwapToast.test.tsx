// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { SwapToast } from "@/components/swap/SwapToast"
import { useSwapToastStore } from "@/stores/swapToastStore"
import type { Token } from "@/types/swap"

// Why seed the component test pattern here, and why SwapToast:
//   - This is the template future component tests will copy. It exercises
//     every tool a realistic Fast Protocol component pulls in — wagmi hooks
//     (mocked), a Zustand store (real), a settlement utility (real),
//     motion/react animations, next/image, and framer-style exit transitions.
//     Getting all of those to render cleanly in happy-dom once means the
//     next component test is a five-line edit.
//   - SwapToast owns the post-submit UX: what the user sees between "sign"
//     and "tokens available." Three branches below are load-bearing:
//       1. Pending renders the right token symbols + "Swapping..." label.
//       2. Failed → "barter minReturn < user required" becomes a RETRY
//          button whose slippage matches what the contract actually needs.
//          A regression here bricks the retry loop.
//       3. Failed → user-rejected becomes "Swap Cancelled" (not "Swap
//          Failed") so we don't alarm the user for a choice they made.
//
// Zustand store semantics:
//   The store is a real module-level singleton. We reset it between tests
//   by re-invoking `setState` with the initial shape. Mocking the whole
//   store would defeat the point of testing the component↔store wiring.
//
// Mocks:
//   - wagmi: `useWaitForTransactionReceipt` returns no data so the
//     component doesn't try to watch an on-chain receipt during the test.
//   - `use-wait-for-tx-confirmation`: no-op so the polling loop doesn't
//     start in happy-dom.
//   - `preconfirm-sound`: `playPreconfirmSound` uses the Web Audio API,
//     which happy-dom doesn't implement. No-op it.

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

const ETH_TOKEN: Token = {
  address: "0x0000000000000000000000000000000000000000",
  symbol: "ETH",
  name: "Ether",
  decimals: 18,
  icon: "/eth.png",
} as unknown as Token

const USDC_TOKEN: Token = {
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  icon: "/usdc.png",
} as unknown as Token

function resetStore() {
  useSwapToastStore.setState({ toasts: [], lastTxError: null, retrySlippage: null })
}

/** Directly insert a toast into the store (bypasses addToast's timestamp randomness). */
function seedToast(partial: Partial<Parameters<typeof useSwapToastStore.setState>[0]> = {}, toast: Record<string, unknown> = {}) {
  useSwapToastStore.setState({
    toasts: [
      {
        id: "toast-test-1",
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
    ...partial,
  })
}

beforeEach(() => {
  resetStore()
})

afterEach(() => {
  resetStore()
})

describe("SwapToast — empty state", () => {
  it("renders nothing when the hash is not in the store", () => {
    const { container } = render(<SwapToast hash="0xnever" />)
    // A missing toast early-returns null; the render root should stay empty.
    expect(container.firstChild).toBeNull()
  })
})

describe("SwapToast — pending state", () => {
  it("renders the Swapping label with in/out token symbols and amounts", () => {
    seedToast()
    render(<SwapToast hash="0xabc" />)
    expect(screen.getByText("Swapping...")).toBeTruthy()
    // Token symbols + amounts live in the same tabular-nums row.
    const row = screen.getByText(/ETH.*USDC/)
    expect(row.textContent).toContain("1.0")
    expect(row.textContent).toContain("2500")
  })
})

describe("SwapToast — barter slippage failure", () => {
  const barterError =
    "Slippage: 0.5\nbarter minReturn (1987949) < user required (2000000) — retry with looser slippage"

  it("shows a retry button with a slippage >= the parsed requirement", () => {
    seedToast({}, { status: "failed", errorMessage: barterError })
    render(<SwapToast hash="0xabc" />)
    // The parser computes a recommendation of 1.1% for this payload
    // (0.6% shortfall + 0.5% buffer). The UX contract: the retry label
    // must advertise a value AT LEAST that large, capped at 2.0%. We don't
    // hard-code the number so the parser can tighten its heuristic.
    const retryBtn = screen.getByRole("button", { name: /Retry\s+\d+(\.\d+)?%/ })
    const match = retryBtn.textContent?.match(/([\d.]+)%/)
    expect(match).toBeTruthy()
    const pct = parseFloat(match![1])
    expect(pct).toBeGreaterThanOrEqual(1.0)
    expect(pct).toBeLessThanOrEqual(2.0)
    expect(screen.getByText("Slippage too low")).toBeTruthy()
  })

  it("firing the retry button clears the toast and writes retrySlippage to the store", () => {
    seedToast({}, { status: "failed", errorMessage: barterError })
    render(<SwapToast hash="0xabc" />)
    const retryBtn = screen.getByRole("button", { name: /Retry\s+\d+(\.\d+)?%/ })

    act(() => {
      fireEvent.click(retryBtn)
    })

    const state = useSwapToastStore.getState()
    // The retry path removes the toast and surfaces the new slippage for
    // SwapForm to pick up. Both halves must happen together — otherwise
    // either the toast lingers (UX regression) or the form reopens with
    // stale slippage (safety regression).
    expect(state.toasts).toHaveLength(0)
    expect(state.retrySlippage).not.toBeNull()
    expect(parseFloat(state.retrySlippage!)).toBeGreaterThan(0)
  })
})

describe("SwapToast — user-rejected failure", () => {
  it("renders 'Swap Cancelled' (not 'Swap Failed') when the user rejected", () => {
    seedToast({}, {
      status: "failed",
      errorMessage: "User rejected the request.",
    })
    render(<SwapToast hash="0xabc" />)
    // Calling a user-initiated reject "Swap Failed" would be misleading;
    // this branch is the distinct-language contract.
    expect(screen.getByText("Swap Cancelled")).toBeTruthy()
    // Subtitle still shows the swap pair so the user knows which toast.
    expect(screen.getByText(/ETH.*USDC/)).toBeTruthy()
  })

  it("shows Details button that surfaces lastTxError on click", () => {
    seedToast({}, {
      status: "failed",
      errorMessage: "execution reverted: insufficient output amount",
    })
    render(<SwapToast hash="0xabc" />)
    const details = screen.getByRole("button", { name: "Details" })

    act(() => {
      fireEvent.click(details)
    })

    // Details click hands the error to the store so SwapConfirmationModal
    // can reopen with the raw receipt + message.
    expect(useSwapToastStore.getState().lastTxError?.message).toContain("execution reverted")
  })
})

describe("SwapToast — confirmed auto-dismiss", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("auto-removes a confirmed toast after 6000ms", () => {
    seedToast({}, { status: "confirmed" })
    render(<SwapToast hash="0xabc" />)
    expect(useSwapToastStore.getState().toasts).toHaveLength(1)
    act(() => {
      vi.advanceTimersByTime(5999)
    })
    // Just before the ceiling — toast still in store.
    expect(useSwapToastStore.getState().toasts).toHaveLength(1)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(useSwapToastStore.getState().toasts).toHaveLength(0)
  })
})
