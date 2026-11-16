import { env } from "cloudflare:workers"
import { defineMiddleware } from "astro:middleware"
import { accessToken, accessVisitor, type Visitor } from "./lib/access"
import { nativeVisitor, nativeRoute, NativeAuthUnavailable } from "./lib/native-auth"
import { sharedPage } from "./lib/cache"
import { cachedCard, db, memberByEmail, randomId, rememberCard, type Member } from "./lib/db"

const MEMBERS_ONLY = ["/members", "/me", "/dev", "/scan", "/e/new", "/api/me", "/api/redeem", "/api/entries", "/media/members/", "/meet"]

// Pages that look the same to every signed-out visitor.
const SHARED = /^\/(e(\/(?!new$)[a-z0-9][a-z0-9-]*)?|r\/\d{1,9})?$/

const under = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`))

const hasRole = (visitor: Visitor, list: string) => list.split(",").some((r) => visitor.roles.includes(r.trim()))

// A member's card follows their Logto name and username; everything else on it is theirs to set.
async function memberCard(visitor: Visitor) {
  const cached = cachedCard(visitor.email)
  const card = cached ?? (await memberByEmail(visitor.email))
  if (card && !cached) rememberCard(card)
  if (card?.name === visitor.name && card.alias === visitor.username) return card
  const fresh = await db()
    .prepare(
      `INSERT INTO members (id, email, name, alias, joined, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (email) DO UPDATE SET name = ?3, alias = ?4 RETURNING *`,
    )
    .bind(randomId(9), visitor.email, visitor.name, visitor.username, new Date().getFullYear(), Date.now())
    .first<Member>()
  if (fresh) rememberCard(fresh)
  return fresh
}

export const onRequest = defineMiddleware(async ({ request, url, locals, redirect, rewrite }, next) => {
  // Only an already-authorized internal rewrite can set this request-local marker.
  // rewrite() rematches the route and rebuilds dynamic params (key/slug/id).
  if (locals.nativeRewrite?.path === url.pathname && locals.nativeRewrite.method === request.method) {
    delete locals.nativeRewrite
    return next()
  }
  const native = url.pathname.startsWith("/native/")
  const target = new URL(url)
  if (native) {
    target.pathname = url.pathname.slice("/native".length)
    if (!nativeRoute(target.pathname, request.method)) return new Response(null, { status: 404 })
  }
  if (!native && request.method === "GET" && !url.search && SHARED.test(url.pathname) && !accessToken(request)) {
    locals.user = null
    return sharedPage(url, next)
  }
  let visitor: Visitor | null
  try { visitor = native ? await nativeVisitor(request) : await accessVisitor(request) }
  catch (error) {
    if (error instanceof NativeAuthUnavailable) return new Response(null, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "10" } })
    throw error
  }
  if (native && !visitor) return new Response(null, { status: 401, headers: { "Cache-Control": "no-store", "WWW-Authenticate": "Bearer" } })
  const isMember = visitor ? hasRole(visitor, env.MEMBER_ROLES) : false
  // A failing database must not stop public pages and the outage page from rendering.
  let failure: unknown = null
  const member = isMember ? await memberCard(visitor!).catch((e) => ((failure = e), null)) : null
  locals.user = visitor && {
    email: visitor.email,
    name: visitor.name,
    picture: visitor.picture,
    member,
    admin: isMember && hasRole(visitor, env.ADMIN_ROLES),
  }

  const path = target.pathname
  const finish = async () => {
    if (!native) return next()
    locals.nativeRewrite = { path: target.pathname, method: request.method }
    const response = await rewrite(new Request(target, request))
    const headers = new Headers(response.headers)
    headers.set("Cache-Control", path.startsWith("/media/") ? "private, max-age=3600" : "no-store")
    headers.set("Vary", "Authorization, X-Logto-Userinfo")
    headers.delete("Set-Cookie")
    const location = headers.get("Location")
    if (location) {
      const destination = new URL(location, target)
      if (destination.origin !== target.origin || !nativeRoute(destination.pathname, "GET")) return new Response(null, { status: 401 })
      headers.set("Location", "/native" + destination.pathname + destination.search)
    }
    return new Response(response.body, { status: response.status, headers })
  }
  if (!under(path, MEMBERS_ONLY)) return finish()
  // Without the card the visitor would wrongly be told they are not a member.
  if (failure) throw failure
  const api = native || path.startsWith("/api/") || path.startsWith("/media/")
  if (!locals.user) {
    return api ? new Response(null, { status: 401 }) : redirect(`/login?next=${encodeURIComponent(path + url.search)}`)
  }
  if (!locals.user.member) return api ? new Response(null, { status: 403 }) : redirect("/forbidden")
  return finish()
})
