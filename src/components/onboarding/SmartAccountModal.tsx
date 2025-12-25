"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, ArrowRight } from "lucide-react"

interface SmartAccountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAcknowledged: () => void
}

/* ----------------------------- Shared Blocks ----------------------------- */

const WhatIsSmartAccount = () => (
  <div className="bg-muted/50 rounded-lg p-3 sm:p-4 space-y-2">
    <p className="text-sm font-medium text-foreground">What&apos;s a smart account?</p>
    <p className="text-sm text-muted-foreground leading-relaxed">
      A smart account is a wallet address upgraded to a smart contract, enabling advanced features
      like batching and permissions. Some of these features are not fully compatible with Fast RPC.
    </p>
  </div>
)

/* ----------------------------- Main Component ----------------------------- */

export const SmartAccountModal = ({
  open,
  onOpenChange,
  onAcknowledged,
}: SmartAccountModalProps) => {
  const [activeTab, setActiveTab] = useState("warning")

  const getTabMessage = () => {
    if (activeTab === "check") {
      return "Requires MetaMask."
    }
    if (activeTab === "video") {
      return "Requires MetaMask and Fast RPC disabled."
    }
    return null
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        // Prevent closing - user must click "Acknowledged"
        if (!open) return
      }}
    >
      <DialogContent
        hideClose
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="w-full h-full sm:h-auto sm:max-w-xl border-yellow-500/50
          max-h-[100vh] sm:max-h-[90vh]
          flex flex-col m-0 sm:m-4 rounded-none sm:rounded-lg
          inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] translate-x-0 translate-y-0 sm:translate-x-[-50%] sm:translate-y-[-50%]
          p-4 sm:p-6"
      >
        <DialogHeader className="flex-shrink-0 pb-2 sm:pb-0">
          <div className="flex items-start gap-2 sm:gap-3">
            {/* 1. Icon Container */}
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-yellow-500/10 flex-shrink-0">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
            </div>

            {/* 2. Text Column */}
            <div className="flex flex-col flex-1 min-w-0">
              <DialogTitle className="text-base sm:text-xl leading-tight text-left sm:text-left">
                Smart Account Information
              </DialogTitle>
              {getTabMessage() && (
                <div className="flex items-center sm:justify-start gap-1 mt-1.5 sm:mt-2">
                  <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {getTabMessage()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 overflow-hidden pt-0 sm:pt-4">
          <Tabs
            defaultValue="warning"
            value={activeTab}
            onValueChange={setActiveTab}
            className="h-full flex flex-col"
          >
            <TabsList className="grid grid-cols-3 flex-shrink-0 gap-1 sm:gap-2 mb-0 sm:mb-2">
              <TabsTrigger value="warning" className="text-xs sm:text-sm px-2 sm:px-3">
                Info
              </TabsTrigger>
              <TabsTrigger value="check" className="text-xs sm:text-sm px-2 sm:px-3">
                Check
              </TabsTrigger>
              <TabsTrigger value="video" className="text-xs sm:text-sm px-2 sm:px-3">
                Disable
              </TabsTrigger>
            </TabsList>

            {/* Warning Tab */}
            <TabsContent
              value="warning"
              className="mt-0 sm:mt-4 flex-1 overflow-y-auto flex flex-col justify-center sm:justify-start space-y-4 data-[state=inactive]:!hidden sm:data-[state=inactive]:!block"
            >
              <WhatIsSmartAccount />

              <p className="text-sm text-muted-foreground text-center">
                Ensure that your wallet is not a smart account.
              </p>
            </TabsContent>

            {/* Check Tab */}
            <TabsContent
              value="check"
              className="mt-3 sm:mt-4 flex-1 overflow-hidden flex flex-col items-center justify-center data-[state=inactive]:!hidden sm:data-[state=inactive]:!block"
            >
              <div className="flex justify-center items-center w-full h-full">
                <Image
                  src="/assets/smart-check.gif"
                  alt="Smart Check"
                  width={300}
                  height={200}
                  className="rounded-lg w-full h-full sm:h-auto sm:max-w-[300px] object-contain"
                  unoptimized
                />
              </div>
            </TabsContent>

            {/* Video Tab */}
            <TabsContent
              value="video"
              className="mt-3 sm:mt-4 flex-1 overflow-hidden flex flex-col items-center justify-center data-[state=inactive]:!hidden sm:data-[state=inactive]:!block"
            >
              <div className="flex justify-center items-center w-full h-full">
                <Image
                  src="/assets/smart-disable.gif"
                  alt="Smart Disable"
                  width={300}
                  height={200}
                  className="rounded-lg w-full h-full sm:h-auto sm:max-w-[300px] object-contain"
                  unoptimized
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="flex-shrink-0 border-t border-border mt-4 pt-4">
            <Button onClick={onAcknowledged} className="w-full">
              Acknowledged
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
