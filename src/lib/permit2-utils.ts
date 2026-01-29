/**
 * Permit2 utility functions for EIP-712 signing
 */

/**
 * The specific witness type string used by the Permit2 contract
 * to reconstruct the hash for verification.
 * MUST match FastSettlementV3 contract's WITNESS_TYPE_STRING exactly
 */
export const INTENT_WITNESS_TYPE_STRING =
  "Intent witness)Intent(address user,address inputToken,address outputToken,uint256 inputAmt,uint256 userAmtOut,address recipient,uint256 deadline,uint256 nonce)TokenPermissions(address token,uint256 amount)"

/**
 * Returns the EIP-712 type definition for Permit2 + Witness
 * @param witnessTypeString - The witness type string (for future extensibility)
 */
export const GET_SWAP_INTENT_TYPES = (witnessTypeString: string) => ({
  PermitWitnessTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "witness", type: "Intent" },
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  Intent: [
    { name: "user", type: "address" },
    { name: "inputToken", type: "address" },
    { name: "outputToken", type: "address" },
    { name: "inputAmt", type: "uint256" },
    { name: "userAmtOut", type: "uint256" },
    { name: "recipient", type: "address" },
    { name: "deadline", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
})
