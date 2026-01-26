import React, { useState, useEffect, useCallback, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ShieldCheck, ChevronLeft, ChevronRight, Loader2, Check, Beaker } from "lucide-react";
import { useAccount, useReadContracts } from "wagmi";
import { erc721Abi } from "viem";

/** * TEST CONFIGURATION
 * Set TEST_MODE to true to bypass blockchain checks and force successful verification.
 */
const TEST_MODE = true;

const ECOSYSTEM_SETS = [
  { 
    id: "pudgy", 
    name: "Pudgy\nPenguins", 
    img: "assets/nfts/pudgy-penguins.jpg", 
    addresses: [
      "0xbd3531da5cf5857e7cfaa92426877b022e612cf8", // Pudgy Penguins
      "0x524cab2ec69124574082676e6f654a18df49a048", // Lil Pudgys
      "0x062e691c2054de82f28008a8ccc6d7a1c8ce060d"  // Pudgy Rods
    ] as const 
  },
  { 
    id: "moonbirds", 
    name: "Moonbirds", 
    img: "assets/nfts/moonbirds.jpg", 
    addresses: [
      "0x23581767a106ae21c074b2276d25e5c3e136a68b", // Moonbirds
      "0x1792a96e5668ad7c167ab804a100ce42395ce54d", // Moonbirds Oddities
      "0xc0ffee8ff7e5497c2d6f7684859709225fcc5be8"  // Moonbirds Mythics
    ] as const 
  },
  { 
    id: "azuki", 
    name: "Azuki", 
    img: "assets/nfts/azuki.jpg", 
    addresses: [
      "0xed5af388653567af2f388e6224dc7c4b3241c544", // Azuki
      "0x306b1ea3ecdf94ab739f1910bbda052ed4a9f949", // BEANZ
      "0xb6a37b5d14d502c3ab0ae6f3a0e058bc9517786e"  // Azuki Elementals
    ] as const 
  },
  { 
    id: "yuga", 
    name: "Yuga Labs", 
    img: "assets/nfts/yuga-labs.jpg", 
    addresses: [
      "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d", // BAYC
      "0x60e4d786628fea6478f785a6d7e704777c86a7c6", // MAYC
      "0xba30e5f9bb24caa003e9f2f0497ad287fdf95623", // BAKC
      "0x34d85c9cdeb23fa97cb08333b511ac86e1c4e258", // Otherdeed
      "0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb", // CryptoPunks
      "0x7bd29408f11d2bfc23c34f18275bbf23bb716bc7"  // Meebits
    ] as const 
  },
  { 
    id: "doodles", 
    name: "Doodles", 
    img: "assets/nfts/doodles.jpg", 
    addresses: [
      "0x8a90cab2b38dba80c64b7734e58ee1db38b8992e", // Doodles
      "0x89afdbf071050a67cfdc28b2ccb4277eef598f37", // Space Doodles
      "0x466cfcd0525189b573e794f554b8a751279213ac"  // The Dooplicator
    ] as const 
  },
];

