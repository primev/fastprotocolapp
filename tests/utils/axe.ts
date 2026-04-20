import axe, { type RunOptions, type AxeResults } from "axe-core"

// Thin wrapper around axe-core so a11y tests don't each have to know how to
// invoke the rules engine. Defaults to WCAG 2.1 AA, which is the bar we
// target — AAA has a handful of contrast rules that would fail on our
// brand palette (blue on near-black) even though the hierarchy reads fine.
export async function runAxe(
  container: Element,
  options: RunOptions = {}
): Promise<AxeResults["violations"]> {
  const results = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    ...options,
  })
  return results.violations
}

// Formats the violation array into the kind of message that actually helps
// when a test fails in CI. Without this, axe's default stringify dumps the
// whole DOM node and you lose the rule identity in the scroll.
export function formatViolations(violations: AxeResults["violations"]): string {
  if (violations.length === 0) return "no violations"
  return violations
    .map((v) => {
      const nodes = v.nodes.map((n) => `    target: ${n.target.join(" ")}\n    html: ${n.html}`).join("\n")
      return `[${v.id}] ${v.help}\n  ${v.helpUrl}\n${nodes}`
    })
    .join("\n\n")
}
