import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Early Access",
  description:
    "Join the waitlist for the fastest swap experience on Ethereum. Preconfirmed trades, tokenized mev rewards.",
  openGraph: {
    title: "Get Early Access — Fast Protocol",
    description:
      "Join the waitlist for the fastest swap experience on Ethereum. Preconfirmed trades, tokenized mev rewards.",
  },
}

export default function EarlyAccessLayout({ children }: { children: React.ReactNode }) {
  return children
}
