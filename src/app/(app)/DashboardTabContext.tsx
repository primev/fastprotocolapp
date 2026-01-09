"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useSearchParams, useRouter } from "next/navigation"

interface DashboardTabContextType {
  activeTab: string
  setActiveTab: (value: string) => void
}

const DashboardTabContext = createContext<DashboardTabContextType | undefined>(undefined)

export function DashboardTabProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [activeTab, setActiveTabState] = useState("genesis")

  // Read from URL on mount
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && ["genesis", "points"].includes(tab)) {
      setActiveTabState(tab)
    }
  }, [searchParams])

  const setActiveTab = (value: string) => {
    setActiveTabState(value)
    router.push(`/dashboard?tab=${value}`)
  }

  return (
    <DashboardTabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </DashboardTabContext.Provider>
  )
}

export function useDashboardTab() {
  const context = useContext(DashboardTabContext)
  // Return default values if not in provider (for non-dashboard pages)
  if (context === undefined) {
    return { activeTab: "genesis", setActiveTab: () => {} }
  }
  return context
}
