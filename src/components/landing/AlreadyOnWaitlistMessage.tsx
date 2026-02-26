"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { WaitlistExperience } from "@/components/landing/WaitlistExperience"

interface AlreadyOnWaitlistMessageProps {
  onBack: () => void
}

export function AlreadyOnWaitlistMessage({ onBack }: AlreadyOnWaitlistMessageProps) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-hidden">
      {/* Header — mirrors OnboardingHeader style */}
      <header className="border-b border-border/50 shrink-0">
        <div className="container mx-auto px-4 py-4 lg:py-3 flex items-center justify-between">
          <div className="relative">
            <Image
              src="/assets/fast-icon.png"
              alt="Fast Protocol"
              width={40}
              height={40}
              className="sm:hidden"
              quality={100}
              placeholder="empty"
            />
            <Image
              src="/assets/fast-protocol-logo-icon.png"
              alt="Fast Protocol"
              width={150}
              height={75}
              className="hidden sm:block"
              quality={100}
              placeholder="empty"
            />
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-muted-foreground font-bold">Waitlist</h1>
            <span className="w-px h-6 bg-border mx-1" />
            <Button variant="outline" size="sm" onClick={onBack} className="shrink-0">
              Back to Fast Protocol
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center overflow-y-auto px-4">
        <div className="w-full max-w-lg mx-auto py-8">
          <WaitlistExperience />
        </div>
      </main>
    </div>
  )
}
