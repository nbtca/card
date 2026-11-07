import { peel as tick } from "../lib/sound"

interface Point {
  x: number
  y: number
}

// Folding the bottom-right corner to the pointer: the crease is the perpendicular bisector of the corner and
// the pointer, the sticker keeps the half away from the corner, and the flap is the other half mirrored.
function fold(w: number, h: number, tip: Point) {
  const corner = { x: w, y: h }
  const mid = { x: (corner.x + tip.x) / 2, y: (corner.y + tip.y) / 2 }
  const len = Math.hypot(corner.x - tip.x, corner.y - tip.y) || 1
  const n = { x: (corner.x - tip.x) / len, y: (corner.y - tip.y) / len }
  const side = (p: Point) => (p.x - mid.x) * n.x + (p.y - mid.y) * n.y
  const rect = [{ x: 0, y: 0 }, { x: w, y: 0 }, corner, { x: 0, y: h }]
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
  const exposed = clip((s) => s > 0)
  return { remain: clip((s) => s <= 0), exposed, flap: exposed.map(mirror), n, mid, depth: len }
}

const polygon = (points: Point[], dx = 0, dy = 0) =>
  points.length > 2 ? `polygon(${points.map((p) => `${(p.x + dx).toFixed(1)}px ${(p.y + dy).toFixed(1)}px`).join(",")})` : "polygon(0 0)"

const motion = matchMedia("(prefers-reduced-motion: no-preference)")
const storageKey = (id: string) => `card:revealed:${id}`

for (const root of document.querySelectorAll<HTMLElement>("[data-peel]")) {
  const sticker = root.querySelector<HTMLElement>("[data-peel-card]")!
  const flap = root.querySelector<HTMLElement>("[data-peel-flap]")!
  const shade = root.querySelector<HTMLElement>("[data-peel-shade]")
  const handle = root.querySelector<HTMLElement>("[data-peel-handle]")!
  const id = root.closest<HTMLElement>("[data-ticket]")?.dataset.ticket ?? ""
  const locked = root.hasAttribute("data-locked")

  const revealed = () => {
    root.dataset.revealed = ""
    root.dispatchEvent(new CustomEvent("pass:revealed", { bubbles: true }))
  }
  try {
    if (!locked && id && localStorage.getItem(storageKey(id))) revealed()
  } catch {}

  let w = 0
  let h = 0
  let tip: Point = { x: 0, y: 0 }
  let target: Point = { x: 0, y: 0 }
  let dragging = false
  let frame = 0
  let opened = 0
  let onSettle: (() => void) | null = null
  let revealing = false

  const rest = (lift = 0.09) => ({ x: w - w * lift, y: h - w * lift })

  const render = () => {
    const { remain, exposed, flap: shape, n, mid, depth } = fold(w, h, tip)
    sticker.style.clipPath = polygon(remain)
    flap.style.clipPath = polygon(shape, w, h)
    const deg = `${(Math.atan2(n.y, n.x) * 180) / Math.PI + 90}deg`
    // A linear gradient spans |W sin| + |H cos| through the box centre; this finds a point's offset along it.
    const at = (p: Point, bw: number, bh: number) =>
      `${(50 + (((p.x - w / 2) * n.x + (p.y - h / 2) * n.y) / (Math.abs(bw * n.x) + Math.abs(bh * n.y))) * 100).toFixed(2)}%`
    flap.style.setProperty("--shade-angle", deg)
    flap.style.setProperty("--fold", at(mid, 3 * w, 3 * h))
    flap.style.setProperty("--tip", at(tip, 3 * w, 3 * h))
    flap.parentElement!.style.setProperty("--lift", Math.min(1, depth / w).toFixed(3))
    if (shade) {
      shade.style.clipPath = polygon(exposed)
      shade.style.setProperty("--shade-angle", deg)
      shade.style.setProperty("--fold", at(mid, w, h))
    }
    tick(depth / 2 - opened)
    opened = depth / 2
  }

  const step = () => {
    tip = { x: tip.x + (target.x - tip.x) * 0.2, y: tip.y + (target.y - tip.y) * 0.2 }
    render()
    const settled = !dragging && Math.hypot(target.x - tip.x, target.y - tip.y) < 0.3
    frame = settled ? 0 : requestAnimationFrame(step)
    if (settled && onSettle) {
      onSettle()
      onSettle = null
    }
  }
  const go = (p: Point, then?: () => void) => {
    target = p
    onSettle = then ?? null
    if (!motion.matches) {
      tip = p
      render()
      onSettle?.()
      onSettle = null
    } else {
      frame ||= requestAnimationFrame(step)
    }
  }

  const reveal = () => {
    revealing = true
    go({ x: -w * 0.9, y: -h * 1.6 }, () => {
      revealed()
      try {
        localStorage.setItem(storageKey(id), "1")
      } catch {}
    })
  }

  const measure = () => {
    w = sticker.offsetWidth
    h = sticker.offsetHeight
    tip = target = rest()
    opened = Math.hypot(w - tip.x, h - tip.y) / 2
    render()
  }
  measure()
  addEventListener("resize", measure)

  const local = (e: PointerEvent) => {
    const box = sticker.getBoundingClientRect()
    let p = { x: ((e.clientX - box.left) / box.width) * w, y: ((e.clientY - box.top) / box.height) * h }
    if (locked) {
      const corner = { x: w, y: h }
      const d = Math.hypot(corner.x - p.x, corner.y - p.y)
      const max = w * 0.16
      if (d > max) p = { x: corner.x + ((p.x - corner.x) * max) / d, y: corner.y + ((p.y - corner.y) * max) / d }
    }
    return p
  }

  const nudge = () => root.dispatchEvent(new CustomEvent("pass:locked", { bubbles: true }))

  handle.addEventListener("pointerenter", () => !dragging && !revealing && go(rest(0.15)))
  handle.addEventListener("pointerleave", () => !dragging && !revealing && go(rest()))
  handle.addEventListener("pointerdown", (e) => {
    e.stopPropagation()
    e.preventDefault()
    handle.setPointerCapture(e.pointerId)
    dragging = true
    root.dataset.peeling = ""
    if (locked) nudge()
    go(local(e))
  })
  handle.addEventListener("pointermove", (e) => dragging && go(local(e)))
  const release = () => {
    if (!dragging) return
    dragging = false
    delete root.dataset.peeling
    if (!locked && Math.hypot(w - tip.x, h - tip.y) > w * 0.4) reveal()
    else go(rest())
  }
  handle.addEventListener("pointerup", release)
  handle.addEventListener("pointercancel", release)
  handle.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return
    e.preventDefault()
    if (locked) nudge()
    else reveal()
  })
}
