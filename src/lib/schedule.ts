// Times here are Beijing wall-clock strings ("2026-11-28T09:00") held as UTC milliseconds,
// which is safe because Asia/Shanghai has no daylight saving.
export const HOUR = 36e5
export const DAY = 24 * HOUR
export const SHANGHAI = 8 * HOUR

export const parseWall = (wall: string) => Date.parse(`${wall}:00Z`)
export const toWall = (ms: number) => new Date(ms).toISOString().slice(0, 16)

export const opensPresets = [
  ["提前一天", DAY],
  ["提前三天", 3 * DAY],
  ["提前一周", 7 * DAY],
  ["提前两周", 14 * DAY],
] as const

export const closesPresets = [
  ["开场前一天", "start", DAY],
  ["开场前一小时", "start", HOUR],
  ["开场时", "start", 0],
  ["活动结束时", "end", 0],
] as const

export const opensAt = (preset: number, start: number) => start - opensPresets[preset]![1]

export const closesAt = (preset: number, start: number, end: number) => {
  const [, from, before] = closesPresets[preset]!
  return (from === "start" ? start : end) - before
}

export const matchOpens = (at: number, start: number) => opensPresets.findIndex((_, i) => opensAt(i, start) === at)

export const matchCloses = (at: number, start: number, end: number) =>
  closesPresets.findIndex((_, i) => closesAt(i, start, end) === at)

const WEEK = "日一二三四五六"

export const formatWallDay = (ms: number, thisYear: number) => {
  const d = new Date(ms)
  const year = d.getUTCFullYear() === thisYear ? "" : `${d.getUTCFullYear()}年`
  return `${year}${d.getUTCMonth() + 1}月${d.getUTCDate()}日 周${WEEK[d.getUTCDay()]}`
}

export const formatWallMoment = (ms: number, thisYear: number) => `${formatWallDay(ms, thisYear)} ${toWall(ms).slice(11)}`

export const formatLength = (ms: number) => {
  const days = Math.floor(ms / DAY)
  const hours = Math.floor((ms % DAY) / HOUR)
  const minutes = Math.round((ms % HOUR) / 6e4)
  return [days && `${days}\u00a0天`, hours && `${hours}\u00a0小时`, minutes && `${minutes}\u00a0分钟`].filter(Boolean).join(" ") || "0\u00a0分钟"
}

export const scheduleError = (opens: number, closes: number, start: number, end: number) =>
  [opens, closes, start, end].some(Number.isNaN)
    ? "四个时间都要填。"
    : end <= start
      ? "活动结束要晚于开始。"
      : closes <= opens
        ? "停止领取要晚于开放领取。"
        : closes > end
          ? "领取要在活动结束前截止。"
          : null

export const summarize = (opens: number, closes: number, start: number, end: number, thisYear: number) =>
  scheduleError(opens, closes, start, end) ??
  `${formatWallMoment(opens, thisYear)} 开放领取，${formatWallMoment(closes, thisYear)} 停止领取。活动共 ${formatLength(end - start)}，开场前一小时起可以核销。以上均为北京时间。`
