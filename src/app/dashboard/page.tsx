import { Suspense } from "react"
import { FEATURE_FLAGS } from "@/lib/feature-flags"
import {
  getCumulativeTransactions,
  getCumulativeSwapVolume,
  getSwapTransactionCount,
  getEthPrice,
} from "@/lib/analytics-server"
import DashboardContent from "./DashboardClient"

const DashboardPage = async () => {
  // If feature flag is enabled, fetch global stats on the server
  let initialGlobalStats = null

  if (FEATURE_FLAGS.show_global_stats) {
    const [cumulativeTransactions, cumulativeSwapVolume, swapTxCount, ethPrice] =
      await Promise.all([
        getCumulativeTransactions(),
        getCumulativeSwapVolume(),
        getSwapTransactionCount(),
        getEthPrice(),
      ])

    initialGlobalStats = {
      totalTxs: cumulativeTransactions,
      swapTxs: swapTxCount,
      totalSwapVolEth: cumulativeSwapVolume,
      ethPrice: ethPrice,
    }
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <DashboardContent initialGlobalStats={initialGlobalStats} />
    </Suspense>
  )
}

export default DashboardPage
