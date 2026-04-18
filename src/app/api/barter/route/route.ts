import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { parseJson } from "@/lib/api/parse"

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

    const data = await resp.json()

    if (!resp.ok) {
      const msg = data?.error ?? data?.message ?? `Barter API error (${resp.status})`
      return NextResponse.json({ error: msg }, { status: resp.status })
    }

    const outputAmount = data?.outputWithGasAmount
    const gasEstimation = data?.gasEstimation
    const transactionFee = data?.transactionFee
    const gasPrice = data?.gasPrice

    if (outputAmount == null || gasEstimation == null) {
      return NextResponse.json(
        { error: "Barter API error. Invalid route response." },
        { status: 500 }
      )
    }

    const response: Record<string, unknown> = {
      outputAmount: String(outputAmount),
      gasEstimation: Number(gasEstimation),
    }
    if (transactionFee != null) response.transactionFee = String(transactionFee)
    if (gasPrice != null) response.gasPrice = String(gasPrice)

    return NextResponse.json(response)
  } catch (error) {
    console.error("Barter route API error:", error)
    return NextResponse.json(
      { error: "Barter API error. Please check your connection." },
      { status: 500 }
    )
  }
}
