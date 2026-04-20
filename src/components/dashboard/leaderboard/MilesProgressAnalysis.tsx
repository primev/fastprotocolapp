"use client"

// Miles-mode progress tracker + performance analysis grid. Mirrors the
// volume variant but sourced from Fuul miles totals; split out so the
// copy and milestone markers can be iterated without touching volume UI.

import { Card } from "@/components/ui/card"
import { Target, Zap } from "lucide-react"
import { FEATURE_FLAGS } from "@/lib/config/feature-flags"
import type { FuulMilesEntry } from "@/hooks/use-fuul-miles-leaderboard"

export interface MilesProgressAnalysisProps {
  userAddr: string | undefined
  userMilesEntry: FuulMilesEntry | null
  nextMilesRankEntry: FuulMilesEntry | null
}

export const MilesProgressAnalysis = ({
  userAddr,
  userMilesEntry,
  nextMilesRankEntry,
}: MilesProgressAnalysisProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-stretch">
      {/* Miles Progress Tracker */}
      <Card className="p-3 sm:p-4 bg-white/[0.01] border-white/5 flex flex-col justify-center space-y-2 sm:space-y-3 min-w-0 w-full h-full">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest text-muted-foreground/40 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Target size={10} className="sm:w-3 sm:h-3 shrink-0" />{" "}
            <span className="whitespace-nowrap">Miles Progress</span>
          </div>
          <span className="text-primary font-mono text-[10px] sm:text-xs whitespace-nowrap shrink-0">
            {(userMilesEntry?.points ?? 0).toLocaleString()} / 1,000 Miles
          </span>
        </div>
        <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <div
            className="absolute h-full bg-primary transition-all duration-1000"
            style={{ width: `${Math.min(((userMilesEntry?.points ?? 0) / 1000) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between gap-1 sm:gap-2 min-w-0">
          {[
            { n: "250", v: 250 },
            { n: "500", v: 500 },
            { n: "1,000", v: 1000 },
          ].map((m) => (
            <div key={m.n} className="flex flex-col min-w-0">
              <span className="text-sm sm:text-base font-black text-primary/70 whitespace-nowrap">
                {m.n}
              </span>
              <span className="text-[10px] sm:text-xs font-mono font-bold opacity-60 whitespace-nowrap truncate">
                miles
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Miles Performance Analysis */}
      <Card className="overflow-hidden border-white/5 bg-white/[0.01] transition-all duration-300 hover:border-primary/20 shadow-2xl h-full flex">
        <div className="flex items-stretch w-full h-full">
          <div className="w-full p-4 sm:p-5 flex flex-col justify-center bg-primary/[0.01]">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center gap-2.5">
                <Zap size={15} className="text-primary/40" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/60">
                  Miles Analysis
                </h4>
              </div>

              <p className="text-sm sm:text-base font-bold leading-snug tracking-tight text-foreground/90">
                {!userAddr ? (
                  <span className="text-[10px] sm:text-sm text-muted-foreground/40 font-black uppercase tracking-widest italic">
                    Connect wallet to track miles
                  </span>
                ) : userMilesEntry ? (
                  userMilesEntry.rank === 1 ? (
                    <>
                      <span className="text-primary font-black">Congratulations!</span> You're the{" "}
                      <span className="italic font-bold text-primary">#1</span> miles leader.
                      <span className="block mt-1 text-[10px] sm:text-[11px] font-bold text-primary/80 uppercase tracking-widest">
                        Hold that lead
                      </span>
                    </>
                  ) : (
                    <>
                      {(() => {
                        const diff =
                          (nextMilesRankEntry?.points ?? 0) - (userMilesEntry?.points ?? 0)
                        if (nextMilesRankEntry && diff > 0) {
                          return (
                            <>
                              Surpass{" "}
                              <span className="italic font-bold">#{userMilesEntry.rank - 1}</span>{" "}
                              with{" "}
                              <span className="text-primary font-black tabular-nums">
                                {diff.toLocaleString()} miles
                              </span>
                            </>
                          )
                        }
                        return (
                          <>
                            You're closing in on{" "}
                            <span className="italic font-bold text-primary">
                              #{userMilesEntry.rank - 1}
                            </span>
                            {" — keep earning!"}
                          </>
                        )
                      })()}
                      {FEATURE_FLAGS.show_referral_counts && (
                        <span className="block mt-1 text-[10px] sm:text-[11px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                          {userMilesEntry.referrals} referral
                          {userMilesEntry.referrals !== 1 ? "s" : ""} earned
                        </span>
                      )}
                    </>
                  )
                ) : (
                  <span className="text-[10px] sm:text-sm text-muted-foreground/30 font-black uppercase tracking-widest italic">
                    Earn miles by performing swaps
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
