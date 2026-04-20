import "@/app/globals.css"

import type { Metadata, Viewport } from "next"
import { Providers } from "@/components/providers"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { getBaseUrl, SITE_URL } from "@/lib/config/site"
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register"
import { InstallPrompt } from "@/components/pwa/install-prompt"
import { GlobalBanner } from "@/components/shared/GlobalBanner"

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
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon-180x180.png", sizes: "180x180", type: "image/png" }],
  },
  // manifest is linked manually in <head> to avoid Next.js adding crossOrigin="use-credentials"
  // which breaks PWA installability on Vercel preview deployments
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
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Fast Protocol" />
        {/* Apple splash screens — prevents white flash on iOS PWA launch */}
        <link
          rel="apple-touch-startup-image"
          href="/icons/splash/iphone-8.png"
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/icons/splash/iphone-x.png"
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/icons/splash/iphone-xr.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/icons/splash/iphone-xsmax.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/icons/splash/iphone-12.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/icons/splash/iphone-12promax.png"
          media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/icons/splash/iphone-14pro.png"
          media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/icons/splash/iphone-14promax.png"
          media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/icons/splash/ipad-air.png"
          media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/icons/splash/ipad-pro-11.png"
          media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/icons/splash/ipad-pro-12.png"
          media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)"
        />
      </head>
      <body className="overflow-x-hidden">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <GlobalBanner />
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
        <InstallPrompt />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
