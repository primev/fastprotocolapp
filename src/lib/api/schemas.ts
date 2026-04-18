import { z } from "zod"

// Shared Zod schemas for API routes.
//
// Why centralize: wallet/hash/symbol validation was duplicated across ~20
// routes with subtle variations (some lowercased, some checked length, some
// just checked truthiness). One source of truth keeps the 400 responses
// consistent and lets us tighten a rule in exactly one place.
//
// Convention: re-use these primitives to build route-specific Body/Query
// schemas. Keep route-local schemas colocated with the route so ownership
// stays obvious.

/**
 * EVM hex wallet address. Normalized to lower-case at parse time so downstream
 * SQL / cache keys don't depend on the caller's casing.
 */
export const walletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address")
  .transform((v) => v.toLowerCase())

/**
 * EVM transaction hash (32 bytes / 64 hex chars).
 */
export const txHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash")
  .transform((v) => v.toLowerCase())

/**
 * Token symbol — non-empty, ≤16 chars, uppercased. We cap length because the
 * API uses symbols as map keys and cache slugs; unbounded input would let a
 * caller bloat internal maps.
 */
export const tokenSymbolSchema = z
  .string()
  .min(1, "Symbol is required")
  .max(16, "Symbol too long")
  .transform((v) => v.toUpperCase())

/**
 * Pagination with safe defaults. Offset and limit are clamped server-side so
 * a caller can't request a million rows by crafting a large `limit`.
 */
export const paginationSchema = z.object({
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

export type Pagination = z.infer<typeof paginationSchema>
