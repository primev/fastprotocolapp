"use client"

import React, { useState } from "react"
import { ArrowDown } from "lucide-react"

interface SwitchButtonProps {
  onSwitch: () => void
}

export default React.memo(function SwitchButton({ onSwitch }: SwitchButtonProps) {
  const [rotation, setRotation] = useState(0)

  const handleClick = () => {
    setRotation((prev) => prev + 180)
    onSwitch()
  }

  return (
    <div className="relative h-2 w-full flex justify-center z-20">
      <button
        onClick={handleClick}
        className="absolute -top-5 p-3 bg-[#1B1B1B] border-[5px] border-[#131313] rounded-2xl hover:scale-110 transition-transform text-white shadow-lg"
      >
        <ArrowDown
          size={24}
          strokeWidth={3}
          className="transition-transform duration-300 ease-in-out"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
      </button>
    </div>
  )
})
