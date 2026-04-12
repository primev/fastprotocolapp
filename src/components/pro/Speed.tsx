const rows = [
  {
    label: "Confirmation",
    fast: "<500 ms",
    typical: "10–15 sec",
    fastHighlight: true,
  },
  {
    label: "Block position",
    fast: "Top-of-block",
    typical: "Variable",
    fastHighlight: false,
  },
  {
    label: "Failure risk",
    fast: "Low",
    typical: "Medium",
    fastHighlight: false,
  },
  {
    label: "Slippage exposure",
    fast: "Reduced",
    typical: "Higher",
    fastHighlight: false,
  },
]

const Speed = () => {
  return (
    <section className="px-4 py-20 md:py-28 max-w-6xl mx-auto">
      <h2 className="font-sora font-bold text-2xl sm:text-3xl md:text-4xl text-center mb-3">
        Sub-second confirmation vs standard DEX
      </h2>
      <p className="text-sm text-muted-foreground/70 text-center mb-12 max-w-md mx-auto">
        Speed = position advantage. Earlier execution = better price.
      </p>

      <div className="max-w-lg mx-auto bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left px-5 py-3 font-medium">Action</th>
              <th className="text-right px-5 py-3 font-medium">
                <span className="text-primary font-semibold">Fast Protocol</span>
              </th>
              <th className="text-right px-5 py-3 font-medium">Typical DEX</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-border/50 last:border-0">
                <td className="px-5 py-4 text-muted-foreground">{row.label}</td>
                <td className="text-right px-5 py-4">
                  {row.fastHighlight ? (
                    <span className="font-mono font-bold text-primary motion-safe:animate-pulse-glow drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]">
                      {row.fast}
                    </span>
                  ) : (
                    <span
                      className={`font-mono font-semibold ${row.fast === "Top-of-block" ? "text-success" : "text-foreground"}`}
                    >
                      {row.fast}
                    </span>
                  )}
                </td>
                <td className="text-right px-5 py-4 font-mono text-muted-foreground">
                  {row.typical}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default Speed
