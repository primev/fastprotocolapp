"use client"

// Volume Leaders dashboard card (Volume / Avg Size / Largest tabs). Split
// from LeaderboardTable because this card has its own API fetch lifecycle
// and tab state — keeping it colocated with its helpers makes the tabs
// easy to iterate on in isolation.

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { BarChart3, HelpCircle, TrendingUp } from "lucide-react"
import { getTierFromVolume, getTierMetadata } from "@/lib/config/constants"
import { PaginatedLeaderboardModal } from "./PaginatedLeaderboardModal"
import type { LeaderboardEntry } from "./types"

// Volume Leaders entry from API
interface VolumeLeaderEntry {
  rank: number
  wallet: string
  volume: number
  volumeEth: number
  swapCount: number
  avgSize: number
  largestSwap?: number
  largestSwapEth?: number
}

const VOLUME_TABS = ["Volume", "Avg Size", "Largest"] as const
type VolumeTab = (typeof VOLUME_TABS)[number]

const TAB_TO_SORT: Record<VolumeTab, string> = {
  Volume: "volume",
  "Avg Size": "avg_size",
  Largest: "largest",
}

const TAB_TO_LABEL: Record<VolumeTab, string> = {
  Volume: "VOLUME",
  "Avg Size": "AVG SIZE",
  Largest: "LARGEST",
}

