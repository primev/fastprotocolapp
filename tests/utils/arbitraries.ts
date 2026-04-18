import fc from "fast-check"

// Shared fast-check arbitraries for property and invariant tests.
//
// Keep these **focused on the repo's real domain**, not generic hex/string
// generators. A `validWalletAddress()` that matches the exact shape
// `walletAddressSchema` accepts is more valuable than a call-site copy-paste
// of `fc.hexaString({ minLength: 40, maxLength: 40 })`, because when the
// schema tightens (e.g., EIP-55 checksum) we update ONE place.
//
// Convention: `valid*` arbitraries produce inputs the schema MUST accept.
// `invalid*` arbitraries produce inputs the schema MUST reject. Together
// they let us prove the schema's accept/reject frontier is exactly where
// we think it is.

/** Random mixed-case hex character (0–9, a–f, A–F). */
const hexChar = fc.constantFrom(
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "a",
  "b",
  "c",
  "d",
  "e",
  "f",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F"
)

function hexString(length: number) {
  return fc.array(hexChar, { minLength: length, maxLength: length }).map((a) => a.join(""))
}

/** 0x + 40 mixed-case hex chars — matches `walletAddressSchema`. */
export function validWalletAddress() {
  return hexString(40).map((s) => `0x${s}`)
}

/** 0x + 64 mixed-case hex chars — matches `txHashSchema`. */
export function validTxHash() {
  return hexString(64).map((s) => `0x${s}`)
}

/**
 * Strings that `walletAddressSchema` MUST reject — wrong length, missing
 * prefix, or non-hex characters. We deliberately exclude overlaps with
 * `validWalletAddress()` by filtering.
 */
export function invalidWalletAddress() {
  const wrongLengthHex = fc
    .integer({ min: 0, max: 80 })
    .filter((n) => n !== 40)
    .chain((n) => hexString(n).map((s) => `0x${s}`))
  const missingPrefix = hexString(40)
  const badChars = fc
    .string({ minLength: 42, maxLength: 42 })
    .filter((s) => !/^0x[a-fA-F0-9]{40}$/.test(s))
  return fc.oneof(wrongLengthHex, missingPrefix, badChars)
}

/**
 * 1–16 char alphanumeric — the shape `tokenSymbolSchema` accepts before
 * uppercasing.
 */
export function validTokenSymbol() {
  return fc
    .string({ minLength: 1, maxLength: 16 })
    .filter((s) => s.length >= 1 && s.length <= 16)
}

/** Empty or >16 chars — must be rejected. */
export function invalidTokenSymbol() {
  return fc.oneof(
    fc.constant(""),
    fc.string({ minLength: 17, maxLength: 32 }).filter((s) => s.length >= 17)
  )
}

/** Non-negative bigint up to 2^128 — wide enough to cover realistic token amounts. */
export function bigUint128() {
  return fc.bigInt({ min: 0n, max: (1n << 128n) - 1n })
}

/** Slippage in basis points (0–10_000 = 0–100%). */
export function slippageBps() {
  return fc.integer({ min: 0, max: 10_000 })
}
