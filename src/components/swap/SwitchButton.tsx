"use client"

import { ArrowDown } from "lucide-react"

export const SwitchButton = ({ handleSwitch }: { handleSwitch: () => void }) => {
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
