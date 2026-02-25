"use client"

import { useAccount } from "wagmi"
import { EarlyAccessForm } from "@/components/landing/EarlyAccessForm"

export default function EarlyAccessFormPage() {
  const { address } = useAccount()
  return <EarlyAccessForm initialWalletAddress={address} />
}
