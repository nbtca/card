import { checkInPhase, db, getEvent, randomId, type Member } from "./db"

const pair = (x: string, y: string) => (x < y ? [x, y] : [y, x])

export const meetCode = async (passId: string) =>
  (await db().prepare("UPDATE passes SET meet_code = COALESCE(meet_code, ?) WHERE id = ? RETURNING meet_code").bind(randomId(12), passId).first<{ meet_code: string }>())!
    .meet_code

export const metAt = async (event: string, memberId: string) =>
  (
    await db()
      .prepare(
        `SELECT m.* FROM meets x JOIN members m ON m.id = CASE WHEN x.a = ?1 THEN x.b ELSE x.a END
         WHERE x.event = ?2 AND (x.a = ?1 OR x.b = ?1) ORDER BY x.created_at`,
      )
      .bind(memberId, event)
      .all<Member>()
  ).results

export const metWhere = async (me: string, other: string) =>
  (
    await db()
      .prepare("SELECT e.slug, e.title FROM meets x JOIN events e ON e.slug = x.event WHERE x.a = ? AND x.b = ? ORDER BY x.created_at")
      .bind(...pair(me, other))
      .all<{ slug: string; title: string }>()
  ).results

type MeetOutcome =
  | { status: "ok" | "self"; event: string; other: Member }
  | { status: "unknown" | "absent" | "closed"; event?: string }

// Both have to be checked in to the same event while it is on, so a code passed around later records nothing.
export async function meet(code: string, me: Member): Promise<MeetOutcome> {
  const shown = await db()
    .prepare("SELECT p.event, m.* FROM passes p JOIN members m ON m.email = p.email WHERE p.meet_code = ? AND p.redeemed_at IS NOT NULL")
    .bind(code)
    .first<Member & { event: string }>()
  if (!shown) return { status: "unknown" }
  const { event: slug, ...other } = shown
  if (other.id === me.id) return { status: "self", event: slug, other }
  const [event, mine] = await Promise.all([
    getEvent(slug),
    db().prepare("SELECT redeemed_at FROM passes WHERE event = ? AND email = ?").bind(slug, me.email).first<{ redeemed_at: number | null }>(),
  ])
  if (!event || checkInPhase(event) !== "open") return { status: "closed", event: slug }
  if (!mine?.redeemed_at) return { status: "absent", event: slug }
  await db()
    .prepare("INSERT INTO meets (event, a, b, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING")
    .bind(slug, ...pair(me.id, other.id), Date.now())
    .run()
  return { status: "ok", event: slug, other }
}
