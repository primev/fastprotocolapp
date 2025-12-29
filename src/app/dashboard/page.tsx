"use client"

import { useState, useEffect, useLayoutEffect, useRef, Suspense, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAccount } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Mail } from "lucide-react"

// Hooks
import { useUserOnboarding } from "@/hooks/use-user-onboarding"
import { useGenesisSBT } from "@/hooks/use-genesis-sbt"
import { useDashboardTasks } from "@/hooks/use-dashboard-tasks"
import { useEmailDialog } from "@/hooks/use-email-dialog"
import { useAffiliateCode } from "@/hooks/use-affiliate-code"
import { useRPCTest } from "@/hooks/use-rpc-test"
import { useWalletInfo } from "@/hooks/use-wallet-info"

// Components
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import { SBTDisplayCard } from "@/components/dashboard/SBTDisplayCard"
import { ReferralsCard } from "@/components/dashboard/ReferralsCard"
import { OneTimeTasksAccordion } from "@/components/dashboard/OneTimeTasksAccordion"
import { SwapEarnAccordion } from "@/components/dashboard/SwapEarnAccordion"
import { WeeklyActivitySection } from "@/components/dashboard/WeeklyActivitySection"
import { TransactionFeedbackModal } from "@/components/modals/TransactionFeedbackModal"
import { ReferralModal } from "@/components/modals/ReferralModal"
import { RPCTestModal } from "@/components/network-checker"
import { MetaMaskToggleModal } from "@/components/onboarding/MetaMaskToggleModal"
import { AddRpcModal } from "@/components/onboarding/AddRpcModal"
import { BrowserWalletStepsModal } from "@/components/onboarding/BrowserWalletStepsModal"
import { SwapForm } from "@/components/swap/SwapForm"

// Utils
import { cn } from "@/lib/utils"
import { isMetaMaskWallet, isRabbyWallet } from "@/lib/onboarding-utils"
import { NETWORK_CONFIG } from "@/lib/network-config"
import type { TaskName } from "@/hooks/use-dashboard-tasks"

