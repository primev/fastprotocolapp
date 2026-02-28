import type { Metadata } from "next"

export const metadata: Metadata = {
  alternates: { canonical: "https://fastprotocol.io/referral" },
}

export default function ReferralLayout({ children }: { children: React.ReactNode }) {
  return children
}
