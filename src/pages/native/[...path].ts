import type { APIRoute } from "astro"
// Native requests are verified and rewritten by middleware before reaching this fallback.
export const ALL: APIRoute = () => new Response(null, { status: 404 })
