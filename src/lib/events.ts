import { env } from "cloudflare:workers"
import { passDesigns } from "../cards/pass"
import { db, getEvent, posterKey, randomId, type Event } from "./db"

export const MAX_VIDEO_MB = 10
export const MAX_VIDEO_SECONDS = 15
const MAX_VIDEO = MAX_VIDEO_MB * 1024 * 1024
const MAX_POSTER = 300 * 1024
const SHANGHAI = 8 * 3600e3
const TIMES = ["claim_from", "claim_until", "starts_at", "ends_at"] as const

export const toLocal = (iso: string) => new Date(Date.parse(iso) + SHANGHAI).toISOString().slice(0, 16)

export const canEdit = (event: Event, user: App.Locals["user"]) =>
  !!user?.member && (user.admin || event.created_by === user.email)

// Returns the event's slug once saved, or a message saying what to fix.
export async function saveEvent(form: FormData, editing: Event | null, createdBy: string) {
  const text = (name: string) => String(form.get(name) ?? "").trim()
  const slug = editing?.slug ?? text("slug").toLowerCase()
  const [claimFrom, claimUntil, startsAt, endsAt] = TIMES.map((name) => new Date(`${text(name)}:00+08:00`)) as [Date, Date, Date, Date]
  const capacity = text("capacity") ? Number(text("capacity")) : null
  const video = form.get("video")
  const design = Object.hasOwn(passDesigns, text("design")) ? text("design") : "default"

  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(slug)) return { error: "链接名只能用小写字母、数字和连字符，至少两个字符。" }
  if (!editing && (await getEvent(slug))) return { error: "这个链接名已经被用过了，换一个吧。" }
  if (!text("title") || !text("word") || !text("venue")) return { error: "活动名称、卡面大字和地点都要填。" }
  if ([claimFrom, claimUntil, startsAt, endsAt].some((d) => Number.isNaN(d.getTime()))) return { error: "四个时间都要填。" }
  if (claimFrom >= claimUntil) return { error: "停止领券的时间要晚于开始领券。" }
  if (startsAt >= endsAt) return { error: "活动结束时间要晚于开始时间。" }
  if (claimUntil > endsAt) return { error: "领券要在活动结束前截止。" }
  if (capacity !== null && !(Number.isInteger(capacity) && capacity > 0)) return { error: "名额要是正整数，不限名额就留空。" }
  if (video instanceof File && video.size > MAX_VIDEO) return { error: `视频不能超过 ${MAX_VIDEO_MB}MB，剪一段 ${MAX_VIDEO_SECONDS} 秒以内的片段吧。` }
  const poster = form.get("poster")

  let key = editing?.video ?? null
  if (video instanceof File && video.size > 0) {
    key = `events/${slug}/${randomId(8)}.${video.type === "video/webm" ? "webm" : "mp4"}`
    await env.MEDIA.put(key, video.stream(), { httpMetadata: { contentType: video.type || "video/mp4" } })
    if (poster instanceof File && poster.size > 0 && poster.size < MAX_POSTER && poster.type === "image/webp") {
      await env.MEDIA.put(posterKey(key), poster.stream(), { httpMetadata: { contentType: "image/webp" } })
    }
    if (editing?.video) await env.MEDIA.delete([editing.video, posterKey(editing.video)])
  }

  await db()
    .prepare(
      `INSERT INTO events (slug, title, word, design, venue, summary, video, capacity, claim_from, claim_until, starts_at, ends_at, created_by, created_at, needs_info)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
       ON CONFLICT (slug) DO UPDATE SET
         title = ?2, word = ?3, design = ?4, venue = ?5, summary = ?6, video = ?7, capacity = ?8,
         claim_from = ?9, claim_until = ?10, starts_at = ?11, ends_at = ?12, needs_info = ?15`,
    )
    .bind(
      slug, text("title"), text("word").slice(0, 16), design, text("venue"), text("summary"), key, capacity,
      claimFrom.toISOString(), claimUntil.toISOString(), startsAt.toISOString(), endsAt.toISOString(), createdBy, Date.now(),
      form.has("needs_info") ? 1 : 0,
    )
    .run()
  return { slug }
}
