import type { Metadata } from "next"
import { SITE_URL } from "@/lib/config/site"

export const metadata: Metadata = {
  title: "Get Started",
  description:
    "Connect your wallet and set up Fast RPC to start swapping with sub-second confirmations.",
  alternates: { canonical: `${SITE_URL}/claim/onboarding` },
  openGraph: {
    title: "Get Started | Fast Protocol",
    description:
      "Connect your wallet and set up Fast RPC to start swapping with sub-second confirmations.",
  },
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children
}
