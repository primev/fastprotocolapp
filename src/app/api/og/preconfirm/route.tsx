import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const runtime = "edge"

/**
 * Dynamic OG image for preconfirmation share cards.
 * Uses designer-provided background + custom fonts (Clonoid Bold Italic, Sora).
 * Usage: /api/og/preconfirm?time=0.4
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const raw = parseFloat(searchParams.get("time") || "0.4")
  const time = !isNaN(raw) && raw >= 0 && raw <= 999 ? raw.toFixed(1) : "0.4"

  // Load custom fonts
  const [clonoidFont, soraFont] = await Promise.all([
    fetch(new URL("./fonts/clonoid-bold-italic.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("./fonts/sora-semibold.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
  ])

  // Background image — designer-provided template with blue glow + speed lines
  const bgUrl = `${request.nextUrl.origin}/assets/og-preconfirm-bg.png`

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
        backgroundColor: "#040810",
      }}
    >
      {/* Background image */}
      <img
        src={bgUrl}
        width={1200}
        height={630}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      {/* Content overlay */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* SWAP PRECONFIRMED */}
        <div
          style={{
            fontFamily: "Sora",
            fontSize: "24px",
            fontWeight: 600,
            color: "rgba(160, 200, 255, 0.5)",
            letterSpacing: "0.25em",
            textTransform: "uppercase" as const,
            marginBottom: "10px",
          }}
        >
          Swap Preconfirmed
        </div>

        {/* Speed number + sec */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "16px",
          }}
        >
          <div
            style={{
              fontFamily: "Clonoid",
              fontSize: "180px",
              color: "#fff",
              lineHeight: 1,
              letterSpacing: "-0.02em",
              textShadow: "0 0 60px rgba(100, 180, 255, 0.4), 0 0 120px rgba(100, 180, 255, 0.2)",
            }}
          >
            {time}
          </div>
          <div
            style={{
              fontFamily: "Sora",
              fontSize: "48px",
              fontWeight: 600,
              color: "rgba(160, 200, 255, 0.5)",
              lineHeight: 1,
            }}
          >
            sec
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Clonoid",
          data: clonoidFont,
          style: "italic",
          weight: 700,
        },
        {
          name: "Sora",
          data: soraFont,
          style: "normal",
          weight: 600,
        },
      ],
    }
  )
}
