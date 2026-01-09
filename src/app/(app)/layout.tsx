"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { usePathname } from "next/navigation"
import { useAccount } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { toast } from "sonner"
import { Suspense } from "react"
import { AppHeader } from "@/components/shared/AppHeader"
import { useRPCTest } from "@/hooks/use-rpc-test"
import { useWalletInfo } from "@/hooks/use-wallet-info"
import { isMetaMaskWallet, isRabbyWallet } from "@/lib/onboarding-utils"
import { NETWORK_CONFIG } from "@/lib/network-config"
import { DashboardTabProvider, useDashboardTab } from "./DashboardTabContext"

// Modal Components
import { RPCTestModal } from "@/components/network-checker"
import { MetaMaskToggleModal } from "@/components/onboarding/MetaMaskToggleModal"
import { AddRpcModal } from "@/components/onboarding/AddRpcModal"
import { BrowserWalletStepsModal } from "@/components/onboarding/BrowserWalletStepsModal"

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isMounted, setIsMounted] = useState(false)
  const [isTestModalOpen, setIsTestModalOpen] = useState(false)
  const [isMetaMaskModalOpen, setIsMetaMaskModalOpen] = useState(false)
  const [isAddRpcModalOpen, setIsAddRpcModalOpen] = useState(false)
  const [isBrowserWalletModalOpen, setIsBrowserWalletModalOpen] = useState(false)
  const [headerHeight, setHeaderHeight] = useState(75)
  const headerRef = useRef<HTMLDivElement>(null)

  const { isConnected, status, connector, address } = useAccount()
  const { walletName, walletIcon } = useWalletInfo(connector, isConnected)
  const rpcTest = useRPCTest()
  const { openConnectModal } = useConnectModal()
  const hasOpenedConnectModalRef = useRef(false)

  // Wallet detection
  const isMetaMask = isMetaMaskWallet(connector)
  const isRabby = isRabbyWallet(connector)

  // Determine if we're on dashboard (for tabs)
  const isDashboard = pathname?.startsWith("/dashboard")
  const dashboardTab = useDashboardTab() // Always available since we're in DashboardTabProvider

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Automatically open wallet connect modal if user is not connected (only on dashboard/leaderboard)
  useEffect(() => {
    if (
      isMounted &&
      !isConnected &&
      !hasOpenedConnectModalRef.current &&
      status !== "connecting" &&
      status !== "reconnecting" &&
      (pathname?.startsWith("/dashboard") || pathname?.startsWith("/leaderboard"))
    ) {
      hasOpenedConnectModalRef.current = true
      openConnectModal()
    }
  }, [isMounted, isConnected, status, openConnectModal, pathname])

  // Measure header height
  const setHeaderRef = useCallback((node: HTMLDivElement | null) => {
    headerRef.current = node
    if (node) {
      setHeaderHeight(node.offsetHeight)
    }
  }, [])

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
        <AppHeader
          isConnected={isConnected}
          status={status}
          isMounted={isMounted}
          isMetaMask={isMetaMask}
          onAddNetwork={handleAddNetwork}
          onRpcSetup={handleRpcSetup}
          onTestRpc={() => setIsTestModalOpen(true)}
          activeTab={dashboardTab?.activeTab}
          onTabChange={dashboardTab?.setActiveTab}
          showTabs={isDashboard}
        />
      </div>

      {/* Content Area - Add padding to account for fixed header */}
      <div style={{ paddingTop: `${headerHeight}px` }}>{children}</div>

      {/* Shared Modals */}
      <RPCTestModal
        open={isTestModalOpen}
        onOpenChange={setIsTestModalOpen}
        onConfirm={() => {}}
        onClose={() => {
          setIsTestModalOpen(false)
          rpcTest.reset()
        }}
      />

      <MetaMaskToggleModal
        open={isMetaMaskModalOpen}
        onOpenChange={setIsMetaMaskModalOpen}
        onComplete={() => {
          setIsMetaMaskModalOpen(false)
        }}
      />

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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <DashboardTabProvider>
        <AppLayoutContent>{children}</AppLayoutContent>
      </DashboardTabProvider>
    </Suspense>
  )
}
