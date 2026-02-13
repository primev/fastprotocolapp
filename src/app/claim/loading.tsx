import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export default function ClaimLoading() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="relative z-10">
        {/* Header skeleton */}
        <header className="border-b border-border/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 lg:py-3">
            <Skeleton className="h-[75px] w-[150px] rounded" />
          </div>
        </header>

        {/* Hero + content skeleton */}
        <main className="container mx-auto px-4 py-12 sm:py-16 lg:py-10">
          <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8 lg:space-y-6">
            {/* Hero skeleton */}
            <div className="space-y-4 sm:space-y-5 lg:space-y-4">
              <div className="inline-flex justify-center">
                <Skeleton className="h-8 w-32 rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="mx-auto h-10 w-48 rounded" />
                <Skeleton className="mx-auto h-12 w-64 rounded" />
              </div>
              <Skeleton className="mx-auto h-6 max-w-xl rounded" />
            </div>

            {/* CTA button skeleton */}
            <div className="flex justify-center pt-2 lg:pt-3">
              <Skeleton className="h-12 w-40 rounded-md" />
            </div>

            {/* Feature cards skeleton */}
            <div className="grid md:grid-cols-3 gap-6 sm:gap-8 lg:gap-6 pt-12 sm:pt-16 lg:pt-10">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6 lg:p-5 bg-card/50 border-border/50">
                  <div className="space-y-3 lg:space-y-2.5">
                    <Skeleton className="h-11 w-11 rounded-xl" />
                    <Skeleton className="h-6 w-24 rounded" />
                    <Skeleton className="h-4 w-full rounded" />
                    <Skeleton className="h-4 w-full rounded" />
                  </div>
                </Card>
              ))}
            </div>

            {/* Stats row skeleton */}
            <div className="pt-16 grid grid-cols-2 md:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-9 w-20 rounded" />
                  <Skeleton className="h-4 w-24 rounded" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
