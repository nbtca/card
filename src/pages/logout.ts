import type { APIRoute } from "astro"
import { accessToken } from "../lib/access"

const LOGTO_END_SESSION = "https://auth.app.nbtca.space/oidc/session/end"
// The Logto application Access signs in with; the return URL must be registered on it.
const ACCESS_CLIENT_ID = "xw0otkfer5gaypstjnla4"

// Access logout leaves the Logto session alive, so the next sign-in would silently reuse the same account.
export const GET: APIRoute = ({ request, url, redirect }) => {
  if (accessToken(request)) return redirect(`/cdn-cgi/access/logout?returnTo=${encodeURIComponent(`${url.origin}/logout`)}`)
  const end = new URL(LOGTO_END_SESSION)
  end.search = new URLSearchParams({ client_id: ACCESS_CLIENT_ID, post_logout_redirect_uri: `${url.origin}/` }).toString()
  return redirect(end.href)
}
