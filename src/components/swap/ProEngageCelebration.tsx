"use client"

import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"

/**
 * Small particle burst + glow that fires when Pro mode auto-engages.
 * Similar to PreconfirmCelebration but smaller, fewer particles, and
 * uses pink/primary colors to match the CTA gradient.
 */

interface Spark {
  id: number
  angle: number
  distance: number
  size: number
  delay: number
  duration: number
  color: string
}

const PRO_SPARK_COLORS = [
  "#ec4899", // pink-500
  "#f472b6", // pink-400
  "#3b82f6", // blue-500
  "#60a5fa", // blue-400
  "#a78bfa", // violet-400
  "#ffffff", // white
]

function generateSparks(count: number): Spark[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    angle: (360 / count) * i + (Math.random() * 40 - 20),
    distance: 24 + Math.random() * 20,
    size: 1.5 + Math.random() * 2,
    delay: Math.random() * 0.06,
    duration: 0.4 + Math.random() * 0.2,
    color: PRO_SPARK_COLORS[Math.floor(Math.random() * PRO_SPARK_COLORS.length)],
  }))
}

export function ProEngageCelebration({ active }: { active: boolean }) {
  const [sparks] = useState(() => generateSparks(10))
  const [show, setShow] = useState(false)
  const hasPlayed = useRef(false)

  useEffect(() => {
    if (active && !hasPlayed.current) {
      hasPlayed.current = true
      setShow(true)
      const timer = setTimeout(() => setShow(false), 1000)
      return () => clearTimeout(timer)
    }
    if (!active) {
      hasPlayed.current = false
    }
  }, [active])

  return (
    <AnimatePresence>
      {show && (
        <div className="absolute inset-0 pointer-events-none overflow-visible z-30">
          {/* Central flash */}
          <motion.div
            className="absolute inset-0 rounded-xl"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 0.7, 0], scale: [0.6, 1.3, 1.8] }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{
              background:
                "radial-gradient(circle, rgba(236, 72, 153, 0.5) 0%, rgba(56, 139, 253, 0.3) 40%, transparent 70%)",
            }}
          />

          {/* Spark particles */}
          {sparks.map((s) => {
            const rad = (s.angle * Math.PI) / 180
            const x = Math.cos(rad) * s.distance
            const y = Math.sin(rad) * s.distance
            return (
              <motion.div
                key={s.id}
                className="absolute rounded-full"
                style={{
                  width: s.size,
                  height: s.size,
                  backgroundColor: s.color,
                  left: "50%",
                  top: "50%",
                  marginLeft: -s.size / 2,
                  marginTop: -s.size / 2,
                  boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x,
                  y,
                  opacity: [1, 1, 0],
                  scale: [1, 1.1, 0.2],
                }}
                transition={{
                  duration: s.duration,
                  delay: s.delay,
                  ease: "easeOut",
                }}
              />
            )
          })}

          {/* Ring pulse */}
          <motion.div
            className="absolute inset-[-4px] rounded-xl border border-pink-400/40"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: [0, 0.5, 0], scale: [0.9, 1.3, 1.6] }}
            transition={{ duration: 0.5, delay: 0.03, ease: "easeOut" }}
          />
        </div>
      )}
    </AnimatePresence>
  )
}
