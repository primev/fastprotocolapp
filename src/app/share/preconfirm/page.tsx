import { Metadata } from "next"

interface Props {
  searchParams: Promise<{ time?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams
  const raw = parseFloat(params.time || "0.4")
  const time = !isNaN(raw) && raw >= 0 && raw <= 999 ? raw.toFixed(1) : "0.4"
  const title = `Preconfirmed in ${time}s — Fast Swaps`
  const description = `Swap preconfirmed in ${time} seconds on Fast Protocol`
  const ogUrl = `/api/og/preconfirm?time=${time}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
      site: "@Fast_Protocol",
    },
    robots: { index: false },
  }
}

/**
 * Renders a minimal page so crawlers (Twitter, Facebook) can read the meta tags.
 * Human visitors get a client-side redirect to the swap page.
 */
export default function SharePreconfirmPage() {
  return (
    <meta httpEquiv="refresh" content="0;url=/" />
  )
}
