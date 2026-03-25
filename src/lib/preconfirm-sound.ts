/**
 * Short synthesized "whoosh + chime" sound for preconfirmation.
 * Uses Web Audio API — no external files, instant playback.
 * Respects user's system; only plays once per call.
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

/**
 * Fast "whoosh + rising chime" — ~300ms total.
 * Feels like a quick confirmation ding with velocity.
 */
export function playPreconfirmSound() {
  const ctx = getAudioContext()
  if (!ctx) return

  // Resume if suspended (browser autoplay policy)
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {})
  }

  const now = ctx.currentTime

  // ── Whoosh: filtered noise sweep ──
  const noiseLength = 0.15
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * noiseLength, ctx.sampleRate)
  const noiseData = noiseBuffer.getChannelData(0)
  for (let i = 0; i < noiseData.length; i++) {
    noiseData[i] = (Math.random() * 2 - 1) * 0.3
  }
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer

  const noiseFilter = ctx.createBiquadFilter()
  noiseFilter.type = "bandpass"
  noiseFilter.frequency.setValueAtTime(2000, now)
  noiseFilter.frequency.exponentialRampToValueAtTime(6000, now + 0.1)
  noiseFilter.Q.value = 0.5

  const noiseGain = ctx.createGain()
  noiseGain.gain.setValueAtTime(0.08, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + noiseLength)

  noise.connect(noiseFilter)
  noiseFilter.connect(noiseGain)
  noiseGain.connect(ctx.destination)
  noise.start(now)
  noise.stop(now + noiseLength)

  // ── Chime: two quick rising tones ──
  const playTone = (freq: number, start: number, dur: number, vol: number) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(freq, now + start)
    gain.gain.setValueAtTime(vol, now + start)
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now + start)
    osc.stop(now + start + dur)
  }

  // Rising two-note chime (C6 → E6)
  playTone(1047, 0.04, 0.18, 0.06)  // C6
  playTone(1319, 0.10, 0.22, 0.08)  // E6
}
