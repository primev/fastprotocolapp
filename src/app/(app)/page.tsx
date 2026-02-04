import { Hero } from "@/components/swap/HeroSection"
import { AnimatedBackgroundOrbs } from "@/components/swap/OrbAnimatedBackground"
import { SwapForm } from "@/components/swap/SwapForm"

export default function IndexPage() {
  return (
    <div className="relative flex flex-col items-center justify-start px-4 xs:pt-6 pb-4">
      <AnimatedBackgroundOrbs />
      <Hero />
      <SwapForm />
    </div>
  )
}
