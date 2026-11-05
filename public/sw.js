// Keeps the pages a visitor has opened, so a pass still opens at a door with no signal.
const PAGES = "pages-v1"
const ASSETS = "assets-v1"
const PATIENCE = 3500
const PASS_THROUGH = /^\/(api|login|cdn-cgi|media\/members)(\/|$)/
const STATIC = /^\/(_astro|fonts)\/|^\/logo\.svg$/

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()))

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== "GET" || url.origin !== location.origin || PASS_THROUGH.test(url.pathname)) return
  // Someone else may sign in on this phone next.
  if (url.pathname === "/logout") return event.waitUntil(caches.delete(PAGES))
  if (request.mode === "navigate") event.respondWith(page(event, request, url.pathname))
  else if (STATIC.test(url.pathname)) event.respondWith(asset(request))
})

async function asset(request) {
  const cache = await caches.open(ASSETS)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

// The network answers when it can; the stored copy steps in when it fails or stalls.
async function page(event, request, key) {
  const cache = await caches.open(PAGES)
  const network = fetch(request).then((response) => {
    // Redirects to sign-in come back opaque and are never stored.
    if (response.ok && response.type === "basic") event.waitUntil(cache.put(key, response.clone()))
    return response
  })
  const stalled = new Promise((done) => setTimeout(done, PATIENCE)).then(() => cache.match(key))
  try {
    return await Promise.race([network, stalled.then((hit) => hit ?? network)])
  } catch {
    return (await cache.match(key)) ?? Response.error()
  }
}
