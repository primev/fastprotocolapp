import { NextRequest, NextResponse } from "next/server"

/**
 * Returns raw HTML with OG/Twitter meta tags for share card rendering.
 * Twitter's crawler doesn't execute JS, so we can't use generateMetadata.
 * Human visitors get redirected to / via meta refresh.
 */
export async function GET(request: NextRequest) {
  const raw = parseFloat(request.nextUrl.searchParams.get("time") || "0.4")
  const time = !isNaN(raw) && raw >= 0 && raw <= 999 ? raw.toFixed(1) : "0.4"

  const title = `Preconfirmed in ${time}s — Fast Swaps`
  const description = `Swap preconfirmed in ${time} seconds on Fast Protocol`
  const origin = request.nextUrl.origin
  const ogImage = `${origin}/api/og/preconfirm?time=${time}`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@Fast_Protocol" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImage}" />
  <meta http-equiv="refresh" content="0;url=/" />
</head>
<body></body>
</html>`

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
