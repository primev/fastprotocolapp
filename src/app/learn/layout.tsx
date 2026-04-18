import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { getBaseUrl } from "@/lib/config/site"

export const metadata: Metadata = {
  title: {
    default: "Learn — Fast Protocol",
    template: "%s | Fast Protocol",
  },
  description:
    "Learn about preconfirmations, mev rewards, fast swaps, and how Fast Protocol delivers sub-second Ethereum transactions.",
  alternates: {
    canonical: `${getBaseUrl()}/learn`,
  },
}

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 lg:py-3 flex items-center justify-between">
          <Link href="/">
            <Image
              src="/assets/fast-icon.png"
              alt="Fast Protocol"
              width={40}
              height={40}
              className="sm:hidden"
            />
            <Image
              src="/assets/fast-protocol-logo-icon.png"
              alt="Fast Protocol"
              width={150}
              height={75}
              className="hidden sm:block"
            />
          </Link>

          <div className="flex items-center gap-2">
            <h1 className="text-muted-foreground font-bold">Learn</h1>
            <span className="w-px h-6 bg-border mx-1" />
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 shrink-0"
            >
              Launch App
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/50 py-8">
        <p className="text-sm text-muted-foreground text-center">
          &copy; {new Date().getFullYear()} Fast Protocol
        </p>
      </footer>
    </div>
  )
}
