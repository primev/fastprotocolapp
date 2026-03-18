"use client"

import { useState, useEffect, useCallback, useRef } from "react"

const IDLE_TIMEOUT_MS = 2 * 60 * 1000 // 2 minutes
const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "pointerdown",
]

/**
 * Returns `true` when the page is both visible AND the user is actively
 * interacting (has moved the mouse / typed / scrolled within the last 2 min).
 *
 * Use this to gate periodic polling so we don't waste calls when the user
 * has walked away from their computer or switched tabs.
 */
export function usePageActive(): boolean {
  const [visible, setVisible] = useState(true)
  const [idle, setIdle] = useState(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const resetIdleTimer = useCallback(() => {
    setIdle(false)
    clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setIdle(true), IDLE_TIMEOUT_MS)
  }, [])

  // Page Visibility API
  useEffect(() => {
    const onVisibilityChange = () => setVisible(!document.hidden)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => document.removeEventListener("visibilitychange", onVisibilityChange)
  }, [])

  // User idle detection
  useEffect(() => {
    // Start the idle timer immediately
    resetIdleTimer()

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, resetIdleTimer, { passive: true })
    }
    return () => {
      clearTimeout(idleTimerRef.current)
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, resetIdleTimer)
      }
    }
  }, [resetIdleTimer])

  return visible && !idle
}
