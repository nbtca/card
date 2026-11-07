// After Jhey Tompkins' generative sprite masks.
const FRAMES = 14

const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function dissolveMask({ cols = 10, rows = 6, seed = 1 } = {}) {
  const next = random(seed)
  const order = Array.from({ length: cols * rows }, (_, i) => [Math.floor(i / cols) / rows + next() * 0.7, i] as const)
  order.sort((a, b) => a[0] - b[0])
  const frameOf = new Array<number>(cols * rows)
  order.forEach(([, cell], rank) => (frameOf[cell] = Math.floor((rank / order.length) * FRAMES) + 1))

  let sheet = ""
  for (let frame = 1; frame <= FRAMES; frame++) {
    const cells = frameOf.flatMap((f, i) => (f <= frame ? [`M${frame * cols + (i % cols)} ${Math.floor(i / cols)}h1.02v1.02h-1.02z`] : []))
    sheet += `<path d="${cells.join("")}"/>`
  }
  // Frame 0 is empty and the last frame is whole; the sheet holds them side by side.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(FRAMES + 1) * cols} ${rows}" preserveAspectRatio="none" shape-rendering="crispEdges"><g fill="#fff">${sheet}</g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
