import type { APIRoute } from "astro"
import { authorizeUrl } from "../lib/logto"

export const GET: APIRoute = async ({ cookies, url, redirect }) => {
  const next = url.searchParams.get("next") ?? "/"
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/"
  return redirect((await authorizeUrl(cookies, url.origin, safe)).toString())
}
