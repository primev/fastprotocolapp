import { Metadata } from "next"

interface Props {
  params: Promise<{ time: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { time: timeParam } = await params
  const raw = parseFloat(timeParam || "0.4")
  const time = !isNaN(raw) && raw >= 0 && raw <= 999 ? raw.toFixed(1) : "0.4"

  const title = `Preconfirmed in ${time}s — Fast Swaps`
  const description = `Swap preconfirmed in ${time} seconds on Fast Protocol`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      site: "@Fast_Protocol",
    },
    robots: { index: false },
  }
}

/** Client-side redirect — crawlers see the meta tags, humans get redirected */
export default function SharePage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: 'window.location.replace("/")' }} />
      <p>Redirecting to Fast Protocol...</p>
    </>
  )
}
