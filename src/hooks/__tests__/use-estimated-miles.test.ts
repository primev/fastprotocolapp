import { describe, it, expect } from "vitest"
import { computeSurplusEth } from "../use-estimated-miles"

describe("computeSurplusEth", () => {
  // Convenience: 1 USDC = 1e6 wei (6 decimals); 1 ETH = 1e18 wei.
  const USDC_DECIMALS = 6
  const ETH_DECIMALS = 18
  const usdc = (whole: number) => BigInt(Math.round(whole * 1e6))
  const wei = (eth: number) => BigInt(Math.round(eth * 1e18))

  describe("ETH output (no price conversion)", () => {
    it("computes surplus = barter − userAmtOut at typical 0.5% slippage", () => {
      // Quote says 1 ETH out, Barter routes to 0.998 ETH (0.2% routing
      // overhead), slippage 0.5% → minAmountOut = 0.995 ETH.
      // surplus = 0.998 − 0.995 = 0.003 ETH.
      const result = computeSurplusEth({
        parsedAmountOut: 1,
        slippagePct: 0.5,
        barterPreGasOutputAmount: wei(0.998),
        toTokenDecimals: ETH_DECIMALS,
        isEthOutput: true,
        toTokenPrice: null,
        ethPrice: null,
      })
      expect(result).not.toBeNull()
      expect(result!).toBeCloseTo(0.003, 9)
    })

    it("scales surplus with slippage — wider tolerance widens the gap", () => {
      const baseline = computeSurplusEth({
        parsedAmountOut: 1,
        slippagePct: 0.5,
        barterPreGasOutputAmount: wei(0.998),
        toTokenDecimals: ETH_DECIMALS,
        isEthOutput: true,
        toTokenPrice: null,
        ethPrice: null,
      })!
      const wider = computeSurplusEth({
        parsedAmountOut: 1,
        slippagePct: 5,
        barterPreGasOutputAmount: wei(0.998),
        toTokenDecimals: ETH_DECIMALS,
        isEthOutput: true,
        toTokenPrice: null,
        ethPrice: null,
      })!
      // 5% slippage → minAmountOut = 0.95, surplus = 0.998 − 0.95 = 0.048.
      // Should be substantially larger than the 0.5% baseline.
      expect(wider).toBeGreaterThan(baseline)
      expect(wider).toBeCloseTo(0.048, 9)
    })

    it("clamps surplus to 0 when Barter output is below the user's floor", () => {
      // Barter delivers only 0.99, slippage 0.5% → floor 0.995.
      // On-chain this would revert with InsufficientOut; surplus is "negative"
      // → clamp to zero.
      const result = computeSurplusEth({
        parsedAmountOut: 1,
        slippagePct: 0.5,
        barterPreGasOutputAmount: wei(0.99),
        toTokenDecimals: ETH_DECIMALS,
        isEthOutput: true,
        toTokenPrice: null,
        ethPrice: null,
      })
      expect(result).toBe(0)
    })

    it("returns 0 when slippage exactly matches the routing shortfall", () => {
      // routing shortfall 0.5%, slippage 0.5% → barter == minAmountOut → surplus = 0.
      const result = computeSurplusEth({
        parsedAmountOut: 1,
        slippagePct: 0.5,
        barterPreGasOutputAmount: wei(0.995),
        toTokenDecimals: ETH_DECIMALS,
        isEthOutput: true,
        toTokenPrice: null,
        ethPrice: null,
      })
      expect(result!).toBeCloseTo(0, 9)
    })
  })

  describe("non-ETH output (price-converted)", () => {
    it("converts USDC surplus to ETH using token / ETH prices", () => {
      // Quote 3000 USDC, Barter routes 2997 USDC, slippage 0.5% →
      // minAmountOut = 2985 USDC. Surplus = 12 USDC.
      // At $1/USDC and $3000/ETH → 12 / 3000 = 0.004 ETH.
      const result = computeSurplusEth({
        parsedAmountOut: 3000,
        slippagePct: 0.5,
        barterPreGasOutputAmount: usdc(2997),
        toTokenDecimals: USDC_DECIMALS,
        isEthOutput: false,
        toTokenPrice: 1,
        ethPrice: 3000,
      })
      expect(result).not.toBeNull()
      expect(result!).toBeCloseTo(0.004, 9)
    })

    it("returns null when token price is missing", () => {
      const result = computeSurplusEth({
        parsedAmountOut: 3000,
        slippagePct: 0.5,
        barterPreGasOutputAmount: usdc(2997),
        toTokenDecimals: USDC_DECIMALS,
        isEthOutput: false,
        toTokenPrice: null,
        ethPrice: 3000,
      })
      expect(result).toBeNull()
    })

    it("returns null when ETH price is missing", () => {
      const result = computeSurplusEth({
        parsedAmountOut: 3000,
        slippagePct: 0.5,
        barterPreGasOutputAmount: usdc(2997),
        toTokenDecimals: USDC_DECIMALS,
        isEthOutput: false,
        toTokenPrice: 1,
        ethPrice: null,
      })
      expect(result).toBeNull()
    })
  })

  describe("invalid inputs", () => {
    it("returns null for zero or negative amountOut", () => {
      expect(
        computeSurplusEth({
          parsedAmountOut: 0,
          slippagePct: 0.5,
          barterPreGasOutputAmount: wei(0.998),
          toTokenDecimals: ETH_DECIMALS,
          isEthOutput: true,
          toTokenPrice: null,
          ethPrice: null,
        })
      ).toBeNull()
    })

    it("returns null for negative slippage", () => {
      expect(
        computeSurplusEth({
          parsedAmountOut: 1,
          slippagePct: -1,
          barterPreGasOutputAmount: wei(0.998),
          toTokenDecimals: ETH_DECIMALS,
          isEthOutput: true,
          toTokenPrice: null,
          ethPrice: null,
        })
      ).toBeNull()
    })

    it("returns null for NaN slippage", () => {
      expect(
        computeSurplusEth({
          parsedAmountOut: 1,
          slippagePct: Number.NaN,
          barterPreGasOutputAmount: wei(0.998),
          toTokenDecimals: ETH_DECIMALS,
          isEthOutput: true,
          toTokenPrice: null,
          ethPrice: null,
        })
      ).toBeNull()
    })

    it("returns null when Barter output is zero", () => {
      expect(
        computeSurplusEth({
          parsedAmountOut: 1,
          slippagePct: 0.5,
          barterPreGasOutputAmount: 0n,
          toTokenDecimals: ETH_DECIMALS,
          isEthOutput: true,
          toTokenPrice: null,
          ethPrice: null,
        })
      ).toBeNull()
    })
  })

  describe("auto-bump scenario (slippage adjusted to clear the routing shortfall)", () => {
    it("yields a positive surplus once auto-bump opens room above routing cost", () => {
      // Routing shortfall 1.5%, auto bumps to 2% → minAmountOut = 0.98,
      // barter = 0.985 → surplus = 0.005 ETH.
      const result = computeSurplusEth({
        parsedAmountOut: 1,
        slippagePct: 2,
        barterPreGasOutputAmount: wei(0.985),
        toTokenDecimals: ETH_DECIMALS,
        isEthOutput: true,
        toTokenPrice: null,
        ethPrice: null,
      })
      expect(result!).toBeCloseTo(0.005, 9)
    })
  })

  describe(">5% custom slippage scenario", () => {
    it("produces a much larger surplus mirroring the warning copy ('more miles')", () => {
      // Same trade, comparing tight vs. loose slippage.
      const tight = computeSurplusEth({
        parsedAmountOut: 1,
        slippagePct: 0.5,
        barterPreGasOutputAmount: wei(0.997),
        toTokenDecimals: ETH_DECIMALS,
        isEthOutput: true,
        toTokenPrice: null,
        ethPrice: null,
      })!
      const loose = computeSurplusEth({
        parsedAmountOut: 1,
        slippagePct: 10,
        barterPreGasOutputAmount: wei(0.997),
        toTokenDecimals: ETH_DECIMALS,
        isEthOutput: true,
        toTokenPrice: null,
        ethPrice: null,
      })!
      // tight: 0.997 − 0.995 = 0.002 ETH
      // loose: 0.997 − 0.900 = 0.097 ETH
      // ~48× more surplus → ~48× more miles, which is what the warning copy
      // ("you will earn more miles") promises.
      expect(loose / tight).toBeGreaterThan(40)
    })
  })
})
