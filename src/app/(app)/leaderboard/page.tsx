import { Suspense } from "react"
import {
  getActiveTraders,
  getCumulativeSwapVolume,
  getEthPrice,
  getLeaderboardTop15,
} from "@/lib/analytics-server"
import { LeaderboardPageClient } from "./LeaderboardPageClient"
import { LeaderboardTable } from "@/components/dashboard/LeaderboardTable"

// Progressive rendering: Fetch leaderboard first (most important), then stats
// This allows the leaderboard to render immediately while stats load in parallel

// Leaderboard data component - fetches leaderboard independently
async function LeaderboardDataLoader() {
  const leaderboardData = await getLeaderboardTop15()
  return leaderboardData?.leaderboard || []
}

// Stats component - fetches stats independently and combines with leaderboard
// Each stat can stream in as it completes
async function StatsLoader({
  leaderboardData,
}: {
  leaderboardData: Array<{
    rank: number
    wallet: string
    swapVolume24h: number
    swapCount: number
    change24h: number
    isCurrentUser: boolean
    ethValue: number
  }>
}) {
  // Start all stats fetches in parallel - they'll complete independently
  // Don't use Promise.all - let them resolve individually for better streaming
  const activeTradersPromise = getActiveTraders()
  const swapVolumeEthPromise = getCumulativeSwapVolume()
  const ethPricePromise = getEthPrice()

  // Wait for all stats - but they're already loading in parallel
  // In a true streaming setup, we'd render each as it completes
  // For now, we wait for all but they load in parallel
  const [activeTraders, swapVolumeEth, ethPrice] = await Promise.all([
    activeTradersPromise,
    swapVolumeEthPromise,
    ethPricePromise,
  ])

  return (
    <LeaderboardPageClient
      preloadedActiveTraders={activeTraders}
      preloadedSwapVolumeEth={swapVolumeEth}
      preloadedEthPrice={ethPrice}
      preloadedLeaderboard={leaderboardData}
    />
  )
}

// Main content - fetches leaderboard first, then stats
// Leaderboard renders immediately, stats fill in as they arrive
async function LeaderboardContent() {
  // Fetch leaderboard first - most important data, renders immediately
  const leaderboardData = await LeaderboardDataLoader()

  // Then fetch stats - they load in parallel and render when ready
  return <StatsLoader leaderboardData={leaderboardData} />
}

// Progressive rendering: Leaderboard renders first, then stats fill in
export default function LeaderboardPage() {
  return (
    <div className="w-full container mx-auto px-0 sm:px-0 pb-2 md:pb-4 overflow-x-hidden">
      <Suspense
        fallback={
          <LeaderboardTable
            address={undefined}
            leaderboardData={undefined}
            statsData={undefined}
            isLoading={true}
            isFetching={false}
          />
        }
      >
        {/* Fetch leaderboard first - most important data */}
        <Suspense
          fallback={
            <LeaderboardPageClient
              preloadedActiveTraders={null}
              preloadedSwapVolumeEth={null}
              preloadedEthPrice={null}
              preloadedLeaderboard={[]}
            />
          }
        >
          <LeaderboardContent />
        </Suspense>
      </Suspense>
    </div>
  )
}
