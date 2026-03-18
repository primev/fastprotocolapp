"use client"

import Image from "next/image"
import Link from "next/link"
import { useAccount } from "wagmi"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet"
import {
  Wallet,
  Menu,
  Award,
  LayoutDashboard,
  Trophy,
  Repeat,
  PlusCircle,
  Network,
  Zap,
  BookOpen,
} from "lucide-react"
import { ConnectButton, useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit"
import { toast } from "sonner"
import { SocialIcon } from "react-social-icons"
import { DISCORD_INVITE_URL } from "@/lib/constants"
import { usePrefetchOnHover } from "@/hooks/use-page-prefetch"
import { useUserPoints } from "@/hooks/use-user-points"
import { cn } from "@/lib/utils"
import { FEATURE_FLAGS } from "@/lib/feature-flags"
import { Badge } from "@/components/ui/badge"
import NumberFlow from "@number-flow/react"
import { usePathname, useRouter } from "next/navigation"
import { ClientOnly } from "./ClientOnly" // 1. Import ClientOnly

interface AppHeaderProps {
  isConnected: boolean
  status: "connected" | "disconnected" | "connecting" | "reconnecting"
  isMounted: boolean
  isMetaMask: boolean
  onAddNetwork: () => void
  onRpcSetup: () => void
  onTestRpc: () => void
  activeTab?: string
  onTabChange?: (value: string) => void
  showTabs?: boolean
}

export const AppHeader = ({
  isConnected,
  status,
  isMounted,
  isMetaMask,
  onAddNetwork,
  onRpcSetup,
  onTestRpc,
}: AppHeaderProps) => {
  const pathname = usePathname()
  const { address } = useAccount()
  const { openAccountModal } = useAccountModal()
  const { openConnectModal } = useConnectModal()
  const { points } = useUserPoints()
  const router = useRouter()

  const { handleDashboardHover, handleLeaderboardHover, handleSwapHover } = usePrefetchOnHover()

  const menuNavItems = [
    {
      label: "Swap",
      href: "/",
      active: pathname === "/" || pathname?.startsWith("/swap"),
      icon: Repeat,
      hover: handleSwapHover,
    },
    {
      label: "My Miles",
      href: "/dashboard",
      active: pathname?.startsWith("/dashboard"),
      icon: LayoutDashboard,
      hover: handleDashboardHover,
    },
    {
      label: "Leaderboard",
      href: "/leaderboard",
      active: pathname?.startsWith("/leaderboard"),
      icon: Trophy,
      hover: handleLeaderboardHover,
    },
    {
      label: "Learn",
      href: "/learn",
      active: pathname?.startsWith("/learn"),
      icon: BookOpen,
      hover: undefined,
    },
  ]

  return (
    <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 relative py-2">
      <div className="mx-5 px-4 py-2.5 flex items-center justify-between">
        {/* Logo Section */}
        <Link href="/" className="relative z-10">
          <Image
            src="/assets/fast-icon.png"
            alt="Fast Protocol"
            width={40}
            height={40}
            className="md:hidden h-10 w-auto"
          />
          <Image
            src="/assets/fast-protocol-logo-icon.png"
            alt="Fast Protocol"
            width={150}
            height={75}
            className="hidden md:block h-10 w-auto"
          />
        </Link>

        {/* Central Tab Bar */}
        <div className="hidden md:flex items-center justify-center absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="inline-flex items-center rounded-full bg-muted/50 p-1 gap-1">
            <Link
              href="/"
              prefetch={false}
              onMouseEnter={handleSwapHover(address)}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-medium transition-all cursor-pointer",
                pathname === "/" || pathname?.startsWith("/swap")
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Swap
            </Link>
            <div
              className={cn(
                "px-6 py-2 rounded-full text-sm font-medium transition-all cursor-pointer",
                pathname?.startsWith("/dashboard")
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => router.push("/dashboard")}
            >
              My Miles
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {FEATURE_FLAGS.show_miles_estimate && (
            <Badge
              variant="outline"
              className="h-10 px-3 text-sm border-primary/50 hidden sm:flex items-center"
            >
              <Award className="w-4 h-4 mr-2 text-primary" />
              <NumberFlow
                value={points}
                format={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
              />
              <span className="ml-1">Miles</span>
            </Badge>
          )}

          {/* Wallet Section - Wrapped in ClientOnly to avoid ID mismatch */}
          <ClientOnly fallback={<Skeleton className="h-10 w-10 lg:w-32 rounded-full" />}>
            <div className="flex items-center">
              {isConnected ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={openAccountModal}
                >
                  <Wallet className="h-5 w-5" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={openConnectModal}
                >
                  <Wallet className="h-5 w-5" />
                </Button>
              )}
              <div className="hidden lg:block">
                <ConnectButton showBalance={false} accountStatus="address" chainStatus="none" />
              </div>
            </div>
          </ClientOnly>

          {/* Menu Drawer - Wrapped in ClientOnly because it's a Radix Primitive (Sheet) */}
          <ClientOnly
            fallback={
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-full border border-border/50"
              >
                <Menu className="h-5 w-5" />
              </Button>
            }
          >
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 rounded-full border border-border/50 hover:bg-muted"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[320px] sm:w-[380px] flex flex-col">
                <SheetHeader className="text-left px-2 pt-4">
                  <SheetTitle className="text-xl font-bold">Fast Protocol</SheetTitle>
                  <SheetDescription>Navigation & Settings</SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto mt-6 space-y-8 px-2">
                  <div className="sm:hidden block px-2 mb-6">
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-full">
                          <Award className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                            Balance
                          </p>
                          {FEATURE_FLAGS.show_miles_estimate && (
                            <div className="text-lg font-bold flex items-center gap-1">
                              <NumberFlow value={points} />
                              <span className="text-sm font-medium text-muted-foreground">
                                Miles
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2">
                      Navigation
                    </h3>
                    <nav className="flex flex-col gap-1">
                      {menuNavItems.map((item) => (
                        <SheetClose key={item.href} asChild>
                          <Link
                            href={item.href}
                            onMouseEnter={item.hover ? item.hover(address) : undefined}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                              item.active
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "hover:bg-muted text-foreground"
                            )}
                          >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                          </Link>
                        </SheetClose>
                      ))}
                    </nav>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2">
                      Settings
                    </h3>
                    <div className="flex flex-col gap-1">
                      {isMetaMask && (
                        <SheetClose asChild>
                          <button
                            onClick={onAddNetwork}
                            className="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted rounded-xl w-full text-left"
                          >
                            <PlusCircle className="w-5 h-5 text-primary" />
                            Add RPC to Wallet
                          </button>
                        </SheetClose>
                      )}
                      <SheetClose asChild>
                        <button
                          onClick={onRpcSetup}
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted rounded-xl w-full text-left"
                        >
                          <Network className="w-5 h-5 text-muted-foreground" />
                          {isMetaMask ? "Toggle Network" : "Setup RPC"}
                        </button>
                      </SheetClose>
                      <SheetClose asChild>
                        <button
                          onClick={() => {
                            if (!isConnected) {
                              toast.error("Please connect your wallet first")
                              return
                            }
                            onTestRpc()
                          }}
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted rounded-xl w-full text-left"
                        >
                          <Zap className="w-5 h-5 text-amber-500" />
                          Test RPC Connection
                        </button>
                      </SheetClose>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2">
                      Community
                    </h3>
                    <SheetClose asChild>
                      <button
                        onClick={() => window.open(DISCORD_INVITE_URL, "_blank")}
                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium hover:bg-muted rounded-xl w-full text-left"
                      >
                        <SocialIcon network="discord" style={{ height: 20, width: 20 }} />
                        Discord Server
                      </button>
                    </SheetClose>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </ClientOnly>
        </div>
      </div>
    </header>
  )
}
