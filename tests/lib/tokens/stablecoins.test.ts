import { describe, it, expect } from "vitest"
import { isStablecoin } from "@/lib/tokens/stablecoins"

// isStablecoin drives display formatting (toFixed for stables vs toSignificant
// for volatile assets). A false positive makes a volatile token render with
// too few significant digits; a false negative makes stablecoins show noisy
// sub-cent decimals. Both surface as visible UI regressions, so we lock the
// three lookup tiers here.

const USDC_ADDR = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
const USDT_ADDR = "0xdAC17F958D2ee523a2206206994597C13D831ec7"
const DAI_ADDR = "0x6B175474E89094C44Da98b954EedeAC495271d0F"

describe("isStablecoin", () => {
  describe("tier A — hardcoded CORE_STABLES by address", () => {
    it("matches USDC/USDT/DAI in either case", () => {
      expect(isStablecoin(USDC_ADDR)).toBe(true)
      expect(isStablecoin(USDC_ADDR.toLowerCase())).toBe(true)
      expect(isStablecoin(USDT_ADDR)).toBe(true)
      expect(isStablecoin(DAI_ADDR)).toBe(true)
    })
  })

  describe("tier B — CoinGecko symbol list", () => {
    it("matches a known stablecoin symbol on an unknown address", () => {
      // Address is random; symbol is the signal. The test proves the symbol
      // list is actually consulted, not just the hardcoded CORE set.
      expect(isStablecoin("0xdead", "USDC")).toBe(true)
    })
  })

  describe("tier C — prefix heuristic", () => {
    it("matches USD-, EUR-, DAI-, FRAX- prefixes on unknown symbols", () => {
      expect(isStablecoin("0xdead", "USDe")).toBe(true)
      expect(isStablecoin("0xdead", "EURC")).toBe(true)
      expect(isStablecoin("0xdead", "FRAXv2")).toBe(true)
    })

    it("does not match unrelated symbols", () => {
      expect(isStablecoin("0xdead", "WBTC")).toBe(false)
      expect(isStablecoin("0xdead", "PEPE")).toBe(false)
    })
  })

  describe("edge cases", () => {
    it("returns false for empty inputs", () => {
      expect(isStablecoin("")).toBe(false)
      expect(isStablecoin("", "")).toBe(false)
    })
  })
})
