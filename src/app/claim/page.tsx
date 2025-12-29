import { getTotalSupply } from "@/lib/contract-server"
import {
  getCumulativeTransactions,
  getCumulativeVolume,
  getEthPrice,
} from "@/lib/analytics-server"
import { ClaimPageClient } from "@/components/claim/ClaimPageClient"

const ClaimPage = async () => {
  // Fetch data on the server before rendering
  const [totalSupply, cumulativeTransactions, cumulativeVolume, ethPrice] =
    await Promise.all([
      getTotalSupply(),
      getCumulativeTransactions(),
      getCumulativeVolume(),
      getEthPrice(),
    ])

  // Convert bigint to string for serialization (Next.js can't serialize bigint directly)
  const totalSupplyString = totalSupply !== null ? totalSupply.toString() : null
  const transactionsString =
    cumulativeTransactions !== null ? cumulativeTransactions.toString() : null
  const volumeString = cumulativeVolume !== null ? cumulativeVolume.toString() : null
  const ethPriceString = ethPrice !== null ? ethPrice.toString() : null

  return (
    <ClaimPageClient
      initialTotalSupply={totalSupplyString}
      initialTransactions={transactionsString}
      initialVolume={volumeString}
      initialEthPrice={ethPriceString}
    />
  )
}

export default ClaimPage
