import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

export const runtime = "edge"

/**
 * Dynamic OG image for preconfirmation share cards.
 * Clean background (blue glow, speed lines, Fast logo) with dynamic text overlay.
 * Usage: /api/og/preconfirm?time=0.4
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const raw = parseFloat(searchParams.get("time") || "0.4")
  const time = !isNaN(raw) && raw >= 0 && raw <= 999 ? raw.toFixed(1) : "0.4"

  const [clonoidFont, soraFont] = await Promise.all([
    fetch(new URL("./fonts/clonoid-bold-italic.ttf", import.meta.url)).then(
      (r) => r.arrayBuffer()
    ),
    fetch(new URL("./fonts/sora-semibold.ttf", import.meta.url)).then((r) =>
      r.arrayBuffer()
    ),
  ])

  const bgUrl = `${request.nextUrl.origin}/assets/og-preconfirm-bg.png`

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: "#040810",
      }}
    >
      {/* Background */}
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

      {/* Content — positioned above the blue glow line */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          paddingBottom: "80px",
        }}
      >
        {/* SWAP PRECONFIRMED */}
        <div
          style={{
            fontFamily: "Sora",
            fontSize: "26px",
            fontWeight: 600,
            color: "rgba(180, 215, 255, 0.7)",
            letterSpacing: "0.3em",
            textTransform: "uppercase" as const,
            marginBottom: "16px",
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
              fontSize: "200px",
              color: "#fff",
              lineHeight: 1,
              letterSpacing: "-0.02em",
              textShadow:
                "0 0 40px rgba(100, 180, 255, 0.5), 0 0 80px rgba(100, 180, 255, 0.3), 0 0 160px rgba(60, 140, 255, 0.15)",
            }}
          >
            {time}
          </div>
          <div
            style={{
              fontFamily: "Sora",
              fontSize: "52px",
              fontWeight: 600,
              color: "rgba(180, 215, 255, 0.55)",
              lineHeight: 1,
            }}
          >
            sec
          </div>
        </div>

        {/* fastprotocol.io */}
        <div
          style={{
            fontFamily: "Sora",
            fontSize: "22px",
            fontWeight: 600,
            color: "rgba(180, 215, 255, 0.4)",
            marginTop: "32px",
            fontStyle: "italic",
          }}
        >
          fastprotocol.io
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
