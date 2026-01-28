import React, { useState, useEffect, useCallback, useMemo } from "react"
import useEmblaCarousel from "embla-carousel-react"
import { ShieldCheck, ChevronLeft, ChevronRight, Loader2, Check, X } from "lucide-react"
import { useAccount, useReadContracts } from "wagmi"
import { erc721Abi } from "viem"

const ASSETS_URL = process.env.NEXT_PUBLIC_R2_BASE_URL

const AZUKI_IMG = `${ASSETS_URL}/nfts/azuki.jpg`
const DOODLES_IMG = `${ASSETS_URL}/nfts/doodles.jpg`
const MOONBIRDS_IMG = `${ASSETS_URL}/nfts/moonbirds.jpg`
const PUDGY_PENGUINS_IMG = `${ASSETS_URL}/nfts/pudgy-penguins.jpg`
const YUGA_LABS_IMG = `${ASSETS_URL}/nfts/yuga-labs.jpg`

const ECOSYSTEM_SETS = [
  {
    id: "pudgy",
    name: "Pudgy\nPenguins",
    img: PUDGY_PENGUINS_IMG,
    addresses: [
      "0xbd3531da5cf5857e7cfaa92426877b022e612cf8", // Pudgy Penguins
      "0x524cab2ec69124574082676e6f654a18df49a048", // Lil Pudgys
      "0x062e691c2054de82f28008a8ccc6d7a1c8ce060d", // Pudgy Rods
    ] as const,
  },
  {
    id: "moonbirds",
    name: "Moonbirds",
    img: MOONBIRDS_IMG,
    addresses: [
      "0x23581767a106ae21c074b2276d25e5c3e136a68b", // Moonbirds
      "0x1792a96e5668ad7c167ab804a100ce42395ce54d", // Moonbirds Oddities
      "0xc0ffee8ff7e5497c2d6f7684859709225fcc5be8", // Moonbirds Mythics
    ] as const,
  },
  {
    id: "azuki",
    name: "Azuki",
    img: AZUKI_IMG,
    addresses: [
      "0xed5af388653567af2f388e6224dc7c4b3241c544", // Azuki
      "0x306b1ea3ecdf94ab739f1910bbda052ed4a9f949", // BEANZ
      "0xb6a37b5d14split502c3ab0ae6f3a0e058bc9517786e", // Azuki Elementals
    ] as const,
  },
  {
    id: "yuga",
    name: "Yuga Labs",
    img: YUGA_LABS_IMG,
    addresses: [
      "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d", // BAYC
      "0x60e4d786628fea6478f785a6d7e704777c86a7c6", // MAYC
      "0xba30e5f9bb24caa003e9f2f0497ad287fdf95623", // BAKC
      "0x34d85c9cdeb23fa97cb08333b511ac86e1c4e258", // Otherdeed
      "0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb", // CryptoPunks
      "0x7bd29408f11d2bfc23c34f18275bbf23bb716bc7", // Meebits
    ] as const,
  },
  {
    id: "doodles",
    name: "Doodles",
    img: DOODLES_IMG,
    addresses: [
      "0x8a90cab2b38dba80c64b7734e58ee1db38b8992e", // Doodles
      "0x89afdbf071050a67cfdc28b2ccb4277eef598f37", // Space Doodles
      "0x466cfcd0525189b573e794f554b8a751279213ac", // The Dooplicator
    ] as const,
  },
]

const fetchUserActivity = async (walletAddress: string): Promise<Record<string, boolean>> => {
  const res = await fetch(`/api/user-community-activity/${walletAddress}`)
  if (!res.ok) return {}
  const data = await res.json()
  return data.activities ?? {}
}

