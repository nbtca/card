import { env } from "cloudflare:workers"

interface SaturdayMember {
  memberId: string
  logtoId: string
  alias: string
  name: string
  section: string
  role: string
  avatar: string
  githubId: string
  gmtCreate: string
}

// Saturday maps a Logto access token to the member bound to that account and
// refuses anyone without a member role, so a 200 here is proof of membership.
export async function syncMember(accessToken: string, logtoId: string) {
  const response = await fetch(new URL("/member", env.SATURDAY_API), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) return null
  const m = await response.json<SaturdayMember>()
  if (m.logtoId && m.logtoId !== logtoId) return null
  await env.DB.prepare(
    `INSERT INTO members (member_id, logto_id, name, alias, section, role, github, avatar, joined, synced_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
     ON CONFLICT (member_id) DO UPDATE SET
       logto_id = ?2, name = ?3, alias = ?4, section = ?5, role = ?6, github = ?7, avatar = ?8, synced_at = ?10`,
  )
    .bind(
      m.memberId,
      logtoId,
      m.name || m.alias,
      m.alias || m.name,
      m.section ?? "",
      m.role,
      m.githubId || null,
      m.avatar || null,
      new Date(m.gmtCreate).getFullYear() || new Date().getFullYear(),
      Date.now(),
    )
    .run()
  return m
}
