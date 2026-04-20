import type { Metadata } from "next"
import { Sora } from "next/font/google"
import { SITE_URL } from "@/lib/config/site"

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Best Execution Ethereum Swaps — Preconfirmed in Under 500ms | Fast Protocol",
  description:
    "Compare Fast Protocol execution quality vs Uniswap and 1inch on real Ethereum mainnet swaps. Top-of-block preconfirmations, sub-500ms confirmation, and tokenized mev rewards.",
  alternates: { canonical: `${SITE_URL}/pro` },
  openGraph: {
    title: "Fast Protocol — Better Execution on Ethereum, Verified",
    description:
      "Top-of-block preconfirmed swaps vs Uniswap and aggregators. See live execution quality comparisons on real mainnet trades.",
    url: `${SITE_URL}/pro`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fast Protocol — Better Execution on Ethereum, Verified",
    description:
      "Top-of-block preconfirmed swaps vs Uniswap and aggregators. Sub-500ms confirmation with mev rewards.",
  },
}

const proJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Fast Protocol Execution Quality Comparison",
  description:
    "Compare Fast Protocol swap execution vs Uniswap and aggregators on Ethereum mainnet",
  url: `${SITE_URL}/pro`,
  isPartOf: {
    "@type": "WebSite",
    name: "Fast Protocol",
    url: SITE_URL,
  },
  about: {
    "@type": "SoftwareApplication",
    name: "Fast Protocol",
    applicationCategory: "DeFi",
    operatingSystem: "Web",
  },
}

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={sora.variable}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(proJsonLd) }}
      />
      {children}
    </div>
  )
}
