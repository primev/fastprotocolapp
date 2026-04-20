const inputs = [
  { label: "Weekly volume", value: "$50,000" },
  { label: "Avg value recovered", value: "0.35%" },
  { label: "mev recovered", value: "0.10%" },
]

const Earnings = () => {
  return (
    <section className="px-4 py-20 md:py-28 max-w-6xl mx-auto">
      <h2 className="font-sora font-bold text-2xl sm:text-3xl md:text-4xl text-center mb-12">
        mev rewards calculator
      </h2>

      <div className="max-w-md mx-auto bg-card border border-border rounded-xl p-6 md:p-8">
        <div className="space-y-4 mb-8">
          {inputs.map((input) => (
            <div key={input.label} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{input.label}</span>
              <span className="font-mono font-semibold text-foreground">{input.value}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-6 text-center">
          <p className="font-mono font-extrabold text-3xl sm:text-4xl text-success">+$225/month</p>
          <p className="text-xs text-muted-foreground mt-1">in recovered value</p>
          <p className="text-[11px] text-muted-foreground/70 mt-2">
            Based on the trade improvements shown above.
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">
            Conservative estimate based on real swap data.
          </p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">
            Most traders lose value due to execution ordering — this estimate reflects value
            recovered by securing better block position.
          </p>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-6">
          You are recovering value that is normally lost to mev.
        </p>
      </div>
    </section>
  )
}

export default Earnings
