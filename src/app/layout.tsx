import "@/app/globals.css"

import type { Metadata, Viewport } from "next"
import { Providers } from "@/components/providers"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { getBaseUrl, SITE_URL } from "@/lib/site-config"
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register"
import { InstallPrompt } from "@/components/pwa/install-prompt"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3b8df8",
}

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: "Fast Protocol — Sub-second swaps on Ethereum",
    template: "%s | Fast Protocol",
  },
  description:
    "Swap tokens on Ethereum with sub-second execution powered by preconfirmations. Earn tokenized mev rewards with every trade on Fast Protocol.",
  icons: {
    icon: "/icon.png",
    apple: "/icons/icon-192x192.png",
  },
  manifest: "/manifest.json",
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
    canonical: SITE_URL,
  },
  verification: {
    google: "p5re5yzQsP2RyFgyBQ0IbBPtQbWAwpb1cz5QrHi-JUU",
  },
  openGraph: {
    title: "Fast Protocol | Sub-second swaps on Ethereum",
    description:
      "Swap tokens on Ethereum with sub-second execution powered by preconfirmations. Earn tokenized mev rewards with every trade on Fast Protocol.",
    url: SITE_URL,
    type: "website",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Fast Protocol — Sub-second swaps on Ethereum",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@Fast_Protocol",
    title: "Fast Protocol | Sub-second swaps on Ethereum",
    description:
      "Swap tokens on Ethereum with sub-second execution powered by preconfirmations. Earn tokenized mev rewards with every trade on Fast Protocol.",
    images: ["/opengraph-image.png"],
  },
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Fast Protocol",
  url: SITE_URL,
  logo: `${SITE_URL}/assets/fast-protocol-logo-icon.png`,
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
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Fast Protocol" />
      </head>
      <body className="overflow-x-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
        <InstallPrompt />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
