import type { Event, Member } from "./db"

// Workers freeze the clock outside a request, so these are built per request.
export const showcaseMember = (): Member => ({
  id: "",
  email: "",
  name: "你的名字",
  alias: "NBTCA",
  section: "计算机协会",
  role: "社员",
  joined: new Date().getFullYear(),
  github: null,
  word: null,
  motto: null,
  hue: 212,
  portrait: null,
  background: null,
  kept: 0,
})

export const showcaseEvent = (): Event => {
  const now = new Date().toISOString()
  return {
    slug: "",
    created_by: "",
    title: "理工维修日",
    word: "fix",
    design: "default",
    venue: "图书馆一楼大厅",
    summary: "",
    video: null,
    capacity: null,
    needs_info: 0,
    claim_from: now,
    claim_until: now,
    starts_at: now,
    ends_at: now,
    album: null,
  }
}
