"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useAccount, useDisconnect } from "wagmi"
import { isAddress } from "viem"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AnimatedBackground } from "@/components/AnimatedBackground"

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface EarlyAccessFormProps {
  /** Pre-fill wallet address when user is already connected */
  initialWalletAddress?: string
}

export function EarlyAccessForm({ initialWalletAddress }: EarlyAccessFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { address } = useAccount()
  const { disconnect } = useDisconnect()
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
    if (!xHandle?.trim()) next.xHandle = "X handle is required"
    if (!discordHandle?.trim()) next.discordHandle = "Discord handle is required"
    if (!email?.trim()) next.email = "Email is required"
    else if (!EMAIL_REGEX.test(email.trim())) next.email = "Invalid email address"
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

      if (data.alreadyOnWaitlist) {
        toast.info("You're already on the waitlist", {
          description: "No need to submit again. You're all set.",
        })
        if (data.approved) {
          const addr = walletAddress.trim().toLowerCase()
          queryClient.setQueryData(
            ["waitlist", "list"],
            (prev: { addresses: string[] } | undefined) => {
              const addresses = prev?.addresses ?? []
              if (addresses.includes(addr)) return prev ?? { addresses }
              return { addresses: [...addresses, addr] }
            }
          )
          void queryClient.invalidateQueries({ queryKey: ["waitlist"] })
          router.push("/")
        } else {
          setIsLoading(false)
        }
        return
      }

      setSubmitted({ approved: data.approved })
    } catch {
      toast.error("Something went wrong", { description: "Please try again." })
      setIsLoading(false)
    }
  }

  const handleStartSwapping = () => {
    if (address) {
      const addr = address.toLowerCase().trim()
      queryClient.setQueryData(
        ["waitlist", "list"],
        (prev: { addresses: string[] } | undefined) => {
          const addresses = prev?.addresses ?? []
          if (addresses.includes(addr)) return prev ?? { addresses }
          return { addresses: [...addresses, addr] }
        }
      )
    }
    void queryClient.invalidateQueries({ queryKey: ["waitlist"] })
    router.push("/")
  }

  const handleBackToProtocol = () => {
    disconnect()
    router.push("/")
    void queryClient.invalidateQueries({ queryKey: ["whitelist"] })
    void queryClient.invalidateQueries({ queryKey: ["waitlist"] })
  }

  if (submitted) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background">
        <AnimatedBackground />
        <div className="relative z-10 w-full px-4 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
          <div className="isolate mb-6">
            <Image
              src="/assets/fast-protocol-logo-icon.png"
              alt="Fast Protocol"
              width={256}
              height={256}
              quality={100}
              placeholder="empty"
              className="h-24 w-auto"
            />
          </div>
          {submitted.approved ? (
            <>
              <h1 className="text-xl font-medium text-foreground mb-2">
                You&apos;re pre-approved!
              </h1>
              <p className="text-muted-foreground mb-8">Your wallet is on the whitelist.</p>
              <Button variant="hero" size="lg" onClick={handleStartSwapping}>
                Start swapping
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-medium text-foreground mb-2">Thanks for signing up</h1>
              <p className="text-muted-foreground mb-8">
                You&apos;re on the waitlist. We&apos;ll be in touch soon with next steps.
              </p>
              <Button variant="hero" size="lg" onClick={handleBackToProtocol}>
                Back to Fast Protocol
              </Button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background">
      <AnimatedBackground />
      <div className="relative z-10 w-full px-4 flex flex-col items-center max-w-lg mx-auto">
        <Link href="/" className="mb-6 isolate block">
          <Image
            src="/assets/fast-protocol-logo-icon.png"
            alt="Fast Protocol"
            width={160}
            height={160}
            quality={100}
            placeholder="empty"
            className="h-20 w-auto"
          />
        </Link>
        <h1 className="text-xl font-medium text-foreground mb-1">Get Early Access</h1>
        <p className="text-muted-foreground text-sm mb-6 text-center">
          Submit your details to join the waitlist for Fast Swap.
        </p>

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
            Use your real X and Discord profiles—if you&apos;re approved, we&apos;ll reach out to
            you there.
          </p>

          <div className="space-y-2">
            <Label htmlFor="x">X handle</Label>
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
            <Label htmlFor="discord">Discord handle</Label>
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
            <Label htmlFor="email">Email</Label>
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

        <p className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              disconnect()
              router.push("/")
              void queryClient.invalidateQueries({ queryKey: ["whitelist"] })
              void queryClient.invalidateQueries({ queryKey: ["waitlist"] })
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to Fast Protocol
          </button>
        </p>
      </div>
    </div>
  )
}
