import { tear } from "../lib/sound"

// Staff usually scan within moments of the peel, so checks start quick and slow down while nobody scans.
const FIRST_POLL = 2500
const LAST_POLL = 15000

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
    setTimeout(() => {
      card.dataset.torn = ""
      card.dataset.state = "redeemed"
      stamp.hidden = false
      ticket.remove()
      card.dispatchEvent(new CustomEvent("pass:redeemed", { bubbles: true, detail: { at } }))
    }, 700)
  }

  // Only a peeled sticker shows the code, so until then nobody can scan it and there is nothing to ask.
  let timer = 0
  let polling = false
  let wait = FIRST_POLL
  const check = async () => {
    timer = 0
    if (document.visibilityState !== "visible" || !ticket.isConnected) return
    try {
      const response = await fetch(`/api/pass?id=${encodeURIComponent(id)}`, { cache: "no-store" })
      const { redeemedAt } = (await response.json()) as { redeemedAt: number | null }
      if (redeemedAt) return torn(redeemedAt)
    } catch {}
    if (!polling) return
    timer = window.setTimeout(check, wait)
    wait = Math.min(LAST_POLL, wait * 1.3)
  }
  const start = () => {
    polling = true
    if (!timer) timer = window.setTimeout(check, wait)
  }
  // Checked once on return too: the pass may have been scanned from another device.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !timer && ticket.isConnected) check()
  })
  if (ticket.querySelector("[data-revealed]")) start()
  else ticket.addEventListener("pass:revealed", start, { once: true })
}
