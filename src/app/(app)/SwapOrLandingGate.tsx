"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { FEATURE_FLAGS } from "@/lib/config/feature-flags"
import { useGateStatus, getCachedApproval } from "@/hooks/use-gate-status"
import { useGateView } from "./GateViewContext"
import { Hero } from "@/components/swap/HeroSection"
import { AnimatedBackgroundOrbs } from "@/components/swap/OrbAnimatedBackground"
import { SwapForm } from "@/components/swap/SwapForm"
import LandingPage from "@/components/landing/Page"
import { AlreadyOnWaitlistMessage } from "@/components/landing/AlreadyOnWaitlistMessage"
import { ApprovedExperience } from "@/components/landing/ApprovedExperience"

type GateView = "landing" | "approved" | "waitlist" | "swap"

function SwapContent() {
  return (
    <div className="relative flex flex-col items-center justify-start px-4 xs:pt-6 pb-4">
      <AnimatedBackgroundOrbs />
      <Hero />
      <SwapForm />
    </div>
  )
}

export function SwapOrLandingGate() {
  const router = useRouter()
  const { swapPrivateMode } = FEATURE_FLAGS
  const { isConnected, address } = useAccount()
  const {
    isPreApproved,
    onWaitlist,
    acceptedInvite,
    isLoading: isCheckingAccess,
    setAcceptedInvite,
    invalidate,
  } = useGateStatus()
  const { enterSwap, resetGate } = useGateView()
  const [view, setView] = useState<GateView>("landing")
  // True when user clicked the button while disconnected — auto-proceeds after wallet connects
  const [earlyAccessIntended, setEarlyAccessIntended] = useState(false)
  // True once the initial sessionStorage check has run. Until then we
  // suppress all rendering so the landing page never flashes for
  // returning approved users.
  const [ready, setReady] = useState(false)

  // Helper: transition to swap and tell the layout to show the app header
  const goToSwap = () => {
    enterSwap()
    setView("swap")
  }

  // On mount, check sessionStorage BEFORE rendering any content.
  // If the user has a cached approval, jump straight to swap on the
  // very first post-mount render — no landing page flash, no API call.
  useEffect(() => {
    if (address && getCachedApproval(address)) {
      goToSwap()
    }
    setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After connecting + checks resolve, proceed automatically if user had clicked the button
  useEffect(() => {
    if (!earlyAccessIntended || !isConnected || isCheckingAccess) return
    setEarlyAccessIntended(false)
    if (isPreApproved && acceptedInvite) {
      goToSwap()
    } else if (isPreApproved) {
      setView("approved")
    } else if (onWaitlist) {
      setView("waitlist")
    } else {
      router.push("/early-access")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    earlyAccessIntended,
    isConnected,
    isCheckingAccess,
    isPreApproved,
    acceptedInvite,
    onWaitlist,
    router,
  ])

  // Reset all early-access state when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setView("landing")
      setEarlyAccessIntended(false)
      resetGate()
      invalidate()
    }
  }, [isConnected, resetGate, invalidate])

  const handleStartSwapping = () => {
    goToSwap()
    setAcceptedInvite()
    // Fire-and-forget — update the sheet in the background
    if (address) {
      fetch("/api/waitlist/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: address }),
      }).catch(() => {})
    }
  }

  if (!swapPrivateMode) {
    return <SwapContent />
  }

  // Suppress all rendering until the mount effect has checked
  // sessionStorage. This is a single invisible frame (~16ms) that
  // prevents the landing page from flashing for returning users
  // who already have a cached approval.
  if (!ready) {
    return null
  }

  if (view === "swap") {
    return <SwapContent />
  }

  if (view === "approved") {
    return (
      <ApprovedExperience onStartSwapping={handleStartSwapping} onBack={() => setView("landing")} />
    )
  }

  if (view === "waitlist") {
    return <AlreadyOnWaitlistMessage onBack={() => setView("landing")} />
  }

  const handleEarlyAccessClick = () => {
    if (isCheckingAccess) return
    if (!isConnected) {
      // Wallet not connected yet — flag intent, Page.tsx will open the connect modal
      setEarlyAccessIntended(true)
      return
    }
    if (isPreApproved && acceptedInvite) {
      goToSwap()
    } else if (isPreApproved) {
      setView("approved")
    } else if (onWaitlist) {
      setView("waitlist")
    } else {
      router.push("/early-access")
    }
  }

  return (
    <LandingPage
      onEarlyAccessClick={handleEarlyAccessClick}
      isCheckingAccess={isCheckingAccess || (earlyAccessIntended && isConnected)}
      hasAccess={isConnected && isPreApproved}
    />
  )
}
