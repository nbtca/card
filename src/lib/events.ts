import { env } from "cloudflare:workers"
import { passDesigns } from "../cards/pass"
import { SHANGHAI, parseWall, scheduleError, toWall } from "./schedule"
import { db, getEvent, posterKey, randomId, type Event } from "./db"

export const MAX_VIDEO_MB = 10
export const MAX_VIDEO_SECONDS = 15
const MAX_VIDEO = MAX_VIDEO_MB * 1024 * 1024
const MAX_POSTER = 300 * 1024
const TIMES = ["claim_from", "claim_until", "starts_at", "ends_at"] as const

export const toLocal = (iso: string) => toWall(Date.parse(iso) + SHANGHAI)

export const canEdit = (event: Event, user: App.Locals["user"], hosts: { email: string }[]) =>
  !!user?.member && (user.admin || event.created_by === user.email || hosts.some((h) => h.email === user.email))

// A rejected form is shown again with what was typed, so nothing has to be entered twice.
export const draftFrom = (form: FormData, base: Event): Event => {
  const text = (name: string) => String(form.get(name) ?? "").trim()
  const iso = (name: string) => {
    const at = parseWall(text(name)) - SHANGHAI
    return Number.isNaN(at) ? base[name as (typeof TIMES)[number]] : new Date(at).toISOString()
  }
  return {
    ...base,
    title: text("title"),
    word: text("word"),
    venue: text("venue"),
    venue_note: text("venue_note"),
    summary: text("summary"),
    album: text("album") || null,
    capacity: text("capacity") ? Number(text("capacity")) || null : null,
    needs_info: form.has("needs_info") ? 1 : 0,
    repair: form.has("repair") ? 1 : 0,
    design: Object.hasOwn(passDesigns, text("design")) ? text("design") : base.design,
    claim_from: iso("claim_from"),
    claim_until: iso("claim_until"),
    starts_at: iso("starts_at"),
    ends_at: iso("ends_at"),
  }
}

export async function saveEvent(form: FormData, editing: Event | null, createdBy: string) {
  const text = (name: string) => String(form.get(name) ?? "").trim()
  const slug = editing?.slug ?? text("slug").toLowerCase()
  const [claimFrom, claimUntil, startsAt, endsAt] = TIMES.map((name) => new Date(parseWall(text(name)) - SHANGHAI)) as [Date, Date, Date, Date]
  const capacity = text("capacity") ? Number(text("capacity")) : null
  const video = form.get("video")
  const design = Object.hasOwn(passDesigns, text("design")) ? text("design") : "default"

  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) return { error: "链接名只能用小写字母、数字和连字符，至少两个字符。", field: "slug" }
  if (!editing && (await getEvent(slug))) return { error: "这个链接名已经被用过了，换一个吧。", field: "slug" }
  if (!text("title")) return { error: "填写活动名称。", field: "title" }
  if (!text("word")) return { error: "填写卡面大字。", field: "word" }
  if (!text("venue")) return { error: "填写活动地点。", field: "venue" }
  const timeError = scheduleError(claimFrom.getTime(), claimUntil.getTime(), startsAt.getTime(), endsAt.getTime())
  if (timeError) return { error: timeError, field: "schedule" }
  if (capacity !== null && !(Number.isInteger(capacity) && capacity > 0)) return { error: "名额要是正整数。", field: "capacity" }
  if (video instanceof File && video.size > MAX_VIDEO) return { error: `视频不能超过 ${MAX_VIDEO_MB}MB，剪一段 ${MAX_VIDEO_SECONDS} 秒以内的片段吧。`, field: "video" }
  const poster = form.get("poster")
  const album = text("album") || null
  if (album && !/^https:\/\/photo\.nbtca\.space\/\S*$/.test(album)) return { error: "相册链接要是 photo.nbtca.space 上的地址。", field: "album" }

  // Old media goes only after the row points at the new keys, so a failed write never leaves a broken link.
  const replaced: (string | null)[] = []
  let key = editing?.video ?? null
  if (video instanceof File && video.size > 0) {
    key = `events/${slug}/${randomId(8)}.${video.type === "video/webm" ? "webm" : "mp4"}`
    await env.MEDIA.put(key, video.stream(), { httpMetadata: { contentType: video.type || "video/mp4" } })
    if (poster instanceof File && poster.size > 0 && poster.size < MAX_POSTER && poster.type === "image/webp") {
      await env.MEDIA.put(posterKey(key), poster.stream(), { httpMetadata: { contentType: "image/webp" } })
    }
    if (editing?.video) replaced.push(editing.video, posterKey(editing.video))
  }

  let share = editing?.share ?? null
  const preview = form.get("share")
  if (preview instanceof File && preview.size > 0 && preview.size < MAX_POSTER && preview.type === "image/webp") {
    const next = `events/${slug}/${randomId(8)}.share.webp`
    await env.MEDIA.put(next, preview.stream(), { httpMetadata: { contentType: "image/webp" } })
    replaced.push(share)
    share = next
  }

  const cohosts = JSON.stringify(form.getAll("hosts").map(String))
  const hosts = "SELECT email FROM members WHERE email = ?3 OR id IN (SELECT value FROM json_each(?2))"
  const event = db()
    .prepare(
      `INSERT INTO events (slug, title, word, design, venue, summary, video, capacity, claim_from, claim_until, starts_at, ends_at, created_by, created_at, needs_info, album, repair, venue_note, share)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
       ON CONFLICT (slug) DO UPDATE SET
         title = ?2, word = ?3, design = ?4, venue = ?5, summary = ?6, video = ?7, capacity = ?8,
         claim_from = ?9, claim_until = ?10, starts_at = ?11, ends_at = ?12, needs_info = ?15, album = ?16, repair = ?17, venue_note = ?18, share = ?19`,
    )
    .bind(
      slug, text("title"), text("word").slice(0, 16), design, text("venue"), text("summary"), key, capacity,
      claimFrom.toISOString(), claimUntil.toISOString(), startsAt.toISOString(), endsAt.toISOString(), createdBy, Date.now(),
      form.has("needs_info") ? 1 : 0,
      album,
      form.has("repair") ? 1 : 0,
      text("venue_note").slice(0, 60),
      share,
    )
  // Hosts added after the first guest checked in are credited from that moment, like the rest.
  await db().batch([
    event,
    db().prepare(`DELETE FROM hosts WHERE event = ?1 AND email NOT IN (${hosts})`).bind(slug, cohosts, createdBy),
    db()
      .prepare(
        `INSERT INTO hosts (event, email, created_at, credited_at)
         SELECT ?1, email, ?4, (SELECT MIN(redeemed_at) FROM passes WHERE event = ?1 AND email NOT IN (${hosts})) FROM (${hosts})
         WHERE true ON CONFLICT DO NOTHING`, // SQLite parses ON after a bare FROM as a join, hence WHERE true.
      )
      .bind(slug, cohosts, createdBy, Date.now()),
  ])
  const stale = replaced.filter((k) => k !== null)
  if (stale.length) await env.MEDIA.delete(stale)
  return { slug }
}
