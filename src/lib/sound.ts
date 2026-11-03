// Synthesised in Web Audio, so there are no sound files to download. Browsers only allow audio after
// a click or key press, so nothing plays until the visitor has interacted.
const KEY = "card:sound"
let context: AudioContext | null = null

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
}

function audio() {
  if (!soundOn() || !navigator.userActivation?.hasBeenActive) return null
  try {
    context ??= new AudioContext()
    if (context.state === "suspended") context.resume()
    return context
  } catch {
    return null
  }
}

function noise(ctx: AudioContext, seconds: number) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const source = ctx.createBufferSource()
  source.buffer = buffer
  return source
}

function envelope(ctx: AudioContext, peak: number, attack: number, release: number) {
  const gain = ctx.createGain()
  const t = ctx.currentTime
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release)
  gain.connect(ctx.destination)
  return gain
}

export function peel() {
  const ctx = audio()
  if (!ctx) return
  const source = noise(ctx, 0.35)
  const filter = ctx.createBiquadFilter()
  filter.type = "bandpass"
  filter.Q.value = 0.8
  filter.frequency.setValueAtTime(5200, ctx.currentTime)
  filter.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.3)
  source.connect(filter).connect(envelope(ctx, 0.12, 0.02, 0.3))
  source.start()
}

export function pat() {
  const ctx = audio()
  if (!ctx) return
  const osc = ctx.createOscillator()
  osc.frequency.setValueAtTime(180, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.12)
  osc.connect(envelope(ctx, 0.18, 0.005, 0.14))
  osc.start()
  osc.stop(ctx.currentTime + 0.2)
}

export function whoosh(up: boolean) {
  const ctx = audio()
  if (!ctx) return
  const source = noise(ctx, 0.6)
  const filter = ctx.createBiquadFilter()
  filter.type = "lowpass"
  filter.frequency.setValueAtTime(up ? 300 : 2400, ctx.currentTime)
  filter.frequency.exponentialRampToValueAtTime(up ? 2400 : 300, ctx.currentTime + 0.5)
  source.connect(filter).connect(envelope(ctx, 0.08, 0.15, 0.4))
  source.start()
}

export function chime() {
  const ctx = audio()
  if (!ctx) return
  for (const [i, f] of [880, 1320, 1760].entries()) {
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.value = f
    const gain = envelope(ctx, 0.08, 0.01, 0.9)
    osc.connect(gain)
    osc.start(ctx.currentTime + i * 0.07)
    osc.stop(ctx.currentTime + 1.2)
  }
}
