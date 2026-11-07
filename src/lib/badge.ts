export interface BadgeSpec {
  background: HTMLImageElement | null
  portrait: HTMLImageElement | null
  word: string
  name: string
  sub: string
  hue: number
}

const S = 360
const R = S / 2
const SANS = `system-ui, -apple-system, "PingFang SC", "Noto Sans SC", sans-serif`
const DISPLAY = `"Bebas Neue", "Arial Narrow", Impact, ${SANS}`

const oklch = (l: number, c: number, h: number, a = 1) => `oklch(${l} ${c} ${h} / ${a})`

function cover(ctx: OffscreenCanvasRenderingContext2D, image: HTMLImageElement, scale = 1, anchorY = 0.5) {
  const k = Math.max(S / image.naturalWidth, S / image.naturalHeight) * scale
  const [w, h] = [image.naturalWidth * k, image.naturalHeight * k]
  ctx.drawImage(image, (S - w) / 2, (S - h) * anchorY, w, h)
}

function sky(ctx: OffscreenCanvasRenderingContext2D, hue: number) {
  const base = ctx.createLinearGradient(0, 0, 0, S)
  base.addColorStop(0, oklch(0.2, 0.08, hue))
  base.addColorStop(0.65, oklch(0.48, 0.16, hue))
  base.addColorStop(1, oklch(0.72, 0.13, hue + 25))
  ctx.fillStyle = base
  ctx.fillRect(0, 0, S, S)
  for (const [x, y, r, color] of [[0.5, 1, 0.9, oklch(0.82, 0.13, hue + 45)], [0.8, 0.15, 0.6, oklch(0.6, 0.16, hue - 30, 0.6)]] as const) {
    const g = ctx.createRadialGradient(x * S, y * S, 0, x * S, y * S, r * S)
    g.addColorStop(0, color)
    g.addColorStop(1, "transparent")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
  }
  const fade = ctx.createLinearGradient(0, S * 0.2, 0, S * 0.75)
  fade.addColorStop(0, "rgb(255 255 255 / 0)")
  fade.addColorStop(1, "rgb(255 255 255 / 0.12)")
  ctx.fillStyle = fade
  for (let i = 36; i < S; i += 36) {
    ctx.fillRect(i, 0, 1, S)
    ctx.fillRect(0, i, S, 1)
  }
}

async function logo() {
  const image = new Image()
  image.src = "/logo.svg"
  await image.decode()
  const tinted = new OffscreenCanvas(S, S)
  const t = tinted.getContext("2d")!
  t.drawImage(image, S * 0.06, S * 0.36, S * 0.88, S * 0.88)
  t.globalCompositeOperation = "source-in"
  t.fillStyle = "rgb(255 255 255 / 0.9)"
  t.fillRect(0, 0, S, S)
  return tinted
}

export async function drawBadge(spec: BadgeSpec) {
  await Promise.all([document.fonts.load(`400 100px "Bebas Neue"`), document.fonts.ready])
  const canvas = new OffscreenCanvas(S, S)
  const ctx = canvas.getContext("2d")!
  if (spec.background) {
    ctx.filter = "saturate(1.3) brightness(0.9)"
    cover(ctx, spec.background, 1.06)
    ctx.filter = "none"
  } else sky(ctx, spec.hue)

  const word = spec.word.toUpperCase()
  ctx.font = `400 100px ${DISPLAY}`
  const size = Math.min(150, (100 * 280) / ctx.measureText(word).width)
  ctx.font = `400 ${size}px ${DISPLAY}`
  ctx.fillStyle = "rgb(255 255 255 / 0.92)"
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  ctx.fillText(word, R, 62)

  if (spec.portrait) cover(ctx, spec.portrait, 1.08, 1)
  else ctx.drawImage(await logo(), 0, 0)

  const blurred = new OffscreenCanvas(S, S)
  const b = blurred.getContext("2d")!
  b.filter = "blur(10px)"
  b.drawImage(canvas, 0, 0)
  b.filter = "none"
  b.globalCompositeOperation = "destination-in"
  const fade = b.createLinearGradient(0, S * 0.62, 0, S * 0.85)
  fade.addColorStop(0, "transparent")
  fade.addColorStop(1, "#000")
  b.fillStyle = fade
  b.fillRect(0, 0, S, S)
  ctx.drawImage(blurred, 0, 0)

  ctx.shadowColor = "rgb(0 0 0 / 0.3)"
  ctx.shadowBlur = 8
  ctx.shadowOffsetY = 2
  ctx.fillStyle = "#fff"
  ctx.textBaseline = "alphabetic"
  ctx.letterSpacing = "4px"
  ctx.font = `400 15px ${DISPLAY}`
  ctx.fillText("NBTCA", R + 2, 38)
  ctx.fillRect(R - 14, 266, 28, 1)
  ctx.letterSpacing = "2px"
  ctx.font = `600 26px ${SANS}`
  ctx.fillText(spec.name, R + 1, 300, 230)
  ctx.letterSpacing = "0px"
  ctx.globalAlpha = 0.8
  ctx.font = `400 14px ${SANS}`
  ctx.fillText(spec.sub, R, 322, 200)
  ctx.globalAlpha = 1

  // The badge's upload page takes only JPEG and PNG, so this one image cannot be WebP.
  return canvas.convertToBlob({ type: "image/png" })
}
