"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"

interface WaitlistHeaderProps {
  title: string
  onBack: () => void
  backLabel?: string
}

export function WaitlistHeader({
  title,
  onBack,
  backLabel = "Back to Fast Protocol",
}: WaitlistHeaderProps) {
  return (
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
          <h1 className="text-muted-foreground font-bold">{title}</h1>
          <span className="w-px h-6 bg-border mx-1" />
          <Button variant="outline" size="sm" onClick={onBack} className="shrink-0">
            {backLabel}
          </Button>
        </div>
      </div>
    </header>
  )
}
