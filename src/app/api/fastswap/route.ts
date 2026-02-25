import { NextRequest, NextResponse } from "next/server"
import { FASTSWAP_API_BASE } from "@/lib/network-config"

/**
 * Proxies swap intent requests to the FastSwap API.
 * Handles slippage as a string percentage (e.g. "1.0" for 1%).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      user,
      inputToken,
      outputToken,
      inputAmt,
      userAmtOut,
      recipient,
      deadline,
      nonce,
      signature,
      slippage,
    } = body

    if (
      !user ||
      !inputToken ||
      !outputToken ||
      !inputAmt ||
      !userAmtOut ||
      !deadline ||
      !nonce ||
      !signature
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: user, inputToken, outputToken, inputAmt, userAmtOut, deadline, nonce, signature",
        },
        { status: 400 }
      )
    }

    // Validate and format slippage (e.g. "1.0" for 1%)
    const slippageNum = parseFloat(slippage)
    const slippageFormatted =
      !Number.isNaN(slippageNum) && slippageNum >= 0 ? slippageNum.toFixed(1) : "0.5"

    const payload = {
      ...body,
      slippage: slippageFormatted,
    }

    const resp = await fetch(`${FASTSWAP_API_BASE}/fastswap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const result = await resp.json()

    if (!resp.ok) {
      return NextResponse.json(result, { status: resp.status })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("FastSwap API proxy error:", error)
    return NextResponse.json(
      { error: "FastSwap API error. Please check your connection." },
      { status: 500 }
    )
  }
}
