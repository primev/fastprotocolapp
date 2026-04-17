"use client"

import { ArrowDown, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface SwitchButtonProps {
  handleSwitch: () => void
  isProMode?: boolean
}

export const SwitchButton = ({ handleSwitch, isProMode = false }: SwitchButtonProps) => {
  if (isProMode) {
    return (
      <div className="flex justify-center -my-3 relative z-20">
        <button
          onClick={handleSwitch}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#0d1117] border-4 border-[#161b22] hover:bg-[#1c2128] transition-all duration-300 active:scale-90 group shadow-lg"
        >
          <Zap className="h-3.5 w-3.5 text-primary fill-primary" />
          <span className="text-[11px] font-bold text-primary uppercase tracking-wider">Pro</span>
          <ArrowDown className="h-3.5 w-3.5 text-primary group-hover:text-pink-400 group-hover:rotate-180 transition-all duration-300" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex justify-center -my-3 relative z-20">
      <button
        onClick={handleSwitch}
        className="h-9 w-9 rounded-full bg-[#0d1117] border-4 border-[#161b22] flex items-center justify-center hover:bg-[#1c2128] transition-all active:scale-90 group shadow-lg"
      >
        <ArrowDown className="h-4 w-4 text-gray-400 group-hover:text-primary transition-colors group-hover:rotate-180 duration-300" />
      </button>
    </div>
  )
}
