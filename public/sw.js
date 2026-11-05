// Keeps the pages a visitor has opened, so a pass still opens at a door with no signal.
const PAGES = "pages-v1"
const ASSETS = "assets-v1"
const PATIENCE = 5000
const KEEP_ASSETS = 120
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
  if (request.mode === "navigate") event.respondWith(page(event, request, url.pathname, !url.search))
  else if (STATIC.test(url.pathname)) event.respondWith(asset(request))
})

async function asset(request) {
  const cache = await caches.open(ASSETS)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  // Every deploy brings new hashed files; the oldest go once the cache holds more than a release or two.
  if (response.ok) {
    cache
      .put(request, response.clone())
      .then(() => cache.keys())
      .then((keys) => Promise.all(keys.slice(0, Math.max(0, keys.length - KEEP_ASSETS)).map((key) => cache.delete(key))))
  }
  return response
}

// The network answers when it can; the stored copy steps in when it fails, or stalls on a plain visit. A page
// reached with a query, such as the redirect after claiming a pass, must never show the copy from before.
async function page(event, request, key, patient) {
  const cache = await caches.open(PAGES)
  const network = fetch(request).then((response) => {
    // Redirects to sign-in come back opaque and are never stored.
    if (response.ok && response.type === "basic") event.waitUntil(cache.put(key, response.clone()))
    return response
  })
  try {
    if (!patient) return await network
    const stalled = new Promise((done) => setTimeout(done, PATIENCE)).then(() => cache.match(key))
    return await Promise.race([network, stalled.then((hit) => hit ?? network)])
  } catch {
    return (await cache.match(key)) ?? Response.error()
  }
}
