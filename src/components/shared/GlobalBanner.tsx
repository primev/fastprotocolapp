"use client"

import { useEffect, useRef, useState } from "react"

export function GlobalBanner() {
  const [text, setText] = useState<string>("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/config/global-banner")
      .then((r) => (r.ok ? r.json() : { text: "" }))
      .then((data) => {
        if (!cancelled) setText(typeof data?.text === "string" ? data.text : "")
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    const root = document.documentElement
    if (!el) {
      root.style.setProperty("--global-banner-h", "0px")
      return
    }
    const update = () => {
      root.style.setProperty("--global-banner-h", `${el.offsetHeight}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      observer.disconnect()
      root.style.setProperty("--global-banner-h", "0px")
    }
  }, [text])

  if (!text) return null

  return (
    <div
      ref={ref}
      className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-primary to-primary/80 border-b border-primary/50"
    >
      <div className="container mx-auto px-4 py-1 text-center">
        <p className="text-primary-foreground text-sm">{text}</p>
      </div>
    </div>
  )
}
