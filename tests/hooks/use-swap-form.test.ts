// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { Token } from "@/types/swap"

// Hook-under-test has 10+ mockable dependencies. Rather than re-assert every
// one, we pin ONLY the state contracts the parent surface of the hook
// depends on — defaults, token/pair changes, amount, wallet-disconnect
// reset, clearSwapState pulse. Everything downstream of those (quote
// merging, barter guard, minAmountOut) lives in its own test files already
// (min-amount-out.test.ts, quote-guard.test.ts) and/or inside the wagmi
// hook stack that's mocked here.
//
// Why write this at all: the hook's 600 LoC protect the swap button from
// Barter-shortfall regressions. Before further extraction (refresh timer,
// quote cache, switch handler) we need an oracle that catches "I moved a
// line and now the form resets differently." These tests ARE that oracle.

// ── Mocks (module-scope; vitest hoists them above the imports below) ────

vi.mock("wagmi", () => {
  let mockAddress: `0x${string}` | undefined = "0xabcdef1234567890abcdef1234567890abcdef12"
  let mockConnected = true
  return {
    useAccount: () => ({ address: mockAddress, isConnected: mockConnected }),
    useBalance: () => ({ data: undefined, isLoading: false }),
    useChainId: () => 1,
    useWatchBlockNumber: () => {},
    // Test-only mutator so specific tests can flip the wallet.
    __setAccountForTest: (next: { address?: `0x${string}`; isConnected: boolean }) => {
      mockAddress = next.address
      mockConnected = next.isConnected
    },
  }
})

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query"
  )
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  }
})

vi.mock("@/hooks/use-swap-quote", () => ({
  useQuote: () => ({
    data: null,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(null),
    noLiquidity: false,
  }),
}))

vi.mock("@/hooks/use-token-price", () => ({
  useTokenPrice: () => ({ price: null, isLoading: false }),
}))

vi.mock("@/hooks/use-weth-wrap-unwrap", () => ({
  useWethWrapUnwrap: () => ({
    isWrap: false,
    isUnwrap: false,
    wrap: vi.fn(),
    unwrap: vi.fn(),
    error: null,
    reset: vi.fn(),
    gasEstimate: null,
  }),
}))

vi.mock("@/hooks/use-permit2-allowance", () => ({
  usePermit2Allowance: () => ({
    needsApproval: false,
    isApproving: false,
    isApprovalRejected: false,
    approvalTxHash: undefined,
    approve: vi.fn(),
    isLoading: false,
  }),
}))

vi.mock("@/hooks/use-swap-slippage", () => ({
  useSwapSlippage: () => ({ slippage: "0.5", deadline: 30, isMounted: true }),
}))

vi.mock("@/hooks/use-barter-validation", () => ({
  useBarterValidation: () => ({
    amountTooSmall: false,
    shortfallPct: 0,
    isValidating: false,
    barterAmountOut: null,
    barterUnavailable: false,
  }),
}))

vi.mock("@/hooks/use-quote-guard-config", () => ({
  useQuoteGuardConfig: () => ({ divergenceThresholdPct: 25, treasuryMarginPct: 1.5 }),
}))

vi.mock("@/hooks/use-page-active", () => ({
  usePageActive: () => true,
}))

// Imports that need to happen AFTER the mocks are hoisted — same file works
// because vitest hoists `vi.mock` calls above these imports automatically.
import { useSwapForm } from "@/hooks/use-swap-form"
import { DEFAULT_ETH_TOKEN } from "@/components/swap/TokenSelectorModal"
import * as wagmi from "wagmi"

const USDC: Token = {
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  logoURI: "https://example.com/usdc.png",
}

const DAI: Token = {
  address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  symbol: "DAI",
  name: "Dai",
  decimals: 18,
  logoURI: "https://example.com/dai.png",
}

const ALL_TOKENS: Token[] = [DEFAULT_ETH_TOKEN, USDC, DAI]

beforeEach(() => {
  // Reset the wagmi mock between tests — the connection state is mutable
  // across describe blocks and a leak here silently breaks reset tests.
  ;(wagmi as unknown as {
    __setAccountForTest: (v: { address?: `0x${string}`; isConnected: boolean }) => void
  }).__setAccountForTest({
    address: "0xabcdef1234567890abcdef1234567890abcdef12",
    isConnected: true,
  })
})

describe("useSwapForm — defaults on mount", () => {
  it("starts with fromToken = ETH and no toToken", () => {
    const { result } = renderHook(() => useSwapForm(ALL_TOKENS))
    expect(result.current.fromToken?.symbol).toBe("ETH")
    expect(result.current.toToken).toBeUndefined()
  })

  it("starts with amount='' and editingSide='sell'", () => {
    const { result } = renderHook(() => useSwapForm(ALL_TOKENS))
    expect(result.current.amount).toBe("")
    expect(result.current.editingSide).toBe("sell")
  })

  it("starts with timeLeft = 15s (refresh timer budget)", () => {
    const { result } = renderHook(() => useSwapForm(ALL_TOKENS))
    expect(result.current.timeLeft).toBe(15)
  })
})

