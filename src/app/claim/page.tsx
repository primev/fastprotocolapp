import { getTotalSupply } from "@/lib/contract-server"
import {
  getCumulativeTransactions,
  getCumulativeSwapVolume,
  getEthPrice,
} from "@/lib/analytics-server"
import { ClaimPageClient } from "@/components/claim/ClaimPageClient"

const ClaimPage = async () => {
  // Fetch data on the server before rendering
  const [totalSupply, cumulativeTransactions, cumulativeSwapVolume, ethPrice] = await Promise.all([
    getTotalSupply(),
    getCumulativeTransactions(),
    getCumulativeSwapVolume(),
    getEthPrice(),
  ])

  // Convert bigint to string for serialization (Next.js can't serialize bigint directly)
  const totalSupplyString = totalSupply !== null ? totalSupply.toString() : null
  const transactionsString =
    cumulativeTransactions !== null ? cumulativeTransactions.toString() : null
  const swapVolumeString = cumulativeSwapVolume !== null ? cumulativeSwapVolume.toString() : null
  const ethPriceString = ethPrice !== null ? ethPrice.toString() : null

  return (
    <ClaimPageClient
      initialTotalSupply={totalSupplyString}
      initialTransactions={transactionsString}
      initialSwapVolume={swapVolumeString}
      initialEthPrice={ethPriceString}
    />
  )
}

export default ClaimPage
