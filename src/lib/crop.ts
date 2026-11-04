// Frames an image inside a 5:7 window by dragging, wheel or pinch, then renders that window.
export const RATIO = 7 / 5

export interface Framing {
  x: number
  y: number
  scale: number
}

export class Cropper {
  framing: Framing = { x: 0, y: 0, scale: 1 }
  private min = 1
  private max = 1
  private pointers = new Map<number, { x: number; y: number }>()
  private pinch = 0
  private listeners = new AbortController()

  constructor(
    private frame: HTMLElement,
    private img: HTMLImageElement,
    readonly bitmap: ImageBitmap,
    // A background must fill the card; a cut-out portrait may sit smaller inside it.
    private cover: boolean,
    private onChange: (settled: boolean) => void,
  ) {
    const { signal } = this.listeners
    frame.addEventListener("pointerdown", this.down, { signal })
    frame.addEventListener("pointermove", this.move, { signal })
    frame.addEventListener("pointerup", this.up, { signal })
    frame.addEventListener("pointercancel", this.up, { signal })
    frame.addEventListener("wheel", this.wheel, { passive: false, signal })
    frame.addEventListener("keydown", this.key, { signal })
    this.reset()
  }

  // The frame element is reused for the next image, so its listeners must go with this cropper.
  destroy() {
    this.listeners.abort()
    clearTimeout(this.settle)
    this.bitmap.close()
  }

  // Remembered so render() still works after the dialog holding the frame has closed and measures 0.
  private width = 0
  private get size() {
    this.width = this.frame.clientWidth || this.width
    return { w: this.width, h: this.width * RATIO }
  }

  reset() {
    const { w, h } = this.size
    const fill = Math.max(w / this.bitmap.width, h / this.bitmap.height)
    const fit = Math.min(w / this.bitmap.width, h / this.bitmap.height)
    this.min = this.cover ? fill : fit * 0.6
    this.max = fill * 5
    const scale = this.cover ? fill : fit
    // Portraits start standing on the bottom edge, where the card expects them.
    this.framing = {
      scale,
      x: (w - this.bitmap.width * scale) / 2,
      y: this.cover ? (h - this.bitmap.height * scale) / 2 : h - this.bitmap.height * scale,
    }
    this.apply(true)
  }

  get zoom() {
    return (this.framing.scale - this.min) / (this.max - this.min)
  }

  setZoom(t: number, settled = true) {
    const { w, h } = this.size
    this.zoomAt(this.min + (this.max - this.min) * t, w / 2, h / 2, settled)
  }

  private zoomAt(scale: number, cx: number, cy: number, settled: boolean) {
    const next = Math.min(this.max, Math.max(this.min, scale))
    const k = next / this.framing.scale
    this.framing = { scale: next, x: cx - (cx - this.framing.x) * k, y: cy - (cy - this.framing.y) * k }
    this.apply(settled)
  }

  private clamp() {
    const { w, h } = this.size
    const iw = this.bitmap.width * this.framing.scale
    const ih = this.bitmap.height * this.framing.scale
    const keep = (pos: number, inner: number, outer: number) =>
      this.cover ? Math.min(0, Math.max(outer - inner, pos)) : Math.min(outer * 0.8, Math.max(outer * 0.2 - inner, pos))
    this.framing.x = keep(this.framing.x, iw, w)
    this.framing.y = keep(this.framing.y, ih, h)
  }

  private apply(settled: boolean) {
    this.clamp()
    const { x, y, scale } = this.framing
    this.img.style.width = `${this.bitmap.width * scale}px`
    this.img.style.transform = `translate(${x}px, ${y}px)`
    this.onChange(settled)
  }

  private down = (e: PointerEvent) => {
    this.frame.setPointerCapture(e.pointerId)
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.pointers.size === 2) this.pinch = this.spread()
  }

  private spread() {
    const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  private move = (e: PointerEvent) => {
    const last = this.pointers.get(e.pointerId)
    if (!last) return
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (this.pointers.size === 2) {
      const box = this.frame.getBoundingClientRect()
      const [a, b] = [...this.pointers.values()] as [{ x: number; y: number }, { x: number; y: number }]
      const spread = this.spread()
      this.zoomAt(this.framing.scale * (spread / this.pinch), (a.x + b.x) / 2 - box.left, (a.y + b.y) / 2 - box.top, false)
      this.pinch = spread
    } else {
      this.framing.x += e.clientX - last.x
      this.framing.y += e.clientY - last.y
      this.apply(false)
    }
  }

  private up = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId)
    if (!this.pointers.size) this.onChange(true)
  }

  private settle = 0
  private wheel = (e: WheelEvent) => {
    e.preventDefault()
    const box = this.frame.getBoundingClientRect()
    this.zoomAt(this.framing.scale * Math.exp(-e.deltaY * 0.0015), e.clientX - box.left, e.clientY - box.top, false)
    clearTimeout(this.settle)
    this.settle = window.setTimeout(() => this.onChange(true), 150)
  }

  private key = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 10
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (e.key in moves) {
      e.preventDefault()
      this.framing.x += moves[e.key]![0]
      this.framing.y += moves[e.key]![1]
      this.apply(true)
    } else if (e.key === "+" || e.key === "=" || e.key === "-") {
      e.preventDefault()
      this.setZoom(Math.min(1, Math.max(0, this.zoom + (e.key === "-" ? -0.08 : 0.08))))
    }
  }

  // Safari cannot encode WebP and returns PNG, which keeps a portrait's transparency, so the server accepts both.
  render(width: number) {
    const k = width / this.size.w
    const canvas = new OffscreenCanvas(width, Math.round(width * RATIO))
    const ctx = canvas.getContext("2d")!
    ctx.imageSmoothingQuality = "high"
    const { x, y, scale } = this.framing
    ctx.drawImage(this.bitmap, x * k, y * k, this.bitmap.width * scale * k, this.bitmap.height * scale * k)
    return canvas.convertToBlob({ type: "image/webp", quality: 0.86 })
  }
}
