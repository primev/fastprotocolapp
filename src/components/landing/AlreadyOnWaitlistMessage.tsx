"use client"

import { useRouter } from "next/navigation"
import Image from "next/image"
import { useQueryClient } from "@tanstack/react-query"
import { useDisconnect } from "wagmi"
import { Button } from "@/components/ui/button"
import { AnimatedBackground } from "@/components/AnimatedBackground"

export function AlreadyOnWaitlistMessage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { disconnect } = useDisconnect()

  const handleBackToProtocol = () => {
    disconnect()
    router.push("/")
    void queryClient.invalidateQueries({ queryKey: ["whitelist"] })
    void queryClient.invalidateQueries({ queryKey: ["waitlist"] })
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background">
      <AnimatedBackground />
      <div className="relative z-10 w-full px-4 flex flex-col items-center justify-center text-center max-w-md mx-auto">
        <Image
          src="/assets/fast-protocol-logo-icon.png"
          alt="Fast Protocol"
          width={128}
          height={128}
          className="h-24 w-auto mb-6"
        />
        <h1 className="text-xl font-medium text-foreground mb-2">You&apos;re on the waitlist</h1>
        <p className="text-muted-foreground mb-8">We&apos;ll be in touch soon with next steps.</p>
        <Button variant="hero" size="lg" onClick={handleBackToProtocol}>
          Back to Fast Protocol
        </Button>
      </div>
    </div>
  )
}
