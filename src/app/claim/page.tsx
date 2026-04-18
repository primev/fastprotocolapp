import type { Metadata } from "next"
import { SITE_URL } from "@/lib/config/site"
import { getTotalSupply } from "@/lib/contract-server"
import {
  getCumulativeTransactions,
  getCumulativeSwapVolume,
  getEthPrice,
  getTotalPointsEarned,
} from "@/lib/analytics-server"
import { ClaimPageClient } from "@/components/claim/ClaimPageClient"

export const metadata: Metadata = {
  title: "Claim Rewards",
  description: "Claim your earned mev rewards from preconfirmed swaps on Fast Protocol.",
  alternates: { canonical: `${SITE_URL}/claim` },
  openGraph: {
    title: "Claim Rewards | Fast Protocol",
    description: "Claim your earned mev rewards from preconfirmed swaps on Fast Protocol.",
  },
}

const ClaimPage = async () => {
  // Fetch data on the server before rendering
  const [totalSupply, cumulativeTransactions, cumulativeSwapVolume, ethPrice, totalPoints] =
    await Promise.all([
      getTotalSupply(),
      getCumulativeTransactions(),
      getCumulativeSwapVolume(),
      getEthPrice(),
      getTotalPointsEarned(),
    ])

  // Convert bigint to string for serialization (Next.js can't serialize bigint directly)
  const totalSupplyString = totalSupply !== null ? totalSupply.toString() : null
  const transactionsString =
    cumulativeTransactions !== null ? cumulativeTransactions.toString() : null
  const swapVolumeUsdString =
    cumulativeSwapVolume?.usd != null ? cumulativeSwapVolume.usd.toString() : null
  const ethPriceString = ethPrice !== null ? ethPrice.toString() : null
  const totalPointsString = totalPoints !== null ? totalPoints.toString() : null

  return (
    <ClaimPageClient
      initialTotalSupply={totalSupplyString}
      initialTransactions={transactionsString}
      initialSwapVolumeUsd={swapVolumeUsdString}
      initialEthPrice={ethPriceString}
      initialTotalPoints={totalPointsString}
    />
  )
}

export default ClaimPage
