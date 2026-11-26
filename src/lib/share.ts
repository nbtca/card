import { aurora, cover, fit, font, INK, MUTED, PAPER, SANS, spaced, WIDE } from "./poster"

export interface ShareSpec {
  footage: HTMLVideoElement | HTMLImageElement | null
  word: string
  title: string
  when: string
  venue: string
}

const W = 1200
const H = 630

// Chat apps crop link previews to roughly 1.91:1, so everything that matters stays inside the middle.
export async function drawShare(spec: ShareSpec) {
  await Promise.all([document.fonts.load(font(900, 100, `"Archivo"`)), document.fonts.ready])
  const canvas = new OffscreenCanvas(W, H)
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)

  const art = new OffscreenCanvas(W, 360)
  const a = art.getContext("2d")!
  if (spec.footage) cover(a, spec.footage, W, 360)
  else aurora(a, W, 360)
  const sheet = new OffscreenCanvas(W, 360)
  const s = sheet.getContext("2d")!
  s.fillStyle = PAPER
  s.fillRect(0, 0, W, 360)
  s.globalCompositeOperation = "destination-out"
  s.fontStretch = "expanded"
  s.font = font(900, fit(s, spec.word, 900, 300, W - 160, WIDE), WIDE)
  s.textAlign = "center"
  s.textBaseline = "middle"
  s.fillText(spec.word, W / 2, 200)
  a.drawImage(sheet, 0, 0)
  ctx.drawImage(art, 0, 0)

  ctx.fillStyle = INK
  ctx.textBaseline = "alphabetic"
  ctx.font = font(800, fit(ctx, spec.title, 800, 56, W - 160, SANS), SANS)
  ctx.fillText(spec.title, 80, 450)
  ctx.fillStyle = MUTED
  ctx.font = font(600, 30, SANS)
  ctx.fillText(`${spec.when} · ${spec.venue}`, 80, 505, W - 160)
  ctx.fillStyle = "rgb(11 13 18 / 0.14)"
  ctx.fillRect(80, 545, W - 160, 2)
  ctx.fillStyle = MUTED
  ctx.font = font(700, 18, WIDE)
  spaced(ctx, "NBTCA EVENT PASS", 80, 590, 4)
  spaced(ctx, "CARD.NBTCA.SPACE", W - 80, 590, 4, "right")
  return canvas.convertToBlob({ type: "image/webp", quality: 0.85 })
}
