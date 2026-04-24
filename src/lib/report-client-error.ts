/**
 * Forwards client-side errors to /api/client-error so they surface in Vercel
 * server logs (and any log drain attached to them, e.g. Groundcover).
 *
 * Designed to be safe for every call site:
 *  - Fire-and-forget. Never awaits, never throws.
 *  - Swallows wallet rejections (user clicking "Reject" is not an error).
 *  - Dedupes the same Error instance if it bubbles through multiple layers.
 *  - Rate-limited client-side so a tight loop can't flood the endpoint.
 *  - Uses sendBeacon on unload, fetch(keepalive) otherwise.
 *  - No-op on the server (the caller is always a client hook/component today,
 *    but this future-proofs the import).
 */

export type ClientErrorContext = {
  source: string
  [key: string]: unknown
}

const MAX_REPORTS_PER_WINDOW = 20
const WINDOW_MS = 60_000
const MAX_MESSAGE_LEN = 2_000
const MAX_STACK_LEN = 8_000
const ENDPOINT = "/api/client-error"

const seenErrors = new WeakSet<object>()
let windowStart = 0
let windowCount = 0
let sessionId: string | undefined

function getSessionId(): string {
  if (sessionId) return sessionId
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    sessionId = crypto.randomUUID()
  } else {
    sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
  return sessionId
}

function isRejection(err: unknown): boolean {
  if (!err) return true
  const anyErr = err as { code?: unknown; name?: unknown; message?: unknown }
  if (anyErr.code === 4001 || anyErr.code === "ACTION_REJECTED") return true
  if (typeof anyErr.name === "string" && anyErr.name === "UserRejectedRequestError") return true
  const msg = typeof anyErr.message === "string" ? anyErr.message.toLowerCase() : ""
  if (!msg) return false
  return (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("rejected the request") ||
    msg.includes("request rejected") ||
    msg.includes("transaction was rejected") ||
    msg.includes("user cancelled") ||
    msg.includes("user canceled")
  )
}

function truncate(s: string | undefined, max: number): string | undefined {
  if (!s) return s
  return s.length > max ? s.slice(0, max) + "…[truncated]" : s
}

type ViemLike = {
  shortMessage?: unknown
  details?: unknown
  metaMessages?: unknown
  walk?: (fn: (e: unknown) => boolean) => unknown
}

function extractViemDetails(err: unknown) {
  if (!err || typeof err !== "object") return undefined
  const e = err as ViemLike
  const viem: {
    shortMessage?: string
    details?: string
    metaMessages?: string[]
    rootCauseName?: string
    rootCauseMessage?: string
  } = {}
  if (typeof e.shortMessage === "string") viem.shortMessage = truncate(e.shortMessage, 500)
  if (typeof e.details === "string") viem.details = truncate(e.details, 500)
  if (Array.isArray(e.metaMessages)) {
    viem.metaMessages = e.metaMessages
      .filter((m): m is string => typeof m === "string")
      .slice(0, 5)
      .map((m) => m.slice(0, 500))
  }
  if (typeof e.walk === "function") {
    try {
      const root = e.walk(() => true) as { name?: unknown; message?: unknown } | undefined
      if (root && root !== e) {
        if (typeof root.name === "string") viem.rootCauseName = root.name
        if (typeof root.message === "string") viem.rootCauseMessage = truncate(root.message, 500)
      }
    } catch {
      // walk() implementations vary; ignore failures
    }
  }
  return Object.keys(viem).length > 0 ? viem : undefined
}

function buildPayload(err: unknown, context: ClientErrorContext) {
  const isErr = err instanceof Error
  const name = isErr ? err.name : typeof err
  const message =
    isErr && typeof err.message === "string"
      ? err.message
      : typeof err === "string"
        ? err
        : safeStringify(err)
  const stack = isErr && typeof err.stack === "string" ? err.stack : undefined

  return {
    message: truncate(message, MAX_MESSAGE_LEN) ?? "Unknown error",
    name: String(name).slice(0, 100),
    stack: truncate(stack, MAX_STACK_LEN),
    viem: extractViemDetails(err),
    context,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    sessionId: getSessionId(),
    timestamp: Date.now(),
  }
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v)
  } catch {
    return "[unstringifiable]"
  }
}

function allowThroughRateLimit(): boolean {
  const now = Date.now()
  if (now - windowStart > WINDOW_MS) {
    windowStart = now
    windowCount = 0
  }
  if (windowCount >= MAX_REPORTS_PER_WINDOW) return false
  windowCount++
  return true
}

function send(payload: object) {
  const body = safeStringify(payload)
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" })
      // sendBeacon returns false if the UA declined to queue; fall through to fetch
      if (navigator.sendBeacon(ENDPOINT, blob)) return
    }
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => {
      // Never re-throw from the reporter. Swallow silently to avoid feedback loops.
    })
  } catch {
    // Never re-throw.
  }
}

export function reportClientError(err: unknown, context: ClientErrorContext): void {
  try {
    // Skip on the server (no window/navigator). Server routes already console.error.
    if (typeof window === "undefined") return
    if (isRejection(err)) return
    if (err && typeof err === "object") {
      if (seenErrors.has(err as object)) return
      seenErrors.add(err as object)
    }
    if (!allowThroughRateLimit()) return
    send(buildPayload(err, context))
  } catch {
    // Never re-throw from the reporter.
  }
}
