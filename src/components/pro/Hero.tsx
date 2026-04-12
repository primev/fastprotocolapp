"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const Hero = () => {
  return (
    <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <Image
        src="/pro/logo-secondary.png"
        alt="Fast Protocol"
        width={480}
        height={240}
        priority
        className="h-48 md:h-60 w-auto mb-10 relative z-10"
      />

      <h1 className="font-sora font-extrabold text-3xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight max-w-4xl relative z-10">
        Better price. Instant confirmation. <span className="text-primary">You keep the mev.</span>
      </h1>

      <p className="mt-6 text-muted-foreground text-base sm:text-lg max-w-xl relative z-10">
        Most swaps get worse prices simply because they execute later in the block. Fast secures
        top-of-block execution — so you keep that value.
      </p>

      <p className="mt-2 text-xs text-muted-foreground/60 relative z-10">
        Verified against live swaps vs Uniswap and aggregators
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mt-10 relative z-10">
        <Button size="lg" className="text-base px-8 py-6 font-semibold rounded-lg" asChild>
          <Link href="/">Start Swap →</Link>
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="text-base px-8 py-6 font-medium rounded-lg border-border hover:border-primary/50"
          asChild
        >
          <a href="#comparison">View live comparison</a>
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground/70 relative z-10">
        No bridge. No new wallet. Works with your existing setup.
      </p>
    </section>
  )
}

export default Hero
