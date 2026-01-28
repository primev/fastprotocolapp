/**
 * FastSettlementV3 contract ABI
 * Minimal ABI for executeWithETH and executeWithPermit (Intent + SwapCall structs).
 * Used by backend/executor or for direct contract calls; frontend uses FastSwap API.
 */

export const FAST_SETTLEMENT_V3_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "user", type: "address" },
          { name: "inputToken", type: "address" },
          { name: "outputToken", type: "address" },
          { name: "inputAmt", type: "uint256" },
          { name: "userAmtOut", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "nonce", type: "uint256" },
        ],
        name: "intent",
        type: "tuple",
      },
      {
        components: [
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
        name: "swapData",
        type: "tuple",
      },
    ],
    name: "executeWithETH",
    outputs: [
      { name: "received", type: "uint256" },
      { name: "surplus", type: "uint256" },
    ],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      {
        components: [
          { name: "user", type: "address" },
          { name: "inputToken", type: "address" },
          { name: "outputToken", type: "address" },
          { name: "inputAmt", type: "uint256" },
          { name: "userAmtOut", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "nonce", type: "uint256" },
        ],
        name: "intent",
        type: "tuple",
      },
      { name: "signature", type: "bytes" },
      {
        components: [
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
        name: "swapData",
        type: "tuple",
      },
    ],
    name: "executeWithPermit",
    outputs: [
      { name: "received", type: "uint256" },
      { name: "surplus", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const
