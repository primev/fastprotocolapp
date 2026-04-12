import { Zap, GitBranch, ArrowDownToLine } from "lucide-react"

const cards = [
  {
    icon: Zap,
    title: "Top-of-block execution",
    text: "Your transaction is preconfirmed before block inclusion, securing optimal position and reducing reordering slippage.",
  },
  {
    icon: GitBranch,
    title: "Routing + execution optimization",
    text: "Aggregates liquidity across DEXs including Uniswap for optimal pricing.",
  },
  {
    icon: ArrowDownToLine,
    title: "mev returned (not extracted)",
    text: "Instead of extraction, mev is recovered and redistributed back to the trader.",
  },
]

const WhyItWorks = () => {
  return (
    <section className="px-4 py-20 md:py-28 max-w-6xl mx-auto">
      <h2 className="font-sora font-bold text-2xl sm:text-3xl md:text-4xl text-center mb-12">
        Why Fast outperforms
      </h2>

      <div className="grid sm:grid-cols-3 gap-5">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 transition-colors"
          >
            <card.icon className="w-8 h-8 text-primary mb-4" strokeWidth={1.5} />
            <h3 className="font-sora font-semibold text-base mb-2">{card.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{card.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default WhyItWorks
