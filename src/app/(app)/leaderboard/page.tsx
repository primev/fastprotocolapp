import type { Metadata } from "next"
import { SITE_URL } from "@/lib/site-config"
import { Suspense } from "react"
import {
  getActiveTraders,
  getCumulativeSwapVolume,
  getLeaderboardTop15,
} from "@/lib/analytics-server"
import { LeaderboardPageClient } from "./LeaderboardPageClient"
import { LeaderboardTable } from "@/components/dashboard/LeaderboardTable"

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "See top swappers ranked by volume and rewards earned on Fast Protocol.",
  alternates: { canonical: `${SITE_URL}/leaderboard` },
  openGraph: {
    title: "Leaderboard | Fast Protocol",
    description:
      "See top swappers ranked by volume and rewards earned on Fast Protocol.",
  },
}

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
  const activeTradersPromise = getActiveTraders()
  const swapVolumePromise = getCumulativeSwapVolume()

  const [activeTraders, swapVolume] = await Promise.all([activeTradersPromise, swapVolumePromise])

  return (
    <LeaderboardPageClient
      preloadedActiveTraders={activeTraders}
      preloadedSwapVolumeEth={swapVolume?.eth ?? null}
      preloadedSwapVolumeUsd={swapVolume?.usd ?? null}
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
      <section className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold mb-1">Fast Protocol Leaderboard</h1>
        <p className="text-muted-foreground text-sm">
          Top Ethereum swappers ranked by 24-hour volume. Powered by preconfirmations on L1. Updated in real-time.
        </p>
      </section>
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
              preloadedSwapVolumeUsd={null}
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
