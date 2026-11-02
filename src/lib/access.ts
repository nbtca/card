import { env } from "cloudflare:workers"

interface Claims {
  aud?: string | string[]
  iss?: string
  exp?: number
  email?: string
}

interface Jwk extends JsonWebKey {
  kid: string
}

const KEYS_TTL = 60 * 60 * 1000
const KEYS_RETRY = 60 * 1000
const ALGORITHM = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }

let keys: { fetched: number; byId: Map<string, CryptoKey> } | undefined

const decode = (value: string) => Uint8Array.fromBase64(value, { alphabet: "base64url" })
const parse = <T>(value: string): T => JSON.parse(new TextDecoder().decode(decode(value)))

// Cloudflare Access rotates its signing keys, so an unknown key ID refetches them, at most once a minute.
async function signingKey(kid: string) {
  const age = keys ? Date.now() - keys.fetched : Infinity
  if (age > KEYS_TTL || (!keys?.byId.has(kid) && age > KEYS_RETRY)) {
    const response = await fetch(`${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`)
    if (!response.ok) return
    const { keys: jwks } = await response.json<{ keys: Jwk[] }>()
    keys = {
      fetched: Date.now(),
      byId: new Map(
        await Promise.all(
          jwks.map(async (jwk) => [jwk.kid, await crypto.subtle.importKey("jwk", jwk, ALGORITHM, false, ["verify"])] as const),
        ),
      ),
    }
  }
  return keys?.byId.get(kid)
}

function token(request: Request) {
  const header = request.headers.get("Cf-Access-Jwt-Assertion")
  if (header) return header
  for (const pair of (request.headers.get("Cookie") ?? "").split("; ")) {
    if (pair.startsWith("CF_Authorization=")) return pair.slice("CF_Authorization=".length)
  }
}

// Access only guards some paths, and public pages read the same cookie, so every token is verified here.
export async function accessEmail(request: Request) {
  const [header, payload, signature] = token(request)?.split(".") ?? []
  if (!env.ACCESS_AUD || !header || !payload || !signature) return null
  try {
    const { kid, alg } = parse<{ kid: string; alg: string }>(header)
    if (alg !== "RS256") return null
    const key = await signingKey(kid)
    if (!key) return null
    const valid = await crypto.subtle.verify(ALGORITHM, key, decode(signature), new TextEncoder().encode(`${header}.${payload}`))
    if (!valid) return null
    const claims = parse<Claims>(payload)
    const fresh = claims.exp && claims.exp > Date.now() / 1000
    const ours = claims.iss === env.ACCESS_TEAM_DOMAIN && [claims.aud].flat().includes(env.ACCESS_AUD)
    return fresh && ours ? (claims.email?.toLowerCase() ?? null) : null
  } catch {
    return null
  }
}
