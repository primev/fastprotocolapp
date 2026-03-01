/** Canonical production URL — always non-www, used for sitemap, robots, and canonical tags. */
export const SITE_URL = "https://fastprotocol.io"

/** Returns the base URL for metadata. Uses the canonical domain in production, Vercel URL for previews. */
export function getBaseUrl(): string {
  const vercelEnv = process.env.VERCEL_ENV

  if (vercelEnv === "production") {
    return SITE_URL
  }

  const domain = process.env.VERCEL_URL
  if (domain) {
    return /^https?:\/\//i.test(domain) ? domain : `https://${domain}`
  }

  return "http://localhost:3000"
}
