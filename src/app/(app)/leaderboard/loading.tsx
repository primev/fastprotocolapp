// Loading state for leaderboard - layout provides header, so only show content skeleton
export default function Loading() {
  return (
    <div className="w-full container mx-auto px-0 sm:px-0 pb-2 md:pb-4 overflow-x-hidden">
      <div className="w-full max-w-7xl mx-auto pt-2 pb-4 md:py-8 px-3 sm:px-4 md:px-6 space-y-4 md:space-y-6">
        {/* Header skeleton */}
        <div className="flex flex-col gap-5 border-b border-white/5 pb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="h-16 w-64 bg-muted/20 animate-pulse rounded" />
            <div className="flex items-center gap-6 sm:gap-10">
              <div className="h-8 w-24 bg-muted/20 animate-pulse rounded" />
              <div className="h-8 w-32 bg-muted/20 animate-pulse rounded" />
            </div>
          </div>
        </div>
        {/* Cards skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          <div className="h-32 bg-muted/10 animate-pulse rounded-xl" />
          <div className="h-32 bg-muted/10 animate-pulse rounded-xl" />
        </div>
        {/* Table skeleton */}
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-muted/10 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
