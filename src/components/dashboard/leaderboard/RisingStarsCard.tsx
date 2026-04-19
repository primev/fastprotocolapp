"use client"

// Rising Stars dashboard card (Climbers / New Users / WoW Growth tabs).
// Split out because it caches per-sort API responses and has its own
// Find-Me gating (only standard-tier users are eligible) — easier to
// reason about in its own file than inline in LeaderboardTable.

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { BarChart3, Flame, HelpCircle } from "lucide-react"
import { getTierFromVolume } from "@/lib/config/constants"
import { PaginatedLeaderboardModal } from "./PaginatedLeaderboardModal"

// Rising Stars types and component
interface RisingStarEntry {
  rank: number
  wallet: string
  stat: number
  statLabel: string
  swapCount?: number
  volume?: number
}

const RISING_TABS = ["Climbers", "New Users", "WoW Growth"] as const
type RisingTab = (typeof RISING_TABS)[number]

const RISING_TAB_TO_SORT: Record<RisingTab, string> = {
  Climbers: "climbers",
  "New Users": "new_users",
  "WoW Growth": "wow_growth",
}

const RISING_TAB_TO_LABEL: Record<RisingTab, string> = {
  Climbers: "INCREASE",
  "New Users": "VOLUME",
  "WoW Growth": "GROWTH",
}

function getRisingStat(entry: RisingStarEntry, tab: RisingTab): string {
  switch (tab) {
    case "Climbers":
      return `+${formatRisingVol(entry.stat)}`
    case "New Users":
      return formatRisingVol(entry.stat)
    case "WoW Growth":
      return `${entry.stat >= 0 ? "+" : ""}${entry.stat.toFixed(0)}%`
  }
}

function getRisingSubtext(entry: RisingStarEntry, tab: RisingTab): string {
  switch (tab) {
    case "Climbers":
      return formatRisingVol(entry.volume ?? 0)
    case "New Users":
      return `${entry.swapCount ?? 0} swaps`
    case "WoW Growth":
      return formatRisingVol(entry.volume ?? 0)
  }
}

function formatRisingVol(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  if (v >= 1) return `$${v.toFixed(0)}`
  return `$${v.toFixed(2)}`
}

