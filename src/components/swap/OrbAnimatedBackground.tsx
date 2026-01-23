export const AnimatedBackgroundOrbs = () => {
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden pointer-events-none z-0">
      {/* Primary orb */}
      <div className="absolute top-1/4 -left-32 w-80 h-80 sm:w-[500px] sm:h-[500px] rounded-full bg-primary/20 blur-3xl animate-pulse" />
      {/* Secondary orb */}
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 sm:w-[500px] sm:h-[500px] rounded-full bg-pink-500/15 blur-3xl animate-pulse [animation-delay:1s]" />
      {/* Accent orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 sm:w-96 sm:h-96 rounded-full bg-accent/10 blur-3xl animate-pulse [animation-delay:2s]" />
    </div>
  )
}
