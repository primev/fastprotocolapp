"use client"

import { Suspense, useState, useEffect, useLayoutEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Settings, Wallet, Award } from "lucide-react"
import { ConnectButton, useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit"
import { SocialIcon } from "react-social-icons"
import { DISCORD_INVITE_URL } from "@/lib/constants"

// Hooks
import { useRPCTest } from "@/hooks/use-rpc-test"
import { useWalletInfo } from "@/hooks/use-wallet-info"

// Components
import { LeaderboardTable } from "@/components/dashboard/LeaderboardTable"
import { RPCTestModal } from "@/components/network-checker"
import { MetaMaskToggleModal } from "@/components/onboarding/MetaMaskToggleModal"
import { AddRpcModal } from "@/components/onboarding/AddRpcModal"
import { BrowserWalletStepsModal } from "@/components/onboarding/BrowserWalletStepsModal"

// Utils
import { isMetaMaskWallet, isRabbyWallet } from "@/lib/onboarding-utils"
import { NETWORK_CONFIG } from "@/lib/network-config"

// Client-side rendering for instant page load
const LeaderboardContent = () => {
  const router = useRouter()
  const [points] = useState(0)
  const [isMounted, setIsMounted] = useState(false)
  const [isTestModalOpen, setIsTestModalOpen] = useState(false)
  const [isMetaMaskModalOpen, setIsMetaMaskModalOpen] = useState(false)
  const [isAddRpcModalOpen, setIsAddRpcModalOpen] = useState(false)
  const [isBrowserWalletModalOpen, setIsBrowserWalletModalOpen] = useState(false)
  const [headerHeight, setHeaderHeight] = useState(75)
  const [announcementHeight, setAnnouncementHeight] = useState(32)
  const headerRef = useRef<HTMLDivElement>(null)
  const announcementRef = useRef<HTMLDivElement>(null)

  // Callback refs to measure immediately when elements mount
  const setHeaderRef = useCallback((node: HTMLDivElement | null) => {
    headerRef.current = node
    if (node) {
      setHeaderHeight(node.offsetHeight)
    }
  }, [])

  const setAnnouncementRef = useCallback((node: HTMLDivElement | null) => {
    announcementRef.current = node
    if (node) {
      setAnnouncementHeight(node.offsetHeight)
    }
  }, [])

  const { isConnected, address, status, connector } = useAccount()
  const { walletName, walletIcon } = useWalletInfo(connector, isConnected)
  const rpcTest = useRPCTest()
  const { openConnectModal } = useConnectModal()
  const { openAccountModal } = useAccountModal()
  const hasOpenedConnectModalRef = useRef(false)

  // Wallet detection
  const isMetaMask = isMetaMaskWallet(connector)
  const isRabby = isRabbyWallet(connector)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Automatically open wallet connect modal if user is not connected
  useEffect(() => {
    if (
      isMounted &&
      !isConnected &&
      !hasOpenedConnectModalRef.current &&
      status !== "connecting" &&
      status !== "reconnecting"
    ) {
      hasOpenedConnectModalRef.current = true
      openConnectModal()
    }
  }, [isMounted, isConnected, status, openConnectModal])

  // Measure header and announcement heights - use layout effect to run synchronously before paint
  useLayoutEffect(() => {
    const updateHeights = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight)
      }
      if (announcementRef.current) {
        setAnnouncementHeight(announcementRef.current.offsetHeight)
      }
    }

    // Update immediately - useLayoutEffect runs synchronously before paint
    updateHeights()

    // Use ResizeObserver for real-time updates
    const resizeObserver = new ResizeObserver(() => {
      updateHeights()
    })

    if (headerRef.current) resizeObserver.observe(headerRef.current)
    if (announcementRef.current) resizeObserver.observe(announcementRef.current)

    window.addEventListener("resize", updateHeights)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", updateHeights)
    }
  })

  // Handler for adding network (MetaMask wallet_addEthereumChain)
  const handleAddNetwork = async () => {
    if (!isConnected || !connector) {
      toast.error("Please connect your wallet first")
      return
    }

    try {
      let provider = null
      try {
        provider = await connector.getProvider()
      } catch (error) {
        console.error("Error getting provider from connector:", error)
      }

      // Fallback to window.ethereum
      if (!provider && typeof window !== "undefined" && (window as any).ethereum) {
        const ethereum = (window as any).ethereum
        provider = Array.isArray(ethereum) ? ethereum[0] : ethereum
      }

      if (!provider || !provider.request) {
        toast.error("Provider not available", {
          description: "Unable to access wallet provider.",
        })
        return
      }

      await provider.request({
        method: "wallet_addEthereumChain",
        params: [NETWORK_CONFIG],
      })

      toast.success("Network added successfully", {
        description: "Fast Protocol network has been added to your wallet.",
      })
    } catch (error: any) {
      if (error?.code === 4001) {
        // User rejected
        return
      }
      toast.error("Failed to add network", {
        description: error?.message || "Failed to add Fast Protocol network.",
      })
    }
  }

  // Handler for RPC setup based on wallet type
  const handleRpcSetup = () => {
    if (!isConnected) {
      toast.error("Please connect your wallet first")
      return
    }
    if (isMetaMask) {
      setIsMetaMaskModalOpen(true)
    } else if (isRabby) {
      setIsAddRpcModalOpen(true)
    } else {
      setIsBrowserWalletModalOpen(true)
    }
  }

  return (
    <div className="bg-background min-h-screen">
      <div
        ref={setHeaderRef}
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm"
      >
        <header className="border-b border-border/50 backdrop-blur-sm bg-background/80">
          <div className="container mx-auto px-4 py-4 lg:py-2.5 flex items-center justify-between">
            <Link href="/dashboard" className="relative">
              <Image
                src="/assets/fast-icon.png"
                alt="Fast Protocol"
                width={40}
                height={40}
                className="sm:hidden"
              />
              <Image
                src="/assets/fast-protocol-logo-icon.png"
                alt="Fast Protocol"
                width={150}
                height={75}
                className="hidden sm:block"
              />
            </Link>

            {/* Navigation Links - Centered - Desktop only */}
            <div className="flex-1 justify-center hidden sm:flex">
              <div className="inline-flex space-x-2 rounded-full bg-muted/50 p-1">
                <Link
                  href="/dashboard"
                  className="text-sm rounded-full px-4 py-2 transition-colors hover:bg-muted/50"
                >
                  Genesis SBT
                </Link>
                <Link
                  href="/leaderboard"
                  className="text-sm rounded-full px-4 py-2 transition-colors bg-background"
                >
                  Leaderboard
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {/* <Badge
                variant="outline"
                className="h-10 px-3 lg:px-2.5 text-sm lg:text-sm border-primary/50 flex items-center"
              >
                <Award className="w-4 h-4 lg:w-3.5 lg:h-3.5 mr-2 lg:mr-1.5 text-primary" />
                {points} Miles
              </Badge> */}
              {/* Wallet icon button for mobile (when connected) */}
              {isConnected && (
                <Button
                  variant="outline"
                  size="icon"
                  className="sm:hidden"
                  onClick={openAccountModal}
                >
                  <Wallet className="w-4 h-4" />
                </Button>
              )}
              {/* ConnectButton - full on desktop, "Connect" only on mobile when not connected */}
              {isConnected ? (
                <div className="hidden sm:block">
                  <ConnectButton showBalance={false} accountStatus="address" />
                </div>
              ) : (
                <>
                  {!isMounted || status === "connecting" || status === "reconnecting" ? (
                    <Skeleton className="h-10 w-32 rounded-full" />
                  ) : (
                    <>
                      <Button onClick={openConnectModal} className="h-10 sm:hidden px-4">
                        Connect
                      </Button>
                      <div className="hidden sm:block">
                        <ConnectButton showBalance={false} accountStatus="address" />
                      </div>
                    </>
                  )}
                </>
              )}
              {isConnected && (
                <>
                  <div
                    onClick={() => window.open(DISCORD_INVITE_URL, "_blank")}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    aria-label="Discord"
                  >
                    <SocialIcon network="discord" style={{ height: 35, width: 35 }} />
                  </div>
                  <div className="relative">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Account Settings"
                          className="w-10 h-10 rounded-full border border-border shadow-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/50 transition"
                        >
                          <Settings className="w-5 h-5 text-primary" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="min-w-[220px] rounded-lg shadow-lg border border-border p-2 bg-background"
                      >
                        <DropdownMenuLabel className="text-[13px] text-foreground/80 font-semibold pb-1">
                          Fast Protocol Network
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {isMetaMask && (
                          <DropdownMenuItem
                            className="flex items-center gap-2 cursor-pointer transition-colors hover:bg-accent/60 rounded"
                            onSelect={(e) => {
                              e.preventDefault()
                              handleAddNetwork()
                            }}
                          >
                            <span className="inline-block w-2 h-2 rounded-full bg-primary mr-2" />
                            Add RPC to Wallet
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="flex items-center gap-2 cursor-pointer transition-colors hover:bg-accent/60 rounded"
                          onSelect={(e) => {
                            e.preventDefault()
                            handleRpcSetup()
                          }}
                        >
                          <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground mr-2" />
                          {isMetaMask ? "Toggle Network" : "Setup RPC"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="flex items-center gap-2 cursor-pointer transition-colors hover:bg-accent/60 rounded"
                          onSelect={(e) => {
                            e.preventDefault()
                            if (!isConnected) {
                              toast.error("Please connect your wallet first")
                              return
                            }
                            setIsTestModalOpen(true)
                          }}
                        >
                          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2" />
                          Test RPC Connection
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
      </div>

      {/* Mobile Navigation */}
      <div className="flex-1 bg-background/80 justify-center flex flex-col items-center sm:hidden py-4">
        <div className="inline-flex space-x-2 rounded-full bg-muted/50 p-1">
          <Link
            href="/dashboard"
            className="text-sm rounded-full px-4 py-2 transition-colors hover:bg-muted/50"
          >
            Genesis SBT
          </Link>
          <Link
            href="/leaderboard"
            className="text-sm rounded-full px-4 py-2 transition-colors bg-background"
          >
            Leaderboard
          </Link>
        </div>
      </div>

      {/* Announcement Banner */}
      <div
        ref={setAnnouncementRef}
        className="fixed left-0 right-0 z-40 bg-gradient-to-r from-primary to-primary/80 border-b border-primary/50 hover:from-primary/90 hover:to-primary/70 transition-all backdrop-blur-sm"
        style={{ top: `${headerHeight}px` }}
      >
        <div className="container mx-auto px-4 py-1 text-center">
          <p className="text-primary-foreground text-sm">
            🎉 You're all set. Make your first Fast swap on these{" "}
            <a
              href="#defi-protocols"
              className="underline underline-offset-4 font-medium hover:text-primary-foreground/80 transition-colors"
            >
              top DeFi protocols
            </a>
            .
          </p>
        </div>
      </div>

      {/* Content Area - Add padding to account for fixed headers */}
      <div className="container mx-auto px-4 sm:px-0 py-4 pt-56 sm:pt-32">
        <LeaderboardTable />
      </div>

      {/* RPC Test Modal */}
      <RPCTestModal
        open={isTestModalOpen}
        onOpenChange={setIsTestModalOpen}
        onConfirm={() => {}}
        onClose={() => {
          setIsTestModalOpen(false)
          rpcTest.reset()
        }}
      />

      {/* MetaMask Toggle Network Modal */}
      <MetaMaskToggleModal
        open={isMetaMaskModalOpen}
        onOpenChange={setIsMetaMaskModalOpen}
        onComplete={() => {
          setIsMetaMaskModalOpen(false)
        }}
      />

      {/* Add RPC Modal for Non-MetaMask Wallets */}
      <AddRpcModal
        open={isAddRpcModalOpen}
        onOpenChange={setIsAddRpcModalOpen}
        walletName={walletName}
        walletIcon={walletIcon}
        isMetaMask={isMetaMask}
        onComplete={() => {
          setIsAddRpcModalOpen(false)
        }}
      />

      {/* Browser Wallet Steps Modal */}
      <BrowserWalletStepsModal
        open={isBrowserWalletModalOpen}
        onOpenChange={setIsBrowserWalletModalOpen}
        walletName={walletName}
        walletIcon={walletIcon}
        onComplete={() => {
          setIsBrowserWalletModalOpen(false)
        }}
      />
    </div>
  )
}

// Wrap the component in Suspense
const LeaderboardPage = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <LeaderboardContent />
    </Suspense>
  )
}

export default LeaderboardPage
