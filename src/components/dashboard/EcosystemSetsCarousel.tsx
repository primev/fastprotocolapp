import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { flushSync } from "react-dom"
import useEmblaCarousel from "embla-carousel-react"
import {
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  X,
  HelpCircle,
  ExternalLink,
  Trophy,
} from "lucide-react"
import { useAccount, useReadContracts } from "wagmi"
import { erc721Abi, erc20Abi } from "viem"
import { ECOSYSTEM_SETS } from "@/components/dashboard/ecosystem-carousel/criteria"
import { hasEverHeldHype } from "@/app/api/hyperliquid/hype-balance"
import { hasActivity } from "@/app/api/hyperliquid/hype-activity"
import { useGenesisSBT } from "@/hooks/use-genesis-sbt"
import { SBTGatingModal } from "@/components/modals/SBTGatingModal"

const CHAIN_ETH = 1
const CHAIN_BSC = 56
const CHAIN_HYPERLIQUID = 999

const CHAIN_NAMES: Record<number, string> = {
  [CHAIN_ETH]: "Ethereum",
  [CHAIN_BSC]: "BSC",
  [CHAIN_HYPERLIQUID]: "Hyperliquid",
}

const CARD_HEIGHT_PX = 240

const fetchUserActivity = async (walletAddress: string): Promise<Record<string, boolean>> => {
  const res = await fetch(`/api/user-community-activity/${walletAddress}`)
  if (!res.ok) return {}
  const data = await res.json()
  return data.activities ?? {}
}

