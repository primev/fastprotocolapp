"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AnimatedBackground } from "@/components/AnimatedBackground"
import { SocialIcon } from "react-social-icons"
import { DISCORD_INVITE_URL, TELEGRAM_INVITE_URL, TWITTER_INVITE_URL } from "@/lib/constants"
import SwapInterface from "@/components/swap/SwapInterface"
import { AppHeader } from "@/components/shared/AppHeader"
import { useWalletInfo } from "@/hooks/use-wallet-info"
import { isMetaMaskWallet, isRabbyWallet } from "@/lib/onboarding-utils"
import { NETWORK_CONFIG } from "@/lib/network-config"
import { RPCTestModal } from "@/components/network-checker"
import { MetaMaskToggleModal } from "@/components/onboarding/MetaMaskToggleModal"
import { AddRpcModal } from "@/components/onboarding/AddRpcModal"
import { BrowserWalletStepsModal } from "@/components/onboarding/BrowserWalletStepsModal"
import { cn } from "@/lib/utils"
import { 
  ChevronDown, 
  ArrowRight, 
  Zap, 
  Shield, 
  Repeat, 
  Coins, 
  BarChart3, 
  Info, 
  CheckCircle2, 
  ArrowUpRight 
} from "lucide-react"

const socialLinks = [
  { name: "Discord", network: "discord", url: DISCORD_INVITE_URL },
  { name: "Telegram", network: "telegram", url: TELEGRAM_INVITE_URL },
  { name: "X", network: "x", url: TWITTER_INVITE_URL },
]

const footerLogos = [
  { src: "/assets/primev-logo.png", alt: "Primev", width: 100, height: 24, className: "h-6 opacity-80" },
  { src: "/assets/a16z-logo.webp", alt: "a16z", width: 177, height: 24, className: "h-6 opacity-60 hover:opacity-100 transition-opacity" },
  { src: "/assets/figment-logo.webp", alt: "Figment", width: 96, height: 36, className: "h-9 opacity-60 hover:opacity-100 transition-opacity" },
  { src: "/assets/hashkey-logo.svg", alt: "HashKey", width: 73, height: 24, className: "h-6 opacity-60 hover:opacity-100 transition-opacity" },
]

