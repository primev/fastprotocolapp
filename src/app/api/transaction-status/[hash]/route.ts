import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { env } from "@/env/server"
import { parseParams } from "@/lib/api/parse"
import { txHashSchema } from "@/lib/api/schemas"

const paramsSchema = z.object({ hash: txHashSchema })

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  const parsed = await parseParams(params, paramsSchema)
  if (!parsed.ok) return parsed.response
  const { hash } = parsed.data

  try {
    const apiToken = env.FAST_RPC_API_TOKEN || ""

    const response = await fetch(`https://fastrpc.mev-commit.xyz/status/${hash}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { success: false, error: errorText || `API returned status ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({ success: true, hash, data })
  } catch (error) {
    const errorMessage = "Fast RPC not properly configured"
    console.error("Error querying transaction status:", errorMessage)
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
