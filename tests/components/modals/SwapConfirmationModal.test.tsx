// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react"
import { mainnet } from "wagmi/chains"
import type { Token } from "@/types/swap"
import { useSwapToastStore } from "@/stores/swapToastStore"

// Why pin SwapConfirmationModal:
//   - This is the last checkpoint before a user signs a tx. It owns the
//     state machine that routes a click to wrap() / unwrap() / confirmSwap(),
//     the approval → auto-swap chain, the error-fan-out to toast, and the
//     auto-execute-on-open fast path used by the toast retry flow.
//   - useSnapshotOnOpen, ErrorView, and the other extracted leaves each
//     have their own tests. This file tests the orchestration BETWEEN
//     them — which was NOT directly tested when the 1158-LoC original was
//     split into 623 + leaves. Pinning these contracts closes the biggest
//     untested surface on this branch.
//
// Scope (load-bearing contracts only):
//   1. autoExecute=true short-circuits the UI and fires executeSwap.
//   2. Click CTA on a wrap triggers wrap() (not confirmSwap()).
//   3. Click CTA on a normal swap triggers confirmSwap() and closes modal.
//   4. externalError prop renders ErrorView (no review section).
//   5. Close handler clears lastTxError on the store.
//
// Everything else (gas cost computation, miles rendering, priceImpact
// badges) is exercised in isolation by SwapDetailsCollapse's extracted
// siblings or by downstream UI. This file is not trying to be exhaustive
// — it's trying to catch orchestration drift.

// ── Mock factories (vitest hoists vi.mock above imports) ────────────────

const mockWrap = vi.fn()
const mockUnwrap = vi.fn()
const mockConfirmSwap = vi.fn()
const mockOnApprove = vi.fn()

vi.mock("wagmi", () => {
  return {
    useAccount: () => ({
      chain: { id: mainnet.id, name: "Ethereum" },
      isConnected: true,
      address: "0xabcdef1234567890abcdef1234567890abcdef12",
    }),
  }
})

// Toggled per-test so wrap vs. normal-swap paths pick the right branch.
let mockIsWrap = false
let mockIsUnwrap = false

vi.mock("@/hooks/use-weth-wrap-unwrap", () => ({
  useWethWrapUnwrap: () => ({
    isWrap: mockIsWrap,
    isUnwrap: mockIsUnwrap,
    wrap: mockWrap,
    unwrap: mockUnwrap,
    error: null,
    reset: vi.fn(),
    gasEstimate: null,
  }),
}))

vi.mock("@/hooks/use-swap-confirmation", () => ({
  useSwapConfirmation: () => ({
    confirmSwap: mockConfirmSwap,
    isSigning: false,
    isSubmitting: false,
    error: null,
    reset: vi.fn(),
    isNonceLoading: false,
  }),
}))

vi.mock("@/hooks/use-swap-quote", () => ({
  getPriceImpactSeverity: () => "low" as const,
}))

vi.mock("@/hooks/use-token-price", () => ({
  useTokenPrice: () => ({ price: 3500, isLoading: false }),
}))

vi.mock("@/hooks/use-broadcast-gas-price", () => ({
  useBroadcastGasPrice: () => ({ bufferedPrice: 1_000_000_000n }),
  GAS_LIMIT_MULTIPLIER: 120n,
  ETH_PATH_DISPLAY_MULTIPLIER: 150n,
}))

vi.mock("@/hooks/use-eth-path-gas-estimate", () => ({
  useEthPathGasEstimate: () => ({ gasEstimate: null, isLoading: false }),
}))

vi.mock("@/hooks/use-user-points", () => ({
  refetchMiles: vi.fn(),
}))

vi.mock("@/lib/swap/events", () => ({
  notifySwapSubmitted: vi.fn(),
}))

// ── Imports (must be after vi.mock) ─────────────────────────────────────

import SwapConfirmationModal from "@/components/modals/SwapConfirmationModal"

const ETH: Token = {
  address: "0x0000000000000000000000000000000000000000",
  symbol: "ETH",
  name: "Ethereum",
  decimals: 18,
  logoURI: "https://token-icons.s3.amazonaws.com/eth.png",
}
const USDC: Token = {
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  symbol: "USDC",
  name: "USD Coin",
  decimals: 6,
  logoURI: "https://example.com/usdc.png",
}

function baseProps(overrides: Partial<React.ComponentProps<typeof SwapConfirmationModal>> = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    tokenIn: ETH,
    tokenOut: USDC,
    amountIn: "1.0",
    amountOut: "2500",
    minAmountOut: "2450",
    slippageLimitFormatted: "2450",
    isMaxIn: false,
    exchangeRate: 2500,
    priceImpact: 0.5,
    slippage: "0.5",
    deadline: 30,
    gasEstimate: null,
    ethPrice: 3500,
    fromTokenPrice: 3500,
    toTokenPrice: 1,
    setClearSwapState: vi.fn(),
    estimatedMiles: 10,
    onApprove: mockOnApprove,
    ...overrides,
  } as React.ComponentProps<typeof SwapConfirmationModal>
}

beforeEach(() => {
  mockIsWrap = false
  mockIsUnwrap = false
  mockWrap.mockReset().mockResolvedValue("0xwraphash")
  mockUnwrap.mockReset().mockResolvedValue("0xunwraphash")
  mockConfirmSwap.mockReset().mockResolvedValue("0xswaphash")
  mockOnApprove.mockReset()
  useSwapToastStore.setState({ toasts: [], lastTxError: null, retrySlippage: null })
})

