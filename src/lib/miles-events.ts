/** Fired when the user's Fuul miles may have changed (e.g. settlement finalized). */
export const REFETCH_MILES_EVENT = "refetch-user-miles"

/** Trigger a miles refetch from anywhere (e.g. after a successful swap). */
export function refetchMiles() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(REFETCH_MILES_EVENT))
}
