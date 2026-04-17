/**
 * Pro Mode — Top 10% Block Placement
 *
 * When active, the /fastswap POST body includes a `topPercentile` field
 * that tells the executor to attach a top-of-block placement constraint
 * to the mev-commit bid.
 *
 * Only applies to the intent/permit path (ERC20 swaps). ETH-path swaps
 * go through the user's wallet and aren't eligible.
 */

/** Sell-side USD value at which Pro mode auto-engages. */
export const PRO_MODE_MIN_USD = 250

/** The percentile to request — 10 = top 10% of block. Tunable in prod. */
export const TOP_OF_BLOCK_PERCENTILE = 10
