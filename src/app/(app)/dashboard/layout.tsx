import type { Metadata } from "next"
import { SITE_URL } from "@/lib/site-config"

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Track your Fast Miles, manage your Genesis SBT, and monitor your swap activity on Fast Protocol.",
  alternates: { canonical: `${SITE_URL}/dashboard` },
  openGraph: {
    title: "Dashboard | Fast Protocol",
    description:
      "Track your Fast Miles, manage your Genesis SBT, and monitor your swap activity on Fast Protocol.",
  },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
