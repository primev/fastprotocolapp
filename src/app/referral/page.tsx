"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, CheckCircle2, Loader2, Wallet, ShieldCheck } from "lucide-react"
import { Fuul } from "@fuul/sdk"
import { isAddress } from "viem"
import { useAccount } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import "@/lib/fuul"
import { ReferralPageSkeleton } from "@/components/referral/ReferralPageSkeleton"

type RegistrationStatus = "idle" | "checking" | "already_registered" | "registered"

function ReferralPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isConnected, address } = useAccount()
  const { openConnectModal } = useConnectModal()

  const [referrerId, setReferrerId] = useState<string | null>(null)
  const [status, setStatus] = useState<RegistrationStatus>("idle")
  const [existingReferrer, setExistingReferrer] = useState<string | null>(null)

  const hasSentPageviewRef = useRef(false)
  const hasPendingRegistrationRef = useRef(false)
  const hasHandledConnectionRef = useRef(false)

  // Parse referrer from URL, persist to localStorage, fire pageview to establish tracking_id ↔ affiliate_id
  useEffect(() => {
    const referralParam = searchParams.get("af")
    if (!referralParam) return

    const isValidAddress = isAddress(referralParam)
    const isValidCode = /^[a-zA-Z0-9-]+$/.test(referralParam) && referralParam.length <= 30

    if (isValidAddress || isValidCode) {
      setReferrerId(referralParam)
      localStorage.setItem("fuul.affiliate_ref", referralParam)

      if (!hasSentPageviewRef.current) {
        Fuul.sendPageview("referral")
        hasSentPageviewRef.current = true
      }
    }
  }, [searchParams])

  const runRegistration = async (walletAddress: string) => {
    if (hasHandledConnectionRef.current) return
    setStatus("checking")
    hasHandledConnectionRef.current = true

    // Check localStorage first — written on first successful registration
    const registeredKey = `fuul.registered_${walletAddress.toLowerCase()}`
    if (localStorage.getItem(registeredKey)) {
      setStatus("already_registered")
      return
    }

    // Check Fuul API for existing referrer
    try {
      const referrerData = await Fuul.getUserReferrer({
        user_identifier: walletAddress,
        user_identifier_type: "evm_address",
      })

      if (referrerData?.referrer_identifier) {
        setExistingReferrer(referrerData.referrer_identifier)
        localStorage.setItem(registeredKey, "true")
        setStatus("already_registered")
        return
      }
    } catch {
      // Not yet registered, continue
    }

    // Send connect_wallet event — ties this wallet to the tracking_id that
    // already has the affiliate_id from the sendPageview call above
    try {
      const trackingId = localStorage.getItem("fuul.tracking_id")
      if (trackingId) {
        await fetch("/api/fuul/identify-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: walletAddress,
            identifierType: "evm_address",
            trackingId,
            accountChainId: 1,
          }),
        })
      }
      localStorage.setItem(registeredKey, "true")
      setStatus("registered")
    } catch (e) {
      console.error("Registration failed:", e)
      setStatus("idle")
      hasHandledConnectionRef.current = false
    }
  }

  // After user clicks register and the wallet modal completes, run registration
  useEffect(() => {
    if (!isConnected || !address || !hasPendingRegistrationRef.current) return
    runRegistration(address)
  }, [isConnected, address])

  const shortenAddress = (addr: string) =>
    isAddress(addr) ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col min-h-screen">
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
            <h1 className="text-muted-foreground font-bold">Referral Registration</h1>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-[560px] mx-auto space-y-6">
            {/* Checking */}
            {status === "checking" && (
              <div className="text-center space-y-4 animate-in fade-in duration-300">
                <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
                <p className="text-muted-foreground">Checking registration status...</p>
              </div>
            )}

            {/* Already registered */}
            {status === "already_registered" && (
              <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CheckCircle2 className="w-14 h-14 text-primary mx-auto" />
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold">Already Registered</h1>
                  <p className="text-muted-foreground">
                    Your wallet is already linked to a referrer.
                  </p>
                  {existingReferrer && (
                    <p className="text-sm font-mono text-primary pt-1">
                      {shortenAddress(existingReferrer)}
                    </p>
                  )}
                </div>
                <Button
                  variant="hero"
                  size="lg"
                  onClick={() => router.push("/")}
                  className="h-12 px-8 hover:scale-[1.02] hover:shadow-md"
                >
                  Continue to Swap
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            )}

            {/* Registration complete */}
            {status === "registered" && (
              <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ShieldCheck className="w-14 h-14 text-primary mx-auto" />
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold">Registration Complete</h1>
                  <p className="text-muted-foreground">Your wallet is linked to your referrer.</p>
                  {referrerId && (
                    <p className="text-sm font-mono text-primary pt-1">
                      Referred by {shortenAddress(referrerId)}
                    </p>
                  )}
                </div>
                <Button
                  variant="hero"
                  size="lg"
                  onClick={() => router.push("/")}
                  className="w-full h-12 text-base hover:scale-[1.02] hover:shadow-md"
                >
                  Swap Now
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            )}

            {/* Idle — main registration view */}
            {status === "idle" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center space-y-3">
                  <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
                    You've been invited.
                  </h1>
                  <p className="text-lg text-muted-foreground">
                    Connect your wallet to register your referral.
                  </p>
                </div>

                <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
                  <CardContent className="pt-6 space-y-4">
                    {referrerId && (
                      <div className="flex items-center justify-between py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Referred by</span>
                        <span className="text-sm font-mono text-primary">
                          {shortenAddress(referrerId)}
                        </span>
                      </div>
                    )}
                    <ul className="space-y-3 text-sm">
                      <li className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <span>
                          <strong>One-time registration.</strong> Connecting your wallet links you
                          to this referrer.
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <span>
                          Your referrer earns{" "}
                          <strong>2% of miles from your MEV-related swaps.</strong>
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <span>
                          You keep <strong>100% of your own rewards.</strong> No impact on execution
                          or pricing.
                        </span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Button
                  variant="hero"
                  size="lg"
                  onClick={() => {
                    hasPendingRegistrationRef.current = true
                    if (isConnected && address) {
                      runRegistration(address)
                    } else {
                      openConnectModal?.()
                    }
                  }}
                  className="w-full h-12 text-base hover:scale-[1.02] hover:shadow-md"
                >
                  <Wallet className="w-5 h-5" />
                  Connect Wallet to Register
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
    <Suspense fallback={<ReferralPageSkeleton />}>
      <ReferralPageContent />
    </Suspense>
  )
}
