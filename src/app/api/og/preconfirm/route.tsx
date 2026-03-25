import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

export const runtime = "edge"

/**
 * Dynamic OG image for preconfirmation share cards.
 * Usage: /api/og/preconfirm?time=0.4
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const time = searchParams.get("time") || "0.4"

  const secs = parseFloat(time)
  const fire = secs < 1 ? "\u{1F525}\u{1F525}\u{1F525}" : secs < 4 ? "\u{1F525}\u{1F525}" : "\u{1F525}"

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
          background: "radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Top: Fast Swaps label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            fontSize: "20px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.1em",
            textTransform: "uppercase" as const,
          }}
        >
          Fast Swaps
        </div>
      </div>

      {/* Center: speed number */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "12px",
        }}
      >
        <div
          style={{
            fontSize: "140px",
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
            color: "rgba(255,255,255,0.4)",
            lineHeight: 1,
          }}
        >
          sec
        </div>
      </div>

      {/* Fire emojis */}
      <div
        style={{
          fontSize: "36px",
          marginTop: "8px",
          marginBottom: "24px",
        }}
      >
        {fire}
      </div>

      {/* Label */}
      <div
        style={{
          fontSize: "24px",
          color: "rgba(96, 165, 250, 0.6)",
          fontWeight: 500,
        }}
      >
        swap preconfirmed
      </div>

      {/* Bottom: branding */}
      <div
        style={{
          position: "absolute",
          bottom: "40px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div
          style={{
            fontSize: "18px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.3)",
          }}
        >
          fastprotocol.io
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    }
  )
}
