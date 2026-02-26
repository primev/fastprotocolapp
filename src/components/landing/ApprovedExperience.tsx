"use client"

import Image from "next/image"
import { useAccount } from "wagmi"
import { Copy } from "lucide-react"
import { FaXTwitter } from "react-icons/fa6"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient"
import { useAffiliateCode } from "@/hooks/use-affiliate-code"

interface ApprovedExperienceProps {
  onStartSwapping: () => void
  onBack: () => void
}

export function ApprovedExperience({ onStartSwapping, onBack }: ApprovedExperienceProps) {
  const { isConnected } = useAccount()
  const { referralLink, isLoadingCode } = useAffiliateCode()

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink)
    toast.success("Referral link copied to clipboard!")
  }

  const handleShareOnX = () => {
    const tweet = `Just got early access to Fast Swap by @fast_protocol. Sub-50ms execution, MEV protection, guaranteed fills. Join here: ${referralLink}`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`, "_blank")
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-hidden">
      {/* Header — mirrors OnboardingHeader / AlreadyOnWaitlistMessage style */}
      <header className="border-b border-border/50 shrink-0">
        <div className="container mx-auto px-4 py-4 lg:py-3 flex items-center justify-between">
          <div className="relative">
            <Image
              src="/assets/fast-icon.png"
              alt="Fast Protocol"
              width={40}
              height={40}
              className="sm:hidden"
              quality={100}
              placeholder="empty"
            />
            <Image
              src="/assets/fast-protocol-logo-icon.png"
              alt="Fast Protocol"
              width={150}
              height={75}
              className="hidden sm:block"
              quality={100}
              placeholder="empty"
            />
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-muted-foreground font-bold">Early Access</h1>
            <span className="w-px h-6 bg-border mx-1" />
            <Button variant="outline" size="sm" onClick={onBack} className="shrink-0">
              Back to Fast Protocol
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center overflow-y-auto px-4">
        <div className="w-full max-w-lg mx-auto py-8 text-center">
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-xl font-medium text-foreground mb-2">
                You&apos;re pre-approved!
              </h1>
              <p className="text-muted-foreground">Your wallet is on the whitelist.</p>
            </div>

            {/* Referral Section */}
            <div className="rounded-xl border border-primary/20 bg-card/60 backdrop-blur-sm p-4 space-y-3 text-left">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Invite friends</h3>
                <p className="text-xs text-muted-foreground">
                  Share your referral link and earn rewards when friends start swapping.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-secondary/10 rounded-lg px-3 py-2 border border-border/50">
                <code className="text-xs truncate flex-1 text-foreground" title={referralLink}>
                  {isLoadingCode ? (
                    <span className="text-muted-foreground">Generating...</span>
                  ) : (
                    referralLink || (
                      <span className="text-muted-foreground">Connect wallet to get link</span>
                    )
                  )}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="group h-6 w-6 rounded-md flex-shrink-0 hover:bg-transparent p-1"
                  onClick={copyReferralLink}
                  disabled={!isConnected || !referralLink}
                  aria-label="Copy referral link"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Button>
              </div>

              <HoverBorderGradient
                onClick={handleShareOnX}
                disabled={!isConnected || !referralLink}
                aria-label="Share on X"
                containerClassName="w-full"
                className="flex items-center justify-center gap-2 w-full text-sm font-bold"
              >
                <span>Share on</span>
                <FaXTwitter className="h-4 w-4" />
              </HoverBorderGradient>
            </div>

            <Button variant="hero" size="lg" className="w-full" onClick={onStartSwapping}>
              Start swapping
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
