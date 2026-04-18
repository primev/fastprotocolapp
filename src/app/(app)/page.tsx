import type { Metadata } from "next"
import { SITE_URL } from "@/lib/config/site"
import { SwapOrLandingGate } from "./SwapOrLandingGate"

export const metadata: Metadata = {
  title: "Sub-second Ethereum Swaps with Preconfirmations",
  description:
    "Swap tokens on Ethereum with sub-second preconfirmations. Faster than any DEX, settled on L1.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "Fast Protocol — Sub-second Ethereum Swaps with Preconfirmations",
    description:
      "Swap tokens on Ethereum with sub-second preconfirmations. Faster than any DEX, settled on L1.",
  },
}

export default function IndexPage() {
  return <SwapOrLandingGate />
}
