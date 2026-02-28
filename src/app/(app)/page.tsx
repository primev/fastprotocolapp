import type { Metadata } from "next"
import { SwapOrLandingGate } from "./SwapOrLandingGate"

export const metadata: Metadata = {
  title: "Swap",
  description:
    "Swap tokens on Ethereum with sub-second execution powered by preconfirmations. Faster than any DEX, settled on L1.",
  openGraph: {
    title: "Swap — Fast Protocol",
    description:
      "Swap tokens on Ethereum with sub-second execution powered by preconfirmations. Faster than any DEX, settled on L1.",
  },
}

export default function IndexPage() {
  return <SwapOrLandingGate />
}
