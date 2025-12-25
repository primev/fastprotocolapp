"use client"

import { useState, useEffect, Suspense } from "react"
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
import { PointsHUD } from "@/components/dashboard/PointsHUD"
import { WeeklyTasksSection } from "@/components/dashboard/WeeklyTasksSection"
import { ReferralsSection } from "@/components/dashboard/ReferralsSection"
import { PartnerQuestsSection } from "@/components/dashboard/PartnerQuestsSection"
import { OneTimeTasksSection } from "@/components/dashboard/OneTimeTasksSection"
import { LeaderboardTable } from "@/components/dashboard/LeaderboardTable"
import { SBTGatingModal } from "@/components/modals/SBTGatingModal"
import { TransactionFeedbackModal } from "@/components/modals/TransactionFeedbackModal"
import { ReferralModal } from "@/components/modals/ReferralModal"
import { RPCTestModal } from "@/components/network-checker"
import { MetaMaskToggleModal } from "@/components/onboarding/MetaMaskToggleModal"
import { AddRpcModal } from "@/components/onboarding/AddRpcModal"
import { BrowserWalletStepsModal } from "@/components/onboarding/BrowserWalletStepsModal"

// Utils
import { isMetaMaskWallet, isRabbyWallet } from "@/lib/onboarding-utils"
import { NETWORK_CONFIG } from "@/lib/network-config"
import type { TaskName } from "@/hooks/use-dashboard-tasks"

const DashboardContent = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [points] = useState(0)
  const [activeTab, setActiveTab] = useState("genesis")
  const [showSBTGatingModal, setShowSBTGatingModal] = useState(false)
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
    if (tab && ["genesis", "points", "leaderboard"].includes(tab)) {
      // Block access to Points and Leaderboard if no Genesis SBT
      if (!genesisSBT.hasGenesisSBT && (tab === "points" || tab === "leaderboard")) {
        setActiveTab("genesis")
        return
      }
      setActiveTab(tab)
    }
  }, [searchParams, genesisSBT.hasGenesisSBT])

  const handleTabChange = (value: string) => {
    // Block access to Points and Leaderboard if no Genesis SBT
    if (!genesisSBT.hasGenesisSBT && (value === "points" || value === "leaderboard")) {
      setShowSBTGatingModal(true)
      return
    }
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

  return (
    <div className="min-h-screen bg-background relative overflow-hidden px-2 sm:px-0">
      <div className="relative z-10">
        <DashboardHeader
          points={points}
          isConnected={isConnected}
          status={status}
          isMounted={isMounted}
          isMetaMask={isMetaMask}
          onAddNetwork={handleAddNetwork}
          onRpcSetup={handleRpcSetup}
          onTestRpc={() => setIsTestModalOpen(true)}
        />

        {/* Announcement Banner */}
        <div className="bg-gradient-to-r from-primary to-primary/80 border-b border-primary/50 hover:from-primary/90 hover:to-primary/70 transition-all">
          <div className="container mx-auto px-4 py-1 text-center">
            <p className="text-primary-foreground text-sm">
              🎉 You're all set for the miles program kickoff! In the meantime, make your first Fast
              swap on these{" "}
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

        {/* Tabs */}
        <main className="container mx-auto px-0 sm:px-4 py-4">
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
            <TabsList className="hidden md:grid w-full max-w-xl mx-auto grid-cols-2">
              <TabsTrigger value="genesis" className="text-base">
                Genesis SBT
              </TabsTrigger>
              <TabsTrigger value="points" className="text-base" disabled>
                Miles
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-muted/80 text-muted-foreground text-xs font-semibold border border-border">
                  Coming Soon
                </span>
              </TabsTrigger>
              {/* <TabsTrigger value="leaderboard" className="text-base" disabled>
                Leaderboard
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-muted/80 text-muted-foreground text-xs font-semibold border border-border">
                  Coming Soon
                </span>
              </TabsTrigger> */}
            </TabsList>

            {/* Genesis SBT Tab */}
            <TabsContent value="genesis">
              <div className="grid lg:grid-cols-12 gap-8">
                {/* Left Panel - SBT Display */}
                <div className="lg:col-span-3 space-y-6">
                  <SBTDisplayCard
                    hasGenesisSBT={genesisSBT.hasGenesisSBT}
                    tokenId={genesisSBT.tokenId}
                    address={address}
                    isMounted={isMounted}
                  />

                  <ReferralsCard
                    referralLink={referralLink}
                    affiliateCode={affiliateCode}
                    isLoadingCode={isLoadingCode}
                    isConnected={isConnected}
                    onOpenModal={() => setIsReferralModalOpen(true)}
                  />
                </div>

                {/* Right Panel - Tasks */}
                <div className="lg:col-span-9 space-y-6">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">Fast Miles</h1>
                    <p className="text-muted-foreground">
                      Complete tasks to earn miles. Your miles will carry into the official Fast
                      Miles System.
                    </p>
                  </div>

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

            {/* Points Tab */}
            <TabsContent value="points" className="space-y-8">
              <PointsHUD
                season="Season 1"
                points={0}
                rank={0}
                referrals={0}
                volume={0}
                hasGenesisSBT={false}
                hasFastRPC={false}
              />

              <WeeklyTasksSection transactions={0} volume={0} />

              <ReferralsSection
                referralLink={referralLink}
                successfulReferrals={0}
                weeklyLimit={100}
              />

              <PartnerQuestsSection />

              <OneTimeTasksSection tasks={dashboardTasks.oneTimeTasks} />

              {/* Bottom Banner */}
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 text-center">
                <p className="text-sm font-medium">
                  ⚡ Fast Points earned in Season 1 will carry into the official Fast Points System.
                </p>
              </div>
            </TabsContent>

            {/* Leaderboard Tab */}
            <TabsContent value="leaderboard">
              <LeaderboardTable />
            </TabsContent>
          </Tabs>
        </main>
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

      {/* SBT Gating Modal */}
      <SBTGatingModal open={showSBTGatingModal} />
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
