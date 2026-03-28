import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

export const runtime = "edge"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ time: string }> }
) {
  const { time: timeParam } = await params
  const raw = parseFloat(timeParam || "0.4")
  const time = !isNaN(raw) && raw >= 0 && raw <= 999 ? raw.toFixed(1) : "0.4"

  // Subsetted fonts: Clonoid digits-only (2.5KB), Sora label chars only (5KB)
  const [clonoidFont, soraFont] = await Promise.all([
    fetch(new URL("../fonts/clonoid-digits.ttf", import.meta.url)).then((r) =>
      r.arrayBuffer()
    ),
    fetch(new URL("../fonts/sora-subset.ttf", import.meta.url)).then((r) =>
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
        background:
          "linear-gradient(160deg, #020810 0%, #071428 35%, #0d2040 60%, #091830 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 70% at 50% 42%, transparent 30%, rgba(0,0,0,0.45) 100%)",
        }}
      />

      {/* Primary glow */}
      <div
        style={{
          position: "absolute",
          width: "800px",
          height: "500px",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(20, 90, 200, 0.3) 0%, rgba(15, 70, 170, 0.12) 35%, transparent 65%)",
          top: "22%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Inner glow behind number */}
      <div
        style={{
          position: "absolute",
          width: "500px",
          height: "300px",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(50, 140, 255, 0.12) 0%, transparent 70%)",
          top: "38%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Horizon line */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "1px",
          top: "66%",
          background:
            "linear-gradient(90deg, transparent 5%, rgba(0, 180, 255, 0.12) 25%, rgba(0, 200, 255, 0.45) 50%, rgba(0, 180, 255, 0.12) 75%, transparent 95%)",
        }}
      />

      {/* Line bloom */}
      <div
        style={{
          position: "absolute",
          width: "50%",
          height: "30px",
          top: "64.5%",
          left: "25%",
          background:
            "radial-gradient(ellipse, rgba(0, 160, 255, 0.06) 0%, transparent 70%)",
        }}
      />

      {/* Content — shifted up slightly so number sits above horizon */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          zIndex: 1,
          marginTop: "-30px",
        }}
      >
        {/* SWAP PRECONFIRMED */}
        <div
          style={{
            fontFamily: "Sora",
            fontSize: "20px",
            fontWeight: 600,
            color: "rgba(160, 205, 255, 0.55)",
            letterSpacing: "0.4em",
            textTransform: "uppercase" as const,
            marginBottom: "20px",
          }}
        >
          Swap Preconfirmed
        </div>

        {/* Number + sec on same baseline */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "18px",
          }}
        >
          <div
            style={{
              fontFamily: "Clonoid",
              fontSize: "200px",
              color: "#ffffff",
              lineHeight: 0.85,
              letterSpacing: "-0.02em",
            }}
          >
            {time}
          </div>
          <div
            style={{
              fontFamily: "Sora",
              fontSize: "46px",
              fontWeight: 600,
              color: "rgba(160, 205, 255, 0.5)",
              lineHeight: 1,
            }}
          >
            sec
          </div>
        </div>
      </div>

      {/* fastprotocol.io — pinned to bottom with generous padding */}
      <div
        style={{
          position: "absolute",
          bottom: "40px",
          fontFamily: "Sora",
          fontSize: "18px",
          fontWeight: 600,
          color: "rgba(140, 190, 255, 0.28)",
          fontStyle: "italic",
          letterSpacing: "0.06em",
        }}
      >
        fastprotocol.io
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
