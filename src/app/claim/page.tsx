import { getTotalSupply } from "@/lib/contract-server"
import { ClaimPageClient } from "@/components/claim/ClaimPageClient"

const ClaimPage = async () => {
  // Fetch totalSupply on the server before rendering
  const totalSupply = await getTotalSupply()
  
  // Convert bigint to string for serialization (Next.js can't serialize bigint directly)
  const totalSupplyString = totalSupply !== null ? totalSupply.toString() : null

  return <ClaimPageClient initialTotalSupply={totalSupplyString} />
}

export default ClaimPage
