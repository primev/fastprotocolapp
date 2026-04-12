import type { Metadata } from "next"
import { Sora } from "next/font/google"
import { SITE_URL } from "@/lib/site-config"

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sora",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Fast Protocol — Better price. Instant confirmation.",
  description:
    "See the live execution advantage: top-of-block preconfirmed swaps with mev returned to the trader. Verified against Uniswap and aggregators on recent mainnet swaps.",
  alternates: { canonical: `${SITE_URL}/pro` },
  openGraph: {
    title: "Fast Protocol — You keep the mev",
    description:
      "Top-of-block execution, preconfirmed in under 500ms, with mev returned to you. See live trade comparisons vs Uniswap and aggregators.",
    url: `${SITE_URL}/pro`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fast Protocol — You keep the mev",
    description: "Top-of-block execution, preconfirmed in under 500ms, with mev returned to you.",
  },
}

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return <div className={sora.variable}>{children}</div>
}
