import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Fast Swap Preconfirmed"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Blue lightning bolt logo — 80px, base64 embedded (4KB)
const ICON = "data:image/png;base64,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"

export default async function OGImage({
  params,
}: {
  params: Promise<{ time: string }>
}) {
  const { time: timeParam } = await params
  const raw = parseFloat(timeParam || "0.4")
  const time = !isNaN(raw) && raw >= 0 && raw <= 999 ? raw.toFixed(1) : "0.4"

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background:
          "linear-gradient(155deg, #020810 0%, #061428 25%, #0e2348 50%, #091a35 75%, #030a14 100%)",
        fontFamily: "sans-serif",
      }}
    >
      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 90% 80% at 45% 40%, transparent 20%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Primary glow — offset left to sit behind the number */}
      <div
        style={{
          position: "absolute",
          width: "800px",
          height: "600px",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(25, 100, 220, 0.3) 0%, rgba(15, 70, 170, 0.08) 45%, transparent 65%)",
          top: "15%",
          left: "30%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Inner glow */}
      <div
        style={{
          position: "absolute",
          width: "400px",
          height: "350px",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(60, 150, 255, 0.15) 0%, transparent 70%)",
          top: "30%",
          left: "35%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Horizon line */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "1px",
          top: "62%",
          background:
            "linear-gradient(90deg, transparent 2%, rgba(0, 150, 255, 0.06) 15%, rgba(0, 200, 255, 0.4) 45%, rgba(0, 150, 255, 0.06) 75%, transparent 98%)",
        }}
      />

      {/* Line bloom */}
      <div
        style={{
          position: "absolute",
          width: "50%",
          height: "40px",
          top: "60%",
          left: "20%",
          background:
            "radial-gradient(ellipse, rgba(0, 180, 255, 0.06) 0%, transparent 70%)",
        }}
      />

      {/* === LEFT SIDE: Label + Speed === */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
          paddingLeft: "80px",
          paddingBottom: "30px",
          flex: 1,
        }}
      >
        {/* SWAP PRECONFIRMED — large, bold, prominent */}
        <div
          style={{
            fontSize: "32px",
            fontWeight: 800,
            color: "rgba(160, 210, 255, 0.7)",
            letterSpacing: "0.3em",
            textTransform: "uppercase" as const,
            marginBottom: "16px",
          }}
        >
          Swap Preconfirmed
        </div>

        {/* Speed number + sec — the focal point */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
          <div
            style={{
              fontSize: "180px",
              fontWeight: 900,
              fontStyle: "italic",
              color: "#ffffff",
              lineHeight: 0.85,
              letterSpacing: "-0.03em",
            }}
          >
            {time}
          </div>
          <div
            style={{
              fontSize: "50px",
              fontWeight: 800,
              color: "rgba(160, 210, 255, 0.55)",
              lineHeight: 1,
            }}
          >
            sec
          </div>
        </div>
      </div>

      {/* === RIGHT SIDE: Logo — large, prominent, won't be covered by card overlay === */}
      <div
        style={{
          position: "absolute",
          right: "60px",
          top: "50%",
          transform: "translateY(-60%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          zIndex: 1,
        }}
      >
        <img
          src={ICON}
          width={100}
          height={100}
          style={{
            width: "100px",
            height: "100px",
            opacity: 0.8,
          }}
        />
        <div
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "rgba(150, 200, 255, 0.4)",
            letterSpacing: "0.05em",
          }}
        >
          fastprotocol.io
        </div>
      </div>
    </div>,
    { ...size }
  )
}
