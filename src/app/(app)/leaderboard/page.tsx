import { Suspense } from "react"
import {
  getActiveTraders,
  getCumulativeSwapVolume,
  getEthPrice,
  getLeaderboardTop15,
} from "@/lib/analytics-server"
import { LeaderboardPageClient } from "./LeaderboardPageClient"
import Loading from "./loading"

// Server Component - fetches global data
async function LeaderboardPageContent() {
  // Fetch all global stats in parallel (no wallet needed)
  const [activeTraders, swapVolumeEth, ethPrice, leaderboardData] = await Promise.all([
    getActiveTraders(),
    getCumulativeSwapVolume(),
    getEthPrice(),
    getLeaderboardTop15(),
  ])

  return (
    <LeaderboardPageClient
      preloadedActiveTraders={activeTraders}
      preloadedSwapVolumeEth={swapVolumeEth}
      preloadedEthPrice={ethPrice}
      preloadedLeaderboard={leaderboardData?.leaderboard || []}
    />
  )
}

// Wrap in Suspense to show loading state immediately during navigation
export default function LeaderboardPage() {
  return (
    <Suspense fallback={<Loading />}>
      <LeaderboardPageContent />
    </Suspense>
  )
}
