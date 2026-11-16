import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose"
import type { Visitor } from "./access"

export const NATIVE_ISSUER = "https://auth.app.nbtca.space/oidc"
export const NATIVE_AUDIENCE = "https://card.nbtca.space/native"
export const NATIVE_CLIENT_ID = "a3tt7oyxeounfiqqugiah"
const keys = createRemoteJWKSet(new URL(`${NATIVE_ISSUER}/jwks`))
export class NativeAuthUnavailable extends Error {}
const profileCache = new Map<string, { until: number; promise: Promise<Record<string, unknown>> }>()

async function userInfo(identityToken: string, fetcher: typeof fetch): Promise<Record<string, unknown>> {
  const read = async () => {
    let response: Response
    try {
      response = await fetcher(`${NATIVE_ISSUER}/me`, {
        headers: { Authorization: `Bearer ${identityToken}`, Accept: "application/json" },
        redirect: "manual", signal: AbortSignal.timeout(10000),
      })
    } catch { throw new NativeAuthUnavailable("Identity service unavailable") }
    if (response.status >= 500 || response.status === 429 || (response.status >= 300 && response.status < 400)) throw new NativeAuthUnavailable("Identity service unavailable")
    if (!response.ok) throw new Error("Invalid identity token")
    try { return await response.json() as Record<string, unknown> } catch { throw new NativeAuthUnavailable("Invalid identity response") }
  }
  if (fetcher !== fetch) return read()
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identityToken))
  const cacheKey = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2,"0")).join("")
  const cached = profileCache.get(cacheKey)
  if (cached && cached.until > Date.now()) return cached.promise
  if (profileCache.size >= 500) profileCache.clear()
  const promise = read().catch(error => { profileCache.delete(cacheKey); throw error })
  profileCache.set(cacheKey, { until: Date.now() + 30000, promise })
  return promise
}

// Resource tokens establish the intended API/client. UserInfo supplies current profile and roles;
// its subject must match the verified resource token, never a client-provided email/role.
export async function verifyNativeIdentity(token: string, identityToken: string,
  key: JWTVerifyGetKey = keys, fetcher: typeof fetch = fetch): Promise<Visitor> {
  const { payload } = await jwtVerify(token, key, {
    issuer: NATIVE_ISSUER, audience: NATIVE_AUDIENCE,
    algorithms: ["RS256", "ES256", "ES384"], requiredClaims: ["sub", "exp", "iat"], clockTolerance: 5,
  })
  if (payload.client_id !== NATIVE_CLIENT_ID || !payload.sub) throw new Error("Invalid client")
  const profile = await userInfo(identityToken, fetcher)
  if (profile.sub !== payload.sub || typeof profile.email !== "string" || !profile.email || profile.email_verified !== true) {
    throw new Error("Unverified identity")
  }
  const roles = Array.isArray(profile.roles) ? profile.roles.filter((role): role is string => typeof role === "string") : []
  const name = typeof profile.name === "string" ? profile.name : typeof profile.username === "string" ? profile.username : profile.email.split("@")[0]!
  return { email: profile.email.toLowerCase(), name,
    username: typeof profile.username === "string" ? profile.username : name,
    picture: typeof profile.picture === "string" && profile.picture.startsWith("https://") ? profile.picture : null, roles }
}

export async function nativeVisitor(request: Request): Promise<Visitor | null> {
  const bearer = request.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1]
  const identity = request.headers.get("X-Logto-Userinfo")
  if (!bearer || !identity) return null
  try { return await verifyNativeIdentity(bearer, identity) } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : ""
    if (error instanceof NativeAuthUnavailable || code === "ERR_JWKS_TIMEOUT" || code === "ERR_JOSE_GENERIC" || error instanceof TypeError) {
      throw new NativeAuthUnavailable("Identity service unavailable")
    }
    return null
  }
}

export function nativeRoute(path: string, method: string): boolean {
  if (path.includes("%") || path.includes("\\") || path.includes("..")) return false
  if (method === "GET") return /^\/(e(\/[a-z0-9][a-z0-9-]*)?|me|members(\/[\w-]+)?|media\/members\/[\w/-]+(?:\.thumb)?\.(png|webp)|api\/pass)$/.test(path)
  if (method === "POST") return path === "/me" || /^\/e\/[a-z0-9][a-z0-9-]*$/.test(path) || path === "/api/redeem"
  return (method === "PUT" || method === "DELETE") && path === "/api/me/media"
}
