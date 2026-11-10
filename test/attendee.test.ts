import assert from "node:assert/strict"
import { test } from "node:test"
import { checkStudentId, describeStudentId, maskPhone, parseAttendee, toCsv } from "../src/lib/attendee.ts"

const now = new Date("2026-11-10T00:00:00+08:00")

test("accepts undergraduate and graduate IDs from plausible years", () => {
  assert.equal(checkStudentId("3180519056", now), null)
  assert.equal(checkStudentId("2240519056", now), null)
})

test("rejects IDs with the wrong shape", () => {
  for (const id of ["", "1180519056", "318051905", "31805190567", "318051905a"]) assert.match(checkStudentId(id, now)!, /10 位数字/)
})

test("rejects entry years in the future or too far back", () => {
  assert.match(checkStudentId("3270519056", now)!, /2027/)
  assert.match(checkStudentId("3170519056", now)!, /2017/)
  assert.equal(checkStudentId("3180519056", now), null)
  assert.equal(checkStudentId("2160519056", now), null)
  assert.match(checkStudentId("2150519056", now)!, /2015/)
})

test("rejects all-zero majors and serials", () => {
  assert.match(checkStudentId("3180000056", now)!, /不像真实/)
  assert.match(checkStudentId("3180519000", now)!, /不像真实/)
})

test("describes the kind and cohort", () => {
  assert.equal(describeStudentId("3180519056"), "本科生 2018 级")
  assert.equal(describeStudentId("2240519056"), "研究生 2024 级")
})

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}
const valid = { name: "张 三", student_id: "3 24 0519 056", class_name: "计算机  2401", phone: "138-0013-8000" }

test("normalises spacing in a valid attendee", () => {
  assert.deepEqual(parseAttendee(form(valid)), {
    name: "张 三",
    studentId: "3240519056",
    className: "计算机 2401",
    phone: "13800138000",
  })
})

test("names the first invalid field", () => {
  assert.match(parseAttendee(form({ ...valid, name: "张" })) as string, /姓名/)
  assert.match(parseAttendee(form({ ...valid, name: "Robert'); DROP" })) as string, /姓名/)
  assert.match(parseAttendee(form({ ...valid, student_id: "123" })) as string, /学号/)
  assert.match(parseAttendee(form({ ...valid, class_name: "计" })) as string, /班级/)
  assert.match(parseAttendee(form({ ...valid, phone: "12800138000" })) as string, /手机号/)
})

test("masks the middle of a phone number", () => {
  assert.equal(maskPhone("13800138000"), "138****8000")
})

test("writes CSV that Excel opens without formulas or lost digits", () => {
  const csv = toCsv(["姓名", "学号"], [
    { text: ['=HYPERLINK("x")', "0123456789"], numbers: [1] },
    { text: ["a,b", "not digits"], numbers: [1] },
  ])
  assert.ok(csv.startsWith("﻿"))
  assert.equal(
    csv.slice(1),
    '"姓名","学号"\r\n' + `"'=HYPERLINK(""x"")",="0123456789"\r\n` + '"a,b","not digits"\r\n',
  )
})
