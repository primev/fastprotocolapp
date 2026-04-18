import type { Metadata } from "next"
import { SITE_URL } from "@/lib/config/site"

export const metadata: Metadata = {
  title: "Refer Friends",
  description:
    "Invite friends to Fast Protocol and earn bonus rewards. Share your referral link for sub-second swaps on Ethereum.",
  alternates: { canonical: `${SITE_URL}/referral` },
  openGraph: {
    title: "Refer Friends | Fast Protocol",
    description:
      "Invite friends to Fast Protocol and earn bonus rewards. Share your referral link for sub-second swaps on Ethereum.",
  },
}

export default function ReferralLayout({ children }: { children: React.ReactNode }) {
  return children
}
