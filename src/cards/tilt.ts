const motion = matchMedia("(prefers-reduced-motion: no-preference)")
const clamp = (v: number) => Math.min(1, Math.max(-1, v))
const toUnit = (v: number, from: number, to: number) => clamp(((v - from) / (to - from)) * 2 - 1)

function follow(card: HTMLElement) {
  let x = 0, y = 0, tx = 0, ty = 0, frame = 0
  const step = () => {
    x += (tx - x) * 0.14
    y += (ty - y) * 0.14
    card.style.setProperty("--x", x.toFixed(4))
    card.style.setProperty("--y", y.toFixed(4))
    frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(step) : 0
  }
  return (nx: number, ny: number) => {
    ;[tx, ty] = motion.matches ? [nx, ny] : [0, 0]
    frame ||= requestAnimationFrame(step)
  }
}

function fit(word: HTMLElement) {
  const card = word.closest<HTMLElement>("[data-card]")!
  const target = card.clientWidth * Number(word.dataset.fit)
  word.style.removeProperty("font-size")
  const width = word.scrollWidth
  if (width > target) word.style.fontSize = `${(parseFloat(getComputedStyle(word).fontSize) * target) / width}px`
}

const words = document.querySelectorAll<HTMLElement>("[data-fit]")
const refit = () => words.forEach(fit)
document.fonts.ready.then(refit)
new ResizeObserver(refit).observe(document.documentElement)

for (const card of document.querySelectorAll<HTMLElement>("[data-card=thumb]")) {
  const aim = follow(card)
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect()
    aim(toUnit(e.clientX, r.left, r.right), toUnit(e.clientY, r.top, r.bottom))
  })
  card.addEventListener("pointerleave", () => aim(0, 0))
}

const full = document.querySelector<HTMLElement>("[data-card=full]")

if (full) {
  const aim = follow(full)
  addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") aim(toUnit(e.clientX, 0, innerWidth), toUnit(e.clientY, 0, innerHeight))
  })
  document.documentElement.addEventListener("pointerleave", () => aim(0, 0))

  const orient = ({ beta, gamma }: DeviceOrientationEvent) => {
    if (beta === null || gamma === null) return
    const landscape = matchMedia("(orientation: landscape)").matches
    aim(toUnit(landscape ? beta : gamma, -45, 45), -toUnit(landscape ? Math.abs(gamma) : beta, 20, 70))
  }
  // iOS only delivers orientation events after a permission prompt triggered by a user gesture.
  const request = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
    .requestPermission
  if (request) {
    full.addEventListener(
      "click",
      () => request().then((state) => state === "granted" && addEventListener("deviceorientation", orient), () => {}),
      { once: true },
    )
  } else {
    addEventListener("deviceorientation", orient)
  }

  if (full.getAttribute("role") === "button") {
    const flip = () => {
      full.toggleAttribute("data-flipped")
      full.setAttribute("aria-pressed", String(full.hasAttribute("data-flipped")))
    }
    full.addEventListener("click", flip)
    full.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return
      e.preventDefault()
      flip()
    })
  }
}
