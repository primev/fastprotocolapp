import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

export const runtime = "edge"

export async function GET(request: NextRequest) {
  const raw = parseFloat(request.nextUrl.searchParams.get("time") || "0.4")
  const time = !isNaN(raw) && raw >= 0 && raw <= 999 ? raw.toFixed(1) : "0.4"

  // Subsetted fonts: Clonoid digits-only (2.5KB), Sora label chars only (5KB)
  const [clonoidFont, soraFont] = await Promise.all([
    fetch(new URL("./fonts/clonoid-digits.ttf", import.meta.url)).then((r) =>
      r.arrayBuffer()
    ),
    fetch(new URL("./fonts/sora-subset.ttf", import.meta.url)).then((r) =>
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
        background: "linear-gradient(160deg, #020810 0%, #071428 35%, #0d2040 60%, #091830 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Outer subtle vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 70% at 50% 45%, transparent 30%, rgba(0,0,0,0.4) 100%)",
        }}
      />

      {/* Primary blue glow — centered upper half */}
      <div
        style={{
          position: "absolute",
          width: "800px",
          height: "500px",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(20, 90, 200, 0.3) 0%, rgba(15, 70, 170, 0.12) 35%, transparent 65%)",
          top: "20%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Secondary smaller glow for depth */}
      <div
        style={{
          position: "absolute",
          width: "400px",
          height: "300px",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(40, 130, 255, 0.15) 0%, transparent 70%)",
          top: "35%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Cyan horizon line */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "1px",
          top: "63%",
          background:
            "linear-gradient(90deg, transparent 5%, rgba(0, 180, 255, 0.15) 25%, rgba(0, 200, 255, 0.5) 50%, rgba(0, 180, 255, 0.15) 75%, transparent 95%)",
        }}
      />

      {/* Soft glow on the line */}
      <div
        style={{
          position: "absolute",
          width: "60%",
          height: "40px",
          top: "61.5%",
          left: "20%",
          background:
            "radial-gradient(ellipse, rgba(0, 160, 255, 0.08) 0%, transparent 70%)",
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
          paddingBottom: "70px",
        }}
      >
        {/* SWAP PRECONFIRMED label */}
        <div
          style={{
            fontFamily: "Sora",
            fontSize: "22px",
            fontWeight: 600,
            color: "rgba(140, 190, 255, 0.45)",
            letterSpacing: "0.35em",
            textTransform: "uppercase" as const,
            marginBottom: "8px",
          }}
        >
          Swap Preconfirmed
        </div>

        {/* Speed number + sec */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
          <div
            style={{
              fontFamily: "Clonoid",
              fontSize: "200px",
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
              fontSize: "52px",
              fontWeight: 600,
              color: "rgba(140, 190, 255, 0.4)",
              lineHeight: 1,
              marginBottom: "20px",
            }}
          >
            sec
          </div>
        </div>

        {/* Branding */}
        <div
          style={{
            fontFamily: "Sora",
            fontSize: "22px",
            fontWeight: 600,
            color: "rgba(140, 190, 255, 0.3)",
            marginTop: "24px",
            fontStyle: "italic",
            letterSpacing: "0.05em",
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
