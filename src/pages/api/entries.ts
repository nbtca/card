import type { APIRoute } from "astro"
import { db } from "../../lib/db"

export interface Entry {
  name: string
  serial: number
  redeemed_at: number
  received_at: number
}

// Only entries that arrived after the wall's latest, which the partial index on (event, received_at) finds directly.
export const GET: APIRoute = async ({ url }) => {
  const { results } = await db()
    .prepare("SELECT name, serial, redeemed_at, received_at FROM passes WHERE event = ? AND received_at > ? ORDER BY received_at LIMIT 50")
    .bind(url.searchParams.get("event"), Number(url.searchParams.get("after")) || 0)
    .all<Entry>()
  return Response.json(results, { headers: { "Cache-Control": "no-store" } })
}
