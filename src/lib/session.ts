import type { AstroCookies } from "astro"
import { env } from "cloudflare:workers"

export interface User {
  sub: string
  name: string
  member: string | null
  admin: boolean
  exp: number
}

const COOKIE = "card_session"
const MAX_AGE = 60 * 60 * 24 * 7
const encoder = new TextEncoder()

export const base64url = (bytes: Uint8Array) => bytes.toBase64({ alphabet: "base64url", omitPadding: true })

const key = () =>
  crypto.subtle.importKey("raw", encoder.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ])

export async function sign(value: string) {
  const signature = await crypto.subtle.sign("HMAC", await key(), encoder.encode(value))
  return `${value}.${base64url(new Uint8Array(signature))}`
}

export async function unsign(token: string) {
  const dot = token.lastIndexOf(".")
  if (dot < 0) return null
  const value = token.slice(0, dot)
  const signature = Uint8Array.fromBase64(token.slice(dot + 1), { alphabet: "base64url" })
  const valid = await crypto.subtle.verify("HMAC", await key(), signature, encoder.encode(value))
  return valid ? value : null
}

export async function readSession(cookies: AstroCookies): Promise<User | null> {
  const token = cookies.get(COOKIE)?.value
  if (!token) return null
  try {
    const value = await unsign(token)
    if (!value) return null
    const user: User = JSON.parse(new TextDecoder().decode(Uint8Array.fromBase64(value, { alphabet: "base64url" })))
    return user.exp > Date.now() / 1000 ? user : null
  } catch {
    return null
  }
}

export async function writeSession(cookies: AstroCookies, user: Omit<User, "exp">) {
  const payload = base64url(encoder.encode(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + MAX_AGE })))
  cookies.set(COOKIE, await sign(payload), {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: MAX_AGE,
  })
}

export const clearSession = (cookies: AstroCookies) => cookies.delete(COOKIE, { path: "/" })

export const randomId = (bytes = 16) => base64url(crypto.getRandomValues(new Uint8Array(bytes)))
