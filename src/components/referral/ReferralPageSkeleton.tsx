import { Skeleton } from "@/components/ui/skeleton"

/**
 * Shared skeleton for the referral page layout.
 * Used by src/app/referral/loading.tsx and the Suspense fallback in page.tsx
 * so LCP is fast and CLS is minimal when real content loads.
 */
export function ReferralPageSkeleton() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects - match referral page */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-10" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header - logo area + Referral title */}
        <header className="border-b border-border/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 lg:py-3 flex items-center justify-between">
            <Skeleton className="h-10 w-10 rounded sm:h-[75px] sm:w-[150px]" />
            <Skeleton className="h-5 w-16 rounded" />
          </div>
        </header>

        {/* Main - hero + CTA skeleton */}
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-[560px] mx-auto space-y-6">
            <div className="text-center space-y-4">
              <Skeleton className="mx-auto h-10 w-64 sm:w-80 rounded" />
              <Skeleton className="mx-auto h-6 w-72 rounded" />
            </div>
            <div className="flex justify-center">
              <Skeleton className="h-12 w-24 rounded-md" />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