export const EcosystemSetCarousel = () => {
  const { address: userAddress, isConnected } = useAccount();
  const [verifiedSets, setVerifiedSets] = useState<Record<string, boolean>>({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [manualLoadingId, setManualLoadingId] = useState<string | null>(null);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "start",
    skipSnaps: false
  });

  const markAsVerified = useCallback((id: string) => {
    setVerifiedSets((prev) => {
      if (prev[id]) return prev;
      const next = { ...prev, [id]: true };
      localStorage.setItem(`verified_${id}`, "true");
      return next;
    });
  }, []);

  const syncWithBlockchain = useCallback((resultsArray: any[]) => {
    let globalIndex = 0;
    ECOSYSTEM_SETS.forEach((set) => {
      // Check all addresses for this specific set
      for (let i = 0; i < set.addresses.length; i++) {
        const res = resultsArray[globalIndex++];
        // Return once the first balance is found for this set
        if (res.status === "success" && Number(res.result) > 0) {
          markAsVerified(set.id);
          // Advance globalIndex for the remaining addresses in this set and break to next set
          globalIndex += (set.addresses.length - 1 - i);
          break;
        }
      }
    });
  }, [markAsVerified]);

  const contracts = useMemo(() => {
    if (!userAddress || TEST_MODE) return [];
    // Flatten all addresses into a single contract call array
    return ECOSYSTEM_SETS.flatMap((set) => 
      set.addresses.map((addr) => ({
        address: addr,
        abi: erc721Abi,
        functionName: "balanceOf",
        args: [userAddress],
      }))
    );
  }, [userAddress]);

  const { data: blockchainData, refetch } = useReadContracts({
    contracts,
    query: { enabled: isConnected && !!userAddress && !TEST_MODE }
  });

  useEffect(() => {
    const cached: Record<string, boolean> = {};
    ECOSYSTEM_SETS.forEach(s => {
      if (localStorage.getItem(`verified_${s.id}`) === "true") cached[s.id] = true;
    });
    setVerifiedSets(cached);

    const timer = setTimeout(() => setIsInitialLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (blockchainData && !TEST_MODE) syncWithBlockchain(blockchainData as any[]);
  }, [blockchainData, syncWithBlockchain]);

  const handleVerify = async (id: string) => {
    setManualLoadingId(id);
    await new Promise(resolve => setTimeout(resolve, 800));

    if (TEST_MODE) {
      markAsVerified(id);
    } else {
      if (!isConnected) {
        alert("Please connect your wallet!");
        setManualLoadingId(null);
        return;
      }
      const { data } = await refetch();
      if (data) syncWithBlockchain(data as any[]);
    }
    setManualLoadingId(null);
  };

  return (
    <div className="bg-card/50 p-6 rounded-xl border border-border/50 text-foreground max-w-5xl mx-auto shadow-2xl font-sans relative">
      {TEST_MODE && (
        <div className="absolute top-2 left-6 flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-amber-500 text-[9px] font-bold uppercase tracking-tighter z-50">
          <Beaker size={10} /> Test Mode
        </div>
      )}

      <div className="flex justify-end mb-2">
        <div className="bg-[#1a232e] text-[#4da1ff] text-[9px] font-bold px-2.5 py-0.5 rounded-full border border-blue-900/30 uppercase tracking-wider">
          {isInitialLoading
            ? "-- / --"
            : `${Object.keys(verifiedSets).length}/${ECOSYSTEM_SETS.length}`}{" "}
          Verified
        </div>
      </div>

      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-blue-500 w-6 h-6 hidden sm:flex" />
          <h3 className="text-lg font-semibold tracking-tight">Verify Assets</h3>
        </div>
      </div>

      <p className="text-foreground/70 mb-6 text-xs">
        Unlock exclusive badges by verifying your activity.
      </p>

      <div className="relative group">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-3">
            {ECOSYSTEM_SETS.map((set) => {
              const isVerified = !!verifiedSets[set.id];
              const isVerifying = manualLoadingId === set.id;

              return (
                <div key={set.id} className="flex-[0_0_60%] sm:flex-[0_0_30%] lg:flex-[0_0_15.5%] min-w-0">
                  <div className={`bg-[#161d26] border rounded-xl p-4 flex flex-col items-center h-[210px] transition-all duration-500 ${isVerified ? "border-blue-500/40 shadow-lg shadow-blue-500/5" : "border-white/5"}`}>

                    {isInitialLoading ? (
                      <div className="w-full animate-pulse flex flex-col items-center">
                        <div className="w-14 h-14 bg-white/5 rounded-full mb-4" />
                        <div className="h-3 w-16 bg-white/5 rounded-full mb-6" />
                        <div className="h-8 w-full bg-white/5 rounded-full" />
                      </div>
                    ) : (
                      <>
                        <div className="relative mb-6">
                          <div className={`w-14 h-14 rounded-full overflow-hidden border-2 transition-all duration-500 ${isVerified ? "border-blue-500" : "border-gray-700"} bg-[#0b0e11] relative`}>
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
                        </div>

                        <h3 className="text-[10px] font-bold mb-1 text-foreground uppercase tracking-widest text-center leading-tight whitespace-pre-line min-h-[32px] flex items-center justify-center">
                          {set.name}
                        </h3>

                        <button
                          onClick={() => handleVerify(set.id)}
                          disabled={isVerified || isVerifying}
                          className={`mt-auto w-full py-2 rounded-full text-[9px] font-bold uppercase border tracking-widest transition-all ${
                            isVerified 
                              ? "border-blue-900/50 text-[#4da1ff] bg-blue-900/20 cursor-default" 
                              : "border-[#4da1ff] text-[#4da1ff] hover:bg-[#4da1ff]/10 active:scale-95 cursor-pointer"
                          }`}
                        >
                          {isVerifying ? (
                            <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                          ) : isVerified ? (
                            "Verified"
                          ) : (
                            "Verify"
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => emblaApi?.scrollPrev()}
          className="absolute -left-3 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/80 border border-white/10 rounded-full text-white hover:bg-blue-600 transition-all cursor-pointer shadow-xl backdrop-blur-sm"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={() => emblaApi?.scrollNext()}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 p-2 bg-black/80 border border-white/10 rounded-full text-white hover:bg-blue-600 transition-all cursor-pointer shadow-xl backdrop-blur-sm"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};