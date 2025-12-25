"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail } from "lucide-react"

interface EmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  emailInput: string
  emailError: string
  isLoading: boolean
  onEmailChange: (email: string) => void
  onEmailErrorChange: (error: string) => void
  onSubmit: () => void
  onCancel: () => void
}

export const EmailDialog = ({
  open,
  onOpenChange,
  emailInput,
  emailError,
  isLoading,
  onEmailChange,
  onEmailErrorChange,
  onSubmit,
  onCancel,
}: EmailDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-full sm:h-auto sm:max-w-md border-primary/50 max-h-[100vh] sm:max-h-[90vh] flex flex-col m-0 sm:m-4 rounded-none sm:rounded-lg inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] translate-x-0 translate-y-0 sm:translate-x-[-50%] sm:translate-y-[-50%] p-4 sm:p-6">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30">
              <Mail className="w-8 h-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">Enter Your Email</DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            Stay updated with Fast Protocol news and announcements
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={emailInput}
              onChange={(e) => {
                onEmailChange(e.target.value)
                if (emailError) {
                  onEmailErrorChange("")
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSubmit()
                }
              }}
              className={emailError ? "border-destructive" : ""}
              disabled={isLoading}
            />
            {emailError && <p className="text-sm text-destructive">{emailError}</p>}
          </div>
          <div className="flex gap-3">
            <Button className="flex-1" onClick={onSubmit} disabled={isLoading}>
              {isLoading ? "Submitting..." : "Submit Email"}
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
