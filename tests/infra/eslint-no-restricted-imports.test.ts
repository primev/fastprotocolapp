import { describe, it, expect } from "vitest"
import { ESLint } from "eslint"

// Guards the `no-restricted-imports` rule in eslint.config.js. That rule is
// the drift-catcher for main-merges: when a feature PR from main imports a
// pre-folderization `src/lib/*` path, the rule fires with a message pointing
// to the new location. If the rule entry for a module ever goes missing,
// the next merge can silently reintroduce the anti-pattern.
//
// These tests prove the rule actually warns on representative stale paths
// and stays silent on the current (post-folderization) paths. Add new
// cases here when you add new entries to the rule.

async function lintSource(source: string): Promise<string[]> {
  // Programmatic ESLint runs the same flat config as `npm run lint`.
  const eslint = new ESLint({ cwd: process.cwd() })
  const [result] = await eslint.lintText(source, {
    filePath: "src/__lint_probe__.ts",
  })
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === "no-restricted-imports")
    .map((m) => m.message)
}

describe("eslint no-restricted-imports — pre-folderization rename table", () => {
  it.each([
    ["@/lib/site-config", "@/lib/config/site"],
    ["@/lib/feature-flags", "@/lib/config/feature-flags"],
    ["@/lib/network-config", "@/lib/config/network"],
    ["@/lib/constants", "@/lib/config/constants"],
    ["@/lib/weth-abi", "@/lib/tokens/weth-abi"],
    ["@/lib/token-resolver", "@/lib/tokens/token-resolver"],
    ["@/lib/transaction-errors", "@/lib/settlement/transaction-errors"],
    ["@/lib/slippage", "@/lib/swap/slippage"],
    ["@/lib/permit2-utils", "@/lib/swap/permit2-utils"],
  ])("flags '%s' with a pointer to '%s'", async (oldPath, newPath) => {
    // The quoted identifier matches whatever the module would have exported;
    // we don't care about the actual symbol, only that the import specifier
    // is the restricted one.
    const messages = await lintSource(`import { Foo } from "${oldPath}"\nconsole.log(Foo)\n`)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain(oldPath)
    expect(messages[0]).toContain(newPath)
  })

  it("flags deleted modules with a 'Removed' message", async () => {
    const messages = await lintSource(
      `import { FastSettlementV3 } from "@/lib/fast-settlement-v3-abi"\nconsole.log(FastSettlementV3)\n`
    )
    expect(messages).toHaveLength(1)
    // The message must mark it explicitly removed — users should know the
    // module is gone, not just moved, so they don't hunt for a new path.
    expect(messages[0]?.toLowerCase()).toContain("removed")
  })

  it("does NOT fire on the post-folderization paths", async () => {
    // Happy-path sanity: the new paths must lint silently so the rule
    // isn't creating noise on every file that imports them.
    const messages = await lintSource(
      `import { FEATURE_FLAGS } from "@/lib/config/feature-flags"
import { slippageBpsFromPercent } from "@/lib/swap/slippage"
import { WETH_ABI } from "@/lib/tokens/weth-abi"
import { getTransactionShortMessage } from "@/lib/settlement/transaction-errors"
console.log(FEATURE_FLAGS, slippageBpsFromPercent, WETH_ABI, getTransactionShortMessage)
`
    )
    expect(messages).toEqual([])
  })
})
