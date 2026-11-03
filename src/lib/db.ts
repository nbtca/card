import { env } from "cloudflare:workers"

export interface Member {
  id: string
  email: string
  name: string
  alias: string
  section: string
  role: string
  joined: number
  github: string | null
  word: string | null
  motto: string | null
  hue: number
  portrait: string | null
  background: string | null
}

export interface Event {
  slug: string
  created_by: string
  title: string
  word: string
  design: string
  venue: string
  summary: string
  video: string | null
  capacity: number | null
  claim_from: string
  claim_until: string
  starts_at: string
  ends_at: string
}

export interface Pass {
  id: string
  event: string
  email: string
  name: string
  serial: number
  created_at: number
  redeemed_at: number | null
  redeemed_by: string | null
}

export const db = () => env.DB

export const getMember = (id: string) => db().prepare("SELECT * FROM members WHERE id = ?").bind(id).first<Member>()

export const memberByEmail = (email: string) =>
  db().prepare("SELECT * FROM members WHERE email = ?").bind(email).first<Member>()

export const listMembers = async () =>
  (await db().prepare("SELECT * FROM members ORDER BY joined, created_at").all<Member>()).results

export const countMembers = async () =>
  (await db().prepare("SELECT COUNT(*) AS n FROM members").first<{ n: number }>())!.n

export const getEvent = (slug: string) => db().prepare("SELECT * FROM events WHERE slug = ?").bind(slug).first<Event>()

export const listEvents = async () =>
  (await db().prepare("SELECT * FROM events ORDER BY starts_at DESC").all<Event>()).results

export const upcomingEvents = async (limit = 50) =>
  (
    await db()
      .prepare("SELECT * FROM events WHERE ends_at >= ? ORDER BY starts_at LIMIT ?")
      .bind(new Date().toISOString(), limit)
      .all<Event>()
  ).results

const CHECK_IN_LEAD = 60 * 60 * 1000

export const claimPhase = (e: Event, now = Date.now()) =>
  now < Date.parse(e.claim_from) ? "upcoming" : now > Date.parse(e.claim_until) ? "closed" : "open"

export const checkInPhase = (e: Pick<Event, "starts_at" | "ends_at">, now = Date.now()) =>
  now < Date.parse(e.starts_at) - CHECK_IN_LEAD ? "early" : now > Date.parse(e.ends_at) ? "ended" : "open"

export const ZONE = "Asia/Shanghai"

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: ZONE })

export const formatShort = (iso: string) =>
  new Date(iso).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: ZONE })

export const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: ZONE })

export const sameDay = (a: string, b: string) =>
  new Date(a).toLocaleDateString("zh-CN", { timeZone: ZONE }) === new Date(b).toLocaleDateString("zh-CN", { timeZone: ZONE })

export const formatRange = (from: string, until: string) =>
  sameDay(from, until) ? `${formatTime(from)}–${formatClock(until)}` : `${formatTime(from)} 至 ${formatTime(until)}`

export const thumbKey = (key: string) => key.replace(/(\.\w+)$/, ".thumb$1")

export const mediaUrl = (key: string | null, size: "full" | "thumb" = "full") =>
  key ? `/media/${size === "thumb" ? thumbKey(key) : key}` : null

export const randomId = (bytes = 16) =>
  crypto.getRandomValues(new Uint8Array(bytes)).toBase64({ alphabet: "base64url", omitPadding: true })
