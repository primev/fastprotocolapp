import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { FASTSWAP_API_BASE } from "@/lib/config/network"
import { parseJson } from "@/lib/api/parse"
import { walletAddressSchema } from "@/lib/api/schemas"

// The FastSwap API is strict about these nine fields. Missing any of them
// produces a cryptic upstream error, so we validate here and fail fast with
// a precise message. The schema mirrors the upstream contract — update both
// if new fields are added.
const fastswapSchema = z
  .object({
    user: walletAddressSchema,
    inputToken: z.string().min(1),
    outputToken: z.string().min(1),
    inputAmt: z.string().min(1),
    userAmtOut: z.string().min(1),
    recipient: walletAddressSchema.optional(),
    deadline: z.union([z.string(), z.number()]).refine(Boolean, "deadline is required"),
    nonce: z.union([z.string(), z.number()]).refine(Boolean, "nonce is required"),
    signature: z.string().min(1),
    // Slippage arrives as a string percent (e.g. "1.0" for 1%). We clamp and
    // default downstream so clients can ship partial fields during iteration.
    slippage: z.string().optional(),
  })
  .passthrough() // upstream accepts extra fields; let them through unchanged

export async function POST(request: NextRequest) {
  const body = await parseJson(request, fastswapSchema)
  if (!body.ok) return body.response

  // Normalize slippage to the "1.0" / "0.5" string form FastSwap expects.
  const slippageNum = parseFloat(body.data.slippage ?? "")
  const slippageFormatted =
    !Number.isNaN(slippageNum) && slippageNum >= 0 ? slippageNum.toFixed(1) : "0.5"

  try {
    const resp = await fetch(`${FASTSWAP_API_BASE}/fastswap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body.data, slippage: slippageFormatted }),
    })
    const result = await resp.json()
    if (!resp.ok) return NextResponse.json(result, { status: resp.status })
    return NextResponse.json(result)
  } catch (error) {
    console.error("FastSwap API proxy error:", error)
    return NextResponse.json(
      { error: "FastSwap API error. Please check your connection." },
      { status: 500 }
    )
  }
}
