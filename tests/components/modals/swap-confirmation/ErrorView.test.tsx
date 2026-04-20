// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { ErrorView } from "@/components/modals/swap-confirmation/ErrorView"

// Why pin ErrorView:
//   - Barter-slippage retry is a money-critical path. When Barter's routed
//     output falls short of the user-required minAmountOut, the settlement
//     contract reverts, the tx is lost to gas, and the user sees this
//     modal. The retry button bumps slippage to a parser-computed value
//     and resubmits. If the wrong slippage goes through, the retry loop
//     can burn multiple txs before succeeding — or it silently accepts a
//     worse fill than the user configured originally.
//   - Three render branches each with their own load-bearing text +
//     button wiring. This test is the functional oracle corresponding to
//     the a11y sweep already in tests/a11y/SwapToast.a11y.test.tsx
//     (which renders similar UI via the toast path).

function makeRpcError(message: string): Error {
  // The real code path funnels errors through the settlement module's
  // message-normalization helpers; for presentational testing plain
  // Errors are fine — ErrorView reads `error.message` directly.
  return new Error(message)
}

describe("ErrorView — barter slippage branch", () => {
  const barterMessage =
    "Slippage: 0.5\nbarter minReturn (1987949) < user required (2000000) — retry with looser slippage"

  it("renders the 'Slippage too low' header + a retry button with the recommended percentage", () => {
    render(
      <ErrorView
        error={makeRpcError(barterMessage)}
        onOpenDetails={vi.fn()}
        onRetry={vi.fn()}
        onRetryWithSlippage={vi.fn()}
      />
    )
    // The header copy is the first signal the user reads; any regression
    // there changes what triage looks like in support tickets.
    expect(screen.getByText("Slippage too low for this swap.")).toBeTruthy()

    // The button must advertise a percentage — the parser computes 1.1%
    // for the fixture payload (0.6% shortfall + 0.5% buffer). We don't
    // hard-code the exact number so tightening the parser's heuristic
    // later is a test change, not a production bug.
    const retryBtn = screen.getByRole("button", { name: /Retry with \d+(\.\d+)?% slippage/ })
    const match = retryBtn.textContent!.match(/(\d+(?:\.\d+)?)%/)
    expect(match).toBeTruthy()
    const pct = parseFloat(match![1])
    expect(pct).toBeGreaterThanOrEqual(1.0)
    expect(pct).toBeLessThanOrEqual(2.0)
  })

  it("clicking retry passes the parsed slippage upward as a string", () => {
    const onRetryWithSlippage = vi.fn()
    render(
      <ErrorView
        error={makeRpcError(barterMessage)}
        onOpenDetails={vi.fn()}
        onRetry={vi.fn()}
        onRetryWithSlippage={onRetryWithSlippage}
      />
    )
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Retry with .+% slippage/ }))
    })
    expect(onRetryWithSlippage).toHaveBeenCalledTimes(1)
    // The recommendation must be a string like "1.1", never a number —
    // downstream the swap form stores slippage as a string (preserves
    // the user's trailing-dot typing), and a number would bypass the
    // clamp + normalization logic in useSwapSlippage.
    const arg = onRetryWithSlippage.mock.calls[0]![0]
    expect(typeof arg).toBe("string")
    expect(parseFloat(arg)).toBeGreaterThanOrEqual(1.0)
    expect(parseFloat(arg)).toBeLessThanOrEqual(2.0)
  })

  it("clicking 'View Error Details' opens the error-log dialog via the callback", () => {
    const onOpenDetails = vi.fn()
    render(
      <ErrorView
        error={makeRpcError(barterMessage)}
        onOpenDetails={onOpenDetails}
        onRetry={vi.fn()}
        onRetryWithSlippage={vi.fn()}
      />
    )
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /View Error Details/ }))
    })
    expect(onOpenDetails).toHaveBeenCalledTimes(1)
  })

  it("does NOT call onRetry on the barter branch (which has its own slippage-retry)", () => {
    // Barter slippage errors route through onRetryWithSlippage — the plain
    // onRetry must stay idle, otherwise the user gets a double-submit.
    const onRetry = vi.fn()
    render(
      <ErrorView
        error={makeRpcError(barterMessage)}
        onOpenDetails={vi.fn()}
        onRetry={onRetry}
        onRetryWithSlippage={vi.fn()}
      />
    )
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Retry with .+% slippage/ }))
    })
    expect(onRetry).not.toHaveBeenCalled()
  })
})

describe("ErrorView — generic error branch", () => {
  it("renders the short error message (non-barter) and a Try Again button", () => {
    render(
      <ErrorView
        error={makeRpcError("execution reverted: insufficient output amount")}
        onOpenDetails={vi.fn()}
        onRetry={vi.fn()}
      />
    )
    expect(screen.getByRole("button", { name: /Try Again/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /View Error Details/ })).toBeTruthy()
  })

  it("clicking Try Again fires the generic retry callback", () => {
    const onRetry = vi.fn()
    render(
      <ErrorView
        error={makeRpcError("network error")}
        onOpenDetails={vi.fn()}
        onRetry={onRetry}
      />
    )
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Try Again/ }))
    })
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("hides Try Again when occurredAfterPreConfirm is true (tx already on L1)", () => {
    // Load-bearing: if the swap already preconfirmed and then failed at
    // L1 finalization, retrying would submit a SECOND tx for the same
    // preconf intent. The modal must not offer the retry button in this
    // state. This is the one branch where onRetry's absence is the
    // correct behavior, not a regression.
    render(
      <ErrorView
        error={makeRpcError("status 0x0 after preconf")}
        occurredAfterPreConfirm
        onOpenDetails={vi.fn()}
        onRetry={vi.fn()}
      />
    )
    expect(screen.queryByRole("button", { name: /Try Again/ })).toBeNull()
    // Details button must still be reachable — the user still needs to
    // see the receipt.
    expect(screen.getByRole("button", { name: /View Error Details/ })).toBeTruthy()
  })
})
