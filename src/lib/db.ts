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
  kept: number
  hosted: number
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
  needs_info: number
  repair: number
  claim_from: string
  claim_until: string
  starts_at: string
  ends_at: string
  album: string | null
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
  student_id: string | null
  class_name: string | null
  phone: string | null
  meet_code: string | null
}

export const db = () => env.DB

export const getMember = (id: string) => db().prepare("SELECT * FROM members WHERE id = ?").bind(id).first<Member>()

export const memberByEmail = (email: string) =>
  db().prepare("SELECT * FROM members WHERE email = ?").bind(email).first<Member>()

// Every request by a member needs their card, so each isolate keeps it briefly instead of asking D1 each time.
const CARD_TTL = 30_000
const cards = new Map<string, { at: number; card: Member }>()

export const cachedCard = (email: string) => {
  const hit = cards.get(email)
  return hit && Date.now() - hit.at < CARD_TTL ? hit.card : null
}
export const rememberCard = (card: Member) => void cards.set(card.email, { at: Date.now(), card })
export const forgetCard = (email: string) => void cards.delete(email)

// Hosting an event counts twice: once as an entry and once more here.
export const tierOf = (m: Pick<Member, "kept" | "hosted">) => {
  const score = m.kept + m.hosted
  return score >= 10 ? "aurora" : score >= 5 ? "gold" : null
}

export const listMembers = async () =>
  (await db().prepare("SELECT * FROM members ORDER BY joined, created_at").all<Member>()).results

export const countMembers = async () =>
  (await db().prepare("SELECT COUNT(*) AS n FROM members").first<{ n: number }>())!.n

export const getEvent = (slug: string) => db().prepare("SELECT * FROM events WHERE slug = ?").bind(slug).first<Event>()

export const recentEvents = async () =>
  (
    await db()
      .prepare("SELECT * FROM events WHERE ends_at >= ? ORDER BY starts_at")
      .bind(new Date(Date.now() - 864e5).toISOString())
      .all<Event>()
  ).results

export const upcomingEvents = async (limit = 50) =>
  (
    await db()
      .prepare("SELECT * FROM events WHERE ends_at >= ? ORDER BY starts_at LIMIT ?")
      .bind(new Date().toISOString(), limit)
      .all<Event>()
  ).results

export const pastEvents = async (limit = 50) =>
  (
    await db()
      .prepare("SELECT * FROM events WHERE ends_at < ? ORDER BY starts_at DESC LIMIT ?")
      .bind(new Date().toISOString(), limit)
      .all<Event>()
  ).results

export interface Host extends Member {
  credited_at: number | null
}

export const hostsOf = async (slug: string) =>
  (
    await db()
      .prepare("SELECT m.*, h.credited_at FROM hosts h JOIN members m ON m.email = h.email WHERE h.event = ? ORDER BY h.created_at")
      .bind(slug)
      .all<Host>()
  ).results

export interface Stub extends Event {
  pass_id: string
  serial: number
  holder: string
  redeemed_at: number | null
  host?: number
}

// A host pass is not a row in passes, so it takes no seat and never reaches the door. It counts once a guest checks in.
export const hostedBy = async (memberId: string) =>
  (
    await db()
      .prepare(
        `SELECT e.*, 'host-' || e.slug AS pass_id, 0 AS serial, m.name AS holder, h.credited_at AS redeemed_at, 1 AS host
         FROM members m JOIN hosts h ON h.email = m.email JOIN events e ON e.slug = h.event
         WHERE m.id = ? ORDER BY e.starts_at DESC LIMIT 100`,
      )
      .bind(memberId)
      .all<Stub>()
  ).results

const STUBS = "SELECT e.*, p.id AS pass_id, p.serial, p.name AS holder, p.redeemed_at FROM passes p JOIN events e ON e.slug = p.event"

export const passesOf = async (email: string) =>
  (await db().prepare(`${STUBS} WHERE p.email = ? ORDER BY p.created_at DESC LIMIT 100`).bind(email).all<Stub>()).results

export const keptBy = async (memberId: string) =>
  (
    await db()
      .prepare(`${STUBS} WHERE p.email = (SELECT email FROM members WHERE id = ?) AND p.redeemed_at IS NOT NULL ORDER BY p.created_at DESC LIMIT 100`)
      .bind(memberId)
      .all<Stub>()
  ).results

// Host passes are merged in by event date; a member who hosted is shown the host pass instead of a guest one.
export const withHosted = (stubs: Stub[], hosted: Stub[]) => {
  const slugs = new Set(hosted.map((h) => h.slug))
  return [...hosted, ...stubs.filter((s) => !slugs.has(s.slug))].sort((a, b) => b.starts_at.localeCompare(a.starts_at))
}

export const stubPass = (s: Stub) => ({ id: s.pass_id, serial: s.serial, redeemed_at: s.redeemed_at })

const CHECK_IN_LEAD = 60 * 60 * 1000

export const claimPhase = (e: Event, now = Date.now()) =>
  now < Date.parse(e.claim_from) ? "upcoming" : now > Date.parse(e.claim_until) ? "closed" : "open"

export const checkInOpensAt = (e: Pick<Event, "starts_at">) => new Date(Date.parse(e.starts_at) - CHECK_IN_LEAD).toISOString()

export const checkInPhase = (e: Pick<Event, "starts_at" | "ends_at">, now = Date.now()) =>
  now < Date.parse(e.starts_at) - CHECK_IN_LEAD ? "early" : now > Date.parse(e.ends_at) ? "ended" : "open"

export const thumbKey = (key: string) => key.replace(/(\.\w+)$/, ".thumb$1")

export const posterKey = (key: string) => key.replace(/\.\w+$/, ".poster.webp")

export const mediaUrl = (key: string | null, size: "full" | "thumb" = "full") =>
  key ? `/media/${size === "thumb" ? thumbKey(key) : key}` : null

export const randomId = (bytes = 16) =>
  crypto.getRandomValues(new Uint8Array(bytes)).toBase64({ alphabet: "base64url", omitPadding: true })
