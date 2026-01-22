"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { toast } from "sonner"
import Lenis from "lenis"
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
import SwapContainer from "@/components/swap/SwapContainer"
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
  ArrowUpRight,
  Settings,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@radix-ui/react-popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@radix-ui/react-tooltip"
import { SwapForm } from "@/components/swap/SwapForm"

const socialLinks = [
  { name: "Discord", network: "discord", url: DISCORD_INVITE_URL },
  { name: "Telegram", network: "telegram", url: TELEGRAM_INVITE_URL },
  { name: "X", network: "x", url: TWITTER_INVITE_URL },
]

const footerLogos = [
  {
    src: "/assets/primev-logo.png",
    alt: "Primev",
    width: 100,
    height: 24,
    className: "h-6 opacity-80",
  },
  {
    src: "/assets/a16z-logo.webp",
    alt: "a16z",
    width: 177,
    height: 24,
    className: "h-6 opacity-60 hover:opacity-100 transition-opacity",
  },
  {
    src: "/assets/figment-logo.webp",
    alt: "Figment",
    width: 96,
    height: 36,
    className: "h-9 opacity-60 hover:opacity-100 transition-opacity",
  },
  {
    src: "/assets/hashkey-logo.svg",
    alt: "HashKey",
    width: 73,
    height: 24,
    className: "h-6 opacity-60 hover:opacity-100 transition-opacity",
  },
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
  const [isSwapFocused, setIsSwapFocused] = useState(false)
  const swapInterfaceRef = useRef<HTMLDivElement>(null)
  const lenisRef = useRef<Lenis | null>(null)

  const { walletName, walletIcon } = useWalletInfo(connector, isConnected)
  const isMetaMask = isMetaMaskWallet(connector)
  const isRabby = isRabbyWallet(connector)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Initialize Lenis
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.1,
      wheelMultiplier: 1,
    })

    lenisRef.current = lenis

    // Animation frame loop
    function raf(time: number) {
      lenis.raf(time)
      requestAnimationFrame(raf)
    }

    requestAnimationFrame(raf)

    // Cleanup
    return () => {
      lenis.destroy()
    }
  }, [])

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
          fetch("/api/analytics/volume/swap")
            .then((r) => r.json())
            .catch(() => null),
          fetch("/api/analytics/active-traders")
            .then((r) => r.json())
            .catch(() => null),
          fetch("/api/analytics/swap-count")
            .then((r) => r.json())
            .catch(() => null),
          fetch("/api/analytics/eth-price")
            .then((r) => r.json())
            .catch(() => null),
        ])

        const ethPrice = eth?.ethPrice ?? 2600
        const volEth = vol?.cumulativeSwapVolEth ?? 0

        setMetrics({
          swapVolumeEth: volEth,
          swapVolumeUsd: volEth * ethPrice,
          activeTraders: traders?.activeTraders ?? 0,
          swapCount: count?.swapTxCount ?? 0,
        })
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoadingMetrics(false)
      }
    }
    fetchMetrics()
  }, [])

  const handleAddNetwork = async () => {
    if (!isConnected || !connector) {
      toast.error("Connect wallet first")
      return
    }
    try {
      const provider: any = await connector.getProvider()
      await provider.request({ method: "wallet_addEthereumChain", params: [NETWORK_CONFIG] })
    } catch (e) {
      console.error("Network add failed", e)
    }
  }

  const handleRpcSetup = () => {
    if (!isConnected) {
      toast.error("Connect wallet first")
      return
    }
    isMetaMask
      ? setIsMetaMaskModalOpen(true)
      : isRabby
        ? setIsAddRpcModalOpen(true)
        : setIsBrowserWalletModalOpen(true)
  }

  return (
    <>
      <AppHeader
        isConnected={isConnected}
        status={status}
        isMounted={isMounted}
        isMetaMask={isMetaMask}
        onAddNetwork={handleAddNetwork}
        onRpcSetup={handleRpcSetup}
        onTestRpc={() => setIsTestModalOpen(true)}
      />
      <SwapForm />
    </>
  )
}

export default IndexPage
