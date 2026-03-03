import { ImageResponse } from "next/og"
import { getArticle, getArticleSlugs } from "@/lib/learn"

export const runtime = "nodejs"
export const alt = "Fast Protocol Learn"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export function generateStaticParams() {
  return getArticleSlugs().map((slug) => ({ slug }))
}

export default async function OGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  let title = "Fast Protocol"
  let category = "Learn"

  try {
    const { frontmatter } = getArticle(slug)
    title = frontmatter.title
    category = frontmatter.category
  } catch {
    // fallback to defaults
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "60px 80px",
        background: "linear-gradient(135deg, #051219 0%, #071e2b 50%, #0a2a3d 100%)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "32px",
        }}
      >
        <div
          style={{
            background: "rgba(56, 139, 219, 0.15)",
            borderRadius: "9999px",
            padding: "6px 16px",
            fontSize: "18px",
            fontWeight: 600,
            color: "#388BDB",
          }}
        >
          {category}
        </div>
      </div>

      <div
        style={{
          fontSize: title.length > 40 ? "48px" : "56px",
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 1.2,
          marginBottom: "auto",
          maxWidth: "900px",
        }}
      >
        {title}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #388BDB, #2a6db5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
              fontWeight: 700,
              color: "#fff",
            }}
          >
            F
          </div>
          <div style={{ fontSize: "22px", fontWeight: 600, color: "#ffffff" }}>Fast Protocol</div>
        </div>
        <div style={{ fontSize: "18px", color: "rgba(255,255,255,0.5)" }}>
          fastprotocol.io/learn
        </div>
      </div>
    </div>,
    { ...size }
  )
}
