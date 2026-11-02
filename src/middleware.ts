import { defineMiddleware } from "astro:middleware"
import { readSession } from "./lib/session"

const MEMBERS_ONLY = ["/members", "/me", "/scan", "/api/me", "/api/redeem", "/media/members/"]
const ADMINS_ONLY = ["/admin"]

const under = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`))

export const onRequest = defineMiddleware(async ({ cookies, url, locals, redirect }, next) => {
  const user = await readSession(cookies)
  locals.user = user
  const path = url.pathname
  const guarded = under(path, ADMINS_ONLY) ? "admin" : under(path, MEMBERS_ONLY) ? "member" : null
  if (!guarded) return next()

  const api = path.startsWith("/api/") || path.startsWith("/media/")
  if (!user) {
    return api ? new Response(null, { status: 401 }) : redirect(`/login?next=${encodeURIComponent(path + url.search)}`)
  }
  const allowed = guarded === "admin" ? user.admin : user.member !== null
  if (!allowed) {
    return api ? new Response(null, { status: 403 }) : redirect("/forbidden")
  }
  return next()
})
