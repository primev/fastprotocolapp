"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Award, Zap } from "lucide-react"
import { useRouter } from "next/navigation"

interface SBTGatingModalProps {
  open: boolean
}

export const SBTGatingModal = ({ open }: SBTGatingModalProps) => {
  const router = useRouter()

  const handleMintClick = () => {
    router.push("/claim/onboarding")
  }

  return (
    <Dialog open={open} onOpenChange={() => {}} modal>
      <DialogContent
        className="sm:max-w-md border-primary/50 glow-border"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center glow-border">
              <Award className="w-8 h-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">Fast Genesis SBT Required</DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            You must mint your Genesis SBT to access the Fast Points System and Season 1
            leaderboard.
          </DialogDescription>
        </DialogHeader>
        <div className="pt-4">
          <Button className="w-full" size="lg" onClick={handleMintClick}>
            <Zap className="w-4 h-4 mr-2" />
            Mint Genesis SBT
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
