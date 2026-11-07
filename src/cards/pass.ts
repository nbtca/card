import { encode } from "uqr"
import { checkInOpensAt, checkInPhase, mediaUrl, posterKey, type Event, type Pass } from "../lib/db"
import { formatClock, formatDay, formatSerial, ZONE } from "../lib/format"

export interface PassProps {
  event: Event
  pass: Pick<Pass, "id" | "serial" | "redeemed_at"> | null
  holder: string
  guest: boolean
  size?: "thumb" | "full"
  transitionName?: string | null
  anatomy?: boolean
}

const teeth = Array.from({ length: 25 }, (_, i) => `${100 - i * (100 / 24)}% ${i % 2 ? 76.9 : 75.6}%`)
export const TEAR = `polygon(0 0, 100% 0, ${teeth.join(", ")})`

export function qrCode(text: string) {
  const qr = encode(text, { ecc: "M", border: 0 })
  return {
    size: qr.size,
    path: qr.data.flatMap((row, y) => row.flatMap((on, x) => (on ? [`M${x} ${y}h1v1h-1z`] : []))).join(""),
  }
}

export function ticket({ event, pass }: PassProps, origin: string) {
  const when = new Date(event.starts_at)
  const checkIn = checkInPhase(event)
  // The code only reaches the page once it can be used, so a screenshot taken earlier carries nothing.
  const showCode = !!pass && !pass.redeemed_at && checkIn === "open"
  return {
    checkIn,
    opensAt: checkInOpensAt(event),
    showCode,
    state: !pass ? "preview" : pass.redeemed_at ? "redeemed" : checkIn === "ended" ? "expired" : "valid",
    date: when.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: ZONE }),
    day: formatDay(when),
    time: formatClock(when),
    serial: pass ? formatSerial(pass.serial) : "№ ————",
    redeemedAt: pass?.redeemed_at ? formatClock(pass.redeemed_at) : null,
    video: mediaUrl(event.video),
    poster: event.video ? mediaUrl(posterKey(event.video)) : null,
    qr: qrCode(showCode ? `${origin}/scan#${pass!.id}` : `${origin}/e/${event.slug}`),
  } as const
}

const designs = import.meta.glob<{ default: (props: PassProps) => unknown }>("./passes/*.astro", { eager: true })

export const passDesigns = Object.fromEntries(
  Object.entries(designs).map(([path, module]) => [path.slice("./passes/".length, -".astro".length), module.default]),
)

export const passDesign = (name: string) => passDesigns[name] ?? passDesigns.default!
