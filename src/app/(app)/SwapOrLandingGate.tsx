"use client"

import { useAccount } from "wagmi"
import { FEATURE_FLAGS } from "@/lib/feature-flags"
import { useWhitelist } from "@/hooks/use-whitelist"
import { useWaitlist } from "@/hooks/use-waitlist"
import { Hero } from "@/components/swap/HeroSection"
import { AnimatedBackgroundOrbs } from "@/components/swap/OrbAnimatedBackground"
import { SwapForm } from "@/components/swap/SwapForm"
import LandingPage from "@/components/landing/Page"
import { EarlyAccessForm } from "@/components/landing/EarlyAccessForm"
import { AlreadyOnWaitlistMessage } from "@/components/landing/AlreadyOnWaitlistMessage"

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
  const { swapPrivateMode } = FEATURE_FLAGS
  const { isConnected, address } = useAccount()
  const { isWhitelisted, isLoading: isWhitelistLoading } = useWhitelist()
  const { onWaitlist, isLoading: isWaitlistLoading } = useWaitlist()

  if (!swapPrivateMode) {
    return <SwapContent />
  }

  if (isWhitelistLoading || isWaitlistLoading) {
    return (
      <div className="relative flex min-h-[60vh] items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const canSwap = isWhitelisted && onWaitlist
  if (canSwap) {
    return <SwapContent />
  }

  if (isConnected && address) {
    if (onWaitlist) {
      return <AlreadyOnWaitlistMessage />
    }
    return <EarlyAccessForm initialWalletAddress={address} />
  }

  return <LandingPage />
}