const IndexPage = () => {
  const router = useRouter()
  const { isConnected, status, connector } = useAccount()
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [isTestModalOpen, setIsTestModalOpen] = useState(false)
  const [isMetaMaskModalOpen, setIsMetaMaskModalOpen] = useState(false)
  const [isAddRpcModalOpen, setIsAddRpcModalOpen] = useState(false)
  const [isBrowserWalletModalOpen, setIsBrowserWalletModalOpen] = useState(false)
  
  const { walletName, walletIcon } = useWalletInfo(connector, isConnected)
  const isMetaMask = isMetaMaskWallet(connector)
  const isRabby = isRabbyWallet(connector)

  useEffect(() => { setIsMounted(true) }, [])

  const [metrics, setMetrics] = useState({
    swapVolumeEth: null as number | null,
    swapVolumeUsd: null as number | null,
    activeTraders: null as number | null,
    swapCount: null as number | null,
  })
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        // Real-time analytics fetching from the Protocol API
        const [vol, traders, count, eth] = await Promise.all([
          fetch("/api/analytics/volume/swap").then(r => r.json()).catch(() => null),
          fetch("/api/analytics/active-traders").then(r => r.json()).catch(() => null),
          fetch("/api/analytics/swap-count").then(r => r.json()).catch(() => null),
          fetch("/api/analytics/eth-price").then(r => r.json()).catch(() => null),
        ])

        const ethPrice = eth?.ethPrice ?? 2600
        const volEth = vol?.cumulativeSwapVolEth ?? 0

        setMetrics({
          swapVolumeEth: volEth,
          swapVolumeUsd: volEth * ethPrice,
          activeTraders: traders?.activeTraders ?? 0,
          swapCount: count?.swapTxCount ?? 0,
        })
      } catch (e) { console.error(e) } finally { setIsLoadingMetrics(false) }
    }
    fetchMetrics()
  }, [])

  const handleAddNetwork = async () => {
    if (!isConnected || !connector) { toast.error("Connect wallet first"); return; }
    try {
      const provider: any = await connector.getProvider()
      await provider.request({ method: "wallet_addEthereumChain", params: [NETWORK_CONFIG] })
    } catch (e) { console.error("Network add failed", e) }
  }

  const handleRpcSetup = () => {
    if (!isConnected) { toast.error("Connect wallet first"); return; }
    isMetaMask ? setIsMetaMaskModalOpen(true) : isRabby ? setIsAddRpcModalOpen(true) : setIsBrowserWalletModalOpen(true)
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-[#FDFCFE] dark:bg-[#0A0A0B] selection:bg-primary/20 transition-colors duration-500 overflow-x-hidden">
      <AnimatedBackground />

      <header className="sticky top-0 z-50 w-full border-b border-border/40 backdrop-blur-xl bg-background/40">
        <AppHeader 
          isConnected={isConnected} status={status} isMounted={isMounted} 
          isMetaMask={isMetaMask} onAddNetwork={handleAddNetwork} 
          onRpcSetup={handleRpcSetup} onTestRpc={() => setIsTestModalOpen(true)} 
        />
      </header>

      <main className="relative flex flex-col items-center">
        
        {/* SECTION 1: HERO (THE SANCTUARY) */}
        <section className="min-h-[calc(100vh-80px)] w-full flex flex-col items-center justify-center px-4 relative pt-12 pb-24">
          <div className="text-center mb-12 space-y-4 animate-in fade-in slide-in-from-top-6 duration-1000">
            <h1 className="text-6xl sm:text-8xl font-bold tracking-tighter text-foreground leading-[1.05]">
              Trade with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-400">Intent.</span>
            </h1>
            <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground font-medium leading-relaxed">
              Fast Protocol is Ethereum’s first coordinated rewards engine. 
            </p>
          </div>

          <div className="w-full max-w-[500px] z-10 animate-in fade-in zoom-in-95 duration-1000 delay-200 drop-shadow-[0_35px_35px_rgba(0,0,0,0.1)]">
            <SwapInterface />
          </div>

          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 text-muted-foreground/30 hover:text-primary transition-all duration-500 cursor-default">
            <span className="text-[10px] font-black tracking-[0.4em] uppercase">The First Tokenized MEV Layer</span>
            <ChevronDown size={20} className="animate-bounce" />
          </div>
        </section>

        {/* SECTION 2: PROTOCOLFlywheel & STATS (UNISWAP STYLE) */}
        <section className="w-full max-w-7xl py-32 px-6 md:px-10 flex flex-col lg:flex-row gap-20 items-center">
            <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-left-8 duration-1000">
              <h2 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground leading-[1.02]">
                90%+ MEV <br />
                <span className="text-muted-foreground/30 italic">Returned.</span>
              </h2>
              <div className="space-y-6 max-w-lg">
                <p className="text-xl text-muted-foreground font-semibold leading-snug">
                  By construction, Fast Protocol is mathematically constrained to pay back the highest level of MEV rebates to users.
                </p>
                <p className="text-muted-foreground/60 leading-relaxed font-medium">
                  We capture MEV via FAST RPC backruns, accumulate value in the protocol treasury, and redistribute it in $FAST. It's more than a swap—it's a programmable revenue stream.
                </p>
              </div>
              <div className="flex gap-6">
                <button className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-sm transition-transform hover:scale-105">
                  Launch Portal
                </button>
                <button className="group flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                  Read the Math <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            <div className="flex-1 w-full max-w-2xl bg-[#0D0D0E] rounded-[48px] overflow-hidden shadow-3xl border border-white/5">
                <div className="px-10 py-6 bg-white/[0.03] border-b border-white/5 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Protocol Vital Signs</span>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-[0.2em]">Real-Time Flow</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-px bg-white/5">
                    <MetricTile label="Treasury Accrual" value={formatCurrency(metrics.swapVolumeUsd)} isLoading={isLoadingMetrics} />
                    <MetricTile label="MEV Backrun (ETH)" value={formatEth(metrics.swapVolumeEth)} isLoading={isLoadingMetrics} />
                    <MetricTile label="Active Solvers" value="Managed" isLoading={isLoadingMetrics} />
                    <MetricTile label="User Rebates" value=">100%" accent="text-[#21C95E]" isLoading={isLoadingMetrics} />
                </div>
            </div>
        </section>

        {/* SECTION 3: THE REWARDS FLYWHEEL */}
        <section className="w-full max-w-7xl py-40 px-6 border-t border-border/10">
          <div className="text-center mb-24 space-y-4">
             <h2 className="text-xs font-black uppercase tracking-[0.5em] text-primary">The Architecture</h2>
             <h3 className="text-4xl md:text-5xl font-bold tracking-tight">Turning PvP into Alignment.</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <FlywheelCard 
              step="01" 
              title="Simulation" 
              desc="FAST RPC auctions your transaction directly to staked blockbuilders over mev-commit." 
            />
            <FlywheelCard 
              step="02" 
              title="Treasury" 
              desc="MEV value from backruns accumulates in ETH within the protocol treasury." 
            />
            <FlywheelCard 
              step="03" 
              title="Tokenize" 
              desc="The protocol converts ETH value into $FAST token rewards for the transaction supply chain." 
            />
            <FlywheelCard 
              step="04" 
              title="Equilibrium" 
              desc="Increased usage strengthens token utility, driving deeper liquidity and better rebates." 
            />
          </div>
        </section>

        {/* SECTION 4: VALIDATOR RATIONALITY TABLE */}
        <section className="w-full max-w-7xl py-32 px-6 border-t border-border/10 bg-zinc-950/[0.02] rounded-[64px] my-20">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
                <div className="flex-1 space-y-6">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <BarChart3 size={24} />
                    </div>
                    <h3 className="text-4xl font-bold tracking-tight">The Validator <br /> Strictly Rational Move.</h3>
                    <p className="text-muted-foreground font-medium leading-relaxed">
                        Opted-in validators earn significantly higher yields by capturing MEV directed to them via FAST RPC slots.
                    </p>
                    <ul className="space-y-4">
                        {[
                            "Earn normal mev-boost yield",
                            "Plus 95% of incremental FAST MEV",
                            "Priority routing for intent-rich flow"
                        ].map((text) => (
                            <li key={text} className="flex items-center gap-3 text-sm font-semibold">
                                <CheckCircle2 size={18} className="text-emerald-500" /> {text}
                            </li>
                        ))}
                    </ul>
                </div>
                
                <div className="flex-[1.2] w-full border border-border/40 rounded-[32px] bg-background overflow-hidden shadow-xl">
                    <div className="p-8 border-b border-border/40 flex justify-between items-center">
                        <span className="font-bold tracking-tight">Yield Comparison</span>
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Model Equilibrium</span>
                    </div>
                    <div className="p-0">
                        <div className="flex justify-between p-8 border-b border-border/10 items-center">
                            <div>
                                <p className="font-bold">Opted-in Validators</p>
                                <p className="text-xs text-muted-foreground">Integrated with mev-commit chain</p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-emerald-500">~95% MEV</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-500/50">Profit Share</p>
                            </div>
                        </div>
                        <div className="flex justify-between p-8 bg-muted/20 items-center">
                            <div>
                                <p className="font-bold text-muted-foreground">Standard OFAs</p>
                                <p className="text-xs text-muted-foreground/50">Traditional MEV-boost relays</p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-muted-foreground">~5% MEV</p>
                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30">Standard Rate</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        {/* SECTION 5: TECHNICAL CORE FEATURES */}
        <section className="w-full max-w-7xl py-40 px-6 border-t border-border/10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-24">
            <FeatureItem 
              icon={<Coins className="text-blue-500" size={32} />}
              title="Token Exposure"
              desc="The first protocol to gain direct exposure to Ethereum-wide MEV through a tokenized treasury model."
            />
            <FeatureItem 
              icon={<Zap className="text-emerald-500" size={32} />}
              title="Decaying Bids"
              desc="Transactions utilize decaying bids instead of priority gas fees, improving inclusion speed and builder logic."
            />
            <FeatureItem 
              icon={<Shield className="text-indigo-500" size={32} />}
              title="MEV Sanctuary"
              desc="Integrates with mev-commit to ensure transaction privacy and atomic preconfirmations in milliseconds."
            />
          </div>
        </section>

        {/* FOOTER */}
        <footer className="w-full py-24 px-6 bg-zinc-50 dark:bg-[#080809] border-t border-border/10">
          <div className="max-w-7xl mx-auto">
             <div className="flex flex-wrap justify-center items-center gap-16 grayscale opacity-30 hover:opacity-100 transition-all duration-700 mb-20">
                {footerLogos.map(l => <Image key={l.alt} src={l.src} alt={l.alt} width={l.width} height={l.height} className={l.className} />)}
             </div>

             <div className="flex flex-col md:flex-row justify-between items-center gap-12 pt-16 border-t border-border/10">
                <div className="text-center md:text-left">
                  <h3 className="text-2xl font-black tracking-tighter uppercase italic text-foreground">Fast Protocol</h3>
                  <p className="text-sm text-muted-foreground font-medium">The intent execution layer for the onchain economy.</p>
                </div>

                <div className="flex gap-10 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                    <button onClick={() => setIsHelpDialogOpen(true)} className="hover:text-primary transition-colors">Documentation</button>
                    <a href={TWITTER_INVITE_URL} target="_blank" className="hover:text-primary transition-colors">Twitter</a>
                    <a href={DISCORD_INVITE_URL} target="_blank" className="hover:text-primary transition-colors">Discord</a>
                </div>
             </div>
             <div className="mt-20 text-center">
                <p className="text-[9px] text-muted-foreground/20 uppercase tracking-[0.5em]">© 2026 FAST PROTOCOL INC. ALL RIGHTS RESERVED.</p>
             </div>
          </div>
        </footer>
      </main>

      {/* HELP DIALOG */}
      <Dialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen}>
        <DialogContent className="rounded-[40px] p-12 border-0 shadow-3xl">
          <DialogTitle className="text-4xl font-bold tracking-tight">Understanding Fast</DialogTitle>
          <DialogDescription className="text-lg text-muted-foreground leading-relaxed mt-4 font-medium">
            Fast Protocol is a MEV-sharing protocol + RPC stack built on top of mev‑commit. 
            It is mathematically constrained to pay back the highest level of MEV rebates to users, 
            which can exceed the amount their transactions generate (&gt;100%).
          </DialogDescription>
        </DialogContent>
      </Dialog>

      {/* MODALS */}
      <RPCTestModal open={isTestModalOpen} onOpenChange={setIsTestModalOpen} onConfirm={() => {}} onClose={() => setIsTestModalOpen(false)} />
      <MetaMaskToggleModal open={isMetaMaskModalOpen} onOpenChange={setIsMetaMaskModalOpen} onComplete={() => setIsMetaMaskModalOpen(false)} />
      <AddRpcModal open={isAddRpcModalOpen} onOpenChange={setIsAddRpcModalOpen} walletName={walletName} walletIcon={walletIcon} isMetaMask={isMetaMask} onComplete={() => setIsAddRpcModalOpen(false)} />
      <BrowserWalletStepsModal open={isBrowserWalletModalOpen} onOpenChange={setIsBrowserWalletModalOpen} walletName={walletName} walletIcon={walletIcon} onComplete={() => setIsBrowserWalletModalOpen(false)} />
    </div>
  )
}

