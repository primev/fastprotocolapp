import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  createMockRequest,
  createMockParams,
  VALID_WALLET,
  INVALID_WALLET,
  EMPTY_WALLET,
} from "@/test/utils/mock-next-request"

// Mock server-only (it throws in non-server environments)
vi.mock("server-only", () => ({}))

// Create mock query function using vi.hoisted so it's available during mock setup
const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}))

// Mock the database pool
vi.mock("@/lib/fast-db", () => ({
  pool: {
    query: mockQuery,
  },
}))

// Import route handlers AFTER mocks are set up
import { GET, POST, PUT } from "./route"

// Sample user data for tests
const mockUserData = {
  wallet_address: VALID_WALLET.toLowerCase(),
  connect_wallet_completed: true,
  setup_rpc_completed: false,
  mint_sbt_completed: false,
  x_completed: false,
  telegram_completed: false,
  discord_completed: false,
  email_completed: false,
}

describe("user-onboarding API route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==================== GET Tests ====================
  describe("GET", () => {
    it("returns 400 for empty wallet address", async () => {
      const request = createMockRequest(undefined, "GET")
      const params = createMockParams(EMPTY_WALLET)

      const response = await GET(request, params)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.error).toBe("Wallet address is required")
    })

    it("returns 400 for invalid wallet address format", async () => {
      const request = createMockRequest(undefined, "GET")
      const params = createMockParams(INVALID_WALLET)

      const response = await GET(request, params)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.error).toBe("Invalid wallet address format")
    })

    it("returns 404 when user not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })

      const request = createMockRequest(undefined, "GET")
      const params = createMockParams(VALID_WALLET)

      const response = await GET(request, params)
      const json = await response.json()

      expect(response.status).toBe(404)
      expect(json.error).toBe("User not found")
      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM user_onboarding WHERE wallet_address = $1",
        [VALID_WALLET.toLowerCase()]
      )
    })

    it("returns 200 with user data on success", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockUserData] })

      const request = createMockRequest(undefined, "GET")
      const params = createMockParams(VALID_WALLET)

      const response = await GET(request, params)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.user).toEqual(mockUserData)
    })

    it("returns 500 on database error", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Database connection failed"))

      const request = createMockRequest(undefined, "GET")
      const params = createMockParams(VALID_WALLET)

      const response = await GET(request, params)
      const json = await response.json()

      expect(response.status).toBe(500)
      expect(json.error).toBe("Database query failed")
    })
  })

  // ==================== POST Tests ====================
  describe("POST", () => {
    it("returns 400 for empty wallet address", async () => {
      const request = createMockRequest({ connect_wallet_completed: true })
      const params = createMockParams(EMPTY_WALLET)

      const response = await POST(request, params)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.error).toBe("Wallet address is required")
    })

    it("returns 400 for invalid wallet address format", async () => {
      const request = createMockRequest({ connect_wallet_completed: true })
      const params = createMockParams(INVALID_WALLET)

      const response = await POST(request, params)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.error).toBe("Invalid wallet address format")
    })

    it("creates new user with defaults when user does not exist (201)", async () => {
      const newUser = { ...mockUserData, connect_wallet_completed: true }
      // First query checks if user exists (returns empty)
      mockQuery.mockResolvedValueOnce({ rows: [] })
      // Second query inserts and returns new user
      mockQuery.mockResolvedValueOnce({ rows: [newUser] })

      const request = createMockRequest({ connect_wallet_completed: true })
      const params = createMockParams(VALID_WALLET)

      const response = await POST(request, params)
      const json = await response.json()

      expect(response.status).toBe(201)
      expect(json.user).toEqual(newUser)
      expect(mockQuery).toHaveBeenCalledTimes(2)

      // Verify INSERT query was called with correct structure
      const insertCall = mockQuery.mock.calls[1]
      expect(insertCall[0]).toContain("INSERT INTO user_onboarding")
      expect(insertCall[0]).toContain("RETURNING *")
      // First param is wallet address, then the field values
      expect(insertCall[1][0]).toBe(VALID_WALLET.toLowerCase())
      expect(insertCall[1][1]).toBe(true) // connect_wallet_completed
    })

    it("creates new user with all provided values (201)", async () => {
      const inputData = {
        connect_wallet_completed: true,
        setup_rpc_completed: true,
        mint_sbt_completed: true,
        x_completed: true,
        telegram_completed: false,
        discord_completed: true,
        email_completed: false,
      }
      const newUser = {
        wallet_address: VALID_WALLET.toLowerCase(),
        ...inputData,
      }

      mockQuery.mockResolvedValueOnce({ rows: [] })
      mockQuery.mockResolvedValueOnce({ rows: [newUser] })

      const request = createMockRequest(inputData)
      const params = createMockParams(VALID_WALLET)

      const response = await POST(request, params)
      const json = await response.json()

      expect(response.status).toBe(201)
      expect(json.user).toEqual(newUser)
    })

    it("updates existing user with partial fields (200)", async () => {
      const existingUser = { ...mockUserData }
      const updatedUser = { ...mockUserData, setup_rpc_completed: true }

      // First query returns existing user
      mockQuery.mockResolvedValueOnce({ rows: [existingUser] })
      // Second query updates and returns
      mockQuery.mockResolvedValueOnce({ rows: [updatedUser] })

      const request = createMockRequest({ setup_rpc_completed: true })
      const params = createMockParams(VALID_WALLET)

      const response = await POST(request, params)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.user).toEqual(updatedUser)

      // Verify UPDATE query
      const updateCall = mockQuery.mock.calls[1]
      expect(updateCall[0]).toContain("UPDATE user_onboarding")
      expect(updateCall[0]).toContain("setup_rpc_completed = $1")
      expect(updateCall[1]).toEqual([true, VALID_WALLET.toLowerCase()])
    })

    it("updates multiple fields at once (200)", async () => {
      const existingUser = { ...mockUserData }
      const updatedUser = {
        ...mockUserData,
        setup_rpc_completed: true,
        x_completed: true,
        email_completed: true,
      }

      mockQuery.mockResolvedValueOnce({ rows: [existingUser] })
      mockQuery.mockResolvedValueOnce({ rows: [updatedUser] })

      const request = createMockRequest({
        setup_rpc_completed: true,
        x_completed: true,
        email_completed: true,
      })
      const params = createMockParams(VALID_WALLET)

      const response = await POST(request, params)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.user).toEqual(updatedUser)

      // Verify UPDATE query has all three fields
      const updateCall = mockQuery.mock.calls[1]
      expect(updateCall[0]).toContain("setup_rpc_completed = $1")
      expect(updateCall[0]).toContain("x_completed = $2")
      expect(updateCall[0]).toContain("email_completed = $3")
    })

    it("returns 400 when existing user and no fields to update", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockUserData] })

      const request = createMockRequest({})
      const params = createMockParams(VALID_WALLET)

      const response = await POST(request, params)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.error).toBe("No fields to update")
      expect(mockQuery).toHaveBeenCalledTimes(1) // Only SELECT, no UPDATE
    })

    it("returns 500 on database error during SELECT", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Connection timeout"))

      const request = createMockRequest({ connect_wallet_completed: true })
      const params = createMockParams(VALID_WALLET)

      const response = await POST(request, params)
      const json = await response.json()

      expect(response.status).toBe(500)
      expect(json.error).toBe("Database operation failed")
    })

    it("returns 500 on database error during INSERT", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] })
      mockQuery.mockRejectedValueOnce(new Error("Insert failed"))

      const request = createMockRequest({ connect_wallet_completed: true })
      const params = createMockParams(VALID_WALLET)

      const response = await POST(request, params)
      const json = await response.json()

      expect(response.status).toBe(500)
      expect(json.error).toBe("Database operation failed")
    })
  })

  // ==================== PUT Tests ====================
  describe("PUT", () => {
    it("returns 400 for empty wallet address", async () => {
      const request = createMockRequest({ connect_wallet_completed: true })
      const params = createMockParams(EMPTY_WALLET)

      const response = await PUT(request, params)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.error).toBe("Wallet address is required")
    })

    it("returns 400 for invalid wallet address format", async () => {
      const request = createMockRequest({ connect_wallet_completed: true })
      const params = createMockParams(INVALID_WALLET)

      const response = await PUT(request, params)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.error).toBe("Invalid wallet address format")
    })

    it("upserts user with all provided values", async () => {
      const inputData = {
        connect_wallet_completed: true,
        setup_rpc_completed: true,
        mint_sbt_completed: false,
        x_completed: false,
        telegram_completed: false,
        discord_completed: false,
        email_completed: false,
      }
      const resultUser = {
        wallet_address: VALID_WALLET.toLowerCase(),
        ...inputData,
      }

      mockQuery.mockResolvedValueOnce({ rows: [resultUser] })

      const request = createMockRequest(inputData)
      const params = createMockParams(VALID_WALLET)

      const response = await PUT(request, params)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.user).toEqual(resultUser)

      // Verify UPSERT query structure
      const upsertCall = mockQuery.mock.calls[0]
      expect(upsertCall[0]).toContain("INSERT INTO user_onboarding")
      expect(upsertCall[0]).toContain("ON CONFLICT (wallet_address)")
      expect(upsertCall[0]).toContain("DO UPDATE SET")
      expect(upsertCall[0]).toContain("RETURNING *")
    })

    it("uses default false for missing fields", async () => {
      const resultUser = { ...mockUserData, connect_wallet_completed: true }
      mockQuery.mockResolvedValueOnce({ rows: [resultUser] })

      // Only provide one field, others should default to false
      const request = createMockRequest({ connect_wallet_completed: true })
      const params = createMockParams(VALID_WALLET)

      const response = await PUT(request, params)

      expect(response.status).toBe(200)

      // Verify all 7 field values are passed (wallet + 7 fields = 8 params)
      const upsertCall = mockQuery.mock.calls[0]
      expect(upsertCall[1].length).toBe(8)
      expect(upsertCall[1][0]).toBe(VALID_WALLET.toLowerCase())
      expect(upsertCall[1][1]).toBe(true) // connect_wallet_completed
      expect(upsertCall[1][2]).toBe(false) // setup_rpc_completed (defaulted)
    })

    it("returns 500 on database error", async () => {
      mockQuery.mockRejectedValueOnce(new Error("Upsert failed"))

      const request = createMockRequest({ connect_wallet_completed: true })
      const params = createMockParams(VALID_WALLET)

      const response = await PUT(request, params)
      const json = await response.json()

      expect(response.status).toBe(500)
      expect(json.error).toBe("Database operation failed")
    })
  })

  // ==================== Edge Cases ====================
  describe("Edge cases", () => {
    it("lowercases wallet address for storage", async () => {
      const upperCaseWallet = "0xABCDEF1234567890ABCDEF1234567890ABCDEF12"
      mockQuery.mockResolvedValueOnce({ rows: [mockUserData] })

      const request = createMockRequest(undefined, "GET")
      const params = createMockParams(upperCaseWallet)

      await GET(request, params)

      expect(mockQuery).toHaveBeenCalledWith(
        "SELECT * FROM user_onboarding WHERE wallet_address = $1",
        [upperCaseWallet.toLowerCase()]
      )
    })

    it("handles wallet address with mixed case", async () => {
      const mixedCaseWallet = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12"
      mockQuery.mockResolvedValueOnce({ rows: [] })
      mockQuery.mockResolvedValueOnce({ rows: [mockUserData] })

      const request = createMockRequest({ connect_wallet_completed: true })
      const params = createMockParams(mixedCaseWallet)

      await POST(request, params)

      // Both queries should use lowercase
      expect(mockQuery.mock.calls[0][1]).toEqual([mixedCaseWallet.toLowerCase()])
    })
  })
})
