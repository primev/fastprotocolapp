// Loading state for swap page - layout provides header, so only show content skeleton
export default function Loading() {
  return (
    <div className="w-full container mx-auto px-0 sm:px-0 pb-2 md:pb-4 overflow-x-hidden">
      <div className="w-full max-w-[480px] mx-auto pt-8 px-4">
        {/* Card skeleton */}
        <div className="rounded-lg border bg-card/60 backdrop-blur-xl border-white/10 shadow-2xl p-4 space-y-4">
          {/* Header skeleton */}
          <div className="flex justify-between items-center">
            <div className="h-7 w-20 bg-muted/20 animate-pulse rounded" />
            <div className="h-10 w-10 bg-muted/20 animate-pulse rounded-full" />
          </div>
          {/* Input skeletons */}
          <div className="space-y-2">
            <div className="h-24 bg-muted/10 animate-pulse rounded-xl" />
            <div className="h-24 bg-muted/10 animate-pulse rounded-xl" />
          </div>
          {/* Quote skeleton */}
          <div className="h-32 bg-muted/10 animate-pulse rounded-xl" />
          {/* Button skeleton */}
          <div className="h-14 bg-muted/20 animate-pulse rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
