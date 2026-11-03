// Synthesised in Web Audio, so there are no sound files to download. Browsers only allow audio after a
// click or key press, so nothing plays until the visitor has interacted.
const KEY = "card:sound"
const VOLUME = 0.2

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null
let sleep = 0
let untilTick = 0

export const soundOn = () => {
  try {
    return localStorage.getItem(KEY) !== "off"
  } catch {
    return true
  }
}

export function setSound(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off")
  } catch {}
  if (master) master.gain.value = on ? VOLUME : 0
}

// Suspends the context shortly after the last sound so an idle page costs nothing.
function wake(seconds: number) {
  if (!soundOn() || !navigator.userActivation?.hasBeenActive) return null
  try {
    if (!ctx) {
      ctx = new AudioContext({ latencyHint: "interactive" })
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      master = ctx.createGain()
      master.gain.value = VOLUME
      master.connect(new DynamicsCompressorNode(ctx, { threshold: -18, ratio: 6 })).connect(ctx.destination)
    }
    if (ctx.state !== "running") ctx.resume()
    clearTimeout(sleep)
    sleep = window.setTimeout(() => ctx?.suspend(), (seconds + 1.5) * 1000)
    return ctx
  } catch {
    return null
  }
}

interface Burst {
  at?: number
  type: BiquadFilterType
  freq: number
  to?: number
  q?: number
  gain: number
  attack?: number
  decay: number
}

function burst(c: AudioContext, { at = 0, type, freq, to, q = 1, gain, attack = 0.002, decay }: Burst) {
  const t = c.currentTime + at
  const source = new AudioBufferSourceNode(c, { buffer: noise })
  const filter = new BiquadFilterNode(c, { type, frequency: freq, Q: q })
  if (to) filter.frequency.exponentialRampToValueAtTime(to, t + attack + decay)
  const env = new GainNode(c, { gain: 0 })
  env.gain.setValueAtTime(0, t)
  env.gain.linearRampToValueAtTime(gain, t + attack)
  env.gain.exponentialRampToValueAtTime(1e-4, t + attack + decay)
  source.connect(filter).connect(env).connect(master!)
  source.start(t, Math.random() * 1.5)
  source.stop(t + attack + decay + 0.05)
}

function tone(c: AudioContext, freq: number, to: number, gain: number, decay: number) {
  const t = c.currentTime
  const osc = new OscillatorNode(c, { frequency: freq })
  osc.frequency.exponentialRampToValueAtTime(to, t + decay)
  const env = new GainNode(c, { gain: 0 })
  env.gain.linearRampToValueAtTime(gain, t + 0.003)
  env.gain.exponentialRampToValueAtTime(1e-4, t + decay)
  osc.connect(env).connect(master!)
  osc.start(t)
  osc.stop(t + decay + 0.05)
}

// A peel is a run of tiny clicks, one every few pixels the corner travels, like tape coming off.
export function peel(distance: number) {
  if (!distance) return
  const c = wake(0.3)
  if (!c) return
  const opening = distance > 0
  untilTick -= Math.abs(distance)
  let at = 0
  while (untilTick <= 0) {
    untilTick += opening ? 2.5 + Math.random() * 3 : 7 + Math.random() * 7
    burst(c, {
      at,
      type: "highpass",
      freq: opening ? 1800 + Math.random() * 2600 : 1200 + Math.random() * 1200,
      q: 0.7,
      gain: (opening ? 0.35 : 0.14) * (0.35 + Math.random() * 0.65),
      attack: 0.0008,
      decay: 0.004 + Math.random() * 0.01,
    })
    at += 0.004 + Math.random() * 0.01
  }
}

export function land() {
  const c = wake(0.2)
  if (!c) return
  burst(c, { type: "lowpass", freq: 900, q: 0.5, gain: 0.5, decay: 0.06 })
  tone(c, 150, 95, 0.22, 0.08)
}

// The stub coming away along the perforation, then landing.
export function tear() {
  peel(160)
  setTimeout(land, 420)
}

export function tap() {
  const c = wake(0.2)
  if (!c) return
  tone(c, 210, 140, 0.2, 0.07)
  burst(c, { type: "bandpass", freq: 1600, q: 0.8, gain: 0.12, decay: 0.03 })
}

// A pencil stroke: band-passed noise in short, uneven scratches.
export function scribble(delay: number, length: number) {
  const c = wake(delay + length)
  if (!c) return
  const t = c.currentTime + delay
  const source = new AudioBufferSourceNode(c, { buffer: noise })
  const filter = new BiquadFilterNode(c, { type: "bandpass", frequency: 3600, Q: 2.4 })
  const env = new GainNode(c, { gain: 0 })
  let at = t
  while (at < t + length) {
    env.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.09, at + 0.012)
    at += 0.025 + Math.random() * 0.03
    env.gain.linearRampToValueAtTime(0.01, at)
  }
  env.gain.linearRampToValueAtTime(0, at + 0.02)
  source.connect(filter).connect(env).connect(master!)
  source.start(t, Math.random() * 1.5)
  source.stop(at + 0.05)
}

export function whoosh(open: boolean) {
  const c = wake(0.6)
  if (!c) return
  burst(c, { type: "bandpass", freq: open ? 380 : 2400, to: open ? 2200 : 420, q: 1.1, gain: 0.32, attack: 0.12, decay: 0.42 })
}
