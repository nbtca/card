import type { APIRoute } from "astro"
import { logoutUrl } from "../lib/logto"
import { clearSession } from "../lib/session"

export const GET: APIRoute = ({ cookies, url, redirect }) => {
  clearSession(cookies)
  return redirect(logoutUrl(url.origin).toString())
}
