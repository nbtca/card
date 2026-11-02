import type { APIRoute } from "astro"
import { finishLogin } from "../lib/logto"
import { syncMember } from "../lib/saturday"
import { writeSession } from "../lib/session"

export const GET: APIRoute = async ({ cookies, url, redirect }) => {
  const result = await finishLogin(cookies, url)
  if (!result) return redirect("/login")
  const { info, accessToken, next } = result
  const member = await syncMember(accessToken, info.sub)
  await writeSession(cookies, {
    sub: info.sub,
    name: member?.name || info.name || info.username || info.email || "同学",
    member: member?.memberId ?? null,
    admin: member?.role === "admin",
  })
  return redirect(next)
}
