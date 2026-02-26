"use client"

import { useState } from "react"
import { useAccount } from "wagmi"
import { Copy } from "lucide-react"
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
    <div className="w-full space-y-6">
      {/* Waitlist Position */}
      <div className="rounded-xl border border-primary/20 bg-card/60 backdrop-blur-sm p-4 text-center">
        {isPositionLoading ? (
          <div className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Loading position...</span>
          </div>
        ) : position !== null ? (
          <>
            <p className="text-sm text-muted-foreground mb-1">Your position</p>
            <p className="text-3xl font-bold text-foreground">
              #{position}
              <span className="text-sm font-normal text-muted-foreground ml-2">of {total}</span>
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Position unavailable</p>
        )}
      </div>

      {/* Referral Section */}
      <div className="rounded-xl border border-primary/20 bg-card/60 backdrop-blur-sm p-4 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Share your referral link&mdash;when friends join, you both move up.
          </p>
        </div>

        {/* Referral link display + copy */}
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

        {/* Share on X */}
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

      {/* Fast RPC actions */}
      <div className="rounded-xl border border-primary/20 bg-card/60 backdrop-blur-sm p-4 flex items-start justify-between">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-foreground">Setup Fast RPC</h3>
          <p className="text-xs text-muted-foreground">Configure your wallet&apos;s RPC.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSetup}>
            Setup
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsTestOpen(true)}>
            Test
          </Button>
        </div>
      </div>

      {/* Back button — only shown when not handled by a parent header */}
      {onBack && (
        <Button
          variant="ghost"
          size="lg"
          className="w-full hover:bg-transparent hover:text-muted-foreground"
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
