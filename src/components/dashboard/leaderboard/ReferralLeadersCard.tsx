"use client"

// Referral Leaders dashboard card (Total Refs / Miles tabs, Miles tab
// hidden behind the show_miles_estimate flag). Extracted so the
// prefetched Fuul data flow can be reviewed without scrolling past the
// volume leaderboard code.

import { useCallback, useState } from "react"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { BarChart3, HelpCircle, Users } from "lucide-react"
import { FEATURE_FLAGS } from "@/lib/config/feature-flags"
import { PaginatedLeaderboardModal } from "./PaginatedLeaderboardModal"

// Referral Leaders types and component
export interface ReferralLeaderEntry {
  rank: number
  wallet: string
  points: number
  referrals: number
}

const ALL_REFERRAL_TABS = ["Total Refs", "Miles"] as const
type ReferralTab = (typeof ALL_REFERRAL_TABS)[number]
const REFERRAL_TABS: readonly ReferralTab[] = FEATURE_FLAGS.show_miles_estimate
  ? ALL_REFERRAL_TABS
  : ["Total Refs"]

const REFERRAL_TAB_TO_LABEL: Record<ReferralTab, string> = {
  "Total Refs": "REFERRALS",
  Miles: "MILES",
}

function getReferralStat(entry: ReferralLeaderEntry, tab: ReferralTab): string {
  switch (tab) {
    case "Total Refs":
      return entry.referrals.toLocaleString()
    case "Miles":
      return entry.points.toLocaleString()
  }
}

function getReferralSubtext(entry: ReferralLeaderEntry, tab: ReferralTab): string {
  switch (tab) {
    case "Total Refs":
      return `${entry.points.toLocaleString()} miles`
    case "Miles":
      return `${entry.referrals} refs`
  }
}

export const ReferralLeadersCard = ({
  prefetchedData,
  userWallet,
}: {
  prefetchedData: { byPoints: ReferralLeaderEntry[]; byRefs: ReferralLeaderEntry[] } | null
  userWallet?: string
}) => {
  const [activeTab, setActiveTab] = useState<ReferralTab>("Total Refs")
  const [modalOpen, setModalOpen] = useState(false)

  const byPoints = prefetchedData?.byPoints ?? []
  const byRefs = prefetchedData?.byRefs ?? []
  const isLoading = !prefetchedData

  const modalBuildParams = useCallback(
    (p: number, l: number) => ({
      sort: activeTab === "Total Refs" ? "refs" : "miles",
      page: String(p),
      limit: String(l),
    }),
    [activeTab]
  )

  const entries = activeTab === "Total Refs" ? byRefs : byPoints

  const leader = entries[0]
  const statLabel = REFERRAL_TAB_TO_LABEL[activeTab]
  const showLoading = isLoading && entries.length === 0

  return (
    <>
      <Card className="group/card relative p-4 md:p-6 bg-white/[0.01] border-white/5 hover:border-white/10 transition-all duration-300 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Users size={14} className="text-primary" />
          </div>
          <h3 className="font-bold text-sm">Referral Leaders</h3>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle
                size={14}
                className="hidden sm:block text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors cursor-help"
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs leading-relaxed">
              <p>
                <span className="font-bold text-foreground">Total Refs</span> — Most referrals made
              </p>
              {FEATURE_FLAGS.show_miles_estimate && (
                <p>
                  <span className="font-bold text-foreground">Miles</span> — Most miles earned from
                  referrals
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Internal tabs */}
        <div className="flex gap-1 mb-4 border-b border-white/5 pb-2">
          {REFERRAL_TABS.map((tab) => (
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
                  <p className="text-lg font-black tabular-nums text-center">
                    {getReferralStat(leader, activeTab)}
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
                      className={`font-mono text-xs font-bold ${
                        idx === 0 ? "bg-primary text-primary-foreground px-2 py-0.5 rounded" : ""
                      }`}
                    >
                      {getReferralStat(entry, activeTab)}
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
        title={`Referral Leaders — ${activeTab}`}
        description={`All wallets sorted by ${activeTab.toLowerCase()}`}
        fetchUrl="/api/fuul/leaderboard"
        buildParams={modalBuildParams}
        renderStat={(e) => getReferralStat(e as unknown as ReferralLeaderEntry, activeTab)}
        renderSubtext={(e) => getReferralSubtext(e as unknown as ReferralLeaderEntry, activeTab)}
        userWallet={userWallet}
      />
    </>
  )
}
