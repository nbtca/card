import { pat, peel as peelSound } from "../lib/sound"

interface Point {
  x: number
  y: number
}

// Folding the top-right corner to the pointer: the crease is the perpendicular bisector of the corner and
// the pointer, the card keeps the half away from the corner, and the flap is the other half mirrored.
function fold(w: number, h: number, tip: Point) {
  const corner = { x: w, y: 0 }
  const mid = { x: (corner.x + tip.x) / 2, y: (corner.y + tip.y) / 2 }
  const len = Math.hypot(corner.x - tip.x, corner.y - tip.y) || 1
  const n = { x: (corner.x - tip.x) / len, y: (corner.y - tip.y) / len }
  const side = (p: Point) => (p.x - mid.x) * n.x + (p.y - mid.y) * n.y
  const rect = [{ x: 0, y: 0 }, corner, { x: w, y: h }, { x: 0, y: h }]
  const clip = (keep: (s: number) => boolean) => {
    const out: Point[] = []
    rect.forEach((a, i) => {
      const b = rect[(i + 1) % rect.length]!
      const sa = side(a)
      const sb = side(b)
      if (keep(sa)) out.push(a)
      if (keep(sa) !== keep(sb)) out.push({ x: a.x + ((b.x - a.x) * sa) / (sa - sb), y: a.y + ((b.y - a.y) * sa) / (sa - sb) })
    })
    return out
  }
  const mirror = (p: Point) => {
    const d = side(p)
    return { x: p.x - 2 * d * n.x, y: p.y - 2 * d * n.y }
  }
  return { remain: clip((s) => s <= 0), flap: clip((s) => s > 0).map(mirror), angle: Math.atan2(n.y, n.x), depth: len }
}

const polygon = (points: Point[], dx = 0, dy = 0) =>
  points.length > 2 ? `polygon(${points.map((p) => `${(p.x + dx).toFixed(1)}px ${(p.y + dy).toFixed(1)}px`).join(",")})` : "polygon(0 0)"

const motion = matchMedia("(prefers-reduced-motion: no-preference)")

for (const root of document.querySelectorAll<HTMLElement>("[data-peel]")) {
  const card = root.querySelector<HTMLElement>("[data-peel-card]")!
  const flap = root.querySelector<HTMLElement>("[data-peel-flap]")!
  const handle = root.querySelector<HTMLElement>("[data-peel-handle]")!
  let w = 0
  let h = 0
  let tip: Point = { x: 0, y: 0 }
  let target: Point = { x: 0, y: 0 }
  let dragging = false
  let frame = 0

  const rest = (lift = 0.09) => ({ x: w * (1 - lift), y: w * lift })

  const render = () => {
    const { remain, flap: shape, angle, depth } = fold(w, h, tip)
    card.style.clipPath = polygon(remain)
    flap.style.clipPath = polygon(shape, w / 2, h / 2)
    const deg = (angle * 180) / Math.PI + 90
    flap.style.setProperty("--shade-angle", `${deg}deg`)
    flap.style.setProperty("--lift", Math.min(1, depth / w).toFixed(3))
  }

  const step = () => {
    tip = { x: tip.x + (target.x - tip.x) * 0.2, y: tip.y + (target.y - tip.y) * 0.2 }
    render()
    frame = !dragging && Math.hypot(target.x - tip.x, target.y - tip.y) < 0.3 ? 0 : requestAnimationFrame(step)
  }
  const go = (p: Point) => {
    target = p
    if (!motion.matches) {
      tip = p
      render()
    } else {
      frame ||= requestAnimationFrame(step)
    }
  }

  const measure = () => {
    w = card.offsetWidth
    h = card.offsetHeight
    tip = target = rest()
    render()
  }
  measure()
  addEventListener("resize", measure)

  const local = (e: PointerEvent) => {
    const box = card.getBoundingClientRect()
    const x = ((e.clientX - box.left) / box.width) * w
    const y = ((e.clientY - box.top) / box.height) * h
    return { x: Math.min(w, Math.max(-w * 0.3, x)), y: Math.min(h * 1.1, Math.max(0, y)) }
  }

  handle.addEventListener("pointerenter", () => !dragging && go(rest(0.15)))
  handle.addEventListener("pointerleave", () => !dragging && go(rest()))
  handle.addEventListener("pointerdown", (e) => {
    e.stopPropagation()
    e.preventDefault()
    handle.setPointerCapture(e.pointerId)
    dragging = true
    root.dataset.peeling = ""
    peelSound()
    go(local(e))
  })
  handle.addEventListener("pointermove", (e) => dragging && go(local(e)))
  const release = () => {
    if (!dragging) return
    dragging = false
    delete root.dataset.peeling
    pat()
    go(rest())
  }
  handle.addEventListener("pointerup", release)
  handle.addEventListener("pointercancel", release)
  handle.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return
    e.preventDefault()
    const open = target.x < w * 0.5
    go(open ? rest() : { x: w * 0.2, y: h * 0.45 })
    if (!open) peelSound()
  })
}
