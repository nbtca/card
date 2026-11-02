import { env } from "cloudflare:workers"
import { defineMiddleware } from "astro:middleware"
import { accessEmail } from "./lib/access"
import { memberByEmail } from "./lib/db"

const MEMBERS_ONLY = ["/members", "/me", "/scan", "/api/me", "/api/redeem", "/media/members/"]
const ADMINS_ONLY = ["/admin"]

const under = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`))

export const onRequest = defineMiddleware(async ({ request, url, locals, redirect }, next) => {
  const email = await accessEmail(request)
  const member = email ? await memberByEmail(email) : null
  const admins = env.ADMIN_EMAILS.toLowerCase().split(",").map((s) => s.trim())
  locals.user = email ? { email, name: member?.name ?? email.split("@")[0]!, member, admin: admins.includes(email) } : null

  const path = url.pathname
  const guarded = under(path, ADMINS_ONLY) ? "admin" : under(path, MEMBERS_ONLY) ? "member" : null
  if (!guarded) return next()

  const user = locals.user
  const api = path.startsWith("/api/") || path.startsWith("/media/")
  if (!user) {
    return api ? new Response(null, { status: 401 }) : redirect(`/login?next=${encodeURIComponent(path + url.search)}`)
  }
  if (guarded === "admin" ? !user.admin : !user.member) {
    return api ? new Response(null, { status: 403 }) : redirect("/forbidden")
  }
  return next()
})
