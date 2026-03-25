import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

export const runtime = "edge"

/**
 * Dynamic OG image for preconfirmation share cards.
 * Usage: /api/og/preconfirm?time=0.4
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const raw = parseFloat(searchParams.get("time") || "0.4")
  const time = !isNaN(raw) && raw >= 0 && raw <= 999 ? raw.toFixed(1) : "0.4"

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "linear-gradient(145deg, #050a10 0%, #0a1628 40%, #0d1f3c 100%)",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle radial glow */}
      <div
        style={{
          position: "absolute",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Top label */}
      <div
        style={{
          fontSize: "18px",
          fontWeight: 600,
          color: "rgba(255,255,255,0.35)",
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          marginBottom: "20px",
        }}
      >
        Swap Preconfirmed
      </div>

      {/* Speed number */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "12px",
        }}
      >
        <div
          style={{
            fontSize: "148px",
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1,
            letterSpacing: "-0.04em",
          }}
        >
          {time}
        </div>
        <div
          style={{
            fontSize: "48px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.35)",
            lineHeight: 1,
          }}
        >
          sec
        </div>
      </div>

      {/* Thin accent line */}
      <div
        style={{
          width: "80px",
          height: "2px",
          background: "linear-gradient(90deg, transparent, rgba(96, 165, 250, 0.5), transparent)",
          marginTop: "28px",
          marginBottom: "28px",
        }}
      />

      {/* Branding */}
      <div
        style={{
          fontSize: "20px",
          fontWeight: 600,
          color: "rgba(255,255,255,0.25)",
        }}
      >
        fastprotocol.io
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    }
  )
}
