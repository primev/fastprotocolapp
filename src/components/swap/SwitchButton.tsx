"use client"

import React from "react"
import { ArrowDown } from "lucide-react"
import type { QuoteResult } from "@/hooks/use-quote"
import type { Token } from "@/types/swap"

interface SwitchButtonProps {
  onSwitch: () => void
}

export default React.memo(function SwitchButton({ onSwitch }: SwitchButtonProps) {
  return (
    <div className="relative h-2 w-full flex justify-center z-20">
      <button
        onClick={onSwitch}
        className="absolute -top-4 p-2 bg-[#1B1B1B] border-[4px] border-[#131313] rounded-xl hover:scale-110 transition-transform text-white shadow-lg"
      >
        <ArrowDown size={18} strokeWidth={3} />
      </button>
    </div>
  )
})
