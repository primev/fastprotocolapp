const metrics = [
  { label: "Avg value recovered", value: "+0.31%", positive: true, primary: true },
  { label: "Avg mev recovered", value: "$8.40", positive: true, primary: false },
  { label: "Trades routed (24h)", value: "12,847", positive: false, primary: false },
]

const LiveMetrics = () => {
  return (
    <div className="border-y border-border bg-card/50">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col items-center gap-2">
        <div className="flex items-center justify-center gap-6 sm:gap-10 flex-wrap">
          {metrics.map((m, i) => (
            <div key={m.label} className="flex items-center gap-3">
              <div className="text-center">
                <p
                  className={`font-mono font-bold ${
                    m.primary
                      ? "text-base sm:text-lg text-success"
                      : `text-sm sm:text-base ${m.positive ? "text-success/80" : "text-foreground/80"}`
                  }`}
                >
                  {m.value}
                </p>
                <p
                  className={`text-[10px] sm:text-xs ${m.primary ? "text-muted-foreground" : "text-muted-foreground/70"}`}
                >
                  {m.label}
                </p>
              </div>
              {i < metrics.length - 1 && (
                <div className="hidden sm:block w-px h-8 bg-border ml-3" />
              )}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground/40">
          Based on real mainnet swap data.
        </p>
      </div>
    </div>
  )
}

export default LiveMetrics
