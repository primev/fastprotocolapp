"use client"

import { useRef } from "react"

/**
 * Snapshot the caller's `values` the first render `open` flips to `true`, so
 * they stay static for the rest of the session — live quote refreshes must
 * NOT shift the numbers the user is about to sign.
 *
 * We use a ref and synchronous capture (not useEffect) so the snapshot is
 * already available on the very first `open === true` render.
 *
 * The hook returns a merged object: snapshot wins when present, live values
 * when the modal is closed. That lets the caller pass the live props to the
 * same variables regardless of open state — no conditionals at use sites.
 *
 * `structuredClone` gives a deep snapshot. The caller's object tree (tokens,
 * prices, gas estimates) must contain only structured-cloneable values —
 * strings, numbers, bigints, plain objects, arrays. No functions, no class
 * instances. That's true of every call site today; if you pass a new value
 * type, check the MDN structuredClone compatibility table first.
 */
export function useSnapshotOnOpen<T extends Record<string, unknown>>(open: boolean, values: T): T {
  const snapshotRef = useRef<T | null>(null)
  const wasOpenRef = useRef(open)

  if (open && !wasOpenRef.current) {
    // Deep-clone so a later mutation of a nested object (e.g. a token-list
    // refetch replacing `decimals` in place) can't leak into the snapshot
    // and change the numbers we're about to ship to the contract.
    snapshotRef.current = structuredClone(values)
  } else if (!open && wasOpenRef.current) {
    snapshotRef.current = null
  }
  wasOpenRef.current = open

  return snapshotRef.current ?? values
}
