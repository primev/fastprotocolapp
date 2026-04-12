import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const ProHeader = () => {
  return (
    <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="relative z-10">
          <Image
            src="/assets/fast-icon.png"
            alt="Fast Protocol"
            width={48}
            height={48}
            className="md:hidden w-12 h-12"
            priority
          />
          <Image
            src="/assets/fast-protocol-logo-icon.png"
            alt="Fast Protocol"
            width={200}
            height={100}
            className="hidden md:block h-12 w-auto"
            priority
          />
        </Link>
        <Button variant="outline" size="sm" asChild>
          <Link href="/">Launch App</Link>
        </Button>
      </div>
    </header>
  )
}

export default ProHeader
