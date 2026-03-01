import type { Metadata } from "next"
import { isAddress } from "viem"
import ReferralPageClient from "./ReferralPageClient"

function shortenAddress(addr: string): string {
  return isAddress(addr) ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ af?: string }>
}): Promise<Metadata> {
  const params = await searchParams
  const af = params.af

  const hasReferrer = af && (isAddress(af) || /^[a-zA-Z0-9-]+$/.test(af))
  const referrerLabel = hasReferrer ? (isAddress(af) ? shortenAddress(af) : af) : null

  const title = referrerLabel ? `Invited by ${referrerLabel}` : "Refer & Earn"

  const description = referrerLabel
    ? `You've been invited to Fast Protocol by ${referrerLabel}. Connect your wallet to register and start earning mev rewards.`
    : "Invite friends to Fast Protocol and earn rewards when they swap."

  return {
    title,
    description,
    openGraph: {
      title: `${title} — Fast Protocol`,
      description,
    },
  }
}

export default function ReferralPage() {
  return <ReferralPageClient />
}
