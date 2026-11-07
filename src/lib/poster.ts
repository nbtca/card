import { encode } from "uqr"

export interface PosterSpec {
  footage: HTMLVideoElement | HTMLImageElement | null
  word: string
  eyebrow: [string, string]
  holder: string
  tag: string
  title: string
  facts: [string, string][]
  link: string
  linkLabel: string
}

const W = 1080
const H = 1620
const CARD = { x: 90, y: 80, w: 900, h: 1420, r: 44 }
const PERFORATION = 1010
const INK = "#0b0d12"
const PAPER = "#f6f5f1"
const MUTED = "rgb(11 13 18 / 0.55)"
const SANS = `system-ui, -apple-system, "PingFang SC", "Noto Sans SC", sans-serif`
const WIDE = `"Archivo", ${SANS}`

function cover(ctx: OffscreenCanvasRenderingContext2D, source: HTMLVideoElement | HTMLImageElement, w: number, h: number) {
  const [sw, sh] = source instanceof HTMLVideoElement ? [source.videoWidth, source.videoHeight] : [source.naturalWidth, source.naturalHeight]
  const k = Math.max(w / sw, h / sh)
  ctx.drawImage(source, (w - sw * k) / 2, (h - sh * k) / 2, sw * k, sh * k)
}

function aurora(ctx: OffscreenCanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#0a2a6b"
  ctx.fillRect(0, 0, w, h)
  for (const [x, y, r, color] of [[0.2, 0.2, 0.7, "#3b8dff"], [0.85, 0.35, 0.6, "#ff5fa2"], [0.5, 0.8, 0.8, "#3ecfcf"]] as const) {
    const g = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w)
    g.addColorStop(0, color)
    g.addColorStop(1, "transparent")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
}

const font = (weight: number, size: number, family: string) => `${weight} ${size}px ${family}`

function fit(ctx: OffscreenCanvasRenderingContext2D, text: string, weight: number, max: number, width: number, family: string) {
  ctx.font = font(weight, max, family)
  return Math.min(max, (max * width) / ctx.measureText(text).width)
}

function spaced(ctx: OffscreenCanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: "left" | "right" = "left") {
  ctx.letterSpacing = `${spacing}px`
  ctx.textAlign = align
  ctx.fillText(text, x, y)
  ctx.letterSpacing = "0px"
  ctx.textAlign = "left"
}

export async function drawPoster(spec: PosterSpec) {
  await Promise.all([document.fonts.load(font(900, 100, `"Archivo"`)), document.fonts.ready])
  const canvas = new OffscreenCanvas(W, H)
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#05060a"
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.75)
  glow.addColorStop(0, "rgb(59 141 255 / 0.28)")
  glow.addColorStop(1, "transparent")
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const card = new OffscreenCanvas(CARD.w, CARD.h)
  const c = card.getContext("2d")!
  c.beginPath()
  c.roundRect(0, 0, CARD.w, CARD.h, CARD.r)
  c.clip()
  if (spec.footage) cover(c, spec.footage, CARD.w, CARD.h)
  else aurora(c, CARD.w, CARD.h)

  const sheet = new OffscreenCanvas(CARD.w, CARD.h)
  const s = sheet.getContext("2d")!
  s.fillStyle = PAPER
  s.fillRect(0, 0, CARD.w, CARD.h)
  s.globalCompositeOperation = "destination-out"
  s.fontStretch = "expanded"
  const size = fit(s, spec.word, 900, 330, CARD.w * 0.84, WIDE)
  s.font = font(900, size, WIDE)
  s.textAlign = "center"
  s.textBaseline = "middle"
  s.fillText(spec.word, CARD.w / 2, 330)
  c.drawImage(sheet, 0, 0)

  c.fillStyle = INK
  c.textBaseline = "alphabetic"
  c.font = font(700, 20, WIDE)
  spaced(c, spec.eyebrow[0].toUpperCase(), 56, 76, 4)
  spaced(c, spec.eyebrow[1].toUpperCase(), CARD.w - 56, 76, 4, "right")

  c.font = font(800, fit(c, spec.holder, 800, 66, CARD.w - 112, SANS), SANS)
  c.fillText(spec.holder, 56, 640)
  c.font = font(800, 18, WIDE)
  const tagWidth = c.measureText(spec.tag.toUpperCase()).width + 36
  c.beginPath()
  c.roundRect(56, 670, tagWidth, 34, 17)
  c.fill()
  c.fillStyle = PAPER
  spaced(c, spec.tag.toUpperCase(), 74, 694, 2)
  c.fillStyle = MUTED
  c.font = font(600, 28, SANS)
  c.fillText(spec.title, 56 + tagWidth + 18, 697)

  c.fillStyle = "rgb(11 13 18 / 0.14)"
  c.fillRect(56, 760, CARD.w - 112, 2)
  spec.facts.forEach(([label, value], i) => {
    const x = 56 + i * ((CARD.w - 112) / spec.facts.length)
    c.fillStyle = MUTED
    c.font = font(700, 18, WIDE)
    spaced(c, label.toUpperCase(), x, 818, 3)
    c.fillStyle = INK
    c.font = font(700, 34, SANS)
    c.fillText(value, x, 870)
  })

  c.setLineDash([12, 10])
  c.strokeStyle = "rgb(11 13 18 / 0.2)"
  c.lineWidth = 3
  c.beginPath()
  c.moveTo(40, PERFORATION)
  c.lineTo(CARD.w - 40, PERFORATION)
  c.stroke()

  const qr = encode(spec.link, { ecc: "M", border: 0 })
  const cell = Math.floor(280 / qr.size)
  c.fillStyle = INK
  qr.data.forEach((row, y) => row.forEach((on, x) => on && c.fillRect(70 + x * cell, 1080 + y * cell, cell, cell)))
  const right = 70 + qr.size * cell + 50
  c.font = font(800, 44, SANS)
  c.fillText(spec.linkLabel, right, 1170)
  c.fillStyle = MUTED
  c.font = font(600, 24, WIDE)
  c.fillText(spec.link.replace(/^https?:\/\//, ""), right, 1222)
  c.font = font(700, 18, WIDE)
  spaced(c, "ADMIT ONE", right, 1290, 5)

  const glare = c.createRadialGradient(CARD.w * 0.8, 0, 0, CARD.w * 0.8, 0, CARD.w * 0.9)
  glare.addColorStop(0, "rgb(255 255 255 / 0.35)")
  glare.addColorStop(1, "transparent")
  c.fillStyle = glare
  c.fillRect(0, 0, CARD.w, CARD.h)

  c.globalCompositeOperation = "destination-out"
  c.fillStyle = "#000"
  for (const x of [0, CARD.w]) {
    c.beginPath()
    c.arc(x, PERFORATION, 22, 0, Math.PI * 2)
    c.fill()
  }

  ctx.shadowColor = "rgb(0 0 0 / 0.6)"
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 30
  ctx.drawImage(card, CARD.x, CARD.y)
  ctx.shadowColor = "transparent"

  ctx.fillStyle = "rgb(238 241 246 / 0.55)"
  ctx.font = font(600, 24, SANS)
  ctx.textAlign = "center"
  ctx.fillText("浙大宁波理工学院计算机协会 · card.nbtca.space", W / 2, H - 50)
  return canvas.convertToBlob({ type: "image/webp", quality: 0.92 })
}
