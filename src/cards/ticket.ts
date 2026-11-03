import { tear } from "../lib/sound"

const POLL = 4000

for (const ticket of document.querySelectorAll<HTMLElement>("[data-ticket]")) {
  const card = ticket.closest<HTMLElement>(".pass-card")!
  const id = ticket.dataset.ticket!
  const phase = ticket.dataset.checkIn

  // The code is only sent once check-in opens, so the page reloads itself at that moment.
  const opens = Date.parse(ticket.dataset.opens!) - Date.now()
  if (phase === "early" && opens < 864e5) setTimeout(() => location.reload(), Math.max(0, opens) + 500)

  if (phase !== "open") continue

  const torn = (at: number) => {
    ticket.dataset.tearing = ""
    tear()
    const stamp = card.querySelector<HTMLElement>("[data-stamp]")!
    stamp.querySelector("[data-stamp-time]")!.textContent = new Date(at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    setTimeout(() => {
      card.dataset.torn = ""
      card.dataset.state = "redeemed"
      stamp.hidden = false
      ticket.remove()
      card.dispatchEvent(new CustomEvent("pass:redeemed", { bubbles: true, detail: { at } }))
    }, 700)
  }

  // Polls only while the page is visible; staff scanning the code is what flips it.
  let timer = 0
  const check = async () => {
    timer = 0
    if (document.visibilityState !== "visible") return
    try {
      const response = await fetch(`/api/pass?id=${encodeURIComponent(id)}`, { cache: "no-store" })
      const { redeemedAt } = (await response.json()) as { redeemedAt: number | null }
      if (redeemedAt) return torn(redeemedAt)
    } catch {}
    timer = window.setTimeout(check, POLL)
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !timer && ticket.isConnected) check()
  })
  timer = window.setTimeout(check, POLL)
}
