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

  // ──────────────────────────────────────────────────────────────────────────
  // Stale-data sanity gate
  // ──────────────────────────────────────────────────────────────────────────
  describe("stale-data sanity guard", () => {
    it("returns null when barter is < 0.5× the uniswap quote (decimals mismatch)", () => {
      // Simulates a token-switch race: amountOut is the new pair's value but
      // barterPreGas is the old pair's bigint with the wrong decimals scale,
      // making barterHuman a tiny fraction of parsedAmountOut.
      const result = computeSurplusEth({
        parsedAmountOut: 1,
        slippagePct: 0.5,
        barterPreGasOutputAmount: wei(0.0001), // way below 0.5 of 1 ETH
        toTokenDecimals: ETH_DECIMALS,
        isEthOutput: true,
        toTokenPrice: null,
        ethPrice: null,
      })
      expect(result).toBeNull()
    })

    it("returns null when barter is > 2× the uniswap quote (decimals mismatch)", () => {
      // Same race, opposite direction: barter bigint is too LARGE for the
      // current decimals scale (e.g. ETH wei interpreted as USDC raw).
      const result = computeSurplusEth({
        parsedAmountOut: 1,
        slippagePct: 0.5,
        barterPreGasOutputAmount: wei(50), // 50× larger than 1 ETH
        toTokenDecimals: ETH_DECIMALS,
        isEthOutput: true,
        toTokenPrice: null,
        ethPrice: null,
      })
      expect(result).toBeNull()
    })

    it("accepts barter just inside the 0.5× lower bound", () => {
      const result = computeSurplusEth({
        parsedAmountOut: 1,
        slippagePct: 50,
        barterPreGasOutputAmount: wei(0.51), // barely above 0.5×
        toTokenDecimals: ETH_DECIMALS,
        isEthOutput: true,
        toTokenPrice: null,
        ethPrice: null,
      })
      expect(result).not.toBeNull()
      // surplus = 0.51 − 1×(1 − 0.5) = 0.51 − 0.5 = 0.01
      expect(result!).toBeCloseTo(0.01, 9)
    })

    it("accepts barter just inside the 2× upper bound", () => {
      const result = computeSurplusEth({
        parsedAmountOut: 1,
        slippagePct: 0.5,
        barterPreGasOutputAmount: wei(1.99), // barely under 2×
        toTokenDecimals: ETH_DECIMALS,
        isEthOutput: true,
        toTokenPrice: null,
        ethPrice: null,
      })
      expect(result).not.toBeNull()
      // surplus = 1.99 − 1×(1 − 0.005) = 1.99 − 0.995 = 0.995
      expect(result!).toBeCloseTo(0.995, 9)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Decimals coverage — common tokens
  // ──────────────────────────────────────────────────────────────────────────
  describe("token decimals coverage", () => {
    const wbtc = (whole: number) => BigInt(Math.round(whole * 1e8))
    const dai = (whole: number) => BigInt(Math.round(whole * 1e18))

    it("WBTC (8 decimals) — converts surplus to ETH with token prices", () => {
      // 0.5 WBTC out, barter 0.499, slippage 0.5% → minOut 0.4975, surplus 0.0015 WBTC.
      // At $60k/WBTC and $3k/ETH → 0.0015 × 60000 / 3000 = 0.03 ETH.
      const result = computeSurplusEth({
        parsedAmountOut: 0.5,
        slippagePct: 0.5,
        barterPreGasOutputAmount: wbtc(0.499),
        toTokenDecimals: 8,
        isEthOutput: false,
        toTokenPrice: 60000,
        ethPrice: 3000,
      })
      expect(result).not.toBeNull()
      expect(result!).toBeCloseTo(0.03, 6)
    })

    it("DAI (18 decimals) — same scale as ETH, no surprises", () => {
      // 1000 DAI out, barter 999, slippage 0.5% → minOut 995, surplus 4 DAI.
      // At $1/DAI and $3k/ETH → 4 / 3000 ≈ 0.001333 ETH.
      const result = computeSurplusEth({
        parsedAmountOut: 1000,
        slippagePct: 0.5,
        barterPreGasOutputAmount: dai(999),
        toTokenDecimals: 18,
        isEthOutput: false,
        toTokenPrice: 1,
        ethPrice: 3000,
      })
      expect(result).not.toBeNull()
      expect(result!).toBeCloseTo(4 / 3000, 9)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Fuzz tests — randomized inputs verifying invariants
  // ──────────────────────────────────────────────────────────────────────────
  describe("fuzz invariants", () => {
    function mulberry32(seed: number) {
      let state = seed >>> 0
      return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
    }

    it("surplus is non-negative when within sanity bounds", () => {
      const rng = mulberry32(1)
      for (let i = 0; i < 5_000; i++) {
        const amount = rng() * 100 + 0.0001
        const slippage = rng() * 50
        // Keep barter in [0.5×, 2×] amount → passes sanity gate.
        const barterRatio = 0.5 + rng() * 1.5
        const result = computeSurplusEth({
          parsedAmountOut: amount,
          slippagePct: slippage,
          barterPreGasOutputAmount: wei(amount * barterRatio),
          toTokenDecimals: ETH_DECIMALS,
          isEthOutput: true,
          toTokenPrice: null,
          ethPrice: null,
        })
        if (result == null) continue
        expect(result).toBeGreaterThanOrEqual(0)
      }
    })

    it("surplus is monotonic non-decreasing in slippage (same swap)", () => {
      const rng = mulberry32(2)
      for (let i = 0; i < 1_000; i++) {
        const amount = rng() * 100 + 0.001
        const barterRatio = 0.5 + rng() * 1.5
        const s1 = rng() * 25
        const s2 = s1 + rng() * 25
        const r1 = computeSurplusEth({
          parsedAmountOut: amount,
          slippagePct: s1,
          barterPreGasOutputAmount: wei(amount * barterRatio),
          toTokenDecimals: ETH_DECIMALS,
          isEthOutput: true,
          toTokenPrice: null,
          ethPrice: null,
        })
        const r2 = computeSurplusEth({
          parsedAmountOut: amount,
          slippagePct: s2,
          barterPreGasOutputAmount: wei(amount * barterRatio),
          toTokenDecimals: ETH_DECIMALS,
          isEthOutput: true,
          toTokenPrice: null,
          ethPrice: null,
        })
        if (r1 == null || r2 == null) continue
        expect(r2).toBeGreaterThanOrEqual(r1 - 1e-9)
      }
    })

    it("sanity gate triggers ~always when barter is wildly out of scale", () => {
      const rng = mulberry32(3)
      let triggered = 0
      let total = 0
      for (let i = 0; i < 1_000; i++) {
        const amount = rng() * 10 + 0.01
        // 1e6× off — emulates ETH wei vs USDC raw decimals mismatch.
        const factor = rng() < 0.5 ? 1e-6 : 1e6
        const result = computeSurplusEth({
          parsedAmountOut: amount,
          slippagePct: rng() * 5 + 0.1,
          barterPreGasOutputAmount: wei(amount * factor),
          toTokenDecimals: ETH_DECIMALS,
          isEthOutput: true,
          toTokenPrice: null,
          ethPrice: null,
        })
        total++
        if (result == null) triggered++
      }
      expect(triggered / total).toBeGreaterThan(0.99)
    })
  })
})
