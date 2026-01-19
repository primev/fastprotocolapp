import { Suspense } from "react"
import { getUniswapTokenList } from "@/lib/swap-server"
import { SwapPageClient } from "./SwapPageClient"

// Progressive rendering: Fetch token list first (most important), then render
// This allows the swap interface to render immediately

// Token list loader - fetches token list independently
async function TokenListLoader() {
  const tokenList = await getUniswapTokenList()
  return tokenList
}

// Main content - fetches token list first
// Swap interface renders immediately with token list
async function SwapContent() {
  // Fetch token list first - most important data, renders immediately
  const tokenList = await TokenListLoader()

  // Pass preloaded data to client component
  return <SwapPageClient preloadedTokenList={tokenList} />
}

// Progressive rendering: Token list renders first, then swap interface fills in
export default function SwapPage() {
  return (
    <div className="w-full container mx-auto px-0 sm:px-0 pb-2 md:pb-4 overflow-x-hidden">
      <Suspense fallback={<SwapPageClient preloadedTokenList={[]} />}>
        {/* Fetch token list first - most important data */}
        <Suspense fallback={<SwapPageClient preloadedTokenList={[]} />}>
          <SwapContent />
        </Suspense>
      </Suspense>
    </div>
  )
}
