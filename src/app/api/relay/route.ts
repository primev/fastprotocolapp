import { NextResponse } from "next/server"
import type { RelayRequest, RelayResponse } from "@/types/swap"

/**
 * API route to receive and validate swap intents
 * Backend will handle actual on-chain execution via FastSettlementV3 contract
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate intent structure
    if (!body.signature || !body.intent || !body.permit) {
      return NextResponse.json<RelayResponse>(
        {
          success: false,
          message: "Missing required fields: signature, intent, or permit",
        },
        { status: 400 }
      )
    }

    // Validate intent fields (bigint values come as strings from JSON)
    const { intent } = body
    if (
      !intent.user ||
      !intent.inputToken ||
      !intent.outputToken ||
      !intent.recipient ||
      !intent.inputAmt ||
      !intent.userAmtOut ||
      !intent.deadline ||
      !intent.nonce
    ) {
      return NextResponse.json<RelayResponse>(
        {
          success: false,
          message: "Invalid intent structure",
        },
        { status: 400 }
      )
    }

    // Validate permit fields
    const { permit } = body
    if (
      !permit.permitted ||
      !permit.permitted.token ||
      !permit.permitted.amount ||
      !permit.spender ||
      !permit.nonce ||
      !permit.deadline
    ) {
      return NextResponse.json<RelayResponse>(
        {
          success: false,
          message: "Invalid permit structure",
        },
        { status: 400 }
      )
    }

    // TODO: Backend will handle actual on-chain execution
    // For now, just validate and return success
    return NextResponse.json<RelayResponse>({
      success: true,
      message: "Intent received and validated",
    })
  } catch (error) {
    console.error("Error processing relay request:", error)
    return NextResponse.json<RelayResponse>(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    )
  }
}
