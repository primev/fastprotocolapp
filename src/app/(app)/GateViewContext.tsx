"use client"

import { createContext, useContext, useState, useCallback } from "react"

interface GateViewContextValue {
  /** True once the user has clicked through the landing gate into the swap UI */
  passedGate: boolean
  enterSwap: () => void
  /** Reset gate state (e.g. on wallet disconnect) */
  resetGate: () => void
}

const GateViewContext = createContext<GateViewContextValue>({
  passedGate: false,
  enterSwap: () => {},
  resetGate: () => {},
})

export function GateViewProvider({ children }: { children: React.ReactNode }) {
  const [passedGate, setPassedGate] = useState(false)
  const enterSwap = useCallback(() => setPassedGate(true), [])
  const resetGate = useCallback(() => setPassedGate(false), [])

  return (
    <GateViewContext.Provider value={{ passedGate, enterSwap, resetGate }}>
      {children}
    </GateViewContext.Provider>
  )
}

export function useGateView() {
  return useContext(GateViewContext)
}
