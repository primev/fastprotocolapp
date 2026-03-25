"use client"

import { useEffect, useState, useRef } from "react"
import { motion, AnimatePresence } from "motion/react"

/**
 * Particle burst animation that fires when a swap is preconfirmed.
 * Creates a ring of spark particles that explode outward from center.
 */

interface Particle {
  id: number
  angle: number
  distance: number
  size: number
  delay: number
  duration: number
  color: string
}

const SPARK_COLORS = [
  "#60a5fa", // blue-400
  "#93c5fd", // blue-300
  "#3b82f6", // blue-500
  "#818cf8", // indigo-400
  "#a78bfa", // violet-400
  "#ffffff", // white
]

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    angle: (360 / count) * i + (Math.random() * 30 - 15),
    distance: 40 + Math.random() * 35,
    size: 2 + Math.random() * 3,
    delay: Math.random() * 0.08,
    duration: 0.5 + Math.random() * 0.3,
    color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
  }))
}

export function PreconfirmCelebration({ active }: { active: boolean }) {
  const [particles] = useState(() => generateParticles(14))
  const [show, setShow] = useState(false)
  const hasPlayed = useRef(false)

  useEffect(() => {
    if (active && !hasPlayed.current) {
      hasPlayed.current = true
      setShow(true)
      // Clean up particles after animation completes
      const timer = setTimeout(() => setShow(false), 1200)
      return () => clearTimeout(timer)
    }
  }, [active])

  return (
    <AnimatePresence>
      {show && (
        <div className="absolute inset-0 pointer-events-none overflow-visible z-10">
          {/* Central flash */}
          <motion.div
            className="absolute inset-0 rounded-full"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 0.8, 0], scale: [0.5, 1.5, 2] }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              background: "radial-gradient(circle, rgba(96, 165, 250, 0.6) 0%, transparent 70%)",
            }}
          />

          {/* Spark particles */}
          {particles.map((p) => {
            const rad = (p.angle * Math.PI) / 180
            const x = Math.cos(rad) * p.distance
            const y = Math.sin(rad) * p.distance
            return (
              <motion.div
                key={p.id}
                className="absolute rounded-full"
                style={{
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  left: "50%",
                  top: "50%",
                  marginLeft: -p.size / 2,
                  marginTop: -p.size / 2,
                  boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{
                  x,
                  y,
                  opacity: [1, 1, 0],
                  scale: [1, 1.2, 0.3],
                }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  ease: "easeOut",
                }}
              />
            )
          })}

          {/* Ring pulse */}
          <motion.div
            className="absolute inset-[-8px] rounded-full border-2 border-blue-400/50"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.6, 0], scale: [0.8, 1.6, 2] }}
            transition={{ duration: 0.7, delay: 0.05, ease: "easeOut" }}
          />
        </div>
      )}
    </AnimatePresence>
  )
}

/**
 * Glow effect behind the Fast logo when preconfirmed.
 * Persistent subtle pulse that stays while toast is visible.
 */
export function PreconfirmGlow({ active }: { active: boolean }) {
  if (!active) return null

  return (
    <motion.div
      className="absolute inset-[-4px] rounded-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      style={{
        background: "radial-gradient(circle, rgba(96, 165, 250, 0.4) 0%, transparent 70%)",
      }}
    />
  )
}
