import Hero from "@/components/pro/Hero"
import LiveMetrics from "@/components/pro/LiveMetrics"
import Comparison from "@/components/pro/Comparison"
import BlockPosition from "@/components/pro/BlockPosition"
import WhyItWorks from "@/components/pro/WhyItWorks"
import Earnings from "@/components/pro/Earnings"
import Speed from "@/components/pro/Speed"
import FinalCTA from "@/components/pro/FinalCTA"

export default function ProPage() {
  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Hero />
      <LiveMetrics />
      <Comparison />
      <BlockPosition />
      <WhyItWorks />
      <Earnings />
      <Speed />
      <FinalCTA />
    </main>
  )
}
