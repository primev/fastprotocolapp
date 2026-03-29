import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Fast Swap Preconfirmed"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

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
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(160deg, #020810 0%, #06122a 30%, #0e2348 55%, #091a35 80%, #040c18 100%)",
        fontFamily: "sans-serif",
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
            "radial-gradient(ellipse 85% 75% at 50% 42%, transparent 25%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* Primary glow */}
      <div
        style={{
          position: "absolute",
          width: "900px",
          height: "550px",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(25, 100, 220, 0.35) 0%, rgba(15, 70, 170, 0.1) 40%, transparent 65%)",
          top: "25%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Inner glow */}
      <div
        style={{
          position: "absolute",
          width: "450px",
          height: "280px",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(60, 150, 255, 0.18) 0%, rgba(40, 120, 255, 0.06) 50%, transparent 70%)",
          top: "36%",
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
            "linear-gradient(90deg, transparent 3%, rgba(0, 150, 255, 0.08) 20%, rgba(0, 200, 255, 0.5) 50%, rgba(0, 150, 255, 0.08) 80%, transparent 97%)",
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          zIndex: 1,
          marginTop: "-20px",
        }}
      >
        <div
          style={{
            fontSize: "19px",
            fontWeight: 700,
            color: "rgba(170, 210, 255, 0.6)",
            letterSpacing: "0.45em",
            textTransform: "uppercase" as const,
            marginBottom: "24px",
          }}
        >
          Swap Preconfirmed
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "18px" }}>
          <div
            style={{
              fontSize: "210px",
              fontWeight: 900,
              fontStyle: "italic",
              color: "#ffffff",
              lineHeight: 0.82,
              letterSpacing: "-0.02em",
            }}
          >
            {time}
          </div>
          <div
            style={{
              fontSize: "44px",
              fontWeight: 700,
              color: "rgba(170, 210, 255, 0.5)",
              lineHeight: 1,
            }}
          >
            sec
          </div>
        </div>
      </div>

      {/* Branding */}
      <div
        style={{
          position: "absolute",
          bottom: "34px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "20px",
          fontWeight: 700,
          color: "rgba(150, 200, 255, 0.35)",
          fontStyle: "italic",
        }}
      >
        fastprotocol.io
      </div>
    </div>,
    { ...size }
  )
}
