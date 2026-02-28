import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Refer & Earn",
  description:
    "Invite friends to Fast Protocol and earn rewards when they swap.",
  openGraph: {
    title: "Refer & Earn — Fast Protocol",
    description:
      "Invite friends to Fast Protocol and earn rewards when they swap.",
  },
}

export default function ReferralLayout({ children }: { children: React.ReactNode }) {
  return children
}