describe("useSwapForm — amount input", () => {
  it("setAmount updates the amount and preserves it across rerenders", () => {
    const { result, rerender } = renderHook(() => useSwapForm(ALL_TOKENS))
    act(() => result.current.setAmount("1.5"))
    expect(result.current.amount).toBe("1.5")
    rerender()
    expect(result.current.amount).toBe("1.5")
  })

  it("accepts the empty string (user clearing the input)", () => {
    const { result } = renderHook(() => useSwapForm(ALL_TOKENS))
    act(() => result.current.setAmount("0.5"))
    act(() => result.current.setAmount(""))
    expect(result.current.amount).toBe("")
  })
})

describe("useSwapForm — token changes", () => {
  it("setToToken updates the to-side", () => {
    const { result } = renderHook(() => useSwapForm(ALL_TOKENS))
    act(() => result.current.setToToken(USDC))
    expect(result.current.toToken?.symbol).toBe("USDC")
  })

  it("changing the pair clears manual inversion", () => {
    // Once a pair is set, subsequent pair changes must reset this UI-sync
    // flag so stale data from the old pair doesn't leak through.
    //
    // Ordering note: the pairKey-change effect runs *after* any setState
    // batched in the same `act`, so we have to set the pair FIRST (letting
    // the effect clear the flag), THEN flip the flag to true, THEN change
    // the pair again and confirm the flag dropped back to false.
    const { result } = renderHook(() => useSwapForm(ALL_TOKENS))
    act(() => {
      result.current.setToToken(USDC)
    })
    act(() => {
      result.current.setIsManualInversion(true)
    })
    expect(result.current.isManualInversion).toBe(true)

    // Swap to a different pair (ETH → DAI). The effect clears the flag.
    act(() => {
      result.current.setToToken(DAI)
    })
    expect(result.current.isManualInversion).toBe(false)
    // swappedQuote also resets on pair change — confirm it's null after.
    expect(result.current.swappedQuote).toBeNull()
  })
})

describe("useSwapForm — wallet disconnect resets form state", () => {
  it("resets fromToken/toToken/amount/editingSide when the wallet disconnects", () => {
    const { result, rerender } = renderHook(() => useSwapForm(ALL_TOKENS))
    // Dirty the form.
    act(() => {
      result.current.setToToken(USDC)
      result.current.setAmount("1.0")
    })
    expect(result.current.toToken?.symbol).toBe("USDC")
    expect(result.current.amount).toBe("1.0")

    // Simulate a wallet disconnect by flipping the wagmi mock.
    ;(wagmi as unknown as {
      __setAccountForTest: (v: { address?: `0x${string}`; isConnected: boolean }) => void
    }).__setAccountForTest({ address: undefined, isConnected: false })
    rerender()

    expect(result.current.fromToken?.symbol).toBe("ETH")
    expect(result.current.toToken).toBeUndefined()
    expect(result.current.amount).toBe("")
    expect(result.current.editingSide).toBe("sell")
  })

  it("does NOT reset on a connect → connect transition (e.g. account switch)", () => {
    // Only the connected → disconnected edge should reset; switching
    // accounts must preserve the form so the user doesn't lose their input.
    const { result, rerender } = renderHook(() => useSwapForm(ALL_TOKENS))
    act(() => {
      result.current.setToToken(USDC)
      result.current.setAmount("1.0")
    })
    ;(wagmi as unknown as {
      __setAccountForTest: (v: { address?: `0x${string}`; isConnected: boolean }) => void
    }).__setAccountForTest({
      address: "0x0000000000000000000000000000000000000001",
      isConnected: true,
    })
    rerender()
    // Form should be unchanged — account switch isn't a disconnect.
    expect(result.current.toToken?.symbol).toBe("USDC")
    expect(result.current.amount).toBe("1.0")
  })
})

describe("useSwapForm — clearSwapState pulse after a successful swap", () => {
  it("clears amount + editingSide + inversion flags when clearSwapState flips true", () => {
    // The parent calls setClearSwapState(true) after the toast reports
    // success; the hook reacts in an effect, clears the form, then
    // auto-flips clearSwapState back to false so it acts as a one-shot.
    //
    // Ordering note: same pair-change gotcha as the test above — the
    // pairKey-change effect resets isManualInversion, so the flag has to
    // be set in a separate `act` after the pair has stabilized.
    const { result } = renderHook(() => useSwapForm(ALL_TOKENS))
    act(() => {
      result.current.setToToken(USDC)
      result.current.setAmount("2.5")
    })
    act(() => {
      result.current.setIsManualInversion(true)
    })
    expect(result.current.amount).toBe("2.5")
    expect(result.current.isManualInversion).toBe(true)

    act(() => result.current.setClearSwapState(true))

    expect(result.current.amount).toBe("")
    expect(result.current.editingSide).toBe("sell")
    expect(result.current.isManualInversion).toBe(false)
    // toToken is NOT cleared — the user typically wants to do another swap
    // in the same direction.
    expect(result.current.toToken?.symbol).toBe("USDC")
  })
})
