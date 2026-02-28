import type { MetadataRoute } from "next"

function getBaseUrl(): string {
  const vercelEnv = process.env.VERCEL_ENV
  const domain =
    vercelEnv === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : process.env.VERCEL_URL
  if (domain) {
    return /^https?:\/\//i.test(domain) ? domain : `https://${domain}`
  }
  return "http://localhost:3000"
}

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl()

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
