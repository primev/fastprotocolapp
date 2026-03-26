import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

export const runtime = "edge"

export async function GET(request: NextRequest) {
  const raw = parseFloat(request.nextUrl.searchParams.get("time") || "0.4")
  const time = !isNaN(raw) && raw >= 0 && raw <= 999 ? raw.toFixed(1) : "0.4"

  const [clonoidFont, soraFont] = await Promise.all([
    fetch(new URL("./fonts/clonoid-bold-italic.ttf", import.meta.url)).then(
      (r) => r.arrayBuffer()
    ),
    fetch(new URL("./fonts/sora-semibold.ttf", import.meta.url)).then((r) =>
      r.arrayBuffer()
    ),
  ])

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(145deg, #030810 0%, #0a1a30 50%, #0c1e38 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Blue glow center */}
      <div
        style={{
          position: "absolute",
          width: "700px",
          height: "500px",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(30, 100, 200, 0.25) 0%, rgba(20, 80, 180, 0.1) 40%, transparent 70%)",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Horizontal glow line */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "2px",
          background:
            "linear-gradient(90deg, transparent 10%, rgba(0, 160, 255, 0.4) 50%, transparent 90%)",
          top: "62%",
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
          paddingBottom: "60px",
        }}
      >
        <div
          style={{
            fontFamily: "Sora",
            fontSize: "24px",
            fontWeight: 600,
            color: "rgba(150, 200, 255, 0.55)",
            letterSpacing: "0.3em",
            textTransform: "uppercase" as const,
            marginBottom: "12px",
          }}
        >
          Swap Preconfirmed
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "14px",
          }}
        >
          <div
            style={{
              fontFamily: "Clonoid",
              fontSize: "180px",
              color: "#fff",
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            {time}
          </div>
          <div
            style={{
              fontFamily: "Sora",
              fontSize: "48px",
              fontWeight: 600,
              color: "rgba(150, 200, 255, 0.45)",
              lineHeight: 1,
            }}
          >
            sec
          </div>
        </div>

        <div
          style={{
            fontFamily: "Sora",
            fontSize: "20px",
            fontWeight: 600,
            color: "rgba(150, 200, 255, 0.35)",
            marginTop: "28px",
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
        { name: "Clonoid", data: clonoidFont, style: "italic", weight: 700 },
        { name: "Sora", data: soraFont, style: "normal", weight: 600 },
      ],
    }
  )
}