const DashboardContent = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [points] = useState(0)
  const [activeTab, setActiveTab] = useState("swap")
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [oneTimeTasksAccordionValue, setOneTimeTasksAccordionValue] = useState<string | undefined>(
    "one-time-tasks"
  )
  const [isMounted, setIsMounted] = useState(false)
  const [isTestModalOpen, setIsTestModalOpen] = useState(false)
  const [isMetaMaskModalOpen, setIsMetaMaskModalOpen] = useState(false)
  const [isAddRpcModalOpen, setIsAddRpcModalOpen] = useState(false)
  const [isBrowserWalletModalOpen, setIsBrowserWalletModalOpen] = useState(false)
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false)
  const [headerHeight, setHeaderHeight] = useState(75)
  const [announcementHeight, setAnnouncementHeight] = useState(32)
  const [titleSectionHeight, setTitleSectionHeight] = useState(100)
  const headerRef = useRef<HTMLDivElement>(null)
  const announcementRef = useRef<HTMLDivElement>(null)
  const titleSectionRef = useRef<HTMLDivElement>(null)

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

  const setTitleSectionRef = useCallback((node: HTMLDivElement | null) => {
    titleSectionRef.current = node
    if (node) {
      setTitleSectionHeight(node.offsetHeight)
    }
  }, [])

  const { isConnected, address, status, connector } = useAccount()
  const { walletName, walletIcon } = useWalletInfo(connector, isConnected)
  const rpcTest = useRPCTest()

  // Custom hooks
  const userOnboarding = useUserOnboarding(isConnected, address)
  const genesisSBT = useGenesisSBT(isConnected, address)
  const emailDialog = useEmailDialog()
  const { affiliateCode, referralLink, isLoadingCode, refreshAffiliateCode, refreshReferralLink } =
    useAffiliateCode()

  // Dashboard tasks hook
  const dashboardTasks = useDashboardTasks({
    userOnboarding: userOnboarding.userOnboarding,
    hasGenesisSBT: genesisSBT.hasGenesisSBT,
    isConnected,
    address,
    updateUserOnboarding: userOnboarding.updateUserOnboarding,
    onMintComplete: () => {
      setShowFeedbackModal(true)
    },
  })

  // Wallet detection
  const isMetaMask = isMetaMaskWallet(connector)
  const isRabby = isRabbyWallet(connector)

  // Handle tab from URL query parameter
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && ["genesis", "swap"].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    router.push(`/dashboard?tab=${value}`)
  }

  // Handle feedback modal from genesis SBT hook
  useEffect(() => {
    if (genesisSBT.shouldShowFeedbackModal) {
      setShowFeedbackModal(true)
      genesisSBT.markFeedbackShown()
    }
  }, [genesisSBT.shouldShowFeedbackModal])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Measure header and announcement heights - use layout effect to run synchronously before paint
  useLayoutEffect(() => {
    const updateHeights = () => {
      if (headerRef.current) {
        setHeaderHeight(headerRef.current.offsetHeight)
      }
      if (announcementRef.current) {
        setAnnouncementHeight(announcementRef.current.offsetHeight)
      }
      if (titleSectionRef.current) {
        setTitleSectionHeight(titleSectionRef.current.offsetHeight)
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
    if (titleSectionRef.current) resizeObserver.observe(titleSectionRef.current)

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

  // Handle email submission
  const handleEmailSubmit = () => {
    emailDialog.handleEmailSubmit(() => {
      dashboardTasks.handleTaskComplete("Enter Email" as TaskName)
    })
  }

  const titleSectionTop = headerHeight + announcementHeight

  return (
    <div className="bg-background min-h-screen">
      <div
        ref={setHeaderRef}
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm"
      >
        <DashboardHeader
          points={points}
          isConnected={isConnected}
          status={status}
          isMounted={isMounted}
          isMetaMask={isMetaMask}
          onAddNetwork={handleAddNetwork}
          onRpcSetup={handleRpcSetup}
          onTestRpc={() => setIsTestModalOpen(true)}
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      </div>

      {/* Announcement Banner - Hidden on swap tab */}
      {activeTab !== "swap" && (
        <div
          ref={setAnnouncementRef}
          className="fixed left-0 right-0 z-40 bg-gradient-to-r from-primary to-primary/80 border-b border-primary/50 hover:from-primary/90 hover:to-primary/70 transition-all backdrop-blur-sm"
          style={{ top: `${headerHeight}px` }}
        >
          <div className="container mx-auto px-4 py-1 text-center">
            <p className="text-primary-foreground text-sm">
              Make your first Fast swap on these{" "}
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
      )}

      {/* Content Area - Add padding to account for fixed headers */}
      <div className={cn(
        "container mx-auto py-4",
        activeTab === "swap" ? "px-0 pt-28 sm:pt-24" : "px-4 sm:px-0 pt-56 sm:pt-32"
      )}>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          {/* Genesis SBT Tab */}
          <TabsContent value="genesis">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Panel - SBT Display */}
              <div className="lg:col-span-3 space-y-6">
                <SBTDisplayCard
                  hasGenesisSBT={genesisSBT.hasGenesisSBT}
                  tokenId={genesisSBT.tokenId}
                  address={address}
                  isMounted={isMounted}
                />
              </div>

              {/* Right Panel - Tasks */}
              <div className="lg:col-span-9 space-y-6">
                {/* Fixed Title Section */}
                {/* <div
                  ref={setTitleSectionRef}
                  className="fixed left-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/50"
                  style={{ top: `${titleSectionTop}px` }}
                > */}
                <div className="container mx-auto py-4 px-0">
                  <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
                    <div>
                      <h1 className="text-3xl font-bold mb-2">Fast Miles</h1>
                      <p className="text-muted-foreground">
                        Complete tasks to earn miles. Your miles will carry into the official Fast
                        Miles System.
                      </p>
                    </div>
                    <ReferralsCard
                      referralLink={referralLink}
                      affiliateCode={affiliateCode}
                      isLoadingCode={isLoadingCode}
                      isConnected={isConnected}
                      onOpenModal={() => setIsReferralModalOpen(true)}
                    />
                  </div>
                </div>
                {/* </div> */}

                <OneTimeTasksAccordion
                  tasks={dashboardTasks.oneTimeTasks}
                  hasInitialized={userOnboarding.hasInitialized}
                  userOnboarding={userOnboarding.userOnboarding}
                  isConnected={isConnected}
                  address={address}
                  accordionValue={oneTimeTasksAccordionValue}
                  onAccordionChange={setOneTimeTasksAccordionValue}
                  onTaskComplete={dashboardTasks.handleTaskComplete}
                  onEmailTaskClick={() => emailDialog.setShowEmailDialog(true)}
                />

                <SwapEarnAccordion />

                <WeeklyActivitySection />
              </div>
            </div>
          </TabsContent>

          {/* Swap Tab */}
          <TabsContent value="swap" className="mt-0">
            <SwapForm />
          </TabsContent>
        </Tabs>
      </div>

      {/* Email Dialog */}
      <Dialog open={emailDialog.showEmailDialog} onOpenChange={emailDialog.setShowEmailDialog}>
        <DialogContent className="sm:max-w-md border-primary/50">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30">
                <Mail className="w-8 h-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-center text-xl">Enter Your Email</DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              Stay updated with Fast Protocol news and announcements
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={emailDialog.emailInput}
                onChange={(e) => {
                  emailDialog.setEmailInput(e.target.value)
                  if (emailDialog.emailError) {
                    emailDialog.clearError()
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleEmailSubmit()
                  }
                }}
                className={emailDialog.emailError ? "border-destructive" : ""}
              />
              {emailDialog.emailError && (
                <p className="text-sm text-destructive">{emailDialog.emailError}</p>
              )}
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={handleEmailSubmit}>
                Submit Email
              </Button>
              <Button variant="outline" onClick={() => emailDialog.reset()}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Transaction Feedback Modal */}
      <TransactionFeedbackModal
        isOpen={showFeedbackModal}
        walletAddress={address}
        onClose={() => setShowFeedbackModal(false)}
      />

      {/* Referral Modal */}
      <ReferralModal
        open={isReferralModalOpen}
        onOpenChange={(open) => {
          setIsReferralModalOpen(open)
          // Refresh affiliate code and link when modal closes
          if (!open) {
            setTimeout(() => {
              refreshAffiliateCode()
              refreshReferralLink()
            }, 500)
          }
        }}
      />

    </div>
  )
}

const DashboardPage = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}

export default DashboardPage