function formatVol(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`
  if (v >= 1) return `$${v.toFixed(0)}`
  return `$${v.toFixed(2)}`
}

function getStatForTab(entry: VolumeLeaderEntry, tab: VolumeTab): string {
  switch (tab) {
    case "Volume":
      return formatVol(entry.volume)
    case "Avg Size":
      return formatVol(entry.avgSize)
    case "Largest":
      return formatVol(entry.largestSwap ?? 0)
  }
}

export const VolumeLeadersCard = ({
  initialData,
  tierFilter,
  userWallet,
  userVolume,
}: {
  initialData: LeaderboardEntry[]
  tierFilter: string
  userWallet?: string
  userVolume?: number | null
}) => {
  const [activeTab, setActiveTab] = useState<VolumeTab>("Volume")
  const [apiData, setApiData] = useState<VolumeLeaderEntry[] | null>(null)
  const [isApiLoading, setIsApiLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Derive Volume and Avg Size entries from already-loaded leaderboard data (all tier only)
  const derivedEntries = useMemo((): VolumeLeaderEntry[] => {
    const mapped = initialData.map((e, i) => ({
      rank: i + 1,
      wallet: e.wallet,
      volume: e.swapVolume24h,
      volumeEth: e.ethValue ?? 0,
      swapCount: e.swapCount ?? 0,
      avgSize: (e.swapCount ?? 0) > 0 ? e.swapVolume24h / (e.swapCount ?? 1) : 0,
    }))
    if (activeTab === "Avg Size") {
      mapped.sort((a, b) => b.avgSize - a.avgSize)
      return mapped.map((e, i) => ({ ...e, rank: i + 1 }))
    }
    return mapped
  }, [initialData, activeTab])

  // Fetch from API when tier is not "all" or tab is "Largest" (needs server-side query)
  useEffect(() => {
    const needsApiFetch = tierFilter !== "all" || activeTab === "Largest"
    if (!needsApiFetch) {
      setApiData(null)
      return
    }
    let cancelled = false
    setIsApiLoading(true)
    const sort = TAB_TO_SORT[activeTab]
    const params = new URLSearchParams({
      sort,
      tier: tierFilter,
      page: "1",
      limit: "15",
    })
    fetch(`/api/analytics/leaderboard/volume-leaders?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setApiData((data?.entries || []) as VolumeLeaderEntry[])
          setIsApiLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setIsApiLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, tierFilter])

  const modalBuildParams = useCallback(
    (p: number, l: number) => ({
      sort: TAB_TO_SORT[activeTab],
      tier: tierFilter,
      page: String(p),
      limit: String(l),
    }),
    [activeTab, tierFilter]
  )

  // Only show Find Me if user's tier matches the filter (or filter is "all")
  const userTier = useMemo(() => getTierFromVolume(userVolume), [userVolume])
  const canFindMe = tierFilter === "all" || userTier === tierFilter
  const modalFindMeParams = useMemo(() => {
    if (!canFindMe) return undefined
    return {
      category: "volume",
      sort: TAB_TO_SORT[activeTab],
      tier: tierFilter,
    }
  }, [activeTab, tierFilter, canFindMe])

  // Use API data when fetched (tier filter or Largest), otherwise use derived from initialData
  const entries = apiData !== null ? apiData : derivedEntries
  const isLoading = isApiLoading
  const leader = entries[0]
  const statLabel = TAB_TO_LABEL[activeTab]

  return (
    <>
      <Card className="group/card relative p-4 md:p-6 bg-white/[0.01] border-white/5 hover:border-white/10 transition-all duration-300 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <TrendingUp size={14} className="text-primary" />
          </div>
          <h3 className="font-bold text-sm">Volume Leaders</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle
                size={14}
                className="hidden sm:block text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-help"
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
              <p>
                <span className="font-bold text-foreground">Volume</span> — Total swap volume
              </p>
              <p>
                <span className="font-bold text-foreground">Avg Size</span> — Average swap size
              </p>
              <p>
                <span className="font-bold text-foreground">Largest</span> — Biggest single swap
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Internal tabs */}
        <div className="flex gap-1 mb-4 border-b border-white/5 pb-2">
          {VOLUME_TABS.map((tab) => (
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

        {isLoading ? (
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
                {(() => {
                  const tm = getTierMetadata(getTierFromVolume(leader.volume))
                  return (
                    <div
                      className={`relative w-16 h-16 rounded-full ${tm.circleBg} flex items-center justify-center mb-4 ring-2 ring-offset-2 ring-offset-background ${tm.color.replace("text-", "ring-")}/20`}
                    >
                      <span className={`text-sm font-black uppercase tracking-widest ${tm.color}`}>
                        #1
                      </span>
                    </div>
                  )
                })()}
                <p className="font-mono text-xs text-center truncate max-w-[110px]">
                  {leader.wallet}
                </p>
                <div className="mt-auto pt-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 text-center">
                    {statLabel}
                  </p>
                  <p className="text-lg font-black tabular-nums text-center">
                    {getStatForTab(leader, activeTab)}
                  </p>
                </div>
              </div>

              {/* Ranked list */}
              <div className="flex-1 space-y-1 max-h-[220px] overflow-y-auto scrollbar-hide">
                {entries.map((entry, idx) => {
                  const entryTm =
                    tierFilter === "all" && idx < 3
                      ? getTierMetadata(getTierFromVolume(entry.volume))
                      : null
                  return (
                    <div
                      key={entry.wallet}
                      className={`flex items-center justify-between py-1.5 px-2 rounded text-sm transition-colors ${
                        idx === 0 ? "bg-primary/[0.05]" : "hover:bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground/40 w-6 text-xs font-mono flex items-center gap-1">
                          {entryTm && (
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full ${entryTm.dot}`}
                            />
                          )}
                          {idx + 1}.
                        </span>
                        <span className="font-mono text-xs truncate max-w-[100px]">
                          {entry.wallet}
                        </span>
                      </div>
                      <span
                        className={`font-mono text-xs font-bold ${
                          idx === 0 ? "bg-primary text-primary-foreground px-2 py-0.5 rounded" : ""
                        }`}
                      >
                        {getStatForTab(entry, activeTab)}
                      </span>
                    </div>
                  )
                })}
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
        title={`Volume Leaders — ${activeTab}`}
        description={`All wallets sorted by ${activeTab.toLowerCase()}`}
        fetchUrl="/api/analytics/leaderboard/volume-leaders"
        buildParams={modalBuildParams}
        renderStat={(e) => getStatForTab(e as unknown as VolumeLeaderEntry, activeTab)}
        renderSubtext={(e) => `${(e as unknown as VolumeLeaderEntry).swapCount ?? 0} swaps`}
        userWallet={userWallet}
        findMeParams={modalFindMeParams}
      />
    </>
  )
}