const saveUserActivity = async (walletAddress: string, entity: string, activity: boolean) => {
  const res = await fetch(`/api/user-community-activity/${walletAddress}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity, activity }),
  })
  if (!res.ok) throw new Error("Failed to save activity")
}

export const EcosystemSetCarousel = () => {
  const { address: userAddress, isConnected } = useAccount()
  const [verifiedSets, setVerifiedSets] = useState<Record<string, boolean>>({})
  const [failedSets, setFailedSets] = useState<Record<string, boolean>>({})
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [manualLoadingId, setManualLoadingId] = useState<string | null>(null)

  // VERBOSE: Initializing arrow state. In loop mode, these will mostly stay true
  // unless the content is too small to scroll.
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    skipSnaps: false,
  })

  const markAsVerified = useCallback(
    (id: string) => {
      if (!userAddress) return
      saveUserActivity(userAddress, id, true).catch(() => {
        // Verbose: error handling
      })
    },
    [userAddress]
  )

  const contracts = useMemo(() => {
    if (!userAddress || !manualLoadingId) return []
    const set = ECOSYSTEM_SETS.find((s) => s.id === manualLoadingId)
    if (!set) return []
    return set.addresses.map((addr) => ({
      address: addr,
      abi: erc721Abi,
      functionName: "balanceOf",
      args: [userAddress],
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
    if (!isConnected || !userAddress) return
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

    const hasAssets = results.some((res) => res.status === "success" && Number(res.result) > 0)

    if (hasAssets) {
      setVerifiedSets((prev) => ({ ...prev, [manualLoadingId]: true }))
      setFailedSets((prev) => {
        const next = { ...prev }
        delete next[manualLoadingId]
        return next
      })
      localStorage.setItem(`verified_${manualLoadingId}`, "true")
      markAsVerified(manualLoadingId)
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

  // If we have 5 cards and the screen only fits 3, scrolling is active.
  useEffect(() => {
    if (!emblaApi) return
    const updateScrollState = () => {
      // In loop mode, these return true if there's enough content to scroll.
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

  const fitsContainer = !canScrollPrev && !canScrollNext

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
          <div className={`flex ml-[-12px] justify-start`}>
            {ECOSYSTEM_SETS.map((set) => {
              const isVerified = !!verifiedSets[set.id]
              const isVerifying = manualLoadingId === set.id
              const isFailed = !!failedSets[set.id]

              return (
                <div
                  key={set.id}
                  className={`flex-[0_0_182px] min-w-0 pl-3 ${isFailed ? "animate-shake" : ""}`}
                >
                  <div
                    className={`bg-[#161d26] border rounded-xl p-4 flex flex-col items-center h-[210px] transition-all duration-500 
                    ${
                      isVerified
                        ? "border-blue-500/40 shadow-lg shadow-blue-500/5"
                        : isFailed
                          ? "border-red-500/50 shadow-lg shadow-red-500/5"
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
                        <div className="relative mb-6">
                          <div
                            className={`w-14 h-14 rounded-full overflow-hidden border-2 transition-all duration-500 
                            ${isVerified ? "border-blue-500" : isFailed ? "border-red-500/50" : "border-gray-700"} bg-[#0b0e11] relative`}
                          >
                            <img
                              src={set.img}
                              alt={set.name}
                              style={{
                                filter: isVerified ? "none" : "grayscale(100%)",
                                opacity: isVerified ? "1" : "0.3",
                              }}
                              className="w-full h-full object-cover transition-all duration-700"
                            />
                          </div>
                          {isVerified && (
                            <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-0.5 border-2 border-[#161d26] z-10">
                              <Check className="w-2.5 h-2.5 text-white stroke-[4px]" />
                            </div>
                          )}
                          {isFailed && (
                            <div className="absolute bottom-0 right-0 bg-red-500 rounded-full p-0.5 border-2 border-[#161d26] z-10">
                              <X className="w-2.5 h-2.5 text-white stroke-[4px]" />
                            </div>
                          )}
                        </div>

                        <h3 className="text-[10px] font-bold mb-1 text-foreground uppercase tracking-widest text-center leading-tight whitespace-pre-line min-h-[32px] flex items-center justify-center">
                          {set.name}
                        </h3>

                        <button
                          onClick={() => handleVerify(set.id)}
                          disabled={!isConnected || isVerified || isVerifying}
                          className={`mt-auto w-full py-2 rounded-full text-[9px] font-bold uppercase border tracking-widest transition-all ${
                            isVerified
                              ? "border-blue-900/50 text-[#4da1ff] bg-blue-900/20 cursor-not-allowed opacity-60"
                              : isFailed
                                ? "border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20"
                                : !isConnected || isVerifying
                                  ? "border-blue-900/50 text-[#4da1ff] bg-blue-900/20 cursor-not-allowed opacity-60"
                                  : "border-[#4da1ff] text-[#4da1ff] hover:bg-[#4da1ff]/10 active:scale-95 cursor-pointer"
                          }`}
                        >
                          {isVerifying ? (
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
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/80 border border-white/10 rounded-full text-white hover:bg-blue-600 transition-all cursor-pointer shadow-xl backdrop-blur-sm"
          >
            <ChevronLeft size={14} />
          </button>
        )}

        {canScrollNext && (
          <button
            onClick={() => emblaApi?.scrollNext()}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/80 border border-white/10 rounded-full text-white hover:bg-blue-600 transition-all cursor-pointer shadow-xl backdrop-blur-sm"
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
