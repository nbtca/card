import type { APIRoute } from "astro"

// Access guards this path, so reaching it means the visitor has just signed in.
export const GET: APIRoute = ({ url, redirect }) => {
  const next = url.searchParams.get("next") ?? "/"
  return redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/")
}
