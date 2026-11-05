import { encode } from "uqr"
import { checkInOpensAt, checkInPhase, mediaUrl, posterKey, ZONE, type Event, type Pass } from "../lib/db"

// Elements marked data-bind="word|title|venue|date|day|time|footage" update live in the event editor.
export interface PassProps {
  event: Event
  pass: Pick<Pass, "id" | "serial" | "redeemed_at"> | null
  holder: string
  guest: boolean
  size?: "thumb" | "full"
  transitionName?: string | null
  // Lets the page spread the layers apart in 3D by setting --e from 0 to 1.
  anatomy?: boolean
}

export function ticket({ event, pass }: PassProps, origin: string) {
  const when = new Date(event.starts_at)
  const checkIn = checkInPhase(event)
  // The code only reaches the page once it can be used, so a screenshot taken earlier carries nothing.
  const showCode = !!pass && !pass.redeemed_at && checkIn === "open"
  // Staff can scan this with any camera app: the URL opens the check-in page.
  const qr = encode(showCode ? `${origin}/scan#${pass!.id}` : `${origin}/e/${event.slug}`, { ecc: "M", border: 0 })
  return {
    checkIn,
    opensAt: checkInOpensAt(event),
    showCode,
    state: !pass ? "preview" : pass.redeemed_at ? "redeemed" : checkIn === "ended" ? "expired" : "valid",
    date: when.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: ZONE }),
    day: when.toLocaleDateString("zh-CN", { month: "long", day: "numeric", timeZone: ZONE }),
    time: when.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: ZONE }),
    serial: pass ? `№ ${String(pass.serial).padStart(4, "0")}` : "№ ————",
    redeemedAt: pass?.redeemed_at
      ? new Date(pass.redeemed_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: ZONE })
      : null,
    video: mediaUrl(event.video),
    poster: event.video ? mediaUrl(posterKey(event.video)) : null,
    qr: {
      size: qr.size,
      path: qr.data.flatMap((row, y) => row.flatMap((on, x) => (on ? [`M${x} ${y}h1v1h-1z`] : []))).join(""),
    },
  } as const
}

const designs = import.meta.glob<{ default: (props: PassProps) => unknown }>("./passes/*.astro", { eager: true })

export const passDesigns = Object.fromEntries(
  Object.entries(designs).map(([path, module]) => [path.slice("./passes/".length, -".astro".length), module.default]),
)

export const passDesign = (name: string) => passDesigns[name] ?? passDesigns.default!
