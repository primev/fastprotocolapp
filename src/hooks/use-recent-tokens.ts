"use client"

import { useCallback, useEffect, useState } from "react"
import type { Token } from "@/types/swap"

/**
 * Persistent "Recent searches" / recently-selected tokens list for the token
 * selector. Stored in localStorage, scoped per chain, capped at MAX entries.
 * Mirrors Uniswap's interface behavior — whenever a user picks a token from
 * the selector it floats to the top of this list, deduped by address.
 */
const STORAGE_PREFIX = "fp:recent-tokens:"
const MAX = 5

function storageKey(chainId: number) {
  return `${STORAGE_PREFIX}${chainId}`
}

function readFromStorage(chainId: number): Token[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(storageKey(chainId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (t): t is Token =>
        !!t &&
        typeof t.address === "string" &&
        typeof t.symbol === "string" &&
        typeof t.decimals === "number"
    )
  } catch {
    return []
  }
}

function writeToStorage(chainId: number, tokens: Token[]) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey(chainId), JSON.stringify(tokens))
  } catch {
    // Swallow — storage quota / private mode.
  }
}

export function useRecentTokens(chainId: number) {
  const [tokens, setTokens] = useState<Token[]>([])

  // Load on mount / chain change.
  useEffect(() => {
    setTokens(readFromStorage(chainId))
  }, [chainId])

  const add = useCallback(
    (token: Token) => {
      // Read the latest list straight from storage rather than from React
      // state — the caller usually closes the modal on the same tick, which
      // can unmount this hook before a setState updater has a chance to run.
      // Going through storage keeps the write durable regardless of React's
      // commit timing.
      const current = readFromStorage(chainId)
      const lower = token.address.toLowerCase()
      const next = [
        token,
        ...current.filter((t) => t.address.toLowerCase() !== lower),
      ].slice(0, MAX)
      writeToStorage(chainId, next)
      setTokens(next)
    },
    [chainId]
  )

  const clear = useCallback(() => {
    setTokens([])
    writeToStorage(chainId, [])
  }, [chainId])

  return { recent: tokens, addRecent: add, clearRecent: clear }
}
