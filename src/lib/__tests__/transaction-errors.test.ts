import { describe, it, expect } from "vitest"
import type { TransactionReceipt } from "viem"
import {
  RPCError,
  buildRevertMessage,
  getTransactionShortMessage,
  getTransactionFullMessage,
  getTransactionErrorMessage,
  getTransactionErrorTitle,
} from "../transaction-errors"

const fakeReceipt: TransactionReceipt = {
  transactionHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  blockNumber: 12345n,
  gasUsed: 98765n,
  status: "reverted",
  transactionIndex: 0,
  blockHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  from: "0x0000000000000000000000000000000000000001",
  to: "0x0000000000000000000000000000000000000002",
  cumulativeGasUsed: 98765n,
  contractAddress: null,
  logs: [],
  logsBloom: "0x00",
  type: "0x2",
  effectiveGasPrice: 1000000000n,
}

describe("buildRevertMessage", () => {
  it("includes tx hash, block, and gas from receipt", () => {
    const msg = buildRevertMessage(fakeReceipt)
    expect(msg).toContain("0x12345678…90abcdef")
    expect(msg).toContain("12345")
    expect(msg).toContain("98765")
    expect(msg).toContain("reverted on-chain")
  })

  it("includes statusReason from rawDbRecord when present", () => {
    const msg = buildRevertMessage(fakeReceipt, { statusReason: "barter minReturn (100) < user required (200)" })
    expect(msg).toContain("barter minReturn")
  })

  it("includes revertReason from rawDbRecord when present", () => {
    const msg = buildRevertMessage(fakeReceipt, { revertReason: "INSUFFICIENT_OUTPUT_AMOUNT" })
    expect(msg).toContain("INSUFFICIENT_OUTPUT_AMOUNT")
  })
})

describe("mapErrorMessage via getTransactionShortMessage", () => {
  it("RPCError with receipt passes through actual message, not 'Network error'", () => {
    const err = new RPCError(buildRevertMessage(fakeReceipt), fakeReceipt)
    const short = getTransactionShortMessage(err)
    expect(short).not.toContain("Network error")
    expect(short).toContain("reverted on-chain")
  })

  it("non-RPCError with 'rpc' in message still gets Network error", () => {
    const err = new Error("rpc endpoint unreachable")
    const short = getTransactionShortMessage(err)
    expect(short).toBe("Network error")
  })

  it("non-RPCError with 'fetch' in message still gets Network error", () => {
    const err = new Error("failed to fetch")
    const short = getTransactionShortMessage(err)
    expect(short).toBe("Network error")
  })

  it("unknown error without matching keywords passes through raw message", () => {
    const err = new Error("something completely unexpected happened")
    const short = getTransactionShortMessage(err)
    expect(short).toBe("something completely unexpected happened")
  })

  it("user rejection is recognized", () => {
    const err = new Error("user rejected the request")
    const short = getTransactionShortMessage(err)
    expect(short).toBe("Transaction Cancelled in Wallet")
  })

  it("insufficient funds is recognized", () => {
    const err = new Error("insufficient funds for gas")
    const short = getTransactionShortMessage(err)
    expect(short).toBe("Insufficient funds for gas fees")
  })
})

describe("getTransactionFullMessage", () => {
  it("RPCError with receipt shows full buildRevertMessage content", () => {
    const msg = buildRevertMessage(fakeReceipt, { statusReason: "slippage exceeded" })
    const err = new RPCError(msg, fakeReceipt)
    const full = getTransactionFullMessage(err)
    expect(full).toContain("reverted on-chain")
    expect(full).toContain("slippage exceeded")
    expect(full).toContain("0x12345678")
  })

  it("plain Error preserves original message", () => {
    const err = new Error("something weird from the relayer: code 500 internal")
    const full = getTransactionFullMessage(err)
    expect(full).toContain("something weird from the relayer: code 500 internal")
  })
})

describe("getTransactionErrorMessage", () => {
  it("RPCError with receipt does not return network error boilerplate", () => {
    const err = new RPCError(buildRevertMessage(fakeReceipt), fakeReceipt)
    const msg = getTransactionErrorMessage(err)
    expect(msg).not.toContain("Unable to connect to the blockchain")
    expect(msg).toContain("reverted on-chain")
  })

  it("genuine network error surfaces the actual error after the prefix", () => {
    const err = new Error("HttpRequestError: Request to https://fastrpc.mev-commit.xyz failed (status 503)")
    const msg = getTransactionErrorMessage(err)
    expect(msg.startsWith("Network error: ")).toBe(true)
    expect(msg).toContain("503")
    expect(msg).toContain("fastrpc.mev-commit.xyz")
    expect(msg).not.toContain("Unable to connect to the blockchain")
  })
})

describe("getTransactionErrorTitle", () => {
  it("reverted tx shows 'Failed' not 'Cancelled'", () => {
    const err = new RPCError(buildRevertMessage(fakeReceipt), fakeReceipt)
    expect(getTransactionErrorTitle(err, "swap")).toBe("Swap Failed")
  })
})
