import { getTotalSupply } from "@/lib/contract-server"
import { getCumulativeTransactions } from "@/lib/analytics-server"
import { ClaimPageClient } from "@/components/claim/ClaimPageClient"

const ClaimPage = async () => {
  // Fetch data on the server before rendering
  const [totalSupply, cumulativeTransactions] = await Promise.all([
    getTotalSupply(),
    getCumulativeTransactions(),
  ])

  // Convert bigint to string for serialization (Next.js can't serialize bigint directly)
  const totalSupplyString = totalSupply !== null ? totalSupply.toString() : null
  const transactionsString =
    cumulativeTransactions !== null ? cumulativeTransactions.toString() : null

  return (
    <ClaimPageClient
      initialTotalSupply={totalSupplyString}
      initialTransactions={transactionsString}
    />
  )
}

export default ClaimPage
