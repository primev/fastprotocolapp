import React, { useState, useEffect, useCallback, useMemo } from "react"
import useEmblaCarousel from "embla-carousel-react"
import { ShieldCheck, ChevronLeft, ChevronRight, Loader2, Check, X } from "lucide-react"
import { useAccount, useReadContracts } from "wagmi"
import { erc721Abi, erc20Abi } from "viem"
import { ECOSYSTEM_SETS } from "@/components/dashboard/ecosystem-carousel/criteria"

const CHAIN_ETH = 1
const CHAIN_BSC = 56
const CHAIN_HYPERLIQUID = 999

const CHAIN_NAMES: Record<number, string> = {
  [CHAIN_ETH]: "Ethereum",
  [CHAIN_BSC]: "BSC",
  [CHAIN_HYPERLIQUID]: "Hyperliquid",
}

const CHAIN_LOGOS: Record<number, string> = {
  [CHAIN_ETH]: "/assets/ethereum-logo.png",
  [CHAIN_HYPERLIQUID]: "/assets/hyperliquid-logo.png",
}

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
  const [verifiedSets, setVerifiedSets] = useState<Record<string, boolean>>({})
  const [failedSets, setFailedSets] = useState<Record<string, boolean>>({})
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [manualLoadingId, setManualLoadingId] = useState<string | null>(null)

  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    skipSnaps: false,
  })

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
    const results = blockchainData as { status: string; result?: unknown }[]
    const set = ECOSYSTEM_SETS.find((s) => s.id === manualLoadingId)
    const chainId = set?.contracts[0]?.chainId ?? null

    const hasAssets = results.some((res) => res.status === "success" && Number(res.result) > 0)

    if (hasAssets) {
      setVerifiedSets((prev) => ({ ...prev, [manualLoadingId]: true }))
      setFailedSets((prev) => {
        const next = { ...prev }
        delete next[manualLoadingId]
        return next
      })
      localStorage.setItem(`verified_${manualLoadingId}`, "true")
      markAsVerified(manualLoadingId, chainId)
    } else {
      setFailedSets((prev) => ({ ...prev, [manualLoadingId]: true }))
      setTimeout(() => {
        setFailedSets((prev) => {
          const next = { ...prev }
          delete next[manualLoadingId!]
          return next
        })
      }, 3000)
    }
    setManualLoadingId(null)
  }, [blockchainData, manualLoadingId, markAsVerified])

  const handleVerify = (id: string) => {
    setFailedSets((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setManualLoadingId(id)
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
        .animate-shake { animation: shake 0.3s cubic-bezier(.36,.07,.19,.97) both; }
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
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex ml-[-12px] justify-start">
            {ECOSYSTEM_SETS.map((set) => {
              const isVerified = !!verifiedSets[set.id]
              const isVerifying = manualLoadingId === set.id
              const isFailed = !!failedSets[set.id]
              const activeChainId = set.contracts[0]?.chainId

              return (
                <div
                  key={set.id}
                  className={`flex-[0_0_182px] min-w-0 pl-3 ${isFailed ? "animate-shake" : ""}`}
                >
                  <div
                    className={`bg-[#161d26] border rounded-xl p-5 flex flex-col items-center h-[220px] transition-all duration-500 relative overflow-hidden
                    ${
                      isVerified
                        ? "border-blue-500/30 shadow-lg shadow-blue-500/5"
                        : isFailed
                          ? "border-red-500/40"
                          : "border-white/5"
                    }`}
                  >
                    {isInitialLoading ? (
                      <div className="w-full animate-pulse flex flex-col items-center">
                        <div className="w-14 h-14 bg-white/5 rounded-full mb-4" />
                        <div className="h-3 w-16 bg-white/5 rounded-full mb-6" />
                        <div className="h-8 w-full bg-white/5 rounded-full" />
                      </div>
                    ) : (
                      <>
                        {activeChainId && (
                          <div className="absolute -bottom-4 -right-4 w-32 h-32 pointer-events-none select-none">
                            <img
                              src={CHAIN_LOGOS[activeChainId]}
                              alt=""
                              className="w-full h-full object-contain rotate-[15deg] transition-all duration-1000 ease-out"
                              style={{
                                opacity: "0.08",
                                filter: "grayscale(100%) brightness(150%)",
                                maskImage:
                                  "radial-gradient(circle at center, black, transparent 80%)",
                                WebkitMaskImage:
                                  "radial-gradient(circle at center, black, transparent 80%)",
                              }}
                            />
                          </div>
                        )}

                        <div className="relative mb-5 z-10">
                          {/* Main Asset Circle */}
                          <div
                            className={`w-16 h-16 rounded-full overflow-hidden border border-2 transition-all duration-700 
                            ${
                              isVerified
                                ? "border-blue-500 "
                                : isFailed
                                  ? "border-red-500/50"
                                  : "border-white/10"
                            } bg-black relative`}
                          >
                            <img
                              src={set.img}
                              alt={set.name}
                              style={{
                                filter: isVerified ? "none" : "grayscale(100%) brightness(0.7)",
                                opacity: isVerified ? "1" : "0.4",
                              }}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          {/* Status Badge */}
                          {isVerified && (
                            <div className="absolute bottom-0 -right-0 bg-blue-500 rounded-full p-0.5 border border-[#161d26] shadow-lg">
                              <Check className="w-3 h-3 text-white stroke-[4px]" />
                            </div>
                          )}
                          {isFailed && (
                            <div className="absolute bottom-0 -right-1 bg-red-500 rounded-full p-0.5 border border-[#161d26] shadow-lg">
                              <X className="w-2 h-2 text-white stroke-[4px]" />
                            </div>
                          )}
                        </div>

                        {/* Network Metadata */}
                        {activeChainId && (
                          <span
                            className={`text-[7px] font-black uppercase tracking-[0.2em] mb-1 z-10 transition-colors duration-700 ${isVerified ? "text-blue-400/50" : "text-foreground/20"}`}
                          >
                            {CHAIN_NAMES[activeChainId]}
                          </span>
                        )}

                        <h3 className="text-[10px] font-bold mb-1 text-foreground/90 uppercase tracking-widest text-center leading-tight whitespace-pre-line min-h-[32px] flex items-center justify-center z-10">
                          {set.name}
                        </h3>

                        <button
                          onClick={() => handleVerify(set.id)}
                          disabled={
                            set.comingSoon ? true : !isConnected || isVerified || isVerifying
                          }
                          className={`mt-auto w-full py-2 rounded-full text-[9px] font-bold uppercase border tracking-widest transition-all ${
                            set.comingSoon
                              ? "border-blue-900/50 text-[#4da1ff] bg-blue-900/20 cursor-not-allowed opacity-60"
                              : !isConnected || isVerifying
                                ? "border-blue-900/50 text-[#4da1ff] bg-blue-900/20 cursor-not-allowed opacity-60"
                                : isVerified
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
                          ) : isVerified ? (
                            "Verified"
                          ) : isFailed ? (
                            "Not Found"
                          ) : (
                            "Verify"
                          )}
                        </button>
                      </>
                    )}
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
    </div>
  )
}
