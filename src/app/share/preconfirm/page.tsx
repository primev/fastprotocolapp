import { Metadata } from "next"
import { redirect } from "next/navigation"

interface Props {
  searchParams: Promise<{ time?: string; in?: string; out?: string }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams
  const time = params.time || "0.4"
  const tokenIn = params.in || "ETH"
  const tokenOut = params.out || "USDC"
  const secs = parseFloat(time)
  const fire = secs < 1 ? "\u{1F525}\u{1F525}\u{1F525}" : secs < 4 ? "\u{1F525}\u{1F525}" : "\u{1F525}"

  const title = `${fire} Preconfirmed in ${time}s — Fast Swaps`
  const description = `${tokenIn} → ${tokenOut} swap preconfirmed in ${time} seconds on Fast Protocol`
  const ogUrl = `/api/og/preconfirm?time=${time}&in=${tokenIn}&out=${tokenOut}`

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
  }
}

/** Redirect visitors to the main swap page — this route only exists for OG meta. */
export default async function SharePreconfirmPage() {
  redirect("/")
}
