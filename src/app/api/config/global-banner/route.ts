import { NextResponse } from "next/server"
import { get } from "@vercel/edge-config"

export const runtime = "edge"

export async function GET() {
  try {
    const text = await get<string>("global_banner_text")
    return NextResponse.json(
      { text: typeof text === "string" ? text : "" },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" } }
    )
  } catch (error) {
    console.error("[global-banner] Edge Config read failed:", error)
    return NextResponse.json(
      { text: "" },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" } }
    )
  }
}
