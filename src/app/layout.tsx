import "@/app/globals.css"

import type { Metadata, Viewport } from "next"
import { Providers } from "@/components/providers"
import { Analytics } from "@vercel/analytics/next"

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
    "Lightning-fast transactions on L1. Tokenized mev rewards. Join the waitlist for exclusive early access to Fast Protocol.",
  icons: { icon: "/icon.png" },
  keywords: ["blockchain", "protocol", "crypto", "fast transactions", "L1", "mev rewards", "web3"],
  authors: [{ name: "Fast Protocol" }],
  openGraph: {
    title: "Fast Protocol - Lightning-fast transactions on L1",
    description: "Lightning-fast transactions on L1. Tokenized mev rewards.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@Fast_Protocol",
    title: "Fast Protocol - Lightning-fast transactions on L1",
    description: "Lightning-fast transactions on L1. Tokenized mev rewards.",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth overflow-x-hidden">
      <body className="overflow-x-hidden">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  )
}
