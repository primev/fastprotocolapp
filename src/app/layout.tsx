import "@/app/globals.css"

import type { Metadata, Viewport } from "next"
import { Providers } from "@/components/providers"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"

function addProtocolIfMissing(url: string): string {
  if (/^https?:\/\//i.test(url)) {
    return url
  }
  return `https://${url}`
}

const vercelEnv = process.env.VERCEL_ENV
const preferredDomainWithoutProtocol =
  vercelEnv === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : process.env.VERCEL_URL
const deploymentUrlString =
  (preferredDomainWithoutProtocol && addProtocolIfMissing(preferredDomainWithoutProtocol)) ||
  "http://localhost:3000"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(deploymentUrlString),
  title: "Fast Protocol - Lightning-fast transactions on L1",
  description:
    "Swap tokens on Ethereum with sub-second execution powered by preconfirmations. Earn tokenized MEV rewards with every trade on Fast Protocol.",
  icons: { icon: "/icon.png" },
  keywords: [
    "fast swaps",
    "ethereum swaps",
    "preconfirmations",
    "mev rewards",
    "L1 transactions",
    "fast protocol",
    "crypto trading",
    "token swap",
  ],
  authors: [{ name: "Fast Protocol" }],
  openGraph: {
    title: "Fast Protocol - Lightning-fast transactions on L1",
    description:
      "Swap tokens on Ethereum with sub-second execution powered by preconfirmations. Earn tokenized MEV rewards with every trade on Fast Protocol.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@Fast_Protocol",
    title: "Fast Protocol - Lightning-fast transactions on L1",
    description:
      "Swap tokens on Ethereum with sub-second execution powered by preconfirmations. Earn tokenized MEV rewards with every trade on Fast Protocol.",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth overflow-x-hidden">
      <body className="overflow-x-hidden">
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
