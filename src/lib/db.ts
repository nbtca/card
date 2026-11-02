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
  title: string
  word: string
  design: string
  starts_at: string
  venue: string
  summary: string
  video: string | null
  capacity: number | null
  open: number
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

export const ZONE = "Asia/Shanghai"

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: ZONE })

export const mediaUrl = (key: string | null) => (key ? `/media/${key}` : null)

export const randomId = (bytes = 16) =>
  crypto.getRandomValues(new Uint8Array(bytes)).toBase64({ alphabet: "base64url", omitPadding: true })
