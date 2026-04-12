"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAccount } from "wagmi"
import { isAddress } from "viem"
import { toast } from "sonner"
import { Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlreadyOnWaitlistMessage } from "@/components/landing/AlreadyOnWaitlistMessage"
import { ApprovedExperience } from "@/components/landing/ApprovedExperience"
import { WaitlistHeader } from "@/components/landing/WaitlistHeader"
import { useGateStatus } from "@/hooks/use-gate-status"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface EarlyAccessFormProps {
  /** Pre-fill wallet address when user is already connected */
  initialWalletAddress?: string
}

export function EarlyAccessForm({ initialWalletAddress }: EarlyAccessFormProps) {
  const router = useRouter()
  const { address } = useAccount()
  const { invalidate: invalidateGate, setOnWaitlist } = useGateStatus()

  const [walletAddress, setWalletAddress] = useState("")
  const [xHandle, setXHandle] = useState("")
  const [discordHandle, setDiscordHandle] = useState("")
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState<{ approved: boolean } | null>(null)

  useEffect(() => {
    if (initialWalletAddress) {
      setWalletAddress(initialWalletAddress)
    }
  }, [initialWalletAddress])

  const validate = () => {
    const next: Record<string, string> = {}
    if (!walletAddress?.trim()) next.walletAddress = "Wallet address is required"
    else if (!isAddress(walletAddress.trim())) next.walletAddress = "Invalid wallet address"
    if (email?.trim() && !EMAIL_REGEX.test(email.trim())) next.email = "Invalid email address"
    // At least one contact method
    const hasContact = xHandle?.trim() || discordHandle?.trim() || (email?.trim() && EMAIL_REGEX.test(email.trim()))
    if (!hasContact) next.contact = "Provide at least one: X handle, Discord, or email"
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: walletAddress.trim(),
          x_handle: xHandle.trim(),
          discord_handle: discordHandle.trim(),
          email: email.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong", {
          description: "Please try again.",
        })
        setIsLoading(false)
        return
      }

      // Invalidate gate status so WaitlistExperience picks up fresh position
      invalidateGate()
      setSubmitted({ approved: data.approved })
    } catch {
      toast.error("Something went wrong", { description: "Please try again." })
      setIsLoading(false)
    }
  }

  const handleStartSwapping = () => {
    invalidateGate()
    router.push("/")
  }

  const handleBackToProtocol = () => {
    invalidateGate()
    router.push("/")
  }

  if (submitted) {
    if (submitted.approved) {
      return (
        <ApprovedExperience onStartSwapping={handleStartSwapping} onBack={handleBackToProtocol} />
      )
    }

    return <AlreadyOnWaitlistMessage onBack={handleBackToProtocol} />
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background overflow-hidden">
      <WaitlistHeader title="Early Access" onBack={handleBackToProtocol} />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute bottom-1/3 right-0 w-[400px] h-[400px] rounded-full bg-primary/[0.03] blur-3xl" />
      </div>

      <main className="relative flex-1 overflow-y-auto px-4">
        <div className="w-full max-w-lg mx-auto py-12 space-y-8">
          {/* Hero section */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/[0.05] text-primary text-xs font-semibold tracking-wide">
              <Zap size={12} />
              Early Access
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Get on the waitlist
            </h1>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Submit your details below to join the waitlist for Fast Swap.
            </p>
          </div>

          {/* Decorative divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          </div>

          <form
            onSubmit={handleSubmit}
            className="w-full space-y-4 p-6 rounded-xl border border-primary/20 bg-card/60 backdrop-blur-sm"
          >
            <div className="space-y-2">
              <Label htmlFor="wallet">Wallet address</Label>
              <Input
                id="wallet"
                placeholder="0x..."
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                className={errors.walletAddress ? "border-destructive" : ""}
                disabled={isLoading || !!initialWalletAddress}
              />
              {errors.walletAddress && (
                <p className="text-sm text-destructive">{errors.walletAddress}</p>
              )}
            </div>

            <p className="text-sm text-muted-foreground rounded-lg border border-primary/15 bg-primary/5 px-3 py-2">
              Provide at least one way to reach you — we&apos;ll use it to let you know when you&apos;re in.
            </p>

            {errors.contact && (
              <p className="text-sm text-destructive">{errors.contact}</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="x">X handle <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="x"
                placeholder="@username"
                value={xHandle}
                onChange={(e) => setXHandle(e.target.value)}
                className={errors.xHandle ? "border-destructive" : ""}
                disabled={isLoading}
              />
              {errors.xHandle && <p className="text-sm text-destructive">{errors.xHandle}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="discord">Discord handle <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="discord"
                placeholder="username#1234 or username"
                value={discordHandle}
                onChange={(e) => setDiscordHandle(e.target.value)}
                className={errors.discordHandle ? "border-destructive" : ""}
                disabled={isLoading}
              />
              {errors.discordHandle && (
                <p className="text-sm text-destructive">{errors.discordHandle}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={errors.email ? "border-destructive" : ""}
                disabled={isLoading}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Submitting…
                </span>
              ) : (
                "Submit"
              )}
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
