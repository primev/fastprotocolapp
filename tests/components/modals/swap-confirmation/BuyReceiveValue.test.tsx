// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest"
import { render, cleanup } from "@testing-library/react"
import { BuyReceiveValue } from "@/components/modals/swap-confirmation/BuyReceiveValue"

// Why pin BuyReceiveValue:
//   - It's the NumberFlow wrapper for the swap summary's amount fields.
//     The precision rules (at most 6 fractional digits, at least the
//     user's typed precision) are the contract between the form and the
//     review modal — the user must see the same decimal layout post-
//     confirmation as they saw while typing.
//   - Handles non-numeric input by passing the raw string through; a
//     regression here would crash when the parent passes "—" as a
//     placeholder during a load state.

afterEach(cleanup)

describe("BuyReceiveValue", () => {
  it("renders the raw string when the value is not numeric", () => {
    const { container } = render(<BuyReceiveValue value="—" />)
    expect(container.textContent).toBe("—")
  })

  it("falls back to '0' for an empty-string input", () => {
    // Defensive default — the swap-form can pass "" mid-clear; rendering
    // nothing would collapse the layout row. Zero is the right neutral.
    const { container } = render(<BuyReceiveValue value="" />)
    expect(container.textContent).toBe("0")
  })

  it("accepts a valid numeric string and mounts a NumberFlow", () => {
    // NumberFlow renders a custom element; we don't assert on its animated
    // output (the shadow DOM is inaccessible via textContent) but we do
    // verify the container isn't empty and the numeric path was taken by
    // checking that the plain "0"/"—" fallback DIDN'T run.
    const { container } = render(<BuyReceiveValue value="1.234" />)
    expect(container.textContent).not.toBe("0")
    expect(container.textContent).not.toBe("—")
    // The <number-flow-react> custom element always emits its value as
    // text content alongside the animated cells — the fallback text
    // below uses it directly.
    expect(container.innerHTML).toContain("number-flow")
  })

  it("strips commas from the numeric check (e.g. '1,234.5' is valid)", () => {
    // The swap form stores amounts with grouping separators while the
    // user types. The regex / parseFloat path in BuyReceiveValue strips
    // commas before the Number.isNaN check — otherwise '1,234.5' would
    // hit the fallback branch and render as raw text.
    const { container } = render(<BuyReceiveValue value="1,234.5" />)
    expect(container.innerHTML).toContain("number-flow")
  })

  it("applies the className to the outer span", () => {
    const { container } = render(<BuyReceiveValue value="5" className="my-test-class" />)
    const span = container.querySelector("span")
    expect(span?.className).toContain("my-test-class")
  })

  it("renders the raw value unchanged when parseFloat yields NaN", () => {
    // "abc" is neither numeric nor empty; the non-numeric branch sends it
    // straight through to the span as literal text.
    const { container } = render(<BuyReceiveValue value="abc" />)
    expect(container.textContent).toBe("abc")
  })
})
