import { encode } from "uqr"
import { checkInPhase, mediaUrl, ZONE, type Event, type Pass } from "../lib/db"

export interface PassProps {
  event: Event
  pass: Pass | null
  holder: string
  guest: boolean
}

export function ticket({ event, pass }: PassProps, origin: string) {
  const when = new Date(event.starts_at)
  // Staff can scan this with any camera app: the URL opens the check-in page.
  const qr = encode(pass ? `${origin}/scan#${pass.id}` : `${origin}/e/${event.slug}`, { ecc: "M", border: 0 })
  return {
    state: !pass ? "preview" : pass.redeemed_at ? "redeemed" : checkInPhase(event) === "ended" ? "expired" : "valid",
    date: when.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: ZONE }),
    day: when.toLocaleDateString("zh-CN", { month: "long", day: "numeric", timeZone: ZONE }),
    time: when.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: ZONE }),
    serial: pass ? `№ ${String(pass.serial).padStart(4, "0")}` : "№ ————",
    redeemedAt: pass?.redeemed_at
      ? new Date(pass.redeemed_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: ZONE })
      : null,
    video: mediaUrl(event.video),
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
