"use client"

import Image from "next/image"
import { useRef, useState, useEffect } from "react"

const BlockPosition = () => {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!sectionRef.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true)
      },
      { threshold: 0.15 }
    )
    observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={sectionRef} className="px-4 py-20 md:py-28 max-w-[1100px] mx-auto">
      <div
        className={`transition-all duration-500 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <h2 className="font-sora font-bold text-2xl sm:text-3xl md:text-4xl text-center mb-3">
          Why execution position matters
        </h2>
        <p className="text-sm text-muted-foreground/70 text-center mb-10">
          Better position in the block = better price
        </p>

        <Image
          src="/pro/block-position-diagram.png"
          alt="Diagram showing how top-of-block execution with Fast Protocol yields better prices compared to lower block positions"
          width={960}
          height={540}
          loading="lazy"
          className="w-full max-w-[960px] h-auto mx-auto rounded-xl"
        />

        <p className="text-xs text-muted-foreground/60 text-center mt-8 max-w-lg mx-auto">
          Most traders lose value due to where their transaction lands in the block. Fast secures
          top-of-block execution to minimize that loss.
        </p>

        <div className="max-w-lg mx-auto mt-4 px-4 py-3 rounded-lg bg-primary/[0.06] border border-primary/10 text-center">
          <p className="text-xs text-foreground/70">
            Execution quality isn&apos;t just routing — it&apos;s where your trade lands in the
            block.
          </p>
        </div>
      </div>
    </section>
  )
}

export default BlockPosition
