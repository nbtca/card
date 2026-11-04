// Details collected for events whose attendance counts toward course credit.
export interface Attendee {
  name: string
  studentId: string
  className: string
  phone: string
}

const KINDS: Record<string, string> = { "2": "研究生", "3": "本科生" }

// A NingboTech student ID is kind (2 graduate, 3 undergraduate), entry year, four-digit major, three-digit number:
// 3 18 0519 056. This only rules out typos and made-up numbers; it cannot prove an ID belongs to the person.
export function checkStudentId(id: string, now = new Date()) {
  const m = /^([23])(\d{2})(\d{4})(\d{3})$/.exec(id)
  if (!m) return "学号是 10 位数字，本科生以 3 开头，研究生以 2 开头。"
  const [, kind, yy, major, seq] = m as unknown as [string, string, string, string, string]
  const year = 2000 + Number(yy)
  const thisYear = now.getFullYear()
  if (year > thisYear || year < thisYear - (kind === "3" ? 8 : 10)) return `学号里的入学年份 ${year} 不对，请检查一下。`
  if (major === "0000" || seq === "000") return "这个学号不像真实的学号，请检查一下。"
  return null
}

export const describeStudentId = (id: string) => `${KINDS[id[0]!] ?? ""} ${2000 + Number(id.slice(1, 3))} 级`.trim()

export function parseAttendee(form: FormData): Attendee | string {
  const text = (name: string) => String(form.get(name) ?? "").replace(/\s+/g, " ").trim()
  const attendee = {
    name: text("name"),
    studentId: text("student_id").replace(/\s/g, ""),
    className: text("class_name"),
    phone: text("phone").replace(/[\s-]/g, ""),
  }
  if (!/^[\p{Script=Han}A-Za-z·• ]{2,20}$/u.test(attendee.name)) return "姓名要写 2 到 20 个汉字或字母。"
  const idError = checkStudentId(attendee.studentId)
  if (idError) return idError
  if (attendee.className.length < 2 || attendee.className.length > 20) return "班级要写 2 到 20 个字，比如「计算机 2101」。"
  if (!/^1[3-9]\d{9}$/.test(attendee.phone)) return "手机号是 11 位，以 13 到 19 开头。"
  return attendee
}

export const maskPhone = (phone: string) => `${phone.slice(0, 3)}****${phone.slice(-4)}`

// Spreadsheet apps run cells starting with these as formulas; the leading apostrophe keeps them text.
const safe = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value)
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`
// ="…" keeps Excel from showing long digit strings in scientific notation or dropping leading zeros.
const digits = (value: string) => `="${value}"`

export function toCsv(header: string[], rows: { text: string[]; numbers: number[] }[]) {
  const lines = [header.map(quote).join(",")]
  for (const { text, numbers } of rows) {
    lines.push(text.map((v, i) => (numbers.includes(i) && /^\d+$/.test(v) ? digits(v) : quote(safe(v)))).join(","))
  }
  return `﻿${lines.join("\r\n")}\r\n`
}