afterEach(() => {
  cleanup()
})

// ────────────────────────────────────────────────────────────────────────

describe("SwapConfirmationModal — autoExecute fast path", () => {
  it("renders null when open=true and autoExecute=true, firing the execute chain headlessly", async () => {
    // autoExecute is used by the toast-retry flow: the toast already
    // showed the user the review summary, so opening again just runs the
    // swap without re-rendering the review UI.
    const onAutoExecuteConsumed = vi.fn()
    const { container } = render(
      <SwapConfirmationModal
        {...baseProps({ autoExecute: true, onAutoExecuteConsumed })}
      />
    )
    // No visible UI — the component short-circuits to null.
    expect(container.firstChild).toBeNull()
    // Parent is told we consumed the flag so it can reset.
    expect(onAutoExecuteConsumed).toHaveBeenCalledTimes(1)
    // One microtask flush lets the executeSwap promise chain run.
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockConfirmSwap).toHaveBeenCalled()
  })
})

describe("SwapConfirmationModal — CTA routes to the right swap primitive", () => {
  it("fires confirmSwap() on a normal ERC-20 swap", async () => {
    const onOpenChange = vi.fn()
    render(<SwapConfirmationModal {...baseProps({ tokenIn: USDC, tokenOut: ETH, onOpenChange })} />)
    const cta = screen.getByRole("button", { name: /Confirm swap/i })
    await act(async () => {
      fireEvent.click(cta)
      await Promise.resolve()
    })
    expect(mockConfirmSwap).toHaveBeenCalledTimes(1)
    expect(mockWrap).not.toHaveBeenCalled()
    expect(mockUnwrap).not.toHaveBeenCalled()
    // Modal closes immediately — the toast takes over.
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("fires wrap() not confirmSwap() when isWrap=true", async () => {
    mockIsWrap = true
    const onOpenChange = vi.fn()
    render(<SwapConfirmationModal {...baseProps({ onOpenChange })} />)
    // Wrap uses the "Confirm wrap" label — the operationType drives the
    // CTA copy so the user knows which primitive they're signing.
    const cta = screen.getByRole("button", { name: /Confirm wrap/i })
    await act(async () => {
      fireEvent.click(cta)
      await Promise.resolve()
    })
    expect(mockWrap).toHaveBeenCalledTimes(1)
    expect(mockConfirmSwap).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("fires unwrap() not confirmSwap() when isUnwrap=true", async () => {
    mockIsUnwrap = true
    render(<SwapConfirmationModal {...baseProps()} />)
    const cta = screen.getByRole("button", { name: /Confirm unwrap/i })
    await act(async () => {
      fireEvent.click(cta)
      await Promise.resolve()
    })
    expect(mockUnwrap).toHaveBeenCalledTimes(1)
    expect(mockConfirmSwap).not.toHaveBeenCalled()
  })
})

describe("SwapConfirmationModal — approval flow", () => {
  it("shows 'Approve & Swap' and calls onApprove (not confirmSwap) when needsPermit2Approval=true", async () => {
    // intentPath is derived from tokenIn (non-ETH), so we swap direction
    // to USDC → ETH so intentPath = true.
    render(
      <SwapConfirmationModal
        {...baseProps({
          tokenIn: USDC,
          tokenOut: ETH,
          needsPermit2Approval: true,
        })}
      />
    )
    const cta = screen.getByRole("button", { name: /Approve & Swap/i })
    await act(async () => {
      fireEvent.click(cta)
      await Promise.resolve()
    })
    expect(mockOnApprove).toHaveBeenCalledTimes(1)
    // Approval must NOT pre-fire the swap — auto-chain happens later,
    // driven by needsPermit2Approval flipping false in a subsequent render.
    expect(mockConfirmSwap).not.toHaveBeenCalled()
  })
})

describe("SwapConfirmationModal — external error", () => {
  it("renders ErrorView when externalError is set, hiding the review UI", () => {
    render(
      <SwapConfirmationModal
        {...baseProps({
          externalError: {
            message: "execution reverted: insufficient output",
          },
        })}
      />
    )
    // Error heading + Try Again button present; the normal "Confirm swap"
    // CTA is absent because the review block is hidden.
    expect(screen.getByRole("button", { name: /Try Again/i })).toBeTruthy()
    expect(screen.getByRole("button", { name: /View Error Details/i })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Confirm swap/i })).toBeNull()
  })

  it("hides Try Again when occurredAfterPreConfirm is true (tx already on L1)", () => {
    render(
      <SwapConfirmationModal
        {...baseProps({
          externalError: {
            message: "reverted after preconf",
            occurredAfterPreConfirm: true,
          },
        })}
      />
    )
    expect(screen.queryByRole("button", { name: /Try Again/i })).toBeNull()
    // Details button still present — user still needs to see the receipt.
    expect(screen.getByRole("button", { name: /View Error Details/i })).toBeTruthy()
  })
})

describe("SwapConfirmationModal — close handler", () => {
  it("clears lastTxError on the store when the modal closes", () => {
    // Seed a lingering error on the store so we can assert it clears.
    useSwapToastStore.setState({
      lastTxError: { message: "stale error from previous session" },
    })
    const onOpenChange = vi.fn()
    render(<SwapConfirmationModal {...baseProps({ onOpenChange })} />)
    const closeButton = screen.getByRole("button", { name: /Dismiss|Close/i })
    act(() => {
      fireEvent.click(closeButton)
    })
    expect(useSwapToastStore.getState().lastTxError).toBeNull()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
