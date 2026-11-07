import { waitUntil } from "cloudflare:workers"

// Each data centre keeps its own copy and a purge reaches only the local one, so pages live briefly.
const PAGE_TTL = 60
const FOREVER = "max-age=31536000, immutable"

const edge = () => caches.open("card")

const pageKey = (url: URL, path = url.pathname) => new Request(new URL(path, url.origin))

function withCacheControl(response: Response, value: string) {
  const copy = new Response(response.body, response)
  copy.headers.set("Cache-Control", value)
  return copy
}

// The copy is taken before any await, while the original body is still unread.
function store(key: Request | string, response: Response, value: string) {
  const copy = withCacheControl(response.clone(), value)
  waitUntil(edge().then((cache) => cache.put(key, copy)))
}

// Browsers must not keep it, or a visitor who signs in would be shown the signed-out page.
export async function sharedPage(url: URL, render: () => Promise<Response>) {
  const hit = await (await edge()).match(pageKey(url))
  if (hit) return withCacheControl(hit, "private, no-cache")
  const response = await render()
  if (response.status !== 200 || !response.headers.get("Content-Type")?.startsWith("text/html")) return response
  store(pageKey(url), response, `public, max-age=${PAGE_TTL}`)
  return withCacheControl(response, "private, no-cache")
}

export const purgePages = (url: URL, paths: string[]) =>
  waitUntil(edge().then((cache) => Promise.all(paths.map((path) => cache.delete(pageKey(url, path))))))

// Media keys are never reused, so a stored copy never goes stale; members' media is reached only after the sign-in check.
export async function storedMedia(request: Request, load: () => Promise<Response>) {
  if (request.headers.has("Range") || request.headers.has("If-None-Match")) return load()
  const policy = `${new URL(request.url).pathname.startsWith("/media/events/") ? "public" : "private"}, ${FOREVER}`
  const hit = await (await edge()).match(request.url)
  if (hit) return withCacheControl(hit, policy)
  const response = await load()
  if (response.status === 200) store(request.url, response, `public, ${FOREVER}`)
  return response
}
