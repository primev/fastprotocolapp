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
 */
export function useSnapshotOnOpen<T extends Record<string, unknown>>(open: boolean, values: T): T {
  const snapshotRef = useRef<T | null>(null)
  const wasOpenRef = useRef(open)

  if (open && !wasOpenRef.current) {
    snapshotRef.current = { ...values }
  } else if (!open && wasOpenRef.current) {
    snapshotRef.current = null
  }
  wasOpenRef.current = open

  return snapshotRef.current ?? values
}
