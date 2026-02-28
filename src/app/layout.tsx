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
  title: {
    default: "Fast Protocol — Sub-second swaps on Ethereum",
    template: "%s | Fast Protocol",
  },
  description:
    "Swap tokens on Ethereum with sub-second execution powered by preconfirmations. Earn tokenized mev rewards with every trade on Fast Protocol.",
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
  alternates: {
    canonical: "https://fastprotocol.io",
  },
  verification: {
    google: "p5re5yzQsP2RyFgyBQ0IbBPtQbWAwpb1cz5QrHi-JUU",
  },
  openGraph: {
    title: "Fast Protocol — Sub-second swaps on Ethereum",
    description:
      "Swap tokens on Ethereum with sub-second execution powered by preconfirmations. Earn tokenized mev rewards with every trade on Fast Protocol.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@Fast_Protocol",
    title: "Fast Protocol — Sub-second swaps on Ethereum",
    description:
      "Swap tokens on Ethereum with sub-second execution powered by preconfirmations. Earn tokenized mev rewards with every trade on Fast Protocol.",
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Fast Protocol",
  url: "https://fastprotocol.io",
  logo: "https://fastprotocol.io/assets/fast-protocol-logo-icon.png",
  description:
    "The only swap on Ethereum that confirms before the block. Sub-second preconfirmations on L1 with tokenized mev rewards.",
  sameAs: [
    "https://x.com/Fast_Protocol",
    "https://discord.com/invite/fastprotocol",
    "https://t.me/Fast_Protocol",
  ],
  founder: { "@type": "Organization", name: "Primev" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth overflow-x-hidden">
      <body className="overflow-x-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
