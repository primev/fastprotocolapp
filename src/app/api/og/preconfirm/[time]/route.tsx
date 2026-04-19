import { ImageResponse } from "next/og"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { parseParams } from "@/lib/api/parse"

export const runtime = "edge"

// `time` comes in as a URL segment string like "0.4". Coerce to number,
// clamp to a reasonable display range. OG crawlers never pass junk so a
// parse failure is an edge case — we fall back to the default 0.4s
// rather than returning an error image.
const paramsSchema = z.object({
  time: z.coerce.number().min(0).max(999).default(0.4),
})

const ICON_DATA_URI =
  "data:image/png;base64,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"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ time: string }> }
) {
  const parsed = await parseParams(params, paramsSchema)
  // Soft-fail to default — see schema comment. A 400 here would ruin
  // whatever social card the crawler is trying to render.
  const time = (parsed instanceof NextResponse ? 0.4 : parsed.time).toFixed(1)

  const [clonoidFont, soraFont] = await Promise.all([
    fetch(new URL("../fonts/clonoid-digits.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("../fonts/sora-subset.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
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
          "linear-gradient(160deg, #020810 0%, #06122a 30%, #0e2348 55%, #091a35 80%, #040c18 100%)",
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

      {/* Primary glow — large, soft */}
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

      {/* Inner bright glow behind number */}
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

      {/* Line glow bloom */}
      <div
        style={{
          position: "absolute",
          width: "40%",
          height: "50px",
          top: "63.5%",
          left: "30%",
          background: "radial-gradient(ellipse, rgba(0, 180, 255, 0.07) 0%, transparent 70%)",
        }}
      />

      {/* Decorative side accents — left */}
      <div
        style={{
          position: "absolute",
          width: "200px",
          height: "1px",
          top: "42%",
          left: "4%",
          background: "linear-gradient(90deg, transparent, rgba(60, 160, 255, 0.15), transparent)",
          transform: "rotate(-2deg)",
        }}
      />

      {/* Decorative side accents — right */}
      <div
        style={{
          position: "absolute",
          width: "200px",
          height: "1px",
          top: "44%",
          right: "4%",
          background: "linear-gradient(90deg, transparent, rgba(60, 160, 255, 0.15), transparent)",
          transform: "rotate(2deg)",
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
        {/* SWAP PRECONFIRMED */}
        <div
          style={{
            fontFamily: "Sora",
            fontSize: "19px",
            fontWeight: 600,
            color: "rgba(170, 210, 255, 0.6)",
            letterSpacing: "0.45em",
            textTransform: "uppercase" as const,
            marginBottom: "24px",
          }}
        >
          Swap Preconfirmed
        </div>

        {/* Number + sec */}
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
              fontSize: "210px",
              color: "#ffffff",
              lineHeight: 0.82,
              letterSpacing: "-0.02em",
            }}
          >
            {time}
          </div>
          <div
            style={{
              fontFamily: "Sora",
              fontSize: "44px",
              fontWeight: 600,
              color: "rgba(170, 210, 255, 0.5)",
              lineHeight: 1,
            }}
          >
            sec
          </div>
        </div>
      </div>

      {/* Bottom: logo + fastprotocol.io */}
      <div
        style={{
          position: "absolute",
          bottom: "34px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
        }}
      >
        <img src={ICON_DATA_URI} width={48} height={48} style={{ width: "48px", height: "48px" }} />
        <div
          style={{
            fontFamily: "Sora",
            fontSize: "22px",
            fontWeight: 600,
            color: "rgba(150, 200, 255, 0.4)",
            letterSpacing: "0.06em",
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
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  )
}
