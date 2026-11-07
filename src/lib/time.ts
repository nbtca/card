// Pure date formatting, shared by the server and by scripts in the browser.
export const ZONE = "Asia/Shanghai"

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: ZONE })

export const formatShort = (iso: string) =>
  new Date(iso).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: ZONE })

export const formatClock = (iso: string) =>
  new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: ZONE })

export const sameDay = (a: string, b: string) =>
  new Date(a).toLocaleDateString("zh-CN", { timeZone: ZONE }) === new Date(b).toLocaleDateString("zh-CN", { timeZone: ZONE })

export const formatRange = (from: string, until: string) =>
  sameDay(from, until) ? `${formatTime(from)}–${formatClock(until)}` : `${formatTime(from)} 至 ${formatTime(until)}`

const year = (iso: string) => new Date(iso).toLocaleString("en-US", { year: "numeric", timeZone: ZONE })

// Month and day with the time, and the year too once it is not this one.
export const formatWhen = (iso: string) => {
  const y = year(iso)
  return y === year(new Date().toISOString()) ? formatShort(iso) : `${y}/${formatShort(iso)}`
}

export const formatDot = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONE }).replaceAll("-", ".")
