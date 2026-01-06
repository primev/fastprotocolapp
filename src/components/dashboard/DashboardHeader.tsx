"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Award, Wallet, Settings } from "lucide-react"
import { ConnectButton, useAccountModal, useConnectModal } from "@rainbow-me/rainbowkit"
import { toast } from "sonner"
import { SocialIcon } from "react-social-icons"
import { DISCORD_INVITE_URL } from "@/lib/constants"

interface DashboardHeaderProps {
  points: number
  isConnected: boolean
  status: "connected" | "disconnected" | "connecting" | "reconnecting"
  isMounted: boolean
  isMetaMask: boolean
  onAddNetwork: () => void
  onRpcSetup: () => void
  onTestRpc: () => void
  activeTab: string
  onTabChange: (value: string) => void
}

export const DashboardHeader = ({
  points,
  isConnected,
  status,
  isMounted,
  isMetaMask,
  onAddNetwork,
  onRpcSetup,
  onTestRpc,
  activeTab,
  onTabChange,
}: DashboardHeaderProps) => {
  const { openAccountModal } = useAccountModal()
  const { openConnectModal } = useConnectModal()

  return (
    <>
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80">
        <div className="container mx-auto px-4 py-4 lg:py-2.5 flex items-center justify-between">
          <div className="relative">
            <Image
              src="/assets/fast-icon.png"
              alt="Fast Protocol"
              width={40}
              height={40}
              className="sm:hidden"
            />
            <Image
              src="/assets/fast-protocol-logo-icon.png"
              alt="Fast Protocol"
              width={150}
              height={75}
              className="hidden sm:block"
            />
          </div>

          {/* Tabs - Centered - Desktop only */}
          <div className="flex-1  justify-center hidden sm:flex">
            <Tabs value={activeTab} onValueChange={onTabChange} className="w-auto">
              <TabsList className="inline-flex space-x-2 rounded-full bg-muted/50 p-1">
                <TabsTrigger
                  value="genesis"
                  className="text-sm rounded-full data-[state=active]:bg-background"
                >
                  Genesis SBT
                </TabsTrigger>
                <TabsTrigger
                  value="points"
                  className="text-sm rounded-full data-[state=active]:bg-background"
                  disabled
                >
                  Miles
                </TabsTrigger>
                <TabsTrigger
                  value="leaderboard"
                  className="text-sm rounded-full data-[state=active]:bg-background"
                >
                  Leaderboard
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Badge
              variant="outline"
              className="h-10 px-3 lg:px-2.5 text-sm lg:text-sm border-primary/50 flex items-center"
            >
              <Award className="w-4 h-4 lg:w-3.5 lg:h-3.5 mr-2 lg:mr-1.5 text-primary" />
              {points} Miles
            </Badge>
            {/* Wallet icon button for mobile (when connected) */}
            {isConnected && (
              <Button
                variant="outline"
                size="icon"
                className="sm:hidden"
                onClick={openAccountModal}
              >
                <Wallet className="w-4 h-4" />
              </Button>
            )}
            {/* ConnectButton - full on desktop, "Connect" only on mobile when not connected */}
            {isConnected ? (
              <div className="hidden sm:block">
                <ConnectButton showBalance={false} accountStatus="address" />
              </div>
            ) : (
              <>
                {!isMounted || status === "connecting" || status === "reconnecting" ? (
                  <Skeleton className="h-10 w-32 rounded-full" />
                ) : (
                  <>
                    <Button onClick={openConnectModal} className="h-10 sm:hidden px-4">
                      Connect
                    </Button>
                    <div className="hidden sm:block">
                      <ConnectButton showBalance={false} accountStatus="address" />
                    </div>
                  </>
                )}
              </>
            )}
            {isConnected && (
              <>
                <div
                  onClick={() => window.open(DISCORD_INVITE_URL, "_blank")}
                  className="cursor-pointer hover:opacity-80 transition-opacity"
                  aria-label="Discord"
                >
                  <SocialIcon network="discord" style={{ height: 35, width: 35 }} />
                </div>
                <div className="relative">
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

      {/* Tabs - Centered */}
      <div className="flex-1 bg-background/80  justify-center flex flex-col items-center sm:hidden py-4">
        <Tabs value={activeTab} onValueChange={onTabChange} className="w-auto">
          <TabsList className="inline-flex space-x-2 rounded-full bg-muted/50 p-1">
            <TabsTrigger
              value="genesis"
              className="text-sm rounded-full data-[state=active]:bg-background"
            >
              Genesis SBT
            </TabsTrigger>
            <TabsTrigger
              value="points"
              className="text-sm rounded-full data-[state=active]:bg-background"
              disabled
            >
              Miles
            </TabsTrigger>
            <TabsTrigger
              value="leaderboard"
              className="text-sm rounded-full data-[state=active]:bg-background"
              disabled
            >
              Leaderboard
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </>
  )
}
