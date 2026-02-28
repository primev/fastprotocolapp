import type { Metadata } from "next"
import { SITE_URL } from "@/lib/site-config"
import { SwapOrLandingGate } from "./SwapOrLandingGate"

export const metadata: Metadata = {
  title: "Swap",
  description:
    "Swap tokens on Ethereum with sub-second execution powered by preconfirmations. Faster than any DEX, settled on L1.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: "Swap | Fast Protocol",
    description:
      "Swap tokens on Ethereum with sub-second execution powered by preconfirmations. Faster than any DEX, settled on L1.",
  },
}

export default function IndexPage() {
  return <SwapOrLandingGate />
}
