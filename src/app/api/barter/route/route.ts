import { NextRequest, NextResponse } from "next/server"

const BARTER_API_BASE = "https://api2.eth.barterswap.xyz"

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    // Empty or malformed body (typically a probe or stray retry). Respond cleanly
    // without polluting logs with a stack trace.
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    const { source, target, sellAmount, isEthInput } = (body ?? {}) as {
      source?: string
      target?: string
      sellAmount?: string
      isEthInput?: boolean
    }

    if (!source || !target || !sellAmount) {
      return NextResponse.json(
        { error: "Missing required fields: source, target, sellAmount" },
        { status: 400 }
      )
    }

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

    // Two distinct fields, two distinct downstream questions:
    //
    // - `outputAmount` (pre-gas) is what Barter's router would deliver before
    //   relayer gas is deducted. This is the realized routing output regardless
    //   of path, so it's the right basis for *MEV / surplus* estimation
    //   (`barter_pre_gas - userAmtOut` matches what the FastSettlement contract
    //   retains as surplus, which is what miles are credited from).
    //
    // - `outputWithGasAmount` (post-gas) is what the user actually receives
    //   after the relayer deducts L1 gas on the permit path; on the ETH path
    //   the user pays gas themselves, so it equals `outputAmount`. This is the
    //   right basis for the *amount-too-small* gate (can the user actually
    //   receive their floor on this trade?).
    //
    // Returning both lets the client expose two derived numbers without making
    // path-specific decisions in the proxy.
    const outputAmount = data?.outputAmount
    const outputWithGasAmount = isEthInput === true ? data?.outputAmount : data?.outputWithGasAmount
    const gasEstimation = data?.gasEstimation
    const transactionFee = data?.transactionFee
    const gasPrice = data?.gasPrice

    if (outputAmount == null || outputWithGasAmount == null || gasEstimation == null) {
      return NextResponse.json(
        { error: "Barter API error. Invalid route response." },
        { status: 500 }
      )
    }

    const response: Record<string, unknown> = {
      outputAmount: String(outputWithGasAmount),
      outputAmountPreGas: String(outputAmount),
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