export const RisingStarsCard = ({
  userWallet,
  userVolume,
}: {
  userWallet?: string
  userVolume?: number | null
}) => {
  const [activeTab, setActiveTab] = useState<RisingTab>("Climbers")
  const [data, setData] = useState<Record<string, RisingStarEntry[]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchFromApi = useCallback(async (sort: string, limit: number) => {
    const res = await fetch(`/api/analytics/leaderboard/rising-stars?sort=${sort}&limit=${limit}`)
    if (!res.ok) return []
    const json = await res.json()
    return (json.entries || []) as RisingStarEntry[]
  }, [])

  // Fetch data for the active tab
  useEffect(() => {
    const sort = RISING_TAB_TO_SORT[activeTab]
    if (data[sort]) return

    let cancelled = false
    setIsLoading(true)
    fetchFromApi(sort, 10).then((entries) => {
      if (!cancelled) {
        setData((prev) => ({ ...prev, [sort]: entries }))
        setIsLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [activeTab, data, fetchFromApi])

  const modalBuildParams = useCallback(
    (p: number, l: number) => ({
      sort: RISING_TAB_TO_SORT[activeTab],
      page: String(p),
      limit: String(l),
    }),
    [activeTab]
  )

  // Only show Find Me if user is standard tier (below Bronze — Rising Stars only includes standard)
  const isStandardTier = useMemo(() => getTierFromVolume(userVolume) === "standard", [userVolume])
  const modalFindMeParams = useMemo(() => {
    if (!isStandardTier) return undefined
    return {
      category: "rising",
      sort: RISING_TAB_TO_SORT[activeTab],
      tier: "all",
    }
  }, [activeTab, isStandardTier])

  const entries = data[RISING_TAB_TO_SORT[activeTab]] ?? []
  const leader = entries[0]
  const statLabel = RISING_TAB_TO_LABEL[activeTab]
  const showLoading = isLoading && entries.length === 0

  return (
    <>
      <Card className="group/card relative p-4 md:p-6 bg-white/[0.01] border-white/5 hover:border-white/10 transition-all duration-300 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Flame size={14} className="text-primary" />
          </div>
          <h3 className="font-bold text-sm">Rising Stars</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle
                size={14}
                className="hidden sm:block text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-help"
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
              <p>
                <span className="font-bold text-foreground">Climbers</span> — Biggest volume
                increase this week
              </p>
              <p>
                <span className="font-bold text-foreground">New Users</span> — Top performers who
                joined in the last 30 days
              </p>
              <p>
                <span className="font-bold text-foreground">WoW Growth</span> — Highest
                week-over-week volume growth %
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Internal tabs */}
        <div className="flex gap-1 mb-4 border-b border-white/5 pb-2">
          {RISING_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                activeTab === tab
                  ? "bg-primary/10 text-primary font-bold"
                  : "text-muted-foreground/50 hover:text-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {showLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-[10px] text-muted-foreground/30 font-bold uppercase animate-pulse">
              Loading...
            </p>
          </div>
        ) : !leader ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <BarChart3 size={32} className="text-muted-foreground/15" />
            <p className="text-xs text-muted-foreground/30 font-medium">No data available yet</p>
          </div>
        ) : (
          <>
            <div className="flex gap-4">
              {/* Leader highlight */}
              <div className="flex flex-col items-center p-4 bg-gradient-to-b from-white/[0.03] to-transparent rounded-xl border border-white/5 min-w-[130px] w-[140px] shrink-0">
                <div className="relative w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 ring-2 ring-offset-2 ring-offset-background ring-primary/20">
                  <span className="text-sm font-black uppercase tracking-widest text-primary">
                    #1
                  </span>
                </div>
                <p className="font-mono text-xs text-center truncate max-w-[110px]">
                  {leader.wallet}
                </p>
                <div className="mt-auto pt-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 text-center">
                    {statLabel}
                  </p>
                  <p className="text-lg font-black tabular-nums text-green-500 text-center">
                    {getRisingStat(leader, activeTab)}
                  </p>
                </div>
              </div>

              {/* Ranked list */}
              <div className="flex-1 space-y-1 max-h-[220px] overflow-y-auto scrollbar-hide">
                {entries.map((entry, idx) => (
                  <div
                    key={entry.wallet}
                    className={`flex items-center justify-between py-1.5 px-2 rounded text-sm transition-colors ${
                      idx === 0 ? "bg-primary/[0.05]" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground/40 w-6 text-xs font-mono">
                        {idx + 1}.
                      </span>
                      <span className="font-mono text-xs truncate max-w-[100px]">
                        {entry.wallet}
                      </span>
                    </div>
                    <span
                      className={`font-mono text-xs font-bold text-green-500 ${
                        idx === 0 ? "bg-green-500/20 text-green-400 px-2 py-0.5 rounded" : ""
                      }`}
                    >
                      {getRisingStat(entry, activeTab)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setModalOpen(true)}
              className="w-full mt-6 text-xs text-primary hover:underline cursor-pointer"
            >
              All Leaders →
            </button>
          </>
        )}
      </Card>

      <PaginatedLeaderboardModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={`Rising Stars — ${activeTab}`}
        description={`All wallets sorted by ${activeTab.toLowerCase()}`}
        fetchUrl="/api/analytics/leaderboard/rising-stars"
        buildParams={modalBuildParams}
        renderStat={(e) => getRisingStat(e as unknown as RisingStarEntry, activeTab)}
        renderSubtext={(e) => getRisingSubtext(e as unknown as RisingStarEntry, activeTab)}
        userWallet={userWallet}
        findMeParams={modalFindMeParams}
      />
    </>
  )
}
