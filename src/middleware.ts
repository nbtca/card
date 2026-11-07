import { env } from "cloudflare:workers"
import { defineMiddleware } from "astro:middleware"
import { accessToken, accessVisitor, type Visitor } from "./lib/access"
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

export const onRequest = defineMiddleware(async ({ request, url, locals, redirect }, next) => {
  if (request.method === "GET" && !url.search && SHARED.test(url.pathname) && !accessToken(request)) {
    locals.user = null
    return sharedPage(url, next)
  }
  const visitor = await accessVisitor(request)
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

  const path = url.pathname
  if (!under(path, MEMBERS_ONLY)) return next()
  // Without the card the visitor would wrongly be told they are not a member.
  if (failure) throw failure
  const api = path.startsWith("/api/") || path.startsWith("/media/")
  if (!locals.user) {
    return api ? new Response(null, { status: 401 }) : redirect(`/login?next=${encodeURIComponent(path + url.search)}`)
  }
  if (!locals.user.member) return api ? new Response(null, { status: 403 }) : redirect("/forbidden")
  return next()
})
