"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { RabbySteps } from "./rabby-steps"
import { BrowserWalletSteps } from "./browser-wallet-steps"
import { ProgrammaticSetupSteps } from "./programmatic-setup-steps"
import { useWalletInfo } from "@/hooks/use-wallet-info"
import { useAccount } from "wagmi"

interface NetworkSetupDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NetworkSetupDrawer({ open, onOpenChange }: NetworkSetupDrawerProps) {
  const { connector } = useAccount()
  const { walletName, walletIcon } = useWalletInfo(connector, true)

  // Determine wallet type for drawer content
  const isMetaMask = connector?.id?.toLowerCase().includes("metamask")
  const isRabby =
    walletName?.toLowerCase().includes("rabby") || connector?.id?.toLowerCase().includes("rabby")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 mb-2">
            {walletIcon && (
              <img
                src={walletIcon}
                alt={walletName}
                className="w-10 h-10 rounded object-contain"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = "none"
                }}
              />
            )}
            <span>Setup Instructions for {walletName}</span>
          </SheetTitle>
          <SheetDescription>
            Follow these steps to configure your wallet with Fast Protocol RPC.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          {isMetaMask ? (
            <ProgrammaticSetupSteps />
          ) : isRabby ? (
            <RabbySteps />
          ) : (
            <BrowserWalletSteps walletName={walletName} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
