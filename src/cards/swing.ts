// Tags on a rail hang from their eyelet as damped pendulums.
const motion = matchMedia("(prefers-reduced-motion: no-preference)")
const K = 70
const DAMP = 5.5
const STEP = 1 / 120
const MAX = 24

interface Hanger {
  el: HTMLElement
  rest: number
  target: number
  angle: number
  speed: number
}

export function swingRail(rail: HTMLElement, scroller: HTMLElement) {
  const hangers = new Map<HTMLElement, Hanger>()
  const moving = new Set<Hanger>()
  let frame = 0
  let last = 0

  const draw = (h: Hanger) => (h.el.style.rotate = `${h.angle.toFixed(2)}deg`)

  const step = (now: number) => {
    let dt = Math.min(0.05, (now - last) / 1000)
    last = now
    while (dt > 0) {
      const t = Math.min(STEP, dt)
      for (const h of moving) {
        h.speed += (-K * (h.angle - h.target) - DAMP * h.speed) * t
        h.angle = Math.max(-MAX, Math.min(MAX, h.angle + h.speed * t))
      }
      dt -= t
    }
    for (const h of moving) {
      draw(h)
      if (Math.abs(h.angle - h.target) < 0.05 && Math.abs(h.speed) < 0.5) {
        h.angle = h.target
        draw(h)
        h.el.style.willChange = ""
        moving.delete(h)
      }
    }
    frame = moving.size ? requestAnimationFrame(step) : 0
  }

  const wake = (h: Hanger) => {
    if (!motion.matches) return
    h.el.style.willChange = "rotate"
    moving.add(h)
    if (!frame) {
      last = performance.now()
      frame = requestAnimationFrame(step)
    }
  }

  // Layout positions ignore the swing, so reading them does not wait on style.
  const centre = (h: Hanger) => h.el.offsetLeft + h.el.offsetWidth / 2

  const push = (h: Hanger, speed: number) => {
    h.speed += speed
    wake(h)
  }

  const aim = (h: Hanger, target: number) => {
    h.target = target
    if (motion.matches) wake(h)
    else draw(Object.assign(h, { angle: target, speed: 0 }))
  }

  // A pointer sweeping right pushes the bottom of a tag right, which is a counter-clockwise turn.
  let pointer = { x: 0, t: 0 }
  rail.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return
    const now = performance.now()
    const vx = (e.clientX - pointer.x) / Math.max(8, now - pointer.t)
    pointer = { x: e.clientX, t: now }
    if (Math.abs(vx) < 0.05) return
    const x = e.clientX - rail.getBoundingClientRect().left
    for (const h of hangers.values()) {
      const reach = 1 - Math.abs(x - centre(h)) / h.el.offsetWidth
      if (reach > 0) push(h, -vx * 32 * reach * reach)
    }
  })

  // The rail drags the eyelets along when it scrolls, so a change of pace makes the tags lag behind.
  let scroll = { at: scroller.scrollLeft, t: performance.now(), v: 0 }
  scroller.addEventListener(
    "scroll",
    () => {
      const now = performance.now()
      const v = (scroller.scrollLeft - scroll.at) / Math.max(8, now - scroll.t)
      const kick = Math.max(-40, Math.min(40, (v - scroll.v) * 60))
      scroll = { at: scroller.scrollLeft, t: now, v }
      if (Math.abs(kick) < 1) return
      const [from, to] = [scroller.scrollLeft, scroller.scrollLeft + scroller.clientWidth]
      for (const h of hangers.values()) {
        const x = centre(h)
        if (x > from && x < to) push(h, kick)
      }
    },
    { passive: true },
  )

  return {
    add(el: HTMLElement, rest: number, kick = 0) {
      const h: Hanger = { el, rest, target: rest, angle: rest, speed: 0 }
      hangers.set(el, h)
      draw(h)
      const settle = () => aim(h, el.matches(":hover, :focus-within") ? 0 : rest)
      el.addEventListener("pointerenter", settle)
      el.addEventListener("pointerleave", settle)
      el.addEventListener("focusin", settle)
      el.addEventListener("focusout", settle)
      if (kick) push(h, kick)
    },
    remove(el: HTMLElement) {
      const h = hangers.get(el)
      if (h) moving.delete(h)
      hangers.delete(el)
    },
  }
}
