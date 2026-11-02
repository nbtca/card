import { env } from "cloudflare:workers"
import { defineMiddleware } from "astro:middleware"
import { accessVisitor, type Visitor } from "./lib/access"
import { db, memberByEmail, randomId } from "./lib/db"

const MEMBERS_ONLY = ["/members", "/me", "/scan", "/e/new", "/api/me", "/api/redeem", "/media/members/"]

const under = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`))

const hasRole = (visitor: Visitor, list: string) => list.split(",").some((r) => visitor.roles.includes(r.trim()))

// A member's card follows their Logto name and username; everything else on it is theirs to set.
async function memberCard(visitor: Visitor) {
  const card = await memberByEmail(visitor.email)
  if (card?.name === visitor.name && card.alias === visitor.username) return card
  await db()
    .prepare(
      `INSERT INTO members (id, email, name, alias, joined, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (email) DO UPDATE SET name = ?3, alias = ?4`,
    )
    .bind(randomId(9), visitor.email, visitor.name, visitor.username, new Date().getFullYear(), Date.now())
    .run()
  return memberByEmail(visitor.email)
}

export const onRequest = defineMiddleware(async ({ request, url, locals, redirect }, next) => {
  const visitor = await accessVisitor(request)
  const isMember = visitor ? hasRole(visitor, env.MEMBER_ROLES) : false
  locals.user = visitor && {
    email: visitor.email,
    name: visitor.name,
    member: isMember ? await memberCard(visitor) : null,
    admin: isMember && hasRole(visitor, env.ADMIN_ROLES),
  }

  const path = url.pathname
  if (!under(path, MEMBERS_ONLY)) return next()
  const api = path.startsWith("/api/") || path.startsWith("/media/")
  if (!locals.user) {
    return api ? new Response(null, { status: 401 }) : redirect(`/login?next=${encodeURIComponent(path + url.search)}`)
  }
  if (!locals.user.member) return api ? new Response(null, { status: 403 }) : redirect("/forbidden")
  return next()
})
