export const ZONE = "Asia/Shanghai"

type When = string | number | Date

export const formatTime = (at: When) =>
  new Date(at).toLocaleString("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: ZONE })

export const formatShort = (iso: string) =>
  new Date(iso).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: ZONE })

export const formatClock = (at: When) =>
  new Date(at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: ZONE })

export const formatDay = (at: When) => new Date(at).toLocaleDateString("zh-CN", { month: "long", day: "numeric", timeZone: ZONE })

export const sameDay = (a: string, b: string) =>
  new Date(a).toLocaleDateString("zh-CN", { timeZone: ZONE }) === new Date(b).toLocaleDateString("zh-CN", { timeZone: ZONE })

export const formatRange = (from: string, until: string) =>
  sameDay(from, until) ? `${formatTime(from)}–${formatClock(until)}` : `${formatTime(from)} 至 ${formatTime(until)}`

export const yearOf = (at: When) => new Date(at).toLocaleString("en-US", { year: "numeric", timeZone: ZONE })

export const formatWhen = (iso: string) => {
  const y = yearOf(iso)
  return y === yearOf(new Date()) ? formatShort(iso) : `${y}/${formatShort(iso)}`
}

export const formatDot = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: ZONE }).replaceAll("-", ".")

export const padSerial = (n: number) => String(n).padStart(4, "0")

export const formatSerial = (n: number) => `№ ${padSerial(n)}`
