import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { parseJson } from "@/lib/api/parse"
import { barterRouteResponseSchema } from "@/lib/api/upstream"

const BARTER_API_BASE = "https://api2.eth.barterswap.xyz"

// Barter accepts source/target as token addresses and sellAmount as a
// base-unit string. We don't constrain the format further here because
// Barter itself will 400 on garbage — but we do enforce non-emptiness
// so the proxy never sends a hollow request.
const bodySchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  sellAmount: z.union([z.string().min(1), z.number()]),
})

export async function POST(request: NextRequest) {
  const parsed = await parseJson(request, bodySchema)
  if (parsed instanceof NextResponse) return parsed
  const { source, target, sellAmount } = parsed

  try {
    const apiKey = process.env.BARTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Barter API key invalid or missing." }, { status: 500 })
    }

    const requestId = crypto.randomUUID?.() ?? `route-${Date.now()}`

    const resp = await fetch(`${BARTER_API_BASE}/route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Request-Id": requestId,
      },
      body: JSON.stringify({
        source: String(source).toLowerCase(),
        target: String(target).toLowerCase(),
        sellAmount: String(sellAmount),
      }),
    })

    const rawData = await resp.json()

    if (!resp.ok) {
      const msg = rawData?.error ?? rawData?.message ?? `Barter API error (${resp.status})`
      return NextResponse.json({ error: msg }, { status: resp.status })
    }

    // Upstream-shape guard: a Barter response without outputWithGasAmount or
    // gasEstimation is unpriceable. The schema requires both; if either is
    // missing we return 502 so the UI shows a real error instead of
    // silently quoting undefined.
    const parsedResp = barterRouteResponseSchema.safeParse(rawData)
    if (!parsedResp.success) {
      console.error("Barter route shape drift:", parsedResp.error.issues)
      return NextResponse.json(
        { error: "Barter API error. Invalid route response." },
        { status: 502 }
      )
    }
    const data = parsedResp.data

    const response: Record<string, unknown> = {
      outputAmount: String(data.outputWithGasAmount),
      gasEstimation: Number(data.gasEstimation),
    }
    if (data.transactionFee != null) response.transactionFee = String(data.transactionFee)
    if (data.gasPrice != null) response.gasPrice = String(data.gasPrice)

    return NextResponse.json(response)
  } catch (error) {
    console.error("Barter route API error:", error)
    return NextResponse.json(
      { error: "Barter API error. Please check your connection." },
      { status: 500 }
    )
  }
}
