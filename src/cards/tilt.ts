const motion = matchMedia("(prefers-reduced-motion: no-preference)")
const clamp = (v: number) => Math.min(1, Math.max(-1, v))
const toUnit = (v: number, from: number, to: number) => clamp(((v - from) / (to - from)) * 2 - 1)

const visible = new WeakSet<Element>()
const onScreen = new IntersectionObserver((entries) => {
  for (const { target, isIntersecting } of entries) isIntersecting ? visible.add(target) : visible.delete(target)
})

function follow(card: HTMLElement) {
  onScreen.observe(card)
  let x = 0, y = 0, tx = 0, ty = 0, frame = 0
  const step = () => {
    x += (tx - x) * 0.14
    y += (ty - y) * 0.14
    card.style.setProperty("--x", x.toFixed(4))
    card.style.setProperty("--y", y.toFixed(4))
    frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(step) : 0
  }
  return (nx: number, ny: number) => {
    if (!visible.has(card)) return
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
addEventListener("card:refit", refit)

for (const card of document.querySelectorAll<HTMLElement>("[data-card=thumb]")) {
  const aim = follow(card)
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect()
    aim(toUnit(e.clientX, r.left, r.right), toUnit(e.clientY, r.top, r.bottom))
  })
  card.addEventListener("pointerleave", () => aim(0, 0))
}

// Many looping videos on one page would decode at once; only cards on screen play.
const videos = new IntersectionObserver((entries) => {
  for (const { target, isIntersecting } of entries) {
    const video = target as HTMLVideoElement
    if (isIntersecting && motion.matches) video.play().catch(() => {})
    else video.pause()
  }
})
document.querySelectorAll("[data-card] video").forEach((v) => videos.observe(v))

// Moving a dedicated layer keeps the light on the compositor; a root custom property would restyle the whole page.
const light = document.querySelector<HTMLElement>(".light")
let lightFrame = 0
addEventListener("pointermove", (e) => {
  if (!light || lightFrame || e.pointerType !== "mouse") return
  lightFrame = requestAnimationFrame(() => {
    lightFrame = 0
    light.style.translate = `${e.clientX}px ${e.clientY}px`
  })
})

const stage = [...document.querySelectorAll<HTMLElement>("[data-card=stage]")]

if (stage.length) {
  const aims = stage.map(follow)
  const aim = (x: number, y: number) => aims.forEach((a) => a(x, y))
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
    addEventListener(
      "click",
      () => request().then((state) => state === "granted" && addEventListener("deviceorientation", orient), () => {}),
      { once: true },
    )
  } else {
    addEventListener("deviceorientation", orient)
  }
}

for (const card of document.querySelectorAll<HTMLElement>("[data-card][role=button]")) {
  const flip = () => {
    card.toggleAttribute("data-flipped")
    card.setAttribute("aria-pressed", String(card.hasAttribute("data-flipped")))
  }
  card.addEventListener("click", flip)
  card.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return
    e.preventDefault()
    flip()
  })
}
