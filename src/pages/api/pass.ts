import type { APIRoute } from "astro"
import { db } from "../../lib/db"

export const GET: APIRoute = async ({ url, locals }) => {
  if (!locals.user) return new Response(null, { status: 401 })
  const pass = await db()
    .prepare("SELECT redeemed_at FROM passes WHERE id = ? AND email = ?")
    .bind(url.searchParams.get("id"), locals.user.email)
    .first<{ redeemed_at: number | null }>()
  if (!pass) return new Response(null, { status: 404 })
  return Response.json({ redeemedAt: pass.redeemed_at }, { headers: { "Cache-Control": "no-store" } })
}
