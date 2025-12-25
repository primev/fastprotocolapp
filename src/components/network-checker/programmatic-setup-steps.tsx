"use client"

import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { METAMASK_VIDEO_URL } from "@/lib/constants"
import { useNetworkInstallation } from "@/hooks/use-network-installation"

export function ProgrammaticSetupSteps() {
  const { isInstalling, install } = useNetworkInstallation()
  return (
    <div className="space-y-6">
      {/*Automatically add network */}
      <div className="flex gap-4 items-start">
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm bg-primary/20 text-primary">
          1
        </div>
        <div className="flex-1 space-y-2">
          <p className="font-medium">Automatically add network</p>
          <p className="text-sm text-muted-foreground">
            Add the Fast Protocol network configuration to your wallet automatically.
          </p>
          <div className="flex justify-end">
            <Button onClick={install} disabled={isInstalling} size="sm" className="mt-2">
              {isInstalling ? "Installing..." : "Add Network"}
            </Button>
          </div>
        </div>
      </div>

      {/* Important: Switch to network */}
      <div className="pt-3 border-t border-border">
        <div className="relative flex gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
          <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground mb-1">
              Important: Switch to the RPC after adding
            </p>
            <p className="text-sm text-muted-foreground">
              The RPC will be added to your wallet automatically, but you’ll still need to manually
              switch to the new network before you can test the connection. Most wallets require you
              to actively confirm or select the network change. Please follow the video instructions
              below, which walk you through the steps to locate the new RPC in your wallet and
              switch over to it. Once you’ve switched networks, you’ll be ready to proceed with
              testing.
            </p>
          </div>
        </div>
      </div>

      {/* Video Media Window */}
      <div className="flex gap-4 items-start">
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm bg-primary/20 text-primary">
          2
        </div>
        <div className="space-y-2 pt-3 border-t border-border">
          <h3 className="font-semibold text-sm mb-2">Video Instructions</h3>
          <div className="w-full rounded-lg overflow-hidden">
            <video
              src={METAMASK_VIDEO_URL}
              controls
              className="w-full aspect-video"
              preload="metadata"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </div>
    </div>
  )
}
