"use client"

import { Suspense, useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { useAccount } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { Tabs, TabsContent } from "@/components/ui/tabs"
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
import { usePrefetchLeaderboard } from "@/hooks/use-leaderboard-data"
import { useDashboardTab } from "../DashboardTabContext"

// Components
import { SBTDisplayCard } from "@/components/dashboard/SBTDisplayCard"
import { ReferralsCard } from "@/components/dashboard/ReferralsCard"
import { OneTimeTasksAccordion } from "@/components/dashboard/OneTimeTasksAccordion"
import { SwapEarnAccordion } from "@/components/dashboard/SwapEarnAccordion"
import { UserMetricsSection } from "@/components/dashboard/UserMetricsSection"
import { PointsHUD } from "@/components/dashboard/PointsHUD"
import { WeeklyTasksSection } from "@/components/dashboard/WeeklyTasksSection"
import { ReferralsSection } from "@/components/dashboard/ReferralsSection"
import { PartnerQuestsSection } from "@/components/dashboard/PartnerQuestsSection"
import { OneTimeTasksSection } from "@/components/dashboard/OneTimeTasksSection"
import { SBTGatingModal } from "@/components/modals/SBTGatingModal"
import { TransactionFeedbackModal } from "@/components/modals/TransactionFeedbackModal"
import { ReferralModal } from "@/components/modals/ReferralModal"
import { EcosystemSetCarousel } from "@/components/dashboard/EcosystemSetsCarousel"

import type { TaskName } from "@/hooks/use-dashboard-tasks"

// Dashboard page content - uses shared (app) layout for header and RPC/network modals
const DashboardContent = () => {
  const searchParams = useSearchParams()
  const [showSBTGatingModal, setShowSBTGatingModal] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [oneTimeTasksAccordionValue, setOneTimeTasksAccordionValue] = useState<string | undefined>(
    "one-time-tasks"
  )
  const [isMounted, setIsMounted] = useState(false)
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false)

  const { isConnected, address, status } = useAccount()
  const { openConnectModal } = useConnectModal()
  const hasOpenedConnectModalRef = useRef(false)

  // Use DashboardTabContext from (app) layout for genesis/points tabs
  const { activeTab, setActiveTab } = useDashboardTab()

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

  // Prefetch leaderboard data for faster navigation
  const { prefetch: prefetchLeaderboard } = usePrefetchLeaderboard()

  // Handle tab change with SBT gating for Points tab
  const handleTabChange = (value: string) => {
    // Block access to Points if no Genesis SBT
    if (!genesisSBT.hasGenesisSBT && value === "points") {
      setShowSBTGatingModal(true)
      return
    }
    setActiveTab(value)
  }

  // Sync activeTab from URL on mount (DashboardTabContext handles this, but we need to respect SBT gating)
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && ["genesis", "points"].includes(tab)) {
      // Block access to Points if no Genesis SBT
      if (!genesisSBT.hasGenesisSBT && tab === "points") {
        return
      }
      setActiveTab(tab)
    }
  }, [searchParams, genesisSBT.hasGenesisSBT, setActiveTab])

  // Handle feedback modal from genesis SBT hook
  useEffect(() => {
    if (genesisSBT.shouldShowFeedbackModal) {
      setShowFeedbackModal(true)
      genesisSBT.markFeedbackShown()
    }
  }, [genesisSBT])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Prefetch leaderboard data when dashboard loads (debounced to avoid lag)
  useEffect(() => {
    if (isMounted) {
      // Delay prefetch to avoid blocking initial render
      const timeoutId = setTimeout(() => {
        prefetchLeaderboard(address)
      }, 500) // Wait 500ms after mount before prefetching
      return () => clearTimeout(timeoutId)
    }
  }, [isMounted, address, prefetchLeaderboard])

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

  // Handle email submission
  const handleEmailSubmit = () => {
    emailDialog.handleEmailSubmit(() => {
      dashboardTasks.handleTaskComplete("Enter Email" as TaskName)
    })
  }

  return (
    <>
      {/* Announcement Banner - dashboard specific, rendered in page content */}
      <div className="bg-gradient-to-r from-primary to-primary/80 border-b border-primary/50 hover:from-primary/90 hover:to-primary/70 transition-all">
        <div className="container mx-auto px-4 py-1 text-center">
          <p className="text-primary-foreground text-sm">
            🎉 You&apos;re all set. Make your first Fast swap on these{" "}
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

      {/* Content Area - layout provides paddingTop for header */}
      <div className="container mx-auto px-4 sm:px-4 py-4">
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

                <EcosystemSetCarousel />

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

                <hr />
                <UserMetricsSection address={address} />
                <hr />
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
        </Tabs>
      </div>

      {/* Email Dialog - dashboard specific */}
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

      {/* Transaction Feedback Modal - dashboard specific */}
      <TransactionFeedbackModal
        isOpen={showFeedbackModal}
        walletAddress={address}
        onClose={() => setShowFeedbackModal(false)}
      />

      {/* Referral Modal - dashboard specific */}
      <ReferralModal
        open={isReferralModalOpen}
        onOpenChange={(open) => {
          setIsReferralModalOpen(open)
          if (!open) {
            setTimeout(() => {
              refreshAffiliateCode()
              refreshReferralLink()
            }, 500)
          }
        }}
      />

      {/* SBT Gating Modal - dashboard specific */}
      <SBTGatingModal open={showSBTGatingModal} />
    </>
  )
}

// Wrap in Suspense for useSearchParams
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
