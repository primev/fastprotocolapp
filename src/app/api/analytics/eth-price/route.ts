import { NextResponse } from "next/server"
import { getEthPrice } from "@/lib/analytics-server"

export async function GET() {
  try {
    const ethPrice = await getEthPrice()

    if (ethPrice === null) {
      return NextResponse.json({ error: "Failed to fetch ETH price" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      ethPrice: ethPrice,
    })
  } catch (error) {
    console.error("Error fetching ETH price:", error)
    return NextResponse.json({ error: "Failed to fetch ETH price" }, { status: 500 })
  }
}
