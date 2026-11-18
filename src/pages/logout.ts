import type { APIRoute } from "astro"
import { accessToken } from "../lib/access"

// Access logout leaves the Logto session alive, so the next sign-in would silently reuse the same account.
export const GET: APIRoute = ({ request, url, redirect }) =>
  accessToken(request)
    ? redirect(`/cdn-cgi/access/logout?returnTo=${encodeURIComponent(`${url.origin}/logout`)}`)
    : redirect("https://auth.app.nbtca.space/oidc/session/end")
