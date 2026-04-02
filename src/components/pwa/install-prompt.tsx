"use client"

import { useEffect, useState } from "react"
import { Download, Share, X } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

type Platform = "chromium" | "ios" | "safari-desktop" | "firefox-android" | "unsupported"

function detectPlatform(): Platform {
  const ua = navigator.userAgent

  // iOS detection (Safari, Chrome on iOS, etc. — all use WebKit on iOS)
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  if (isIOS) return "ios"

  // macOS Safari (not Chrome/Brave/Edge which include "Chrome" in UA)
  const isMacSafari = /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome/.test(ua)
  if (isMacSafari) return "safari-desktop"

  // Firefox on Android
  const isFirefoxAndroid = /Android/.test(ua) && /Firefox/.test(ua)
  if (isFirefoxAndroid) return "firefox-android"

  // Chromium-based browsers fire beforeinstallprompt
  if ("BeforeInstallPromptEvent" in window || /Chrome/.test(ua)) return "chromium"

  return "unsupported"
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

const DISMISS_KEY = "pwa-install-dismissed"

function isDismissedRecently(): boolean {
  const dismissed = localStorage.getItem(DISMISS_KEY)
  if (!dismissed) return false
  // Re-show after 7 days
  return Date.now() - parseInt(dismissed, 10) < 7 * 24 * 60 * 60 * 1000
}

export function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isStandalone() || isDismissedRecently()) {
      setDismissed(true)
      return
    }

    const detected = detectPlatform()
    setPlatform(detected)

    if (detected === "chromium") {
      const handler = (e: Event) => {
        e.preventDefault()
        setDeferredPrompt(e as BeforeInstallPromptEvent)
      }
      window.addEventListener("beforeinstallprompt", handler)
      return () => window.removeEventListener("beforeinstallprompt", handler)
    }
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
  }

  if (dismissed) return null

  // Chromium: wait for the beforeinstallprompt event
  if (platform === "chromium") {
    if (!deferredPrompt) return null

    const handleInstall = async () => {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === "accepted") {
        setDeferredPrompt(null)
      }
      handleDismiss()
    }

    return (
      <InstallBanner onDismiss={handleDismiss}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Install Fast Protocol</p>
          <p className="text-xs text-muted-foreground">Add to home screen for the best experience</p>
        </div>
        <button
          onClick={handleInstall}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Install
        </button>
      </InstallBanner>
    )
  }

  // iOS Safari: guide user through Share → Add to Home Screen
  if (platform === "ios") {
    return (
      <InstallBanner onDismiss={handleDismiss} icon={<Share className="h-5 w-5 text-primary" />}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Install Fast Protocol</p>
          <p className="text-xs text-muted-foreground">
            Tap <Share className="inline h-3 w-3 align-text-bottom" /> then &quot;Add to Home Screen&quot;
          </p>
        </div>
      </InstallBanner>
    )
  }

  // macOS Safari: guide user through File → Add to Dock (Sonoma+)
  if (platform === "safari-desktop") {
    return (
      <InstallBanner onDismiss={handleDismiss}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Install Fast Protocol</p>
          <p className="text-xs text-muted-foreground">
            Use File &rarr; Add to Dock to install this app
          </p>
        </div>
      </InstallBanner>
    )
  }

  // Firefox Android: guide user through browser menu
  if (platform === "firefox-android") {
    return (
      <InstallBanner onDismiss={handleDismiss}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Install Fast Protocol</p>
          <p className="text-xs text-muted-foreground">
            Tap the menu (&#8942;) then &quot;Install&quot;
          </p>
        </div>
      </InstallBanner>
    )
  }

  return null
}

function InstallBanner({
  children,
  onDismiss,
  icon,
}: {
  children: React.ReactNode
  onDismiss: () => void
  icon?: React.ReactNode
}) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/95 p-4 shadow-lg backdrop-blur-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          {icon ?? <Download className="h-5 w-5 text-primary" />}
        </div>
        {children}
        <button
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
