"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight } from "lucide-react"
import { Fuul } from "@fuul/sdk"
import { isAddress } from "viem"
import "@/lib/fuul"

function ReferralPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [referrerId, setReferrerId] = useState<string | null>(null)
  const [hasAccepted, setHasAccepted] = useState(false)
  const hasSentPageviewRef = useRef(false)

  // Referral tracking: send pageview if present and valid (address or affiliate code)
  useEffect(() => {
    const referralParam = searchParams.get("af")
    if (referralParam && !hasSentPageviewRef.current) {
      // Accept both addresses and affiliate codes
      // Addresses are 0x followed by 40 hex characters
      // Affiliate codes are alphanumeric with dashes
      const isValidAddress = isAddress(referralParam)
      const isValidCode = /^[a-zA-Z0-9-]+$/.test(referralParam) && referralParam.length <= 30

      if (isValidAddress || isValidCode) {
        setReferrerId(referralParam)
        Fuul.sendPageview("referral")
        hasSentPageviewRef.current = true
      }
    }
  }, [searchParams])

  const handleClaim = () => {
    if (referrerId) {
      router.push(`/claim/onboarding?af=${encodeURIComponent(referrerId)}`)
    } else {
      router.push("/claim/onboarding")
    }
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header with Logo */}
        <header className="border-b border-border/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 lg:py-3 flex items-center justify-between">
            <div className="relative">
              <Image
                src="/assets/fast-icon.png"
                alt="Fast Protocol"
                width={40}
                height={40}
                className="sm:hidden cursor-pointer"
                onClick={() => router.push("/")}
              />
              <Image
                src="/assets/fast-protocol-logo-icon.png"
                alt="Fast Protocol"
                width={150}
                height={75}
                className="hidden sm:block cursor-pointer"
                onClick={() => router.push("/")}
              />
            </div>
            <h1 className="text-muted-foreground font-bold">Referral</h1>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-[560px] mx-auto space-y-6">
            {/* Hero Section */}
            <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                You've been invited.
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground">
                Accept the referral and earn rewards.
              </p>
            </div>

            {/* Accept Button */}
            {!hasAccepted && (
              <div className="flex justify-center animate-in fade-in duration-500">
                <Button
                  variant="hero"
                  size="lg"
                  onClick={() => setHasAccepted(true)}
                  className="h-12 px-8 text-base hover:scale-[1.02] hover:shadow-md"
                >
                  Accept
                </Button>
              </div>
            )}

            {/* Show How It Works content after accepting */}
            {hasAccepted && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-xl">How referrals work</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-3 text-sm">
                      <li className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <span>You earn rewards when you swap on any Ethereum protocol</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <span>
                          <strong>
                            Your referrer earns 2% of points generated from your MEV-related swaps
                          </strong>
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <span>
                          You keep <strong>100% of your own rewards</strong>
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <span>No impact on execution or pricing</span>
                      </li>
                    </ul>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <p className="text-xs font-medium text-foreground">About MEV-related swaps</p>
                      <p className="text-xs text-muted-foreground">
                        MEV-related swaps refer to eligible trades where value is derived from
                        market execution efficiency. Referral rewards are calculated from internal
                        points, not taken from your trade.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Claim Button */}
                <Button
                  variant="hero"
                  size="lg"
                  onClick={handleClaim}
                  className="w-full h-12 text-base hover:scale-[1.02] hover:shadow-md"
                >
                  Claim
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function ReferralPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <ReferralPageContent />
    </Suspense>
  )
}
