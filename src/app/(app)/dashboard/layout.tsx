import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Track your Fast Miles, manage your Genesis SBT, and monitor your swap activity on Fast Protocol.",
  alternates: { canonical: "https://fastprotocol.io/dashboard" },
  openGraph: {
    title: "Dashboard — Fast Protocol",
    description:
      "Track your Fast Miles, manage your Genesis SBT, and monitor your swap activity on Fast Protocol.",
  },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