/* --- UTILITIES --- */
const formatCurrency = (v: number | null) => v ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(v) : "—"
const formatEth = (v: number | null) => v ? `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETH` : "—"

/* --- COMPONENTS --- */

function MetricTile({ label, value, accent, isLoading }: any) {
  return (
    <div className="bg-[#0D0D0E] p-12 flex flex-col justify-between hover:bg-white/[0.02] transition-colors group">
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-10 group-hover:text-white/40">{label}</span>
      <div className={cn(
        "text-4xl md:text-5xl font-bold tracking-tighter text-white transition-opacity",
        accent,
        isLoading && "animate-pulse opacity-20"
      )}>
        {value}
      </div>
    </div>
  )
}

function FlywheelCard({ step, title, desc }: any) {
  return (
    <div className="relative p-10 rounded-[40px] bg-background border border-border/40 hover:border-primary/40 transition-all duration-500 group shadow-sm hover:shadow-2xl">
      <span className="absolute top-8 right-10 text-5xl font-black text-muted-foreground/5 group-hover:text-primary/10 transition-colors tracking-tighter">
        {step}
      </span>
      <div className="space-y-4 relative z-10">
        <h4 className="text-xl font-bold tracking-tight">{title}</h4>
        <p className="text-sm text-muted-foreground font-medium leading-relaxed opacity-80">{desc}</p>
      </div>
    </div>
  )
}

function FeatureItem({ icon, title, desc }: any) {
  return (
    <div className="space-y-6 group">
      <div className="w-14 h-14 rounded-2xl bg-muted/40 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500 shadow-sm group-hover:shadow-xl group-hover:-translate-y-2">
        {icon}
      </div>
      <div className="space-y-3">
        <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
        <p className="text-muted-foreground leading-relaxed text-lg font-medium opacity-80">{desc}</p>
      </div>
    </div>
  )
}

export default IndexPage