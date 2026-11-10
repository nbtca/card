import assert from "node:assert/strict"
import { test } from "node:test"
import { formatDot, formatRange, formatSerial, sameDay, yearOf } from "../src/lib/format.ts"

test("reads dates in Shanghai time whatever the machine's zone", () => {
  assert.equal(formatDot("2026-11-09T16:30:00Z"), "2026.11.10")
  assert.equal(yearOf("2026-12-31T16:00:00Z"), "2027")
  assert.equal(sameDay("2026-11-09T16:00:00Z", "2026-11-10T15:59:00Z"), true)
  assert.equal(sameDay("2026-11-09T15:59:00Z", "2026-11-09T16:00:00Z"), false)
})

test("shows only the end time when a range stays within one day", () => {
  assert.doesNotMatch(formatRange("2026-11-10T06:00:00Z", "2026-11-10T08:00:00Z"), /至/)
  assert.match(formatRange("2026-11-10T06:00:00Z", "2026-11-11T08:00:00Z"), /至/)
})

test("pads serials to four digits", () => {
  assert.equal(formatSerial(7), "№ 0007")
  assert.equal(formatSerial(12345), "№ 12345")
})
