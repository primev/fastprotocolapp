import type { Metadata } from "next"
import { SITE_URL } from "@/lib/site-config"

export const metadata: Metadata = {
  title: "Early Access",
  description:
    "Join the waitlist for the fastest swap experience on Ethereum. Preconfirmed trades, tokenized mev rewards.",
  alternates: { canonical: `${SITE_URL}/early-access` },
  openGraph: {
    title: "Get Early Access — Fast Protocol",
    description:
      "Join the waitlist for the fastest swap experience on Ethereum. Preconfirmed trades, tokenized mev rewards.",
  },
}

export default function EarlyAccessLayout({ children }: { children: React.ReactNode }) {
  return children
}
