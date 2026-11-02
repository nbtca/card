import type { AstroCookies } from "astro"
import { env } from "cloudflare:workers"
import { base64url, randomId, sign, unsign } from "./session"

const FLOW = "card_login"
const SCOPES = "openid profile email roles"

interface UserInfo {
  sub: string
  name?: string | null
  username?: string | null
  email?: string | null
  roles?: string[]
}

const redirectUri = (origin: string) => `${origin}/callback`

const challenge = async (verifier: string) =>
  base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))))

export async function authorizeUrl(cookies: AstroCookies, origin: string, next: string) {
  const state = randomId()
  const verifier = randomId(32)
  cookies.set(FLOW, await sign(JSON.stringify({ state, verifier, next })), {
    path: "/callback",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
  })
  const url = new URL("/oidc/auth", env.LOGTO_ENDPOINT)
  url.search = new URLSearchParams({
    client_id: env.LOGTO_APP_ID,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES,
    state,
    code_challenge: await challenge(verifier),
    code_challenge_method: "S256",
    prompt: "login",
  }).toString()
  return url
}

// Identity comes from the userinfo endpoint, called with a token obtained over the
// confidential back channel, so the ID token never needs to be verified here.
export async function finishLogin(cookies: AstroCookies, url: URL) {
  const raw = cookies.get(FLOW)?.value
  cookies.delete(FLOW, { path: "/callback" })
  const flow = raw && (await unsign(raw))
  if (!flow) return null
  const { state, verifier, next } = JSON.parse(flow) as { state: string; verifier: string; next: string }
  const code = url.searchParams.get("code")
  if (!code || url.searchParams.get("state") !== state) return null

  const response = await fetch(new URL("/oidc/token", env.LOGTO_ENDPOINT), {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env.LOGTO_APP_ID}:${env.LOGTO_APP_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(url.origin),
      code_verifier: verifier,
    }),
  })
  if (!response.ok) return null
  const { access_token: accessToken } = await response.json<{ access_token: string }>()

  const me = await fetch(new URL("/oidc/me", env.LOGTO_ENDPOINT), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!me.ok) return null
  return { info: await me.json<UserInfo>(), accessToken, next }
}

export function logoutUrl(origin: string) {
  const url = new URL("/oidc/session/end", env.LOGTO_ENDPOINT)
  url.search = new URLSearchParams({ client_id: env.LOGTO_APP_ID, post_logout_redirect_uri: origin }).toString()
  return url
}
