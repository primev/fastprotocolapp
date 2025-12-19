"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader } from "@/components/ui/dialog"
import { Check } from "lucide-react"

interface MetaMaskToggleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

export const MetaMaskToggleModal = ({
  open,
  onOpenChange,
  onComplete,
}: MetaMaskToggleModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          w-full h-full sm:h-auto sm:max-w-md border-primary/50 
          max-h-[100vh] sm:max-h-[90vh] !flex !flex-col m-0 sm:m-4 
          rounded-none sm:rounded-lg inset-0 sm:inset-auto 
          sm:left-[50%] sm:top-[50%] translate-x-0 translate-y-0 
          sm:translate-x-[-50%] sm:translate-y-[-50%] p-4 sm:p-6
        "
      >
        {/* Modal Header */}
        <DialogHeader className="flex-shrink-0">
          <DialogDescription className="text-center text-base sm:text-lg pt-2">
            Switch to <span className="font-semibold text-primary">FastRPC</span> under{" "}
            <span className="font-semibold">Ethereum</span> in MetaMask network settings
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto -mx-4 sm:mx-0 px-0 sm:px-0 pt-4 flex items-center justify-center">
          <div className="w-full flex justify-center">
            <div className="w-full sm:w-auto max-w-full flex justify-center">
              <Image
                src="/assets/Toggle-Metamask.gif"
                alt="Toggle MetaMask Network"
                width={300}
                height={200}
                className="rounded-lg object-contain w-full max-w-[400px] h-auto"
                unoptimized
                style={{
                  maxHeight: "60vh",
                  width: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="flex-shrink-0 pt-4 border-t border-border mt-4 -mx-4 sm:mx-0 px-4 sm:px-0">
          <Button className="w-full" onClick={onComplete}>
            <Check className="w-4 h-4 mr-2" />
            Mark as Completed
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
