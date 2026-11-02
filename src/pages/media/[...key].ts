import type { APIRoute } from "astro"
import { env } from "cloudflare:workers"

// Safari only plays video that answers byte-range requests.
export const GET: APIRoute = async ({ params, request }) => {
  const key = params.key!
  if (!key.startsWith("members/") && !key.startsWith("events/")) return new Response(null, { status: 404 })
  const object = await env.MEDIA.get(key, { range: request.headers, onlyIf: request.headers })
  if (!object) return new Response(null, { status: 404 })

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set("ETag", object.httpEtag)
  headers.set("Accept-Ranges", "bytes")
  headers.set("Cache-Control", `${key.startsWith("events/") ? "public" : "private"}, max-age=31536000, immutable`)
  if (!("body" in object)) return new Response(null, { status: 304, headers })

  const range = object.range as { offset?: number; length?: number } | undefined
  if (range && request.headers.has("Range")) {
    const offset = range.offset ?? 0
    const length = range.length ?? object.size - offset
    headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${object.size}`)
    headers.set("Content-Length", String(length))
    return new Response(object.body, { status: 206, headers })
  }
  headers.set("Content-Length", String(object.size))
  return new Response(object.body, { headers })
}
