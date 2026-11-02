import type { APIRoute } from "astro"
import { checkInPhase, db } from "../../lib/db"

interface Found {
  id: string
  name: string
  serial: number
  title: string
  starts_at: string
  ends_at: string
  redeemed_at: number | null
}

export const POST: APIRoute = async ({ request, locals }) => {
  const body = (await request.json().catch(() => ({}))) as { id?: string; event?: string; serial?: number }
  const select = "SELECT p.id, p.name, p.serial, p.redeemed_at, e.title, e.starts_at, e.ends_at FROM passes p JOIN events e ON e.slug = p.event"
  const pass = body.id
    ? await db().prepare(`${select} WHERE p.id = ?`).bind(body.id).first<Found>()
    : body.event && body.serial
      ? await db().prepare(`${select} WHERE p.event = ? AND p.serial = ?`).bind(body.event, body.serial).first<Found>()
      : null
  if (!pass) return Response.json({ status: "unknown" }, { status: 404 })
  const window = checkInPhase(pass)
  if (window !== "open" && !pass.redeemed_at) {
    return Response.json({ status: window, name: pass.name, serial: pass.serial, title: pass.title, startsAt: pass.starts_at })
  }

  const now = Date.now()
  const { meta } = await db()
    .prepare("UPDATE passes SET redeemed_at = ?, redeemed_by = ? WHERE id = ? AND redeemed_at IS NULL")
    .bind(now, locals.user!.email, pass.id)
    .run()
  const fresh = meta.changes > 0
  return Response.json({
    status: fresh ? "ok" : "already",
    name: pass.name,
    serial: pass.serial,
    title: pass.title,
    redeemedAt: fresh ? now : pass.redeemed_at,
  })
}
