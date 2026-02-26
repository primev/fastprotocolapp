import { NextRequest, NextResponse } from "next/server"
import { get } from "@vercel/edge-config"

/**
 * Middleware: Wallet-Based API Route Guard
 *
 * Protects sensitive API routes behind a wallet whitelist stored in Vercel Edge Config.
 * The whitelist lives under the key `authorized_wallets` as a JSON array of lowercase
 * Ethereum addresses (e.g. ["0xabc...", "0xdef..."]).
 *
 * How it works:
 * 1. The client sends its wallet address in the `x-wallet-address` request header.
 * 2. This middleware intercepts matched routes (see `config.matcher` below).
 * 3. If the header is missing → 401 Unauthorized.
 * 4. If the address is not in Edge Config's `authorized_wallets` → 403 Forbidden.
 * 5. Otherwise the request passes through to the route handler.
 *
 * Address normalization:
 *   Ethereum addresses are case-insensitive (EIP-55 checksums are optional),
 *   so we normalize to lowercase before comparing. The Edge Config array
 *   should also store addresses in lowercase to avoid mismatches.
 *
 * Local development:
 *   Vercel Edge Config requires the `EDGE_CONFIG` environment variable to be set.
 *   For local development you have two options:
 *     a) Connect to your Vercel project's Edge Config via `vercel env pull`.
 *     b) Set `EDGE_CONFIG` in `.env.local` to your Edge Config connection string.
 *   If `EDGE_CONFIG` is not set, `get()` will throw — the middleware returns 500
 *   so the error surfaces clearly rather than silently allowing access.
 */
export async function middleware(request: NextRequest) {
  // ── Step 1: Extract the wallet address from the request header ──
  // The consuming client (frontend or script) must attach its connected
  // wallet address as `x-wallet-address`. This is a lightweight auth
  // mechanism suitable for internal/admin endpoints where the wallet
  // identity is already known client-side.
  const walletHeader = request.headers.get("x-wallet-address")

  if (!walletHeader || !walletHeader.trim()) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message:
          "Missing x-wallet-address header. Attach your wallet address to access this route.",
      },
      { status: 401 }
    )
  }

  // ── Step 2: Normalize the address to lowercase ──
  // Ethereum addresses may arrive in mixed-case (EIP-55 checksum encoding)
  // or all-lowercase. We normalize to lowercase so the comparison against
  // the Edge Config array is deterministic. The stored array must also be
  // lowercase — document this requirement for whoever manages the config.
  const normalizedAddress = walletHeader.trim().toLowerCase()

  // ── Step 3: Fetch the authorized wallet list from Vercel Edge Config ──
  // `get<T>(key)` reads from the globally-replicated Edge Config store.
  // Reads are extremely fast (~0ms at the edge) because the data is
  // co-located with the middleware execution environment.
  //
  // If EDGE_CONFIG is not set or the key doesn't exist, we fail closed
  // (deny access) rather than fail open (allow access). This prevents
  // accidental exposure if the config is misconfigured.
  try {
    const authorizedWallets = await get<string[]>("authorized_wallets")
    console.log("authorizedWallets", authorizedWallets)

    // If the key is missing or not an array, fail closed.
    if (!authorizedWallets || !Array.isArray(authorizedWallets)) {
      console.error(
        "[middleware] authorized_wallets key is missing or not an array in Edge Config. " +
          "Denying access. Ensure the key exists and contains a JSON array of lowercase addresses."
      )
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "Wallet authorization list is not configured. Contact the admin.",
        },
        { status: 403 }
      )
    }

    // ── Step 4: Check if the wallet is in the authorized list ──
    // Normalize the stored addresses to lowercase as well, in case the
    // Edge Config data contains mixed-case (EIP-55) addresses. This makes
    // the comparison resilient regardless of how the config was populated.
    // For the expected whitelist size (~300 wallets) a linear scan is fine.
    const normalizedWallets = authorizedWallets.map((w) => w.toLowerCase())
    if (!normalizedWallets.includes(normalizedAddress)) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "Your wallet is not authorized to access this route.",
        },
        { status: 403 }
      )
    }

    // ── Step 5: Authorized — let the request through ──
    return NextResponse.next()
  } catch (error) {
    // Edge Config read failures (missing EDGE_CONFIG env var, network issues,
    // malformed connection string) should fail closed. Log the error for
    // debugging but don't leak internal details to the client.
    console.error("[middleware] Edge Config read failed:", error)
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Unable to verify wallet authorization. Please try again later.",
      },
      { status: 500 }
    )
  }
}

/**
 * Route matcher configuration
 *
 * This middleware ONLY runs on the routes listed below. All other /api routes
 * and pages are unaffected. Add new protected routes here as needed.
 *
 * Note: Next.js middleware matchers use path patterns, not regex.
 * Each entry must start with `/`.
 */
export const config = {
  matcher: ["/api/whitelist/generate"],
}
