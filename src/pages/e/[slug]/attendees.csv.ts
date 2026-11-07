import type { APIRoute } from "astro"
import { toCsv } from "../../../lib/attendee"
import { db, getEvent, type Pass } from "../../../lib/db"
import { formatTime } from "../../../lib/time"
import { canEdit } from "../../../lib/events"

const stamp = (ms: number | null) => (ms ? formatTime(new Date(ms).toISOString()) : "")

export const GET: APIRoute = async ({ params, url, locals }) => {
  const event = await getEvent(params.slug!)
  if (!event) return new Response(null, { status: 404 })
  if (!canEdit(event, locals.user)) return new Response(null, { status: locals.user ? 403 : 401 })

  const entered = url.searchParams.get("only") === "entered"
  const { results } = await db()
    .prepare(`SELECT * FROM passes WHERE event = ? ${entered ? "AND redeemed_at IS NOT NULL" : ""} ORDER BY serial`)
    .bind(event.slug)
    .all<Pass>()

  const info = event.needs_info === 1
  const header = ["编号", "姓名", ...(info ? ["学号", "班级", "手机号"] : []), "领取时间", "入场时间", "是否入场"]
  const rows = results.map((p) => ({
    text: [
      String(p.serial).padStart(4, "0"),
      p.name,
      ...(info ? [p.student_id ?? "", p.class_name ?? "", p.phone ?? ""] : []),
      stamp(p.created_at),
      stamp(p.redeemed_at),
      p.redeemed_at ? "是" : "否",
    ],
    numbers: info ? [0, 2, 4] : [0],
  }))

  const filename = `${event.title}-${entered ? "入场名单" : "领取名单"}.csv`
  return new Response(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendees.csv"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  })
}
