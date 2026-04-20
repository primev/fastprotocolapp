// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react"
import { ConfirmCtaButton } from "@/components/modals/swap-confirmation/ConfirmCtaButton"

// Why pin ConfirmCtaButton:
//   - The disabled / danger / default styling precedence is load-bearing
//     UX. A bug that flips the color rules means the user can either
//     click a button they shouldn't be able to (disabled shown blue) or
//     hesitate over a safe click (normal swap shown red). Both are real
//     trust hits in a money-handling UI.
//   - The spinner-wrap toggle is what visually gates the "wallet is
//     open" vs "click me" states. If it's dropped on the wrong branch,
//     the user thinks the flow has hung.

afterEach(cleanup)

describe("ConfirmCtaButton — styling precedence", () => {
  it("applies the disabled style when disabled=true, regardless of isDangerous", () => {
    // Disabled beats dangerous — a greyed-out button that's also "red"
    // on hover would mislead. Disabled always wins.
    render(
      <ConfirmCtaButton
        label="Swap Anyway"
        disabled
        showSpinner={false}
        onClick={vi.fn()}
        isEthereumMainnet
        isDangerous
      />
    )
    const btn = screen.getByRole("button", { name: "Swap Anyway" })
    expect(btn.className).toContain("text-gray-500")
    expect(btn.className).not.toContain("bg-red-500 text-white")
  })

  it("applies the disabled style when not on Ethereum mainnet, even with disabled=false", () => {
    // The "Connect to Ethereum" state passes disabled=true from the
    // parent already, but the ternary `disabled || !isEthereumMainnet`
    // is a second belt: wrong network → grey, not clickable blue.
    render(
      <ConfirmCtaButton
        label="Connect to Ethereum"
        disabled={false}
        showSpinner={false}
        onClick={vi.fn()}
        isEthereumMainnet={false}
        isDangerous={false}
      />
    )
    const btn = screen.getByRole("button")
    expect(btn.className).toContain("text-gray-500")
  })

  it("applies the danger (red) style for high-impact swaps", () => {
    // isDangerous is set when priceImpact > 5%. Red button + "Swap Anyway"
    // label is the visual warning; both halves must land together.
    render(
      <ConfirmCtaButton
        label="Swap Anyway"
        disabled={false}
        showSpinner={false}
        onClick={vi.fn()}
        isEthereumMainnet
        isDangerous
      />
    )
    const btn = screen.getByRole("button")
    expect(btn.className).toContain("bg-red-500")
  })

  it("applies the default primary style in the happy path", () => {
    render(
      <ConfirmCtaButton
        label="Confirm swap"
        disabled={false}
        showSpinner={false}
        onClick={vi.fn()}
        isEthereumMainnet
        isDangerous={false}
      />
    )
    const btn = screen.getByRole("button")
    expect(btn.className).toContain("bg-[#3898FF]")
    expect(btn.className).not.toContain("bg-red-500")
    expect(btn.className).not.toContain("text-gray-500")
  })
})

describe("ConfirmCtaButton — spinner + click", () => {
  it("shows the spinner wrapper when showSpinner=true", () => {
    const { container } = render(
      <ConfirmCtaButton
        label="Submitting..."
        disabled
        showSpinner
        onClick={vi.fn()}
        isEthereumMainnet
        isDangerous={false}
      />
    )
    // The spinner is a span with animate-spin; its presence is the
    // single pixel that tells the user the flow is progressing.
    expect(container.querySelector(".animate-spin")).toBeTruthy()
    expect(screen.getByText("Submitting...")).toBeTruthy()
  })

  it("omits the spinner when showSpinner=false", () => {
    const { container } = render(
      <ConfirmCtaButton
        label="Confirm swap"
        disabled={false}
        showSpinner={false}
        onClick={vi.fn()}
        isEthereumMainnet
        isDangerous={false}
      />
    )
    expect(container.querySelector(".animate-spin")).toBeNull()
  })

  it("forwards onClick to the parent", () => {
    const onClick = vi.fn()
    render(
      <ConfirmCtaButton
        label="Confirm swap"
        disabled={false}
        showSpinner={false}
        onClick={onClick}
        isEthereumMainnet
        isDangerous={false}
      />
    )
    act(() => {
      fireEvent.click(screen.getByRole("button"))
    })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("native disabled attribute gates the click", () => {
    // React's disabled={true} sets the HTML attribute, which the browser
    // honors by swallowing click events. Proves the parent's disabled
    // state can't be bypassed by an unexpected rerender.
    const onClick = vi.fn()
    render(
      <ConfirmCtaButton
        label="Swap Anyway"
        disabled
        showSpinner={false}
        onClick={onClick}
        isEthereumMainnet
        isDangerous
      />
    )
    act(() => {
      fireEvent.click(screen.getByRole("button"))
    })
    expect(onClick).not.toHaveBeenCalled()
  })
})
