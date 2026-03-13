/**
 * Shared utilities for writing to Vercel Edge Config via the REST API.
 *
 * The @vercel/edge-config SDK only supports *reading* values. To *write*
 * (create / update / delete) items we must call the Vercel REST API directly.
 *
 * This module centralises that PATCH call so every cron job that needs to
 * mutate Edge Config can reuse the same typed, error-handled helper instead
 * of duplicating fetch logic.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single mutation sent inside the `items` array of the PATCH body.
 * Vercel supports three operations — we type them all so future callers
 * can delete keys too.
 *
 * @see https://vercel.com/docs/storage/edge-config/vercel-api#update-your-edge-config-items
 */
export type EdgeConfigItemOperation =
  | { operation: "create"; key: string; value: EdgeConfigValue }
  | { operation: "update"; key: string; value: EdgeConfigValue }
  | { operation: "upsert"; key: string; value: EdgeConfigValue }
  | { operation: "delete"; key: string }

/**
 * Edge Config stores JSON — values can be any JSON-serialisable primitive,
 * array, or object.  We keep the type narrow enough to catch accidental
 * `undefined` while still covering real-world usage.
 */
export type EdgeConfigValue =
  | string
  | number
  | boolean
  | null
  | EdgeConfigValue[]
  | { [key: string]: EdgeConfigValue }

/**
 * Shape returned by `PATCH /v1/edge-config/[id]/items` on success (200).
 * Vercel returns the updated status of the Edge Config store.
 */
export interface EdgeConfigPatchResponse {
  status: string
  error?: { message: string; code: string }
}

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

interface EdgeConfigEnv {
  /** The Edge Config store ID (the `ecfg_…` identifier). */
  edgeConfigId: string
  /** A Vercel personal / team access token with Edge Config write scope. */
  vercelAccessToken: string
  /** The Vercel Team ID — required when the project belongs to a team. */
  teamId: string
}

/**
 * Reads and validates the three environment variables needed for Edge Config
 * writes.  Throws a descriptive error if any are missing so the cron handler
 * can return a 500 with a clear message.
 */
export function getEdgeConfigEnv(): EdgeConfigEnv {
  const edgeConfigId = process.env.EDGE_CONFIG_ID
  const vercelAccessToken = process.env.VERCEL_ACCESS_TOKEN
  const teamId = process.env.TEAM_ID

  if (!edgeConfigId || !vercelAccessToken || !teamId) {
    const missing = [
      !edgeConfigId && "EDGE_CONFIG_ID",
      !vercelAccessToken && "VERCEL_ACCESS_TOKEN",
      !teamId && "TEAM_ID",
    ].filter(Boolean)

    throw new Error(
      `Missing required environment variable(s) for Edge Config writes: ${missing.join(", ")}`
    )
  }

  return { edgeConfigId, vercelAccessToken, teamId }
}

// ---------------------------------------------------------------------------
// Core PATCH helper
// ---------------------------------------------------------------------------

/**
 * Sends a PATCH request to the Vercel Edge Config Items API.
 *
 * @param items  One or more create / update / delete operations.
 * @returns      The parsed JSON response from Vercel.
 * @throws       If the HTTP request fails or returns a non-200 status.
 *
 * ### Why PATCH (not PUT)?
 * The Vercel API uses PATCH semantics — it applies the operations you send
 * without replacing the entire config store.  This means multiple cron jobs
 * can safely update *different* keys concurrently.
 *
 * ### Authentication
 * We send a Bearer token via the standard `Authorization` header.  The token
 * must have the "Edge Config — Read & Write" scope.  Team-scoped projects
 * additionally require the `teamId` query parameter.
 */
export async function patchEdgeConfigItems(
  items: EdgeConfigItemOperation[]
): Promise<EdgeConfigPatchResponse> {
  const { edgeConfigId, vercelAccessToken, teamId } = getEdgeConfigEnv()

  /**
   * Construct the full API URL.
   *
   * Format: https://api.vercel.com/v1/edge-config/{id}/items?teamId={teamId}
   *
   * The `teamId` query param is required for projects that belong to a Vercel
   * Team.  For personal (hobby) accounts you could omit it, but including it
   * unconditionally is harmless and avoids a subtle 403 when the project
   * moves to a team later.
   */
  const url = `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items?teamId=${teamId}`

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      /**
       * Bearer token authenticates the request.  Generated at:
       * Vercel Dashboard → Account Settings → Tokens.
       */
      Authorization: `Bearer ${vercelAccessToken}`,
      /**
       * The API expects a JSON body describing the operations to apply.
       */
      "Content-Type": "application/json",
    },
    /**
     * The body is an object with a single `items` array.  Each item
     * describes one atomic operation (create / update / delete) on a
     * specific key.
     *
     * Values are stored as their native JSON type — numbers stay numbers,
     * strings stay strings, etc.  This matters because the @vercel/edge-config
     * SDK's `get<T>()` deserialises the stored JSON directly, so storing
     * `450000` (number) means `get<number>("key")` returns a number without
     * any parsing on the read side.
     */
    body: JSON.stringify({ items }),
  })

  /**
   * Parse the response body regardless of status — Vercel includes error
   * details in the JSON body even for 4xx/5xx responses.
   */
  const data: EdgeConfigPatchResponse = await response.json()

  if (!response.ok) {
    throw new Error(`Edge Config PATCH failed (${response.status}): ${JSON.stringify(data)}`)
  }

  return data
}