const saveUserActivity = async (
  walletAddress: string,
  entity: string,
  activity: boolean,
  chainId: number | null
) => {
  const res = await fetch(`/api/user-community-activity/${walletAddress}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity, activity, chainId }),
  })
  if (!res.ok) throw new Error("Failed to save activity")
}

export const EcosystemSetCarousel = () => {
  const { address: userAddress, isConnected } = useAccount()
  const genesisSBT = useGenesisSBT(isConnected, userAddress ?? undefined)
  const [verifiedSets, setVerifiedSets] = useState<Record<string, boolean>>({})
  const [failedSets, setFailedSets] = useState<Record<string, boolean>>({})
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [manualLoadingId, setManualLoadingId] = useState<string | null>(null)
  const [showSBTGatingModal, setShowSBTGatingModal] = useState(false)

  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({})

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    skipSnaps: false,
  })
  const emblaApiRef = useRef(emblaApi)
  emblaApiRef.current = emblaApi

  const applyVerificationResult = useCallback(
    (updates: {
      verified?: string | null
      failed?: string | null
      clearManualLoading: boolean
    }) => {
      const scrollIndex = emblaApiRef.current?.selectedScrollSnap() ?? null
      queueMicrotask(() => {
        flushSync(() => {
          if (updates.verified) {
            setVerifiedSets((prev) => ({ ...prev, [updates.verified!]: true }))
            setFailedSets((prev) => {
              const next = { ...prev }
              delete next[updates.verified!]
              return next
            })
          }
          if (updates.failed) {
            setFailedSets((prev) => ({ ...prev, [updates.failed!]: true }))
          }
          if (updates.clearManualLoading) {
            setManualLoadingId(null)
          }
        })
        if (scrollIndex !== null && emblaApiRef.current) {
          emblaApiRef.current.scrollTo(scrollIndex, true)
        }
      })
    },
    []
  )

  const markAsVerified = useCallback(
    (id: string, chainId: number | null) => {
      if (!userAddress) return
      saveUserActivity(userAddress, id, true, chainId).catch((err) => {
        console.error("Save activity failed:", err)
      })
    },
    [userAddress]
  )

  const contracts = useMemo(() => {
    if (!userAddress || !manualLoadingId) return []
    const set = ECOSYSTEM_SETS.find((s) => s.id === manualLoadingId)
    if (!set) return []
    return set.contracts.map((c) => ({
      address: c.address,
      abi: c.kind === "erc20" ? erc20Abi : erc721Abi,
      functionName: "balanceOf",
      args: [userAddress],
      chainId: c.chainId,
    }))
  }, [userAddress, manualLoadingId])

  const { data: blockchainData } = useReadContracts({
    contracts,
    query: { enabled: isConnected && !!userAddress && !!manualLoadingId },
  })

  useEffect(() => {
    const cached: Record<string, boolean> = {}
    ECOSYSTEM_SETS.forEach((s) => {
      if (localStorage.getItem(`verified_${s.id}`) === "true") cached[s.id] = true
    })
    setVerifiedSets(cached)

    const timer = setTimeout(() => setIsInitialLoading(false), 1200)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!isConnected || !userAddress) {
      setVerifiedSets({})
      setFailedSets({})
      setManualLoadingId(null)
      return
    }
    fetchUserActivity(userAddress)
      .then((activities) => {
        const fromApi: Record<string, boolean> = {}
        Object.entries(activities).forEach(([entity, active]) => {
          if (active) fromApi[entity] = true
        })
        if (Object.keys(fromApi).length > 0) {
          setVerifiedSets((prev) => ({ ...prev, ...fromApi }))
          Object.keys(fromApi).forEach((id) => localStorage.setItem(`verified_${id}`, "true"))
        }
      })
      .catch((e) => console.error("Fetch user activity failed:", e))
  }, [isConnected, userAddress])

  useEffect(() => {
    if (!blockchainData || !manualLoadingId) return
    const set = ECOSYSTEM_SETS.find((s) => s.id === manualLoadingId)
    if (!set || set.contracts.length === 0) return

    const results = blockchainData as { status: string; result?: unknown }[]
    const chainId = set.contracts[0]?.chainId ?? null

    const hasAssets = results.some((res) => res.status === "success" && Number(res.result) > 0)

    if (hasAssets) {
      applyVerificationResult({ verified: manualLoadingId, clearManualLoading: true })
      localStorage.setItem(`verified_${manualLoadingId}`, "true")
      markAsVerified(manualLoadingId, chainId)
    } else {
      applyVerificationResult({ failed: manualLoadingId, clearManualLoading: true })
      setTimeout(() => {
        setFailedSets((prev) => {
          const next = { ...prev }
          delete next[manualLoadingId!]
          return next
        })
      }, 3000)
    }
  }, [blockchainData, manualLoadingId, markAsVerified, applyVerificationResult])

  useEffect(() => {
    if (!manualLoadingId || !userAddress || !isConnected) return
    const set = ECOSYSTEM_SETS.find((s) => s.id === manualLoadingId)
    if (!set || set.contracts.length > 0 || !set.customCriteria?.length) return

    const chainId = CHAIN_HYPERLIQUID

    if (set.customCriteria.includes("hype_holder")) {
      hasEverHeldHype(userAddress).then((verified) => {
        if (verified) {
          applyVerificationResult({ verified: manualLoadingId, clearManualLoading: true })
          localStorage.setItem(`verified_${manualLoadingId}`, "true")
          markAsVerified(manualLoadingId, chainId)
        } else {
          applyVerificationResult({ failed: manualLoadingId, clearManualLoading: true })
          setTimeout(() => {
            setFailedSets((prev) => {
              const next = { ...prev }
              delete next[manualLoadingId!]
              return next
            })
          }, 3000)
        }
      })
      return
    }

    if (set.customCriteria.includes("active_depositor_trader")) {
      hasActivity(userAddress).then((active) => {
        if (active) {
          applyVerificationResult({ verified: manualLoadingId, clearManualLoading: true })
          localStorage.setItem(`verified_${manualLoadingId}`, "true")
          markAsVerified(manualLoadingId, chainId)
        } else {
          applyVerificationResult({ failed: manualLoadingId, clearManualLoading: true })
          setTimeout(() => {
            setFailedSets((prev) => {
              const next = { ...prev }
              delete next[manualLoadingId!]
              return next
            })
          }, 3000)
        }
      })
    }
  }, [manualLoadingId, userAddress, isConnected, markAsVerified, applyVerificationResult])

  const handleVerify = (id: string) => {
    if (isConnected && !genesisSBT.hasGenesisSBT) {
      setShowSBTGatingModal(true)
      return
    }
    setFailedSets((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setManualLoadingId(id)
  }

  const toggleFlipped = (id: string) => {
    setFlippedCards((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  useEffect(() => {
    if (!emblaApi) return
    const updateScrollState = () => {
      setCanScrollPrev(emblaApi.canScrollPrev())
      setCanScrollNext(emblaApi.canScrollNext())
    }
    emblaApi.on("select", updateScrollState)
    emblaApi.on("reInit", updateScrollState)
    updateScrollState()
    return () => {
      emblaApi.off("select", updateScrollState)
      emblaApi.off("reInit", updateScrollState)
    }
  }, [emblaApi])

  return (
    <div className="bg-card/50 p-6 rounded-xl border border-border/50 text-foreground max-w-5xl mx-auto shadow-2xl font-sans relative">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        @keyframes shine-pulse {
          0% { box-shadow: 0 0 0 0 rgba(77, 161, 255, 0.2); }
          70% { box-shadow: 0 0 0 10px rgba(77, 161, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(77, 161, 255, 0); }
        }
        .animate-shake { animation: shake 0.3s cubic-bezier(.36,.07,.19,.97) both; }
        .animate-shine-pulse { animation: shine-pulse 2s infinite; }
      `,
        }}
      />

      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-blue-500 w-6 h-6 hidden sm:flex" />
          <h3 className="text-xl font-semibold">Verify Assets</h3>
        </div>

        <div className="bg-[#1a232e] text-[#4da1ff] text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-blue-900/30 uppercase tracking-wider">
          {isInitialLoading
            ? "-- / --"
            : `${Object.keys(verifiedSets).length}/${ECOSYSTEM_SETS.length}`}{" "}
          Verified
        </div>
      </div>

      <p className="text-foreground/70 mb-6 text-sm">
        Unlock exclusive badges by verifying your activity.
      </p>

      <div className="relative group">
        <div className="overflow-hidden" ref={emblaRef} style={{ height: CARD_HEIGHT_PX }}>
          <div className="flex ml-[-12px] justify-start">
            {ECOSYSTEM_SETS.map((set) => {
              const isVerified = !!verifiedSets[set.id]
              const isVerifying = manualLoadingId === set.id
              const isFailed = !!failedSets[set.id]
              const activeChainId = set.chainId ?? set.contracts[0]?.chainId

              return (
                <div
                  key={set.id}
                  className={`flex-[0_0_182px] min-w-0 pl-3 shrink-0 ${isFailed ? "animate-shake" : ""}`}
                  style={{ contain: "layout" }}
                >
                  <div
                    className="overflow-hidden rounded-xl"
                    style={{ height: CARD_HEIGHT_PX, perspective: "1000px" }}
                  >
                    <div
                      className="relative w-full h-full transition-transform duration-500 ease-in-out"
                      style={{
                        transformStyle: "preserve-3d",
                        transform: flippedCards[set.id] ? "rotateY(180deg)" : "rotateY(0deg)",
                      }}
                    >
                      {/* Front face */}
                      <div
                        className={`absolute inset-0 transition-all duration-700 bg-[#161d26] border rounded-xl p-5 flex flex-col items-center overflow-hidden
                          ${
                            isVerified
                              ? "border-blue-500/40 shadow-[0_0_20px_rgba(77,161,255,0.15)] bg-gradient-to-b from-[#1c2632] to-[#161d26]"
                              : isFailed
                                ? "border-red-500/40"
                                : "border-white/5"
                          }`}
                        style={{
                          backfaceVisibility: "hidden",
                          WebkitBackfaceVisibility: "hidden",
                          transform: "rotateY(0deg)",
                        }}
                      >
                        {!isInitialLoading && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleFlipped(set.id)
                            }}
                            className="absolute top-2.5 right-2.5 z-20 p-1 rounded-full text-foreground/30 hover:text-foreground/80 hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {isInitialLoading ? (
                          <div className="w-full animate-pulse flex flex-col items-center mt-2">
                            <div className="w-14 h-14 bg-white/5 rounded-full mb-4" />
                            <div className="h-3 w-16 bg-white/5 rounded-full mb-6" />
                            <div className="h-8 w-full bg-white/5 rounded-full" />
                          </div>
                        ) : (
                          <>
                            <div className="relative mt-2 mb-2 z-10">
                              {/* Verification Glow */}
                              {isVerified && (
                                <div className="absolute -inset-4 bg-blue-500/10 rounded-full blur-2xl animate-pulse" />
                              )}

                              <div
                                className={`w-16 h-16 rounded-full overflow-hidden border-2 transition-all duration-700 
          ${
            isVerified
              ? "border-blue-400 shadow-[0_0_15px_rgba(77,161,255,0.4)]"
              : isFailed
                ? "border-red-500/50"
                : "border-white/10"
          } bg-black relative`}
                              >
                                <img
                                  src={set.img}
                                  alt={set.name}
                                  className={`w-full h-full object-cover transition-all duration-700 ${
                                    isVerified
                                      ? "scale-100 grayscale-0"
                                      : "scale-110 grayscale brightness-50 opacity-40"
                                  }`}
                                />
                              </div>

                              {isVerified && (
                                <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-0.5 border border-[#161d26] shadow-lg">
                                  <Check className="w-2.5 h-2.5 text-white stroke-[4px]" />
                                </div>
                              )}
                            </div>

                            {/* Chain Name - Clean & Minimal */}
                            <div className=" z-10">
                              {activeChainId && (
                                <span
                                  className={`text-[7px] font-black uppercase tracking-[0.2em] transition-colors duration-700 ${
                                    isVerified ? "text-blue-400/70" : "text-foreground/20"
                                  }`}
                                >
                                  {CHAIN_NAMES[activeChainId]}
                                </span>
                              )}
                            </div>

                            <h3
                              className={`text-[10px] font-bold mb-5 uppercase tracking-widest text-center leading-tight whitespace-pre-line min-h-[32px] flex items-center justify-center z-10 transition-all ${
                                isVerified ? "text-white" : "text-foreground/60"
                              }`}
                            >
                              {set.name}
                            </h3>

                            {/* Bottom section: fixed min-height to prevent layout shift and carousel scroll jump */}
                            <div className="mt-auto min-h-[44px] w-full flex flex-col justify-end">
                              {isVerified ? (
                                <div className="flex flex-col items-center gap-2 pb-2 animate-[fadeIn_0.5s_ease-out]">
                                  <div className="h-[1px] w-6 bg-blue-500/20" />
                                  <div className="flex items-center">
                                    <span className="text-[7px] font-black text-blue-400/90 tracking-[0.3em] uppercase">
                                      Authenticated
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleVerify(set.id)}
                                  disabled={set.comingSoon || !isConnected || isVerifying}
                                  className={`w-full py-2 rounded-full text-[9px] font-bold uppercase border tracking-widest transition-all ${
                                    set.comingSoon
                                      ? "border-blue-900/50 text-[#4da1ff] bg-blue-900/20 cursor-not-allowed opacity-60"
                                      : !isConnected || isVerifying
                                        ? "border-blue-900/50 text-[#4da1ff] bg-blue-900/20 cursor-not-allowed opacity-60"
                                        : isFailed
                                          ? "border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20"
                                          : "border-[#4da1ff] text-[#4da1ff] hover:bg-[#4da1ff]/10 active:scale-95 cursor-pointer"
                                  }`}
                                >
                                  {set.comingSoon ? (
                                    "Coming"
                                  ) : isVerifying ? (
                                    <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                                  ) : isFailed ? (
                                    "Not Found"
                                  ) : (
                                    "Verify"
                                  )}
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Back face */}
                      <div
                        className="absolute inset-0 bg-[#161d26] border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center text-center"
                        style={{
                          backfaceVisibility: "hidden",
                          WebkitBackfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFlipped(set.id)
                          }}
                          className="absolute top-2 right-2 p-1 rounded-full text-foreground/50 hover:text-foreground/80 hover:bg-white/5 transition-colors cursor-pointer"
                          aria-label="Back to card"
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                        <p className="text-[10px] text-foreground/90 leading-snug mb-2 px-1">
                          {set.criteriaStatement}
                        </p>
                        {set.criteriaLinks && set.criteriaLinks.length > 0 ? (
                          <div className="flex flex-col gap-1 w-full">
                            {set.criteriaLinks.map((item, i) => (
                              <a
                                key={`${item.label}-${i}`}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex w-full items-center justify-between text-[9px] font-bold text-[#4da1ff] hover:underline"
                              >
                                <span className="flex-shrink-0 text-left">{item.label}</span>
                                <ExternalLink className="w-3 h-3 shrink-0 flex-shrink-0" />
                              </a>
                            ))}
                          </div>
                        ) : set.criteriaLink ? (
                          <a
                            href={set.criteriaLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[9px] font-bold text-[#4da1ff] hover:underline"
                          >
                            Learn more
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {canScrollPrev && (
          <button
            onClick={() => emblaApi?.scrollPrev()}
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 p-2 bg-[#161d26]/90 border border-white/5 rounded-full text-white/50 hover:text-white transition-all cursor-pointer backdrop-blur-md"
          >
            <ChevronLeft size={14} />
          </button>
        )}

        {canScrollNext && (
          <button
            onClick={() => emblaApi?.scrollNext()}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 p-2 bg-[#161d26]/90 border border-white/5 rounded-full text-white/50 hover:text-white transition-all cursor-pointer backdrop-blur-md"
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      <SBTGatingModal open={showSBTGatingModal} onOpenChange={setShowSBTGatingModal} />
    </div>
  )
}
