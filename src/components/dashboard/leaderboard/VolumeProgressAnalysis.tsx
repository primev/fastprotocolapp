"use client"

// Volume-mode progress tracker + performance analysis grid. Rendered
// beneath the header when the user is viewing the volume leaderboard;
// split from LeaderboardTable so copy/tier tweaks stay self-contained.

import { Card } from "@/components/ui/card"
import { Target, TrendingUp } from "lucide-react"
import { TIER_THRESHOLDS, type TierMetadata } from "@/lib/config/constants"

export interface VolumeProgressAnalysisProps {
  userAddr: string | undefined
  adjustedUserPos: number | null
  adjustedUserVol: number | null
  adjustedNextRankVol: number | null
  currentTier: string
  currentTierMeta: TierMetadata
  nextTierName: string
  nextTierMeta: TierMetadata
  nextTierVal: number
  progress: number
  tierBackgroundClass: string
  formatVolumeShort: (v: number) => string
  formatVolDiffDisplay: (v: number) => string
}

export const VolumeProgressAnalysis = ({
  userAddr,
  adjustedUserPos,
  adjustedUserVol,
  adjustedNextRankVol,
  currentTier,
  currentTierMeta,
  nextTierName,
  nextTierMeta,
  nextTierVal,
  progress,
  tierBackgroundClass,
  formatVolumeShort,
  formatVolDiffDisplay,
}: VolumeProgressAnalysisProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-stretch">
      {/* Progress Tracker Card */}
      <Card className="p-3 sm:p-4 bg-white/[0.01] border-white/5 flex flex-col justify-center space-y-2 sm:space-y-3 min-w-0 w-full h-full">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground/40 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Target size={10} className="sm:w-3 sm:h-3 shrink-0" />{" "}
            <span className="whitespace-nowrap">Progress Tracker</span>
          </div>
          <span className="text-primary font-mono text-[10px] sm:text-xs whitespace-nowrap shrink-0">
            {nextTierName.toLowerCase() !== currentTier
              ? `${currentTier === "standard" ? "Standard" : currentTierMeta.label} → ${nextTierMeta.label} (${formatVolumeShort(nextTierVal)})`
              : "Max Tier Reached"}
          </span>
        </div>
        <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-primary transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* Major tier labels */}
        <div className="flex justify-between gap-1 sm:gap-2 min-w-0">
          {[
            { n: "Bronze", v: TIER_THRESHOLDS.BRONZE, c: "text-amber-600" },
            { n: "Silver", v: TIER_THRESHOLDS.SILVER, c: "text-slate-400" },
            { n: "Gold", v: TIER_THRESHOLDS.GOLD, c: "text-yellow-500" },
          ].map((t) => (
            <div key={t.n} className="flex flex-col min-w-0">
              <span className={`text-sm sm:text-base font-black ${t.c} whitespace-nowrap`}>
                {t.n}
              </span>
              <span className="text-[10px] sm:text-xs font-mono font-bold opacity-60 whitespace-nowrap truncate">
                {formatVolumeShort(t.v)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Performance Analysis Card */}
      <Card className="overflow-hidden border-white/5 bg-white/[0.01] transition-all duration-300 hover:border-primary/20 shadow-2xl h-full flex">
        <div className="flex flex-col sm:flex-row items-stretch w-full h-full">
          {/* Analysis Content */}
          <div className="sm:w-2/3 p-4 sm:p-5 flex flex-col justify-center bg-primary/[0.01]">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-2.5">
                <TrendingUp size={15} className="text-primary/40" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/60">
                  Performance Analysis
                </h4>
              </div>

              <p className="text-sm sm:text-base font-bold leading-snug tracking-tight text-foreground/90">
                {!userAddr ? (
                  <span className="text-[10px] sm:text-sm text-muted-foreground/40 font-black uppercase tracking-widest italic">
                    Connect wallet to unlock rank
                  </span>
                ) : adjustedUserPos ? (
                  adjustedUserPos === 1 ? (
                    <>
                      <span className="text-primary font-black">Congratulations!</span> You're in{" "}
                      <span className="italic font-bold text-primary">#1</span> position.
                      <span className="block mt-1 text-[10px] sm:text-[11px] font-bold text-primary/80 uppercase tracking-widest">
                        Hold that lead
                      </span>
                    </>
                  ) : (
                    <>
                      {(() => {
                        const diff = (adjustedNextRankVol ?? 0) - (adjustedUserVol ?? 0)
                        if (adjustedNextRankVol && adjustedUserVol && diff > 0) {
                          return (
                            <>
                              Surpass{" "}
                              <span className="italic font-bold">#{adjustedUserPos - 1}</span> with{" "}
                              <span className="text-primary font-black decoration-primary/20 tabular-nums">
                                {formatVolDiffDisplay(diff)}
                              </span>
                            </>
                          )
                        }
                        return (
                          <>
                            You're closing in on{" "}
                            <span className="italic font-bold text-primary">
                              #{adjustedUserPos - 1}
                            </span>
                            {" — keep trading!"}
                          </>
                        )
                      })()}
                      {currentTier !== "gold" && (
                        <span className="block mt-1 text-[10px] sm:text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                          Reach <span className={nextTierMeta.color}>{nextTierName}</span> in{" "}
                          {adjustedUserVol
                            ? formatVolDiffDisplay(nextTierVal - adjustedUserVol)
                            : "--"}
                        </span>
                      )}
                    </>
                  )
                ) : (
                  <span className="text-[10px] sm:text-sm text-muted-foreground/30 font-black uppercase tracking-widest italic">
                    Network sync in progress...
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Tier Display */}
          <div
            className={`sm:w-1/3 p-4 flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-white/5 ${tierBackgroundClass}`}
          >
            <div className="flex flex-col justify-center items-center">
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 mb-1.5">
                Current Tier
              </span>
              <div className="flex items-center gap-2.5">
                <span
                  className={`text-sm sm:text-base font-black uppercase tracking-widest sm:order-1 ${currentTierMeta.color}`}
                >
                  {currentTier === "standard" ? "Standard" : currentTierMeta.label}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
