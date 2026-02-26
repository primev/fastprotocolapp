"use client"

import { Clock } from "lucide-react"
import { WaitlistHeader } from "@/components/landing/WaitlistHeader"
import { WaitlistExperience } from "@/components/landing/WaitlistExperience"

interface AlreadyOnWaitlistMessageProps {
  onBack: () => void
}

export function AlreadyOnWaitlistMessage({ onBack }: AlreadyOnWaitlistMessageProps) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-hidden">
      <WaitlistHeader title="Waitlist" onBack={onBack} />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/[0.03] blur-3xl" />
      </div>

      <main className="relative flex-1 flex items-center justify-center overflow-y-auto px-4">
        <div className="w-full max-w-2xl mx-auto py-8 space-y-8">
          {/* Hero status */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/[0.05] text-primary text-xs font-semibold tracking-wide">
              <Clock size={12} />
              Pending review
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              You&apos;re on the waitlist
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Share your link to move up. When a friend joins through your referral, you both climb
              the queue.
            </p>
          </div>

          {/* Decorative divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          </div>

          <WaitlistExperience />
        </div>
      </main>
    </div>
  )
}
