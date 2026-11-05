import type { APIRoute } from "astro"
import { getEvent } from "../../../lib/db"

const stamp = (iso: string) => iso.replace(/[-:]|\.\d+/g, "")
const text = (value: string) => value.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n")

// RFC 5545 folds lines at 75 octets, and a fold must not split a multi-byte character.
function fold(line: string) {
  const out: string[] = []
  let current = ""
  for (const char of line) {
    if (new TextEncoder().encode(current + char).length > (out.length ? 74 : 75)) {
      out.push(current)
      current = ""
    }
    current += char
  }
  return [...out, current].join("\r\n ")
}

export const GET: APIRoute = async ({ params, url }) => {
  const event = await getEvent(params.slug!)
  if (!event) return new Response(null, { status: 404 })
  const page = `${url.origin}/e/${event.slug}`
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NBTCA//Cards//ZH",
    "BEGIN:VEVENT",
    `UID:${event.slug}@${url.host}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.starts_at)}`,
    `DTEND:${stamp(event.ends_at)}`,
    `SUMMARY:${text(event.title)}`,
    `LOCATION:${text(event.venue)}`,
    `DESCRIPTION:${text([event.summary, `到场后打开活动券，撕开贴纸给工作人员扫码：${page}`].filter(Boolean).join("\n"))}`,
    `URL:${page}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT30M",
    `DESCRIPTION:${text(`${event.title} 半小时后开始`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Inline lets iOS open its add-to-calendar sheet instead of saving a file.
      "Content-Disposition": `inline; filename="${event.slug}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  })
}
