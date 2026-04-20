// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest"
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react"
import { ErrorDetailModal } from "@/components/modals/swap-confirmation/ErrorDetailModal"

// Why pin ErrorDetailModal:
//   - It's the "Error Log" dialog the user opens from a failed-swap toast
//     or the confirmation-modal error view. The raw message / receipt
//     JSON / DB record is what they copy when filing a support ticket,
//     so the copy button is load-bearing — a regression there costs us
//     every support ticket where the user can't paste the receipt.
//   - The 2000ms "Copied" → "Copy" transition is the visual
//     acknowledgement. Fake-timers pin that window.

const clipboardWriteTextMock = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  clipboardWriteTextMock.mockReset()
  // happy-dom's navigator.clipboard is undefined by default; stub it.
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: clipboardWriteTextMock },
  })
})

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe("ErrorDetailModal", () => {
  it("renders the error content when open", () => {
    const body = '{"error":"execution reverted","hash":"0xabc"}'
    render(<ErrorDetailModal open onOpenChange={vi.fn()} content={body} />)
    expect(screen.getByText(/Error Log/i)).toBeTruthy()
    expect(screen.getByText(body)).toBeTruthy()
  })

  it("does not render when open=false", () => {
    render(<ErrorDetailModal open={false} onOpenChange={vi.fn()} content="hidden" />)
    // Radix portals the Dialog content away; when closed, nothing from
    // the body should be reachable.
    expect(screen.queryByText("hidden")).toBeNull()
  })

  it("writes the content to the clipboard when Copy is clicked", () => {
    const body = "raw revert receipt"
    render(<ErrorDetailModal open onOpenChange={vi.fn()} content={body} />)
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Copy/i }))
    })
    expect(clipboardWriteTextMock).toHaveBeenCalledWith(body)
  })

  it("flips the Copy button label to 'Copied' for exactly 2000ms", () => {
    render(<ErrorDetailModal open onOpenChange={vi.fn()} content="payload" />)
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Copy/i }))
    })
    // Immediately after click — label shows "Copied".
    expect(screen.getByText("Copied")).toBeTruthy()
    // Advance just shy of the window.
    act(() => {
      vi.advanceTimersByTime(1999)
    })
    expect(screen.getByText("Copied")).toBeTruthy()
    // One more tick flips it back.
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByText("Copied")).toBeNull()
    expect(screen.getByText("Copy")).toBeTruthy()
  })

  it("no-ops on Copy when content is empty", () => {
    // Defensive: the parent passes "" when there's no error context yet.
    // The modal would render with no useful content, but we still don't
    // want to write an empty string into the user's clipboard.
    render(<ErrorDetailModal open onOpenChange={vi.fn()} content="" />)
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /Copy/i }))
    })
    expect(clipboardWriteTextMock).not.toHaveBeenCalled()
  })
})
