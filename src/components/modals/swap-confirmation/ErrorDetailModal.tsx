"use client"

import { useCallback, useState } from "react"
import { Check, Copy } from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog"

// The "Error Log" modal shown when the user clicks "View Error Details" on
// the main confirmation modal's error view. Renders the raw DB record or
// the parsed message, with a copy-to-clipboard button. A separate Dialog
// (not nested) so the overlay can blur the main modal behind it.
export function ErrorDetailModal({
  open,
  onOpenChange,
  content,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  content: string
}) {
  const [hasCopied, setHasCopied] = useState(false)

  const copyToClipboard = useCallback(() => {
    if (!content) return
    navigator.clipboard.writeText(content)
    setHasCopied(true)
    setTimeout(() => setHasCopied(false), 2000)
  }, [content])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="bg-black/40 backdrop-blur-sm z-[60]" />
      <DialogContent className="sm:max-w-2xl w-[95vw] p-0 bg-[#0d1117] border-white/10 rounded-[28px] overflow-hidden shadow-2xl z-[70] outline-none">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold text-white uppercase tracking-tight">
              Error Log
            </DialogTitle>
            <DialogClose asChild>
              <button className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white" />
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="p-6 pt-2">
          <div className="relative group">
            <div className="w-full bg-black/40 rounded-2xl border border-white/5 p-5 max-h-[50dvh] overflow-y-auto overflow-x-auto scrollbar-hide">
              <code
                className="text-[12px] leading-relaxed font-mono text-red-400/90 break-words whitespace-pre-wrap"
                style={{
                  wordBreak: "break-all",
                  overflowWrap: "break-word",
                  whiteSpace: "pre-wrap",
                }}
              >
                {content}
              </code>
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={copyToClipboard}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-2 border border-white/5"
              >
                {hasCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {hasCopied ? "Copied" : "Copy"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
