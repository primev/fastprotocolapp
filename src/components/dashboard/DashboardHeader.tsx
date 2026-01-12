"use client"

import { AppHeader } from "@/components/shared/AppHeader"

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
  return (
    <AppHeader
      isConnected={isConnected}
      status={status}
      isMounted={isMounted}
      isMetaMask={isMetaMask}
      onAddNetwork={onAddNetwork}
      onRpcSetup={onRpcSetup}
      onTestRpc={onTestRpc}
      activeTab={activeTab}
      onTabChange={onTabChange}
      showTabs={true}
    />
  )
}
