"use client"

import { useAccount } from "wagmi"
import { Copy, CheckCircle2, Users, ArrowRight } from "lucide-react"
import { FaXTwitter } from "react-icons/fa6"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient"
import { WaitlistHeader } from "@/components/landing/WaitlistHeader"
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
      <WaitlistHeader title="Early Access" onBack={onBack} />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] rounded-full bg-primary/[0.03] blur-3xl" />
      </div>

      <main className="relative flex-1 flex items-center justify-center overflow-y-auto px-4">
        <div className="w-full max-w-2xl mx-auto py-8 space-y-8">
          {/* Hero section */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/[0.05] text-primary text-xs font-semibold tracking-wide">
              <CheckCircle2 size={12} />
              Pre-approved
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              You&apos;re in
            </h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Your wallet is on the whitelist. Start swapping now or invite friends to earn referral
              rewards.
            </p>

            <Button variant="hero" size="lg" className="mt-2" onClick={onStartSwapping}>
              Start swapping
              <ArrowRight size={16} className="ml-1" />
            </Button>
          </div>

          {/* Decorative divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          </div>

          {/* Referral Section */}
          <div className="rounded-2xl border border-primary/20 bg-card/60 backdrop-blur-sm p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary shadow-inner">
                <Users size={16} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground leading-none mb-1">
                  Invite friends
                </h3>
                <p className="text-xs text-muted-foreground leading-snug">
                  Share your referral link and earn rewards when friends start swapping.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <div className="flex items-center gap-2 bg-secondary/10 rounded-lg px-3 py-2.5 border border-border/50 flex-1 min-w-0">
                <code
                  className="text-xs truncate flex-1 text-foreground/80 font-mono"
                  title={referralLink}
                >
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
                  className="group/copy h-7 w-7 rounded-md flex-shrink-0 hover:bg-primary/10 p-1 transition-colors"
                  onClick={copyReferralLink}
                  disabled={!isConnected || !referralLink}
                  aria-label="Copy referral link"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover/copy:text-primary transition-colors" />
                </Button>
              </div>

              <HoverBorderGradient
                onClick={handleShareOnX}
                disabled={!isConnected || !referralLink}
                aria-label="Share on X"
                containerClassName="sm:w-auto"
                className="flex items-center justify-center gap-2 text-sm font-bold px-6 whitespace-nowrap"
              >
                <span>Share on</span>
                <FaXTwitter className="h-4 w-4" />
              </HoverBorderGradient>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
