import { land, tap } from "../lib/sound"

const motion = matchMedia("(prefers-reduced-motion: no-preference)")
const START = 6
const K = 180
const DAMP = 16
const STEP = 1 / 120

for (const card of document.querySelectorAll<HTMLElement>("[data-pluck] [data-card=thumb]")) {
  const slot = card.parentElement!
  let pos = { x: 0, y: 0 }
  let vel = { x: 0, y: 0 }
  let swing = 0
  let lift = 0
  let held: { id: number; ox: number; oy: number; t: number; x: number; y: number } | null = null
  let dragged = false
  let frame = 0
  let last = 0

  const draw = () => {
    card.style.transform = `translate(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px) rotate(${swing.toFixed(2)}deg) scale(${(1 + lift * 0.08).toFixed(3)})`
  }

  const step = (now: number) => {
    let dt = Math.min(0.05, (now - last) / 1000)
    last = now
    const targetLift = held ? 1 : 0
    while (dt > 0) {
      const h = Math.min(STEP, dt)
      if (!held) {
        vel.x += (-K * pos.x - DAMP * vel.x) * h
        vel.y += (-K * pos.y - DAMP * vel.y) * h
        pos.x += vel.x * h
        pos.y += vel.y * h
      }
      swing += (Math.max(-18, Math.min(18, vel.x * 0.025)) - swing) * Math.min(1, h * 12)
      lift += (targetLift - lift) * Math.min(1, h * 14)
      dt -= h
    }
    draw()
    const settled = !held && Math.hypot(pos.x, pos.y) < 0.4 && Math.hypot(vel.x, vel.y) < 4 && Math.abs(swing) < 0.05 && lift < 0.01
    if (settled) {
      card.style.transform = ""
      delete slot.dataset.plucked
      land()
      frame = 0
    } else {
      frame = requestAnimationFrame(step)
    }
  }
  const wake = () => {
    if (frame) return
    last = performance.now()
    frame = requestAnimationFrame(step)
  }

  card.addEventListener("pointerdown", (e) => {
    if (!motion.matches || e.button !== 0) return
    held = { id: e.pointerId, ox: e.clientX - pos.x, oy: e.clientY - pos.y, t: performance.now(), x: e.clientX, y: e.clientY }
    dragged = false
  })
  card.addEventListener("pointermove", (e) => {
    if (!held || e.pointerId !== held.id) return
    if (!dragged) {
      if (Math.hypot(e.clientX - held.x, e.clientY - held.y) < START) return
      dragged = true
      card.setPointerCapture(e.pointerId)
      slot.dataset.plucked = ""
      tap()
      wake()
    }
    const now = performance.now()
    const dt = Math.max(1, now - held.t) / 1000
    vel = { x: (e.clientX - held.x) / dt, y: (e.clientY - held.y) / dt }
    pos = { x: e.clientX - held.ox, y: e.clientY - held.oy }
    Object.assign(held, { t: now, x: e.clientX, y: e.clientY })
  })
  const release = () => {
    if (!held) return
    held = null
    if (dragged) wake()
  }
  card.addEventListener("pointerup", release)
  card.addEventListener("pointercancel", release)
  card.addEventListener("lostpointercapture", release)
  // A drag that ends on the card must not also open it.
  card.addEventListener("click", (e) => {
    if (!dragged) return
    e.preventDefault()
    dragged = false
  })
  card.addEventListener("dragstart", (e) => e.preventDefault())
}
