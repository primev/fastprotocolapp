/**
 * "Level Up" sound for preconfirmation.
 * Three-note rising arpeggio (C5-E5-G5) via Web Audio API.
 * No external files, instant playback, ~350ms.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext()
    } catch {
      return null
    }
  }
  return audioCtx
}

export function playPreconfirmSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {})
  }

  const now = ctx.currentTime

  // C5 → E5 → G5 rising arpeggio
  const notes: [number, number, number][] = [
    [523, 0, 0.12],    // C5
    [659, 0.1, 0.12],  // E5
    [784, 0.2, 0.15],  // G5
  ]

  for (const [freq, start, dur] of notes) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.08, now + start)
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + start)
    osc.stop(now + start + dur)
  }
}
