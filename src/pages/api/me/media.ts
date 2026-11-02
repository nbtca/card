import type { APIRoute } from "astro"
import { env } from "cloudflare:workers"
import { db, getMember, randomId } from "../../../lib/db"

const KINDS = ["portrait", "background"] as const
const MAX_BYTES = 4 * 1024 * 1024

function imageType(bytes: Uint8Array) {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end))
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp"
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png"
}

async function target(url: URL, locals: App.Locals) {
  const kind = url.searchParams.get("kind") as (typeof KINDS)[number]
  if (!KINDS.includes(kind)) return null
  const member = (await getMember(locals.user!.member!.id))!
  return { kind, member, old: member[kind] }
}

export const PUT: APIRoute = async ({ request, url, locals }) => {
  const t = await target(url, locals)
  if (!t) return new Response("unknown kind", { status: 400 })
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength > MAX_BYTES) return new Response("图片太大", { status: 413 })
  const type = imageType(bytes)
  if (!type) return new Response("只支持 WebP 或 PNG", { status: 415 })

  const key = `members/${t.member.id}/${t.kind}-${randomId(8)}.${type.split("/")[1]}`
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: type } })
  await db().prepare(`UPDATE members SET ${t.kind} = ? WHERE id = ?`).bind(key, t.member.id).run()
  if (t.old) await env.MEDIA.delete(t.old)
  return Response.json({ key })
}

export const DELETE: APIRoute = async ({ url, locals }) => {
  const t = await target(url, locals)
  if (!t) return new Response("unknown kind", { status: 400 })
  await db().prepare(`UPDATE members SET ${t.kind} = NULL WHERE id = ?`).bind(t.member.id).run()
  if (t.old) await env.MEDIA.delete(t.old)
  return new Response(null, { status: 204 })
}
