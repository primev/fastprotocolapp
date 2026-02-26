"use client"

import { useState } from "react"
import { useAccount } from "wagmi"
import { TrendingUp, Copy, Users, Wifi } from "lucide-react"
import { FaXTwitter } from "react-icons/fa6"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient"
import { RPCTestModal } from "@/components/network-checker/rpc-test-modal"
import { MetaMaskToggleModal } from "@/components/onboarding/MetaMaskToggleModal"
import { AddRpcModal } from "@/components/onboarding/AddRpcModal"
import { BrowserWalletStepsModal } from "@/components/onboarding/BrowserWalletStepsModal"
import { useAffiliateCode } from "@/hooks/use-affiliate-code"
import { useGateStatus } from "@/hooks/use-gate-status"
import { useWalletInfo } from "@/hooks/use-wallet-info"
import { isMetaMaskWallet, isRabbyWallet } from "@/lib/onboarding-utils"

interface WaitlistExperienceProps {
  onBack?: () => void
}

export function WaitlistExperience({ onBack }: WaitlistExperienceProps) {
  const { isConnected, connector } = useAccount()
  const { walletName, walletIcon } = useWalletInfo(connector, isConnected)
  const isMetaMask = isMetaMaskWallet(connector)
  const isRabby = isRabbyWallet(connector)

  const [isMetaMaskModalOpen, setIsMetaMaskModalOpen] = useState(false)
  const [isAddRpcModalOpen, setIsAddRpcModalOpen] = useState(false)
  const [isBrowserWalletModalOpen, setIsBrowserWalletModalOpen] = useState(false)
  const [isTestOpen, setIsTestOpen] = useState(false)

  const handleSetup = () => {
    if (isMetaMask) setIsMetaMaskModalOpen(true)
    else if (isRabby) setIsAddRpcModalOpen(true)
    else setIsBrowserWalletModalOpen(true)
  }
  const { referralLink, isLoadingCode } = useAffiliateCode()
  const { position, total, isLoading: isPositionLoading } = useGateStatus()

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink)
    toast.success("Referral link copied to clipboard!")
  }

  const handleShareOnX = () => {
    const tweet = `I just applied for early access to Fast Swap by @fast_protocol. Refer with my link, and we both move up: ${referralLink}`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`, "_blank")
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Waitlist Position — leaderboard style — spans 3 cols */}
        <div className="md:col-span-3 relative overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.03] backdrop-blur-sm group hover:bg-primary/[0.05] transition-colors">
          {/* Podium accent */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-10 rounded-full bg-primary/60 blur-[1px] transition-all duration-500 group-hover:h-14 group-hover:shadow-[0_0_12px_rgba(var(--primary-rgb),0.4)]" />

          <div className="flex items-center justify-between px-5 py-5 h-full">
            {isPositionLoading ? (
              <div className="flex items-center justify-center gap-2 w-full">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground">Loading position...</span>
              </div>
            ) : position !== null ? (
              <>
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-primary/10 rounded-xl text-primary shadow-inner">
                    <TrendingUp size={20} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-primary/50 uppercase tracking-widest">
                      Waitlist Position
                    </span>
                    <span className="text-3xl sm:text-4xl font-black tabular-nums leading-none tracking-tight text-primary">
                      #{position}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-wider">
                    Total
                  </span>
                  <span className="text-sm font-black tabular-nums text-muted-foreground/50">
                    {total}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground w-full text-center">
                Position unavailable
              </p>
            )}
          </div>
        </div>

        {/* Fast RPC actions — spans 2 cols */}
        <div className="md:col-span-2 rounded-2xl border border-white/5 bg-card/40 backdrop-blur-sm p-5 flex flex-col justify-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/5 rounded-lg text-muted-foreground">
              <Wifi size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground leading-none mb-1">Fast RPC</h3>
              <p className="text-xs text-muted-foreground">Configure your wallet&apos;s RPC.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={handleSetup}>
              Setup
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setIsTestOpen(true)}
            >
              Test
            </Button>
          </div>
        </div>

        {/* Referral Section — full width */}
        <div className="md:col-span-5 rounded-2xl border border-primary/20 bg-card/60 backdrop-blur-sm p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary shadow-inner">
              <Users size={16} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground leading-none mb-1">
                Referral Code
              </h3>
            </div>
          </div>

          {/* Referral link + copy + share row */}
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

      {/* Back button — only shown when not handled by a parent header */}
      {onBack && (
        <Button
          variant="ghost"
          size="lg"
          className="w-full mt-4 hover:bg-transparent hover:text-muted-foreground"
          onClick={onBack}
        >
          Back to Fast Protocol
        </Button>
      )}

      <MetaMaskToggleModal
        open={isMetaMaskModalOpen}
        onOpenChange={setIsMetaMaskModalOpen}
        onComplete={() => setIsMetaMaskModalOpen(false)}
      />
      <AddRpcModal
        open={isAddRpcModalOpen}
        onOpenChange={setIsAddRpcModalOpen}
        walletName={walletName}
        walletIcon={walletIcon}
        isMetaMask={isMetaMask}
        onComplete={() => setIsAddRpcModalOpen(false)}
      />
      <BrowserWalletStepsModal
        open={isBrowserWalletModalOpen}
        onOpenChange={setIsBrowserWalletModalOpen}
        walletName={walletName}
        walletIcon={walletIcon}
        onComplete={() => setIsBrowserWalletModalOpen(false)}
      />
      <RPCTestModal
        open={isTestOpen}
        onOpenChange={setIsTestOpen}
        onConfirm={() => setIsTestOpen(false)}
        onClose={() => setIsTestOpen(false)}
      />
    </div>
  )
}
