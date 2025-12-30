import { create } from 'zustand'
import type { Market, UserBet, BetDirection } from '@/types/market'
import { MOCK_MARKETS, updateMockMarketPrices } from '@/lib/mockMarketData'

interface MarketState {
  // State
  selectedMarket: Market | null
  markets: Market[]
  userBalance: number
  userBets: UserBet[]

  // Actions
  setSelectedMarket: (market: Market) => void
  placeBet: (marketId: string, amount: number, direction: BetDirection) => UserBet | null
  updateBalance: (amount: number) => void
  updateMarketData: () => void
  resetMarkets: () => void
}

export const useMarketStore = create<MarketState>((set, get) => ({
  // Initial state
  selectedMarket: MOCK_MARKETS[0],
  markets: MOCK_MARKETS,
  userBalance: 100.25,
  userBets: [],

  // Set the selected market
  setSelectedMarket: (market: Market) => {
    set({ selectedMarket: market })
  },

  // Place a bet
  placeBet: (marketId: string, amount: number, direction: BetDirection) => {
    const state = get()
    const market = state.markets.find(m => m.id === marketId)

    if (!market || amount > state.userBalance || amount <= 0) {
      return null
    }

    const odds = direction === 'UP' ? market.oddsUp : market.oddsDown
    const potentialPayout = amount * odds

    const newBet: UserBet = {
      id: `bet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      marketId,
      marketName: market.name,
      amount,
      direction,
      odds,
      potentialPayout,
      timestamp: Date.now(),
      status: 'pending',
    }

    set(state => ({
      userBets: [...state.userBets, newBet],
      userBalance: state.userBalance - amount,
    }))

    return newBet
  },

  // Update user balance
  updateBalance: (amount: number) => {
    set(state => ({
      userBalance: Math.max(0, state.userBalance + amount),
    }))
  },

  // Update all market data (simulates live updates)
  updateMarketData: () => {
    set(state => {
      const updatedMarkets = updateMockMarketPrices(state.markets)
      const updatedSelectedMarket = state.selectedMarket
        ? updatedMarkets.find(m => m.id === state.selectedMarket?.id) || updatedMarkets[0]
        : updatedMarkets[0]

      return {
        markets: updatedMarkets,
        selectedMarket: updatedSelectedMarket,
      }
    })
  },

  // Reset markets to initial state
  resetMarkets: () => {
    set({
      markets: MOCK_MARKETS,
      selectedMarket: MOCK_MARKETS[0],
    })
  },
}))
