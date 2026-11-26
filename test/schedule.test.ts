import assert from "node:assert/strict"
import { test } from "node:test"
import { DAY, HOUR, closesAt, formatLength, formatWallDay, matchCloses, matchOpens, opensAt, parseWall, scheduleError } from "../src/lib/schedule.ts"

const start = parseWall("2026-11-28T09:00")
const end = parseWall("2026-11-28T17:00")

test("presets round-trip so a saved event shows its preset again", () => {
  assert.equal(matchOpens(opensAt(2, start), start), 2)
  assert.equal(matchCloses(closesAt(1, start, end), start, end), 1)
  assert.equal(matchCloses(end, start, end), 3)
  assert.equal(matchOpens(start - 2 * DAY - HOUR, start), -1)
})

test("formats days and lengths the way people say them", () => {
  assert.equal(formatWallDay(start, 2026), "11月28日 周六")
  assert.equal(formatWallDay(start, 2025), "2026年11月28日 周六")
  assert.equal(formatLength(end - start), "8\u00a0小时")
  assert.equal(formatLength(DAY + 90 * 6e4), "1\u00a0天 1\u00a0小时 30\u00a0分钟")
})

test("orders the four times", () => {
  assert.equal(scheduleError(start - DAY, start, start, end), null)
  assert.match(scheduleError(start - DAY, start, end, start)!, /结束/)
  assert.match(scheduleError(start, start - DAY, start, end)!, /停止领取/)
  assert.match(scheduleError(start - DAY, end + HOUR, start, end)!, /截止/)
  assert.match(scheduleError(Number.NaN, start, start, end)!, /都要填/)
})
