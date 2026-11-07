// Repair tickets live in Saturday, the repair service's API. Its server is in mainland China and cannot be
// reached from Cloudflare's overseas data centres, so visitors' browsers fetch it; Saturday allows this origin.
const SATURDAY = "https://api.nbtca.space/v2"
const PAGE = 100

type Action = "create" | "accept" | "drop" | "commit" | "alterCommit" | "reject" | "close" | "cancel" | "update"

interface Ticket {
  eventId: number
  model: string
  problem: string
  status: "open" | "accepted" | "committed" | "closed" | "cancelled"
  member: { memberId: string; alias: string; avatar: string } | null
  logs: { action: Action; gmtCreate: string }[] | null
  gmtCreate: string
}

export interface Repair {
  id: number
  model: string
  problem: string
  cancelled: boolean
  done: boolean
  repairer: { alias: string; avatar: string | null } | null
  steps: { label: string; at: string | null; done: boolean }[]
}

export const STEPS = [
  { label: "提交", action: "create", status: "open" },
  { label: "接单", action: "accept", status: "accepted" },
  { label: "修好", action: "commit", status: "committed" },
  { label: "完成", action: "close", status: "closed" },
] as const

const get = async <T>(path: string): Promise<T | null> => {
  const response = await fetch(`${SATURDAY}${path}`, { signal: AbortSignal.timeout(8000) })
  // Saturday answers an unknown id with 422.
  if (response.status === 404 || response.status === 422) return null
  if (!response.ok) throw new Error(`Saturday answered ${response.status}`)
  return response.json()
}

export async function fetchRepair(id: number) {
  const t = await get<Ticket>(`/events/${id}`)
  return t && toRepair(t)
}

export async function fetchRepairsBetween(from: string, until: string) {
  const [start, end] = [Date.parse(from), Date.parse(until)]
  const found: Repair[] = []
  for (let offset = 0; ; offset += PAGE) {
    const page = (await get<Ticket[]>(`/events?order=desc&limit=${PAGE}&offset=${offset}`)) ?? []
    for (const t of page) {
      const at = Date.parse(t.gmtCreate)
      if (at >= start && at <= end) found.push(toRepair(t))
    }
    if (page.length < PAGE || Date.parse(page.at(-1)!.gmtCreate) < start) return found
  }
}

// Saturday knows members by student ID; both sides take the alias from the member's NBTCA account username.
export async function fetchMemberRepairs(alias: string) {
  const key = alias.trim().toLowerCase()
  const member = key && (await get<{ memberId: string; alias: string }[]>("/members?offset=0&limit=500"))?.find((m) => m.alias.trim().toLowerCase() === key)
  if (!member) return null
  const found: Ticket[] = []
  for (let offset = 0; ; offset += PAGE) {
    const page = (await get<Ticket[]>(`/events?memberId=${member.memberId}&order=desc&limit=${PAGE}&offset=${offset}`)) ?? []
    // A Saturday without the member filter answers with everyone's tickets, which must not be counted as this member's.
    if (page.some((t) => t.member?.memberId !== member.memberId)) return null
    found.push(...page)
    if (page.length < PAGE) return found.map(toRepair)
  }
}

function toRepair(t: Ticket): Repair {
  // A ticket can be dropped and taken again, so the latest log of each kind is the one that counts.
  const last = (action: Action) => t.logs?.findLast((l) => l.action === action)?.gmtCreate ?? null
  const reached = STEPS.findIndex((s) => s.status === t.status)
  const alias = t.member?.alias.trim()
  return {
    id: t.eventId,
    model: t.model.trim(),
    problem: t.problem.trim(),
    cancelled: t.status === "cancelled",
    done: t.status === "closed",
    repairer: alias && t.status !== "open" ? { alias, avatar: t.member!.avatar.startsWith("https://") ? t.member!.avatar : null } : null,
    steps: STEPS.map((s, i) => {
      const at = i === 0 ? t.gmtCreate : last(s.action)
      return { label: s.label, at: at && new Date(at).toISOString(), done: reached >= i || (t.status === "cancelled" && !!at) }
    }),
  }
}
