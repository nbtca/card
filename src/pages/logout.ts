import type { APIRoute } from "astro"

export const GET: APIRoute = ({ redirect }) => redirect("/cdn-cgi/access/logout")
