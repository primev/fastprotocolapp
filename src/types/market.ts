// Market types for Fast Markets prediction feature

export type MarketStatus = 'live' | 'pending' | 'resolved'
export type BetDirection = 'UP' | 'DOWN'

export interface Market {
  id: string
  name: string
  symbol: string
  icon: string
  currentPrice: number
  openingPrice: number
  change: number
  changePercent: number
  timeLeft: number // seconds remaining
  oddsUp: number
  oddsDown: number
  trend: number[] // array of price points for sparkline
  participants: number
  status: MarketStatus
  type: 'crypto' | 'event'
  resolution?: string // for event markets
}

export interface UserBet {
  id: string
  marketId: string
  marketName: string
  amount: number
  direction: BetDirection
  odds: number
  potentialPayout: number
  timestamp: number
  status: 'pending' | 'won' | 'lost'
}

export interface MarketStore {
  // State
  selectedMarket: Market | null
  markets: Market[]
  userBalance: number
  userBets: UserBet[]

  // Actions
  setSelectedMarket: (market: Market) => void
  placeBet: (marketId: string, amount: number, direction: BetDirection) => void
  updateBalance: (amount: number) => void
  updateMarketData: () => void
}
