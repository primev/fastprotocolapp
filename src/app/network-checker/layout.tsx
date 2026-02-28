import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Network Checker",
  description:
    "Configure your wallet to use Fast Protocol RPC for sub-second transaction confirmations.",
  alternates: { canonical: "https://fastprotocol.io/network-checker" },
  openGraph: {
    title: "Network Checker — Fast Protocol",
    description:
      "Configure your wallet to use Fast Protocol RPC for sub-second transaction confirmations.",
  },
}

export default function NetworkCheckerLayout({ children }: { children: React.ReactNode }) {
  return children
}
