import type { Market } from '@/types/market'

// Generate trend data (30 points simulating price movement)
function generateTrendData(basePrice: number, volatility: number = 0.02): number[] {
  const points: number[] = []
  let currentPrice = basePrice * (1 - volatility / 2) // Start slightly below

  for (let i = 0; i < 30; i++) {
    const change = (Math.random() - 0.5) * basePrice * volatility
    currentPrice = Math.max(currentPrice + change, basePrice * 0.9) // Floor at 90%
    currentPrice = Math.min(currentPrice, basePrice * 1.1) // Cap at 110%
    points.push(currentPrice)
  }

  // Ensure last point is close to current price
  points[points.length - 1] = basePrice
  return points
}

// Calculate change and percent from opening to current
function calculateChange(current: number, opening: number): { change: number; changePercent: number } {
  const change = current - opening
  const changePercent = ((change / opening) * 100)
  return { change, changePercent }
}

// Initial mock markets data
export const MOCK_MARKETS: Market[] = [
  {
    id: 'btc-15min',
    name: 'Bitcoin',
    symbol: 'BTC',
    icon: '₿',
    currentPrice: 94235.42,
    openingPrice: 93850.00,
    ...calculateChange(94235.42, 93850.00),
    timeLeft: 847, // ~14 minutes
    oddsUp: 1.92,
    oddsDown: 2.08,
    trend: generateTrendData(94235.42),
    participants: 1247,
    status: 'live',
    type: 'crypto',
  },
  {
    id: 'eth-15min',
    name: 'Ethereum',
    symbol: 'ETH',
    icon: 'Ξ',
    currentPrice: 3421.87,
    openingPrice: 3445.20,
    ...calculateChange(3421.87, 3445.20),
    timeLeft: 623, // ~10 minutes
    oddsUp: 2.15,
    oddsDown: 1.85,
    trend: generateTrendData(3421.87),
    participants: 892,
    status: 'live',
    type: 'crypto',
  },
  {
    id: 'sol-15min',
    name: 'Solana',
    symbol: 'SOL',
    icon: '◎',
    currentPrice: 189.34,
    openingPrice: 187.50,
    ...calculateChange(189.34, 187.50),
    timeLeft: 412, // ~7 minutes
    oddsUp: 1.88,
    oddsDown: 2.12,
    trend: generateTrendData(189.34, 0.03),
    participants: 634,
    status: 'live',
    type: 'crypto',
  },
  {
    id: 'trump-2024',
    name: 'Trump Wins 2024',
    symbol: 'TRUMP',
    icon: '🗳️',
    currentPrice: 0.52, // 52% implied probability
    openingPrice: 0.48,
    ...calculateChange(0.52, 0.48),
    timeLeft: 86400, // 24 hours
    oddsUp: 1.92, // Yes odds
    oddsDown: 2.08, // No odds
    trend: generateTrendData(0.52, 0.05),
    participants: 5823,
    status: 'live',
    type: 'event',
    resolution: 'Resolves YES if Trump wins the 2024 presidential election',
  },
]

// Update market prices with small random changes
export function updateMockMarketPrices(markets: Market[]): Market[] {
  return markets.map(market => {
    // Different volatility for crypto vs event markets
    const volatility = market.type === 'crypto' ? 0.001 : 0.002
    const priceChange = (Math.random() - 0.5) * market.currentPrice * volatility

    const newPrice = market.type === 'crypto'
      ? Math.max(market.currentPrice + priceChange, 0.01)
      : Math.max(Math.min(market.currentPrice + priceChange, 0.99), 0.01) // Event markets stay 0-1

    const { change, changePercent } = calculateChange(newPrice, market.openingPrice)

    // Update trend array - remove first, add new price
    const newTrend = [...market.trend.slice(1), newPrice]

    // Decrement time (but not below 0)
    const newTimeLeft = Math.max(market.timeLeft - 2, 0)

    // Slightly adjust odds based on price movement
    const oddsBias = changePercent > 0 ? 0.02 : -0.02
    const newOddsUp = Math.max(1.1, Math.min(3.0, market.oddsUp - oddsBias * 0.1))
    const newOddsDown = Math.max(1.1, Math.min(3.0, market.oddsDown + oddsBias * 0.1))

    return {
      ...market,
      currentPrice: newPrice,
      change,
      changePercent,
      trend: newTrend,
      timeLeft: newTimeLeft,
      oddsUp: newOddsUp,
      oddsDown: newOddsDown,
      participants: market.participants + Math.floor(Math.random() * 3),
    }
  })
}

// Format time remaining as MM:SS or HH:MM:SS
export function formatTimeLeft(seconds: number): string {
  if (seconds <= 0) return '00:00'

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Format price based on type
export function formatPrice(price: number, type: 'crypto' | 'event'): string {
  if (type === 'event') {
    return `${(price * 100).toFixed(1)}%`
  }
  if (price >= 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return price.toFixed(2)
}

// Format change with sign
export function formatChange(change: number, type: 'crypto' | 'event'): string {
  const sign = change >= 0 ? '+' : ''
  if (type === 'event') {
    return `${sign}${(change * 100).toFixed(1)}%`
  }
  if (Math.abs(change) >= 1000) {
    return `${sign}${change.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `${sign}${change.toFixed(2)}`
}
