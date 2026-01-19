"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAccount } from "wagmi"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wallet, Settings, Menu } from "lucide-react"
import { ConnectButton, useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit"
import { toast } from "sonner"
import { SocialIcon } from "react-social-icons"
import { DISCORD_INVITE_URL } from "@/lib/constants"
import { usePrefetchOnHover } from "@/hooks/use-page-prefetch"
import { cn } from "@/lib/utils"

interface AppHeaderProps {
  isConnected: boolean
  status: "connected" | "disconnected" | "connecting" | "reconnecting"
  isMounted: boolean
  isMetaMask: boolean
  onAddNetwork: () => void
  onRpcSetup: () => void
  onTestRpc: () => void
  // Optional tabs for dashboard
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
  activeTab,
  onTabChange,
  showTabs = false,
}: AppHeaderProps) => {
  const pathname = usePathname()
  const { address } = useAccount()
  const { openAccountModal } = useAccountModal()
  const { openConnectModal } = useConnectModal()

  // Hover prefetching for faster navigation
  const { handleDashboardHover, handleLeaderboardHover } = usePrefetchOnHover()

  // Navigation items for mobile drawer
  const navItems = [
    { label: "Genesis SBT", href: "/dashboard", active: pathname?.startsWith("/dashboard") },
    { label: "Leaderboard", href: "/leaderboard", active: pathname?.startsWith("/leaderboard") },
  ]

  return (
    <>
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between">
          <Link href="/dashboard" className="relative">
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

          {/* Tab Bar - Centered (conditional based on route) */}
          {(pathname?.startsWith("/dashboard") || pathname?.startsWith("/leaderboard")) && (
            <div className="hidden md:flex items-center justify-center flex-1 mx-8">
              <div className="inline-flex items-center rounded-full bg-muted/50 p-1 gap-1">
                <Link
                  href="/dashboard"
                  prefetch={false}
                  onMouseEnter={handleDashboardHover(address)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-all",
                    pathname?.startsWith("/dashboard")
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Dashboard
                </Link>
                <Link
                  href="/leaderboard"
                  prefetch={false}
                  onMouseEnter={handleLeaderboardHover(address)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-all",
                    pathname?.startsWith("/leaderboard")
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Leaders
                </Link>
                <button
                  disabled
                  className="px-4 py-2 rounded-full text-sm font-medium text-muted-foreground opacity-60 cursor-not-allowed"
                >
                  Miles
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile: Wallet icon (only on xs, to the left of hamburger) */}
            {isConnected ? (
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden"
                onClick={openAccountModal}
                aria-label="Wallet"
              >
                <Wallet className="h-5 w-5" />
              </Button>
            ) : (
              <>
                {!isMounted || status === "connecting" || status === "reconnecting" ? (
                  <Skeleton className="h-10 w-10 rounded-full sm:hidden" />
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="sm:hidden"
                    onClick={openConnectModal}
                    aria-label="Connect Wallet"
                  >
                    <Wallet className="h-5 w-5" />
                  </Button>
                )}
              </>
            )}

            {/* Medium screens: Wallet icon (when connected) - Show before hamburger on sm */}
            {isConnected && (
              <Button
                variant="outline"
                size="icon"
                className="hidden sm:flex lg:hidden"
                onClick={openAccountModal}
              >
                <Wallet className="w-4 h-4" />
              </Button>
            )}

            {/* Mobile Hamburger Menu - Show on sm and below, hide on md+ */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden sm:ml-auto"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[320px] sm:w-[400px]">
                <div className="flex flex-col h-full">
                  {/* Header */}
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-foreground">Menu</h2>
                    <p className="text-sm text-muted-foreground mt-1">Fast Protocol</p>
                  </div>

                  {/* Navigation Section */}
                  <div className="flex-1 space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                        Navigation
                      </h3>
                      <div className="flex flex-col gap-1">
                        {navItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`px-4 py-3 rounded-lg transition-all text-left font-medium ${
                              item.active
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-foreground hover:bg-muted/50"
                            }`}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* Network Settings Section */}
                    {isConnected && (
                      <div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                          Network
                        </h3>
                        <div className="flex flex-col gap-1">
                          {isMetaMask && (
                            <button
                              onClick={onAddNetwork}
                              className="px-4 py-3 rounded-lg transition-all text-left font-medium text-foreground hover:bg-muted/50 flex items-center gap-3"
                            >
                              <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                              Add RPC to Wallet
                            </button>
                          )}
                          <button
                            onClick={onRpcSetup}
                            className="px-4 py-3 rounded-lg transition-all text-left font-medium text-foreground hover:bg-muted/50 flex items-center gap-3"
                          >
                            <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground" />
                            {isMetaMask ? "Toggle Network" : "Setup RPC"}
                          </button>
                          <button
                            onClick={() => {
                              if (!isConnected) {
                                toast.error("Please connect your wallet first")
                                return
                              }
                              onTestRpc()
                            }}
                            className="px-4 py-3 rounded-lg transition-all text-left font-medium text-foreground hover:bg-muted/50 flex items-center gap-3"
                          >
                            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                            Test RPC Connection
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Community Section */}
                    <div>
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                        Community
                      </h3>
                      <button
                        onClick={() => window.open(DISCORD_INVITE_URL, "_blank")}
                        className="w-full px-4 py-3 rounded-lg transition-all text-left font-medium text-foreground hover:bg-muted/50 flex items-center gap-3"
                      >
                        <SocialIcon network="discord" style={{ height: 20, width: 20 }} />
                        <span>Discord</span>
                      </button>
                    </div>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Large screens: Full ConnectButton */}
            {isConnected ? (
              <div className="hidden lg:block">
                <ConnectButton showBalance={false} accountStatus="address" />
              </div>
            ) : (
              <>
                {!isMounted || status === "connecting" || status === "reconnecting" ? (
                  <Skeleton className="h-10 w-32 rounded-full hidden lg:block" />
                ) : (
                  <div className="hidden lg:block">
                    <ConnectButton showBalance={false} accountStatus="address" />
                  </div>
                )}
              </>
            )}

            {/* Medium/Large screens: Discord and Settings (when connected) */}
            {isConnected && (
              <>
                <div
                  onClick={() => window.open(DISCORD_INVITE_URL, "_blank")}
                  className="hidden md:block cursor-pointer hover:opacity-80 transition-opacity"
                  aria-label="Discord"
                >
                  <SocialIcon network="discord" style={{ height: 35, width: 35 }} />
                </div>
                <div className="hidden md:block relative">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Account Settings"
                        className="w-10 h-10 rounded-full border border-border shadow-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/50 transition"
                      >
                        <Settings className="w-5 h-5 text-primary" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="min-w-[220px] rounded-lg shadow-lg border border-border p-2 bg-background"
                    >
                      <DropdownMenuLabel className="text-[13px] text-foreground/80 font-semibold pb-1">
                        Fast Protocol Network
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {isMetaMask && (
                        <DropdownMenuItem
                          className="flex items-center gap-2 cursor-pointer transition-colors hover:bg-accent/60 rounded"
                          onSelect={(e) => {
                            e.preventDefault()
                            onAddNetwork()
                          }}
                        >
                          <span className="inline-block w-2 h-2 rounded-full bg-primary mr-2" />
                          Add RPC to Wallet
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="flex items-center gap-2 cursor-pointer transition-colors hover:bg-accent/60 rounded"
                        onSelect={(e) => {
                          e.preventDefault()
                          onRpcSetup()
                        }}
                      >
                        <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground mr-2" />
                        {isMetaMask ? "Toggle Network" : "Setup RPC"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="flex items-center gap-2 cursor-pointer transition-colors hover:bg-accent/60 rounded"
                        onSelect={(e) => {
                          e.preventDefault()
                          if (!isConnected) {
                            toast.error("Please connect your wallet first")
                            return
                          }
                          onTestRpc()
                        }}
                      >
                        <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-2" />
                        Test RPC Connection
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  )
}
