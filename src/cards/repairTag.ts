import { formatDot, formatSerial } from "../lib/format"
import type { Repair } from "../lib/repair"

const HOLES = [17.75, 39.25, 60.75, 82.25]

const on = (el: HTMLElement, key: string, value: boolean) => (value ? (el.dataset[key] = "") : delete el.dataset[key])

export const repairState = (r: Repair) =>
  r.cancelled ? "已取消" : ["等待接单", "维修中", "已修好", "已完成"][r.steps.findLastIndex((s) => s.done)]!

// Many tickets have no model, so the first clause of the problem stands in for it.
export const repairHeadline = (r: Repair) => r.model || r.problem.split(/[，。,.;；!！?？\n]/)[0]!.trim() || "未填写机型"

// Copies of one tag share the stamps' arc ids, and textPath follows the first id in the document, even a hidden one.
function ownArcs(tag: HTMLElement, id: number) {
  tag.querySelectorAll<HTMLElement>("[data-stamp]").forEach((stamp, k) => {
    for (const path of stamp.querySelectorAll<SVGPathElement>("path[id]")) {
      const own = `${path.id.replace(/-r\d+-\d+$/, "")}-r${id}-${k}`
      stamp.querySelector(`textPath[href="#${path.id}"]`)?.setAttribute("href", `#${own}`)
      path.id = own
    }
  })
}

export function fillRepairTag(tag: HTMLElement, r: Repair) {
  const serial = formatSerial(r.id)
  tag.style.setProperty("--digits", String(String(r.id).length))
  tag.querySelector("[data-number]")!.textContent = String(r.id)
  tag.querySelector("[data-serial]")!.textContent = serial
  tag.querySelector("article")!.setAttribute("aria-label", `维修单 ${serial}`)
  tag.querySelector("[data-model]")!.textContent = repairHeadline(r)
  tag.querySelector("[data-problem]")!.textContent = r.model ? r.problem : ""

  const holes = r.steps.flatMap((s, i) => (s.done ? [`radial-gradient(circle at ${HOLES[i]}cqi 92cqi, #0000 2.1cqi, #000 2.3cqi)`] : []))
  tag.style.setProperty("--holes", holes.join(", "))
  tag.querySelectorAll<HTMLElement>("[data-step]").forEach((li, i) => on(li, "done", r.steps[i]!.done))

  const repairer = tag.querySelector<HTMLElement>("[data-repairer]")!
  if (r.repairer) {
    repairer.querySelector("b")!.textContent = r.repairer.alias
    repairer.querySelector(".initial")!.textContent = [...r.repairer.alias][0]!
    const avatar = repairer.querySelector("img")!
    if (r.repairer.avatar && avatar.getAttribute("src") !== r.repairer.avatar) {
      avatar.onload = () => (avatar.hidden = false)
      avatar.src = r.repairer.avatar
    }
  }
  repairer.hidden = !r.repairer

  on(tag, "torn", r.done)
  tag.querySelector("[data-stub-note]")!.textContent = r.cancelled ? "已取消" : "完成时撕下"
  ownArcs(tag, r.id)
  const kind = r.done ? "done" : r.cancelled ? "cancelled" : null
  const last = r.steps.findLast((s) => s.at)?.at
  for (const stamp of tag.querySelectorAll<HTMLElement>("[data-stamp]")) {
    stamp.hidden = stamp.dataset.stamp !== kind
    // The same turn on the rail and on the ticket page keeps the stamp still while the tag moves between them.
    stamp.querySelector("svg")!.style.setProperty("--turn", `${((r.id * 37) % 31) - 15}deg`)
    if (last) stamp.querySelector("[data-stamp-date]")!.textContent = `NBTCA · ${formatDot(last)}`
  }
}
